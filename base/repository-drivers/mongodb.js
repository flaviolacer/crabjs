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
            if (definitions.fields[whereKeys[i]])
                fields[whereKeys[i]] = this.setType(fields[whereKeys[i]], definitions.fields[whereKeys[i]].type);
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
                    log.error(cjs.i18n.__(`Error on converting ObjectId Field: '${value}'`))
                    throw new Error(e);
                }
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
        if (this.db != null) return this.db; else {
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

    this.find = (conditions, options) => {
        options = options || {};

        if (!this.db) throw new Error("You must set db before use.");

        return new Promise(async (resolve, reject) => {
            // transform id fields in objects
            this.convertIdFields(conditions);
            let pipeline = conditions.$pipeline || [];
            delete conditions.$pipeline;

            // check if $match already exists
            const found = pipeline.some(fi => !isEmpty(fi.$match));
            if (!found) pipeline.push({$match: conditions});

            let res_cursor;
            try {
                res_cursor = await instance.db.collection(instance.collectionName).aggregate(pipeline, {allowDiskUse: true});
            } catch (e) {
                reject(e);
                throw e;
            }

            res_cursor.toArray(async function (errTo, results) {
                if (errTo) {
                    reject(errTo);
                    throw errTo;
                }

                if (instance.debug) {
                    log.info('info-aggregate-params:' + JSON.stringify(conditions));
                    log.info("info-aggregate-" + instance.collectionName, results[0]);
                }
                if (!isEmpty(results)) {
                    if (options.one) resolve(results[0]); else resolve(results);
                } else {
                    resolve(null);
                }
            });
        });
    };

    this.findOne = async (options) => {
        let filter = options.filter || {};
        options = options || {};
        let db = await this.getDb();
        if (!db) {
            log.error(cjs.i18n.__("Cannot get entity {{entityName}}", {entityName: options.entity}));
            resolve(false);
            return;
        }

        return new Promise(async (resolve) => {
            //convert fields on filter for the right type
            // convert fields to types
            convertFieldsToTypeDefinitions(filter, options.definitions);

            let collectionName = options.definitions.entity.data.RepositoryName || options.entity;
            await db.collection(collectionName).findOne(filter).catch((e) => {
                log.error(e);
                resolve(false);
            }).then((obj) => {
                resolve(obj);
            });
        });
    };

    this.save = (options) => {
        let entity = options.entity;
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
                    if (!isEmpty(entity[fieldRef]) || MongoDB.ObjectId.isValid(entity[fieldRef])) filter[fieldName] = entity[fieldRef];
                }
            }

            // prepare data to save
            let fieldsKeys = Object.keys(entity.__definitions.fields);
            let fields = entity.__definitions.fields;
            let entityPersist = {};
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
                    if (!isEmpty(entity[fieldRef])) entityPersist[fieldName] = this.setType(entity[fieldRef], fields[fieldRef].type);
                } catch(e) {
                    log.error(cjs.i18n.__("Cannot save entity {{entityName}}. Error set value on field.", {entityName: entity.entityName}));
                    resolve(false);
                    return;
                }
            }

            if (isEmpty(entityPersist)) {
                log.error(cjs.i18n.__("No infomation sent to save entity \"{{entityName}}\"", {entityName: entity.entityName}));
                resolve(false)
                return;
            }

            let collectionName = entity.__definitions.entity.data.RepositoryName || entity.entityName;
            if (isEmpty(filter)) { // insert data
                if (isEmpty(entityPersist)) {
                    resolve(false);
                    return;
                }
                // insert data
                await db.collection(collectionName).insertOne(entityPersist, {
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
                if (options.forceUpdate)
                    await db.collection(collectionName).updateMany(filter, entityPersist, {
                        writeConcern: {
                            w: 1,
                            j: true
                        }
                    }).catch((e) => {
                        log.error(e);
                        resolve(false);
                    }).then(() => {
                        resolve(entity);
                    });
                else
                    await db.collection(collectionName).findOneAndUpdate(filter, {$set: entityPersist}, {
                        upsert: true, returnNewDocument: true
                    }).catch((e) => {
                        if (e.code === 66)
                            log.error(cjs.i18n.__("Error trying to save record on repository. Record id already exists?"));
                        else
                            log.error(e);
                        resolve(false);
                    }).then(() => {
                        resolve(entity);
                    });
            }
        });
    };

    this.insertBatch = async (options) => {
        let db = await this.getDb();
        if (!db) {
            log.error(cjs.i18n.__("Cannot insert {{entityName}}", {entityName: options.entity}));
            resolve(false);
            return;
        }
        await db.collection(options.entity).insertMany(options.data);
    };
}

module.exports = new mongoDB();