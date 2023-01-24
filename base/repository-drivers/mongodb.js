const log = require('../log');
let cjs = require("../cjs");

let MongoDB = require('mongodb');
let Error = require("../error")

function mongoDB() {
    let instance = this;
    this.db = null;
    this.client = null;

    let default_options = {
        "maxPoolSize": 10, "wtimeoutMS": 2500, "useNewUrlParser": true, "useUnifiedTopology": true
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
                    fields[fieldKey] = this.setType(fields[whereKeys[i]], definitions.fields[whereKeys[i]].type);
            }
    }

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
                return encrypt_password(value);
            case "datetime":
            case "date":
                return new Date(value);
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

            MongoDB.MongoClient.connect(connUri, params.options, function (err, client) {
                if (err) {
                    reject(err);
                } else {
                    // set collection
                    resolve(client);
                }
            });
        });
    };

    this.find = async (options) => {
        let filter = options.filter || {};
        options = options || {};

        return new Promise(async (resolve, reject) => {
            let db = await this.getDb();
            if (!db) {
                log.error(cjs.i18n.__("Cannot get \"{{entityName}}\" entities", {entityName: options.entity}));
                resolve(false);
                return;
            }

            // convert fields to types
            convertFieldsToTypeDefinitions(filter, options.definitions);

            let pipeline = filter.$pipeline || [];
            delete filter.$pipeline;

            // check if $match already exists
            const found = pipeline.some(fi => !isEmpty(fi.$match));
            if (!found) pipeline.push({$match: filter});

            // create pipeline for count
            let pipeline_count = pipeline.clone();
            pipeline_count.push({"$count": "count"});

            // pagination
            if (options.page_number && options.page_size) {
                pipeline.push({$skip: (options.page_number - 1) * options.page_size});
                pipeline.push({$limit: options.page_size});
            }

            let aggregate_options = {collation: {locale: "pt"}, allowDiskUse: true};

            let collectionName = options.definitions.entity.data.RepositoryName || options.entity;
            let res_cursor;
            let record_count_cursor;
            try {
                record_count_cursor = await (await instance.db.collection(collectionName).aggregate(pipeline_count, aggregate_options)).next();
                res_cursor = await instance.db.collection(collectionName).aggregate(pipeline, aggregate_options);
            } catch (e) {
                reject(e);
                return;
            }

            res_cursor.toArray(async function (errTo, results) {
                if (errTo) {
                    reject(errTo);
                    return;
                }

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
                return;
            }

            //convert fields on filter for the right type
            // convert fields to types
            convertFieldsToTypeDefinitions(filter, options.definitions);

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

        // conditions on insert
        let filter = options.filter || {};
        return new Promise(async (resolve) => {
            let db = await this.getDb();
            if (!db) {
                log.error(cjs.i18n.__("Cannot save entity {{entityName}}", {entityName: entity.entityName}));
                resolve(false);
                return;
            }
            if (isEmpty(filter)) { // check if there is primaryKey(s) set
                let Pks = entity.__definitions.primaryKeys;
                for (let i = 0, j = Pks.length; i < j; i++) {
                    let fieldRef = Pks[i].fname;
                    let fieldName = (isEmpty(Pks[i].data.field)) ? Pks[i].fname : Pks[i].data.field;
                    primaryKeyExists = true;
                    if (!isEmpty(entity[fieldRef]) || MongoDB.ObjectId.isValid(entity[fieldRef])) filter[fieldName] = this.setType(entity[fieldRef], fields[fieldRef].type);
                }
            }

            // prepare data to save
            let fieldsKeys = Object.keys(entity.__definitions.fields);
            let entityPersistInfo = {};
            for (let i = 0, j = fieldsKeys.length; i < j; i++) {
                let fieldRef = fieldsKeys[i];
                let fieldName = (isEmpty(fields[fieldRef].field)) ? fieldRef : fields[fieldRef].field;
                if (typeof fields[fieldRef].required !== "undefined" && isEmpty(entity[fieldRef])) { // required fields
                    log.error(cjs.i18n.__("Required field \"{{fieldName}}\" was not set on entity \"{{entityName}}\"", {
                        fieldName: fieldName, entityName: entity.entityName
                    }));
                    resolve(false);
                    return;
                }

                try {
                    if (!isEmpty(entity[fieldRef])) entityPersistInfo[fieldName] = this.setType(entity[fieldRef], fields[fieldRef].type);
                } catch (e) {
                    log.error(cjs.i18n.__("Cannot save entity {{entityName}}. Error set value on field.", {entityName: entity.entityName}));
                    resolve(false);
                    return;
                }
            }

            if (isEmpty(entityPersistInfo)) {
                log.error(cjs.i18n.__("No infomation sent to save entity \"{{entityName}}\"", {entityName: entity.entityName}));
                resolve(false)
                return;
            }

            let collectionName = entity.__definitions.entity.data.RepositoryName || entity.entityName;
            if (isEmpty(filter)) { // insert data
                if (isEmpty(entityPersistInfo)) {
                    resolve(false);
                    return;
                }
                // insert data
                await db.collection(collectionName).insertOne(entityPersistInfo, {
                    writeConcern: {
                        w: 1, j: true
                    }
                }).catch((e) => {
                    log.error(e);
                    resolve(false);
                }).then((obj) => {
                    // for best practices with mongodb, set _id for the document
                    entity._id = obj.insertedId;
                    resolve(entity);
                });
            } else {
                // convert field names
                convertFieldsToTypeDefinitions(filter, entity.__definitions);

                // persist data and return the modified
                if (filter.__update_multiple) {
                    delete filter.__update_multiple;
                    await db.collection(collectionName).updateMany(filter, {$set: entityPersistInfo}, {
                        writeConcern: {
                            w: 1,
                            j: true
                        }
                    }).catch((e) => {
                        log.error(e);
                        resolve(false);
                    }).then(() => {
                        resolve(entity);
                        return true;
                    });
                } else
                    try {
                        let ret = await db.collection(collectionName).findOneAndUpdate(filter, {$set: entityPersistInfo}, {
                            upsert: true, returnNewDocument: true
                        });
                        resolve(ret.value);
                        return ret;
                    } catch (e) {
                        if (e.code === 66)
                            log.error(cjs.i18n.__("Error trying to save record on repository. Record id already exists?"));
                        else
                            log.error(e);
                        resolve(false);
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
                    primaryKeyExists = true;
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
                convertFieldsToTypeDefinitions(filter, definitions);

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
                    resolve(false);
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
                throw e;
            }

            if (getcursor)
                resolve({cursor: curFind});
            else {
                let results;
                try {
                    results = await curFind.toArray();
                } catch (e) {
                    reject(e);
                    throw e;
                }
                resolve({results: results});
            }
        });
    }
}

module.exports = new mongoDB();