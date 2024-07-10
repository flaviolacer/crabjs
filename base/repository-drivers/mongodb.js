const log = require('../log');
let cjs = require("../cjs");

const MongoDB = require('mongodb');
const Error = require("../error");
const Constants = require("../constants");

function mongoDB() {
    let instance = this;
    this.db = null;
    this.client = null;

    let default_options = {
        maxPoolSize: 10,
        wtimeoutMS: 2500,
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000
    };

    let convertFieldsToTypeDefinitions = (fields, definitions) => {
        let whereKeys = Object.keys(fields);
        for (let i = 0, j = whereKeys.length; i < j; i++)
            if (definitions.fields[whereKeys[i]]) {
                let fieldKey = whereKeys[i];
                if (!isEmpty(definitions.fields[whereKeys[i]].field) && definitions.fields[whereKeys[i]].field !== whereKeys[i]) {
                    fieldKey = definitions.fields[whereKeys[i]].field;
                    fields[fieldKey] = this.setType(fields[whereKeys[i]], definitions.fields[whereKeys[i]].type);
                    delete fields[whereKeys[i]];
                } else
                    fields[fieldKey] = this.setType(fields[fieldKey], definitions.fields[fieldKey].type);
            }
    }

    let translateFilter = (filter) => {
        if (isEmpty(filter))
            return null;
        let filterKeys = Object.keys(filter);
        for (let i = 0, j = filterKeys.length; i < j; i++) {
            let filterKey = filterKeys[i];
            let filterValue = filter[filterKey];
            if (filterKey.startsWith("__")) {
                switch (filterKey) {
                    case "__remove":
                        filter['$unset'] = {};
                        if (isString(filter["__remove"]))
                            filter['$unset'][filter["__remove"]] = "";
                        else if (isArray(filter["__remove"]))
                            for (let i = 0; i < filter["__remove"].length; i++)
                                filter['$unset'][filter["__remove"][i]] = ""

                        delete filter[filterKey];
                        break;
                }
            } else if (isString(filterValue) && filterValue.trim().startsWith("{")) { // possibli JSON
                try {
                    let filterValueParsed = JSON.parse(filterValue);
                    let fieldValueKeys = Object.keys(filterValueParsed);
                    for (var k = 0, l = fieldValueKeys.length; k < l; k++) {
                        let filterValueKey = fieldValueKeys[k];
                        if (filterValueKey.startsWith("__")) { // future in case need
                            switch (filterValueKey) {
                                case "__like":
                                case "__regex":
                                    filter[filterKey] = new RegExp(filterValueParsed[filterValueKey], "i");
                                    break;
                            }
                        }
                    }
                } catch (e) { // not a json object, so continue

                }
            }
        }
    };

    this.setType = (value, type) => {
        type = type || "";
        switch (type.toLowerCase().trim()) {
            case "int":
            case "integer":
                return !isNaN(value) ? value : new parseInt(value);
            case "float":
            case "double":
                return !isNaN(value) ? value : new parseFloat(value);
            case "objectid":
                try {
                    return new MongoDB.ObjectId(value);
                } catch (e) {
                    log.error(cjs.i18n.__("Error on converting ObjectId Field: '{{value}}'", {value: value}));
                    throw new Error(e);
                }
            case "password":
                if (isObject(value) && value.__plain)
                    return value.content;
                else
                    return encrypt_password(value);
            case "datetime":
            case "date":
                return (value === "now") ? new Date() : new Date(value);
            case "boolean":
                return !isBoolean(value) ? Boolean(value) : value;
            case "object":
            case "array":
                return isString(value) ? isObject(value) ? value.data : JSON.parse(value) : value;
            default:
                return value;
        }
    };

    this.getDb = async () => {
        if (isEmpty(this.__connectionInfo.default_collection)) {
            log.error(cjs.i18n.__("You have to specify the parameter \"default_collection\" on mongodb configuration."));
            return;
        }

        if (this.db != null && this.isConnected())
            return this.db;
        else {
            this.client = await this.getClient();
            if (this.client) this.db = this.client.db(this.__connectionInfo.default_collection);
        }

        return this.db;
    };

    this.getClient = async () => {
        if (isEmpty(this.__connectionInfo)) {
            log.error(cjs.i18n.__("Cannot connect to MongoDB. Missing configuration info."));
            return;
        }
        let client;
        if (!this.client || !this.client.isConnected) try {
            client = await this.connect(this.__connectionInfo);
        } catch (e) {
            log.error(e);
            return false;
        }
        return client;
    };

    this.connect = params => {
        return new Promise(function (resolve, reject) {
            if (!params.host) {
                reject(new Error("Host cannot be empty", 500, {}));
                return;
            }

            // default port connection
            params.port = params.port || 27017;
            let connUri = `mongodb://${params.host}:${params.port}`;

            // merge options
            params.options = params.options || {};
            extend(params.options, default_options);

            MongoDB.MongoClient.connect(connUri, params.options).then(
                function (client) {
                    // set collection
                    resolve(client);
                }
            ).catch(function (err) {
                reject(err);
            });
        });
    };

    this.find = (params) => {
        let filter = params.filter || {};
        let options = params.options || {};

        return new Promise(async (resolve, reject) => {
            let db = await this.getDb();
            if (!db) {
                log.error(cjs.i18n.__("Cannot get \"{{entityName}}\" entities", {entityName: params.entity}));
                reject(false);
                return;
            }

            // convert fields to types
            try {
                convertFieldsToTypeDefinitions(filter, params.definitions);
            } catch (e) {
                log.error(e.message);
                reject({
                    error_message: cjs.i18n.__("Undefined error on trying to convert type definitions of entity \"{{entityName}}\"", {entityName: params.entity}),
                    error_code: Constants.UNDEFINED_ERROR
                });
                return;
            }

            let pipeline = filter.$pipeline || [];
            delete filter.$pipeline;

            // check if $match already exists
            const found = pipeline.some(fi => !isEmpty(fi.$match));

            // translate filter functions
            translateFilter(filter);

            // filter - options
            if (!isEmpty(filter["__page"])) {
                options.page_number = parseInt(filter["__page"]);
                delete filter["__page"];
            }

            if (!found) pipeline.push({$match: filter});

            // create pipeline for count
            let pipeline_count = pipeline.clone();
            pipeline_count.push({"$count": "count"});

            // sort order
            if (options.sort) {
                let sortKeys = Object.keys(options.sort);
                for (let i = 0, j = sortKeys.length; i < j; i++)
                    options.sort[sortKeys[i]] = parseInt(options.sort[sortKeys[i]]);
                pipeline.push({$sort: options.sort});
                delete options.sort;
            }

            // pagination
            if (options.page_number && options.page_size) {
                pipeline.push({$skip: (options.page_number - 1) * options.page_size});
                pipeline.push({$limit: options.page_size});
            }

            let aggregate_options = {collation: {locale: "pt"}, allowDiskUse: true};

            let collectionName = params.definitions.entity.data.RepositoryName || params.entity;
            let res_cursor;
            let record_count_cursor;
            try {
                record_count_cursor = await (await instance.db.collection(collectionName).aggregate(pipeline_count, aggregate_options)).next();
                res_cursor = await instance.db.collection(collectionName).aggregate(pipeline, aggregate_options);
            } catch (e) {
                reject(e);
                return;
            }

            await res_cursor.toArray().then(async function (results) {
                log.info('info-aggregate-params:' + JSON.stringify(pipeline));
                //log.info("info-aggregate-" + collectionName, results);

                let returnContent = {
                    totalRecords: ((!isEmpty(record_count_cursor)) ? record_count_cursor.count : 0),
                    records: []
                };
                if (!isEmpty(results)) {
                    if (options.one)
                        resolve(results[0]);
                    else {
                        returnContent.records = results;
                        resolve(returnContent);
                    }
                }
                resolve(returnContent);
                return returnContent;
            }).catch(function (errTo) {
                reject(errTo);
                throw errTo;
            });
        });
    };

    this.findOne = async (options) => {
        let filter = options.filter || {};
        options = options || {};
        return new Promise(async (resolve, reject) => {
            let db = await this.getDb();
            if (!db) {
                log.error(cjs.i18n.__("Cannot get entity {{entityName}}", {entityName: options.entity}));
                return false;
            }

            //convert fields on filter for the right type
            // convert fields to types
            try {
                convertFieldsToTypeDefinitions(filter, options.definitions);
            } catch (e) {
                log.error(e.message);
                reject({
                    error: true,
                    error_message: cjs.i18n.__("Undefined error on trying to convert type definitions of entity \"{{entityName}}\"", {entityName: options.entity}),
                    error_code: Constants.UNDEFINED_ERROR
                });
                return false;
            }
            let collectionName = options.definitions.entity.data.RepositoryName || options.entity;
            try {
                await db.collection(collectionName).findOne(filter).then((obj) => {
                    resolve(obj);
                    return obj;
                });
            } catch (e) {
                log.error(e);
                reject(false);
                return false;
            }
        });
    };

    this.save = (options) => {
        let entity = options.entity;
        let fields = entity.__definitions.fields;

        // translate persist functions
        translateFilter(options.entity);

        // conditions on insert
        let filter = options.filter || {};
        return new Promise(async (resolve, reject) => {
            let db = await this.getDb();
            if (!db) {
                log.error(cjs.i18n.__("Cannot save entity {{entityName}}", {entityName: entity.entityName}));
                reject({
                    error: true,
                    error_message: cjs.i18n.__("Cannot save entity {{entityName}}", {entityName: entity.entityName}),
                    error_code: Constants.CONNECTION_ERROR
                });
                return;
            }
            if (isEmpty(filter)) { // check if there is primaryKey(s) set
                let Pks = entity.__definitions.primaryKeys;
                for (let i = 0, j = Pks.length; i < j; i++) {
                    let fieldRef = Pks[i].fname;
                    let fieldName = (isEmpty(Pks[i].data.field)) ? Pks[i].fname : Pks[i].data.field;
                    if (!isEmpty(entity[fieldRef]) || MongoDB.ObjectId.isValid(entity[fieldRef])) filter[fieldName] = this.setType(entity[fieldRef], fields[fieldRef].type);
                }
            }

            // prepare data to save
            let fieldsKeys = Object.keys(entity.__definitions.fields);
            let entityPersistInfo = {};
            let fieldDefaultValues = {};
            let specialFields = ['$unset'];
            fieldsKeys = fieldsKeys.concat(specialFields);
            for (let i = 0, j = fieldsKeys.length; i < j; i++) {
                let fieldRef = fieldsKeys[i];
                if (fieldRef.startsWith('$')) { // command field
                    if (!isEmpty(entity[fieldRef]))
                        entityPersistInfo[fieldRef] = entity[fieldRef];
                    continue;
                }
                let fieldName = (isEmpty(fields[fieldRef].field)) ? fieldRef : fields[fieldRef].field;
                if (typeof fields[fieldRef].required !== "undefined" && ((isEmpty(entity[fieldRef]) && isEmpty(filter)) || (!isEmpty(filter) && entity.hasOwnProperty(fieldRef) && isEmpty(entity[fieldRef])))) { // required fields
                    log.error(cjs.i18n.__("Required field \"{{fieldName}}\" was not set on entity \"{{entityName}}\"", {
                        fieldName: fieldName, entityName: entity.entityName
                    }));
                    reject({
                        error: true,
                        error_message: cjs.i18n.__("Required field \"{{fieldName}}\" was not set on entity \"{{entityName}}\"", {
                            fieldName: fieldName, entityName: entity.entityName
                        }),
                        error_code: Constants.REQUIRED_FIELD_ERROR
                    });
                    return;
                }

                try {
                    if (!isEmpty(entity[fieldRef]))
                        entityPersistInfo[fieldName] = this.setType(entity[fieldRef], fields[fieldRef].type);
                    else if (!isEmpty(fields[fieldRef].defaultValue) && isEmpty(filter))
                        fieldDefaultValues[fieldName] = this.setType(fields[fieldRef].defaultValue, fields[fieldRef].type);
                } catch (e) {
                    log.error(cjs.i18n.__("Cannot save entity {{entityName}}. Error set value on field {{fieldName}}.", {
                        entityName: entity.entityName,
                        fieldName: fieldRef
                    }));
                    reject({
                        error: true,
                        error_message: cjs.i18n.__("Cannot save entity {{entityName}}. Error set value on field {{fieldName}}.", {
                            entityName: entity.entityName,
                            fieldName: fieldRef
                        }),
                        error_code: Constants.FIELD_VALUE_ERROR
                    });
                    return;
                }
            }

            if (isEmpty(entityPersistInfo)) {
                log.error(cjs.i18n.__("No infomation sent to save entity \"{{entityName}}\"", {entityName: entity.entityName}));
                reject({
                    error: true,
                    error_message: cjs.i18n.__("No infomation sent to save entity \"{{entityName}}\"", {entityName: entity.entityName}),
                    error_code: Constants.EMPTY_CONTENT_ERROR
                })
                return;
            }

            // insert default values for empty fields
            let defaultFieldKeys = Object.keys(fieldDefaultValues);
            for (let i = 0, j = defaultFieldKeys.length; i < j; i++)
                entityPersistInfo[defaultFieldKeys[i]] = fieldDefaultValues[defaultFieldKeys[i]];

            let collectionName = entity.__definitions.entity.data.RepositoryName || entity.entityName;
            if (isEmpty(filter)) { // insert data
                if (isEmpty(entityPersistInfo)) {
                    reject({
                        error: true,
                        error_message: cjs.i18n.__("No infomation aquired from entity \"{{entityName}}\"", {entityName: entity.entityName}),
                        error_code: Constants.UNDEFINED_ERROR
                    });
                    return;
                }
                // insert data
                await db.collection(collectionName).insertOne(entityPersistInfo, {
                    writeConcern: {
                        w: 1, j: true
                    }
                }).then((obj) => {
                    // for best practices with mongodb, set _id for the document
                    entity._id = obj.insertedId;
                    resolve(entity);
                }).catch((e) => {
                    log.error(e);
                    let error_code = Constants.UNDEFINED_ERROR;
                    let error_message = cjs.i18n.__("Undefined error on trying to insert entity \"{{entityName}}\"", {entityName: entity.entityName});
                    if (e.code === 11000) {
                        error_code = Constants.DUPLICATE_KEY_ERROR;
                        error_message = cjs.i18n.__("Duplicate key error on trying to insert entity \"{{entityName}}\"", {entityName: entity.entityName});
                    }

                    reject({
                        error: true,
                        error_message: error_message,
                        error_code: error_code,
                        error_entity: entity.entityName
                    });
                });
            } else { // update data
                try {
                    // convert field names
                    convertFieldsToTypeDefinitions(filter, entity.__definitions);
                } catch (e) {
                    log.error(e.message);
                    reject({
                        error: true,
                        error_message: cjs.i18n.__("Undefined error on trying to convert type definitions of entity \"{{entityName}}\"", {entityName: entity.entityName}),
                        error_code: Constants.UNDEFINED_ERROR
                    });
                }

                // persist data and return the modified
                let updateContent = {};
                if (!isEmpty(entityPersistInfo['$unset'])) {
                    updateContent['$unset'] = entityPersistInfo['$unset'];
                    delete entityPersistInfo['$unset'];
                }
                updateContent['$set'] = entityPersistInfo;
                if (filter.__update_multiple) {
                    delete filter.__update_multiple;
                    await db.collection(collectionName).updateMany(filter, updateContent, {
                        writeConcern: {
                            w: 1,
                            j: true
                        }
                    }).catch((e) => {
                        log.error(e);
                        reject({
                            error: true,
                            error_message: cjs.i18n.__("Undefined error on trying to update entity \"{{entityName}}\"", {entityName: entity.entityName}),
                            error_code: Constants.UNDEFINED_ERROR
                        });
                    }).then(() => {
                        resolve(entity);
                        return true;
                    });
                } else
                    try {
                        let ret = await db.collection(collectionName).findOneAndUpdate(filter, updateContent, {
                            upsert: true, returnNewDocument: true, returnDocument: 'after', writeConcern: {w: 1, j: 1}
                        });
                        resolve(ret);
                        return ret;
                    } catch (e) {
                        if (e.code === 66)
                            log.error(cjs.i18n.__("Error trying to save record on repository. Record id already exists?"));
                        else
                            log.error(e);
                        reject({
                            error: true,
                            error_message: cjs.i18n.__("Undefined error on trying to find and update entity \"{{entityName}}\"", {entityName: entity.entityName}),
                            error_code: Constants.UNDEFINED_ERROR
                        });
                    }
            }
        });
    };

    this.remove = (options) => {
        let entity = options.entity;
        // conditions on remove
        let filter = options.filter || {};
        let definitions = options.definitions || entity.__definitions || {};
        return new Promise(async (resolve, reject) => {
            if (entity == null) {
                log.error(cjs.i18n.__("Cannot remove entity. Entity field is null"));
                return;
            }

            let db = await this.getDb();
            if (!db) {
                log.error(cjs.i18n.__("Cannot remove entity {{entityName}}", {entityName: entity.entityName}));
                resolve(false);
                return;
            }
            if (isEmpty(filter)) { // check if there is primaryKey(s) set
                let Pks = definitions.primaryKeys;
                for (let i = 0, j = Pks.length; i < j; i++) {
                    let fieldRef = Pks[i].fname;
                    let fieldName = (isEmpty(Pks[i].data.field)) ? Pks[i].fname : Pks[i].data.field;
                    if (!isEmpty(entity[fieldRef]) || MongoDB.ObjectId.isValid(entity[fieldRef])) filter[fieldName] = entity[fieldRef];
                }
            }

            let collectionName = definitions.entity.data.RepositoryName || entity.entityName;
            if (isEmpty(filter)) { // insert data
                log.info(cjs.i18n.__("Not removing entities {{entityName}}. No filter set.", {entityName: entity.entityName}));
                resolve(false);
            } else {
                delete filter.__force_delete;
                // convert field names
                try {
                    convertFieldsToTypeDefinitions(filter, definitions);
                } catch (e) {
                    log.error(e.message);
                    reject({
                        error_message: cjs.i18n.__("Undefined error on trying to update entity \"{{entityName}}\"", {entityName: entity.entityName}),
                        error_code: Constants.UNDEFINED_ERROR
                    });
                }
                // remove data and return the modified
                await db.collection(collectionName).deleteMany(filter, {
                    writeConcern: {
                        w: 1,
                        j: true
                    }
                }).catch((e) => {
                    if (e.code === 66) {
                        log.error(cjs.i18n.__("Error trying to delete records on repository. Records exists?"));
                        reject(e);
                        return;
                    } else
                        log.error(e);
                    reject(false);
                }).then((data) => {
                    resolve(data);
                });
            }
        });
    };

    this.insertBatch = async (options) => {
        let db = await this.getDb();
        if (!db) {
            log.error(cjs.i18n.__("Cannot insert {{entityName}}", {entityName: options.entity}));
            return;
        }
        return await db.collection(options.entity).insertMany(options.data);
    };

    this.close = async () => {
        if (this.client)
            this.client.close();
    }

    this.isConnected = () => {
        return !!this.client && !!this.client.topology && this.client.topology.isConnected()
    }

    this.aggregate = (params) => {
        let pipeline = params.pipeline || [];
        let options = params.options || {};
        let getcursor = params.getcursor ? params.getcursor : false;
        let collectionName = params.collection || params.entity;

        return new Promise(async (resolve, reject) => {
            let db = await this.getDb();
            if (!db) {
                log.error(cjs.i18n.__("Cannot get entity {{entityName}}", {entityName: options.entity}));
                return;
            }

            let curFind;
            try {
                curFind = db.collection(collectionName).aggregate(pipeline, options);
            } catch (e) {
                reject(e);
                return;
            }

            if (getcursor)
                resolve({cursor: curFind});
            else {
                let results;
                try {
                    results = await curFind.toArray();
                    resolve({results: results});
                } catch (e) {
                    reject(e);
                    //throw e;
                }
            }
        });
    }
}

module.exports = new mongoDB();