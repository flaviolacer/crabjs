const log = require('../log');
if (!require("../utils").checkLibExists('mongodb')) {
    log.warn("MongoDB module not found. Consider run 'npm install mongodb\n'");
    return false;
}
let MongoDB = require('mongodb');
let Error = require("../error")

function mongoDB() {
    let instance = this;
    this.db = null;
    this.client = null;

    let default_options = {
        "pool_size": 10,
        "wtimeoutMS": 2500,
        "useNewUrlParser": true,
        "useUnifiedTopology": true
    };

    this.setDb = dbname => {
        if (!this.client)
            throw new Error("client is null");
        this.db = this.client.db(dbname);
        this.collectionName = dbname;
    }

    this.connect = params => {
        return new Promise(function (resolve, reject) {
            if (!params.host) {
                reject(new Error("Host cannot be empty", 500, {}));
                return;
            }

            // merge options
            params.options = params.options || {};
            extend(params.options, default_options);

            MongoDB.MongoClient.connect(params.host, params.options, function (err, client) {
                if (err) {
                    reject(err);
                } else {
                    resolve(err, client);
                    instance.client = client;
                }
            });
        });
    }

    this.convertIdFields = function (fields) {
        let ObjectID = MongoDB.ObjectId;
        for (let key in fields) {
            if ((typeof fields[key] === 'string') && key.contains("_id"))
                fields[key] = new ObjectID(fields[key]);
        }

        return fields;
    };

    this.find = (where, options) => {
        options  = options || {};

        if (!this.db)
            throw new Error("You must set db before use.");

        return new Promise(async (resolve, reject) => {
            // transform id fields in objects
            this.convertIdFields(where);
            let pipeline = where.$pipeline || [];
            delete where.$pipeline;

            // check if $match already exists
            const found = pipeline.some(fi => !isEmpty(fi.$match));
            if (!found)
                pipeline.push({$match:where});

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
                    log.info('info-aggregate-params:' + JSON.stringify(where));
                    log.info("info-aggregate-" + instance.collectionName, results[0]);
                }
                if (!isEmpty(results)) {
                    if (options.one)
                        resolve(results[0]);
                    else
                        resolve(results);
                } else {
                    resolve(null);
                }
            });
        });
    }
}

module.exports = mongoDB;