const cjs = require("./cjs");
const utils = require('./utils');
const Constants = require("./constants");

function ControllerEntityBase() {
    /**
     * Controller entity
     */
    this.__entity = null;

    let save_update = async (req, res) => {
        let em = cjs.entityManager;
        let record;
        if (!isEmpty(req.body)) {
            if (!isArray(req.body)) {
                let newProduct = em.newEntity(this.__entity.entityName);

                extend(newProduct, req.body);
                let options = {};
                let filter = req.params.filter;
                if (!isEmpty(filter)) { // update registry
                    if (isEmpty(this.__entity.__definitions.primaryKeys)) {
                        utils.responseError(res, `Error on update object. No defined primary key on entity: ${this.__entity.entityName}`);
                        return false;
                    }
                    // get first primary key
                    let primaryKey = this.__entity.__definitions.primaryKeys[0].fname;
                    newProduct[primaryKey] = filter;
                    let returnUpdate = await newProduct.save();
                    record = extend(returnUpdate, newProduct);
                } else {
                    if (newProduct.__filter) {
                        options.filter = newProduct.__filter;
                        options.filter.__update_multiple = true;
                        delete newProduct.__filter;
                    }

                    try {
                        record = await newProduct.save(options);
                    } catch (e) {
                        let errorMessage;
                        let errorCode = 406;
                        let errorReferenceCode = 0;
                        switch (e.error_code) {
                            case Constants.REQUIRED_FIELD_ERROR:
                                errorMessage = "Missing required fields.";
                                break;
                            case Constants.FIELD_VALUE_ERROR:
                                errorMessage = "Check the field values.";
                                break;
                            case Constants.EMPTY_CONTENT_ERROR:
                                errorMessage = "Check the information sent. Please verify that there is the correct fields with values.";
                                break;
                            case Constants.DUPLICATE_KEY_ERROR:
                                errorMessage = "Record already exists.";
                                errorReferenceCode = 11;
                                break;
                            default:
                        }
                        utils.responseError(res, cjs.i18n.__('Error on insert or update object. {{saveErrorMessage}}', {
                            saveErrorMessage: errorMessage
                        }), errorCode, errorReferenceCode);
                        return false;
                    }
                }
            } else {
                record = await em.insertBatch(this.__entity.entityName, req.body);
            }
            utils.responseData(res, record);
            return true;
        } else {
            utils.responseError(res, cjs.i18n.__('Error on save object. No defined body to save on entity: {{entityName}}', {
                entityName: this.__entity.entityName
            }), 406);
            return false;
        }
    };

    /**
     * Save entity in repository
     */
    this.__post = save_update;
    /**
     * Retrieve entity from repository
     */
    this.__get = async (req, res) => {
        let singleRecord = true;
        let filter = req.params.filter;

        if (isEmpty(filter)) {
            singleRecord = false;
        }

        let queryFields = req.query || {};
        let options = {};
        if (!isEmpty(queryFields.options)) {
            options = queryFields.options;
            delete queryFields.options;
        }
        filter = filter || queryFields;

        if (!options.rawData)
            options.rawData = true;

        // if is string, tranform in object with primary key
        if (isString(filter)) {
            let primaryKeys = isEmpty(this.__entity.__definitions.primaryKeys) ? [] : this.__entity.__definitions.primaryKeys.map(function (primaryKey) {
                return primaryKey.fname;
            });

            if (primaryKeys.length === 0) {
                utils.responseData(res, null);
                return;
            }
            let testFilter = {};
            testFilter[primaryKeys[0]] = filter;
            filter = testFilter;
        }

        let dataObject;
        if (singleRecord) {
            dataObject = await cjs.entityManager.getEntity(this.__entity.entityName, filter);
        } else {
            dataObject = await cjs.entityManager.getEntities(this.__entity.entityName, filter, options);
        }
        utils.responseData(res, dataObject, {type: "entity"});
    }
    /**
     * Update entity in repository
     */
    this.__put = save_update;
    /**
     * delete record from entity in repository
     */
    this.__delete = async (req, res) => {
        let filter = req.params.filter || req.body || {};

        if (!isEmpty(filter) && isString(filter)) {
            if (isEmpty(this.__entity.__definitions.primaryKeys)) {
                utils.responseError(res, `Error on update object. No defined primary key on entity: ${this.__entity.entityName}`);
                return;
            }

            // get first primary key
            let primaryKey = this.__entity.__definitions.primaryKeys[0].fname;
            let filterObj = {};
            filterObj[primaryKey] = filter;
            filter = filterObj;
        }

        if (isEmpty(filter) && !filter.__force_delete) {
            utils.responseError(res, "filter parameter is empty", 100);
            return;
        }

        let retDeleted = await cjs.entityManager.removeEntities(this.__entity.entityName, filter);
        if (isEmpty(retDeleted)) {
            utils.responseError(res, "Error trying to delete", 110);
            return;
        }
        utils.responseData(res, retDeleted, {type: "entity"});
    };
}

module.exports = ControllerEntityBase;