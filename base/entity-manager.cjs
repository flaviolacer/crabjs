const path = require("path");
const fs = require('fs');
const log = require('./log.cjs');
const annotation = require('./annotation.cjs');
const repositoryManager = require("./repository-manager.cjs");
let cjs = require("./cjs.cjs");

/**
 * @class EntityManager
 * @module EntityManager
 */
function EntityManager() {
    let instance = this;

    // initialize entityDefinitions
    this.__entityDefinitions = {};
    let getEntityDefinition = (name) => {

        // check if already exists in memory
        if (!cjs.entityManager.__entityDefinitions[name]) {
            let entityFilename = name.contains("\\.") ? name : name + '.js';
            let entityFilepath = path.join(cjs.config.server_entities_path, entityFilename);
            if (!fs.existsSync(entityFilepath)) {
                // test commonjs
                let commonjsFile = entityFilepath.replaceAll("\\.js", ".cjs");
                if (!fs.existsSync(commonjsFile)) {
                    //system
                    entityFilepath = path.join(__dirname, "./entity/", entityFilename.replaceAll("\\.js", ".cjs"));
                } else {
                    entityFilepath = commonjsFile;
                }
            }

            let annotations = annotation.parseSync(entityFilepath);

            if (isEmpty(annotations)) {
                return false;
            }

            // when class, merge function and classes - ES6
            if (annotations.classes) {
                let classKeys = Object.keys(annotations.classes);
                annotations.functions = annotations.functions || {};
                for (let i = 0, j = classKeys.length; i < j; i++)
                    annotations.functions[classKeys[i]] = annotations.classes[classKeys[i]];
            }

            let annotationFunctionsKeys = Object.keys(annotations.functions);
            if (annotations.functions && annotationFunctionsKeys.length > 0) { // start mapping fields
                let entityInfo;
                try {
                    entityInfo = instance.getEntitiesAnnotationsInfo(annotations);
                } catch (e) {
                    log.error(cjs.i18n.__('Annotation "@Entity" not found on entity file "{{name}}"', {name: name}));
                }
                return entityInfo;
            }
        } else
            return cjs.entityManager.__entityDefinitions[name];
    };

    /**
     * Initialize entity manager
     */
    this.init = () => {
        if (isEmpty(cjs.config.server_entities_path) || cjs.config.server_entities_path.startsWith('.') || !cjs.config.server_entities_path.startsWith('/'))
            cjs.config.server_entities_path = path.join(cjs.config.app_root, cjs.config.server_entities_path);
    };

    let createEntity = async name => {
        if (isEmpty(name)) {
            log.error(cjs.i18n.__("You must specify the name of the entity to create a new one."));
            return;
        }
        let entityFilename = name.contains("\\.") ? name : name + '.js';
        let entityFilepath = path.join(cjs.config.server_entities_path, entityFilename);
        if (!fs.existsSync(entityFilepath)) {
            let commonjsEntityFile = entityFilepath.replaceAll("\\.js", ".cjs");
            if (!fs.existsSync(commonjsEntityFile)) {
                // system entity?
                entityFilepath = path.join(__dirname, "./entity/", entityFilename.replaceAll("\\.js", ".cjs"));
                if (!fs.existsSync(entityFilepath)) {
                    log.error(cjs.i18n.__('Entity definition not found. Missing create it "{{name}}"?', {name: name}));
                    return;
                }
            } else
                entityFilepath = commonjsEntityFile;
        }
        // create entity and extend it to base
        let newEntityInstantiated = require(entityFilepath);
        if (newEntityInstantiated.constructor && newEntityInstantiated.constructor.name.toLowerCase() === "function") newEntityInstantiated = new newEntityInstantiated();
        else if (newEntityInstantiated.__esModule) {
            let __esImport = await import(entityFilepath);
            if (__esImport.default && typeof __esImport.default === "function") {
                newEntityInstantiated = new __esImport.default();
            } else if (__esImport.default && typeof __esImport.default === "object") {
                newEntityInstantiated = __esImport.default;
            } else {
                newEntityInstantiated = __esImport;
            }
        }

        // extend entitybase
        let definitions = getEntityDefinition(name);
        let annotationMapKeys = Object.keys(definitions);
        const entries = Object.entries(definitions.entity.data);
        let headerAnnotationKeys =
            entries.map(([key]) => {
                return key.toLowerCase();
            });
        let headerAnnotations = Object.fromEntries(
            entries.map(([key, value]) => {
                return [key.toLowerCase(), value];
            }),
        );

        let EntityBase;
        let customBaseLib = headerAnnotationKeys.contains("custom") || headerAnnotationKeys.contains("custombase");
        if (customBaseLib) {
            let customEntityPath = (headerAnnotationKeys.contains("custompath")) ? headerAnnotationKeys["custompath"] : path.join(cjs.config.server_entities_path, "custom");
            try {
                let entityBasefile = path.join(customEntityPath, headerAnnotations["custom"] || headerAnnotations["custombase"] + ".js");
                if (!fs.existsSync(entityBasefile))
                    entityBasefile = entityBasefile.replaceAll("\\.js", ".cjs");
                EntityBase = require(entityBasefile);
            } catch (e) {
                log.error(cjs.i18n.__('Error loading custom entity. Verify if file exists on: {{customBaseLib}} ', {customBaseLib: customBaseLib}));
                return;
            }
        } else {
            EntityBase = require('./entity-base.cjs');
        }

        let entityBase = new EntityBase();
        newEntityInstantiated = extend(entityBase, newEntityInstantiated);
        newEntityInstantiated.entityName = name;

        // load entity definitions
        newEntityInstantiated.__definitions = definitions;

        // map annotation entity properties to the object
        for (let i = 0, j = annotationMapKeys.length; i < j; i++)
            newEntityInstantiated[lowerFirstLetter(annotationMapKeys[i])] = newEntityInstantiated.__definitions.entity.data[annotationMapKeys[i]];

        // remove entity definition
        delete newEntityInstantiated.entity;

        return newEntityInstantiated;
    };

    /**
     * Create entity to manipulate repository data
     * @param name
     * @param initContent
     * @returns Entity
     */
    this.setEntity = async (name, initContent) => {
        let newEntityObj = await createEntity(name);
        if (initContent) { // map content to entity definitions
            if (!isObject(initContent))
                return newEntityObj;
            // get only mapped fields
            let fieldsDefinitions = newEntityObj.__definitions.fields;
            let fDKeys = Object.keys(fieldsDefinitions);
            for (let i = 0, j = fDKeys.length; i < j; i++) {
                if (!isEmpty(initContent[fDKeys[i]]))
                    newEntityObj[fDKeys[i]] = initContent[fDKeys[i]];
                else if (!isEmpty(fieldsDefinitions[fDKeys[i]].field) && !isEmpty(initContent[fieldsDefinitions[fDKeys[i]].field]))
                    newEntityObj[fDKeys[i]] = initContent[fieldsDefinitions[fDKeys[i]].field];
            }
        }
        return newEntityObj;
    };

    /**
     * new entity
     * @param name
     * @param initContent
     * @returns Entity
     */
    this.newEntity = this.setEntity;
    this.createEntity = this.setEntity;

    /**
     * Load entity class
     * @param name
     * @returns Entity
     */
    this.loadEntity = async (name) => {
        return await this.createEntity(name);
    };

    /**
     * Get information about detected annotations
     * @param annotations
     * @returns entityInfo
     */
    this.getEntitiesAnnotationsInfo = (annotations) => {
        let entityInfo = {
            functions: [],
            fields: {},
            primaryKeys: []
        };

        // search for controller
        let functionKeys = Object.keys(annotations.functions);
        let fieldKeys = Object.keys(annotations.fields);
        for (let i = 0, j = functionKeys.length; i < j; i++) {
            let functionAnnotationKey = functionKeys[i];
            if (Object.keys(annotations.functions[functionAnnotationKey]).contains('entity'))
                entityInfo.entity = {
                    "fname": functionAnnotationKey, data: annotations.functions[functionAnnotationKey]
                }; else entityInfo.functions.push({
                "fname": functionAnnotationKey, data: annotations.functions[functionAnnotationKey]
            });
        }

        for (let i = 0, j = fieldKeys.length; i < j; i++) {
            let fieldAnnotationKey = fieldKeys[i];
            let fieldAnnotationData = Object.keys(annotations.fields[fieldAnnotationKey]);

            if (fieldAnnotationData.contains('primary') || fieldAnnotationData.contains('primarykey'))
                entityInfo.primaryKeys.push({
                    "fname": fieldAnnotationKey, data: annotations.fields[fieldAnnotationKey]
                });
            if (fieldAnnotationData.contains('field'))
                entityInfo.fields[fieldAnnotationKey] = annotations.fields[fieldAnnotationKey]
        }

        if (!entityInfo.entity) {
            throw new Error("Annotation Entity not found");
        }

        return entityInfo;
    };

    /**
     * Save entities batch mode
     * @param entity
     * @param data
     */
    this.insertBatch = (entity, data) => {
        if (isEmpty(entity)) {
            log.error(cjs.i18n.__("Need to specify the entity to insert batch."));
            log.trace("error");
            return;
        }

        if (isEmpty(data)) {
            log.error(cjs.i18n.__("Trying to insert with empty data."));
            log.trace("error");
            return;
        }

        if (!isArray(data))
            data = [data];
        return new Promise(async (resolve) => {
            let entityDefinitions = getEntityDefinition(entity);
            let retInsertBatch = await repositoryManager.insertBatch({
                repository: entityDefinitions.entity.repository,
                entity: entityDefinitions.entity.data.RepositoryName || entity,
                data: data
            });
            resolve(retInsertBatch);
        });
    };

    /**
     * Retrieve entity from repository
     * @param entity
     * @param filter
     * @param options
     * @returns {Promise<unknown>}
     */
    this.getEntity = (entity, filter, options = {}) => {
        // convert array to object
        if (isArray(filter))
            filter = Object.assign({}, filter);

        return new Promise(async (resolve, reject) => {
            if (isEmpty(entity)) {
                log.error(cjs.i18n.__("Need to specify the entity to load data."));
                log.trace("error");
                resolve(null);
                return;
            }

            if (isEmpty(filter)) {
                log.error(cjs.i18n.__("Need to specify the filter to return the entity."));
                log.trace("error");
                resolve(null);
                return;
            }
            log.info(cjs.i18n.__(`Get entity from repository ${entity}`));

            let entityDefinitions = getEntityDefinition(entity);
            if (!entityDefinitions) {
                log.error(cjs.i18n.__("Entity not defined. Did you missed the file on directory?"));
                reject(null);
                return null;
            }
            let entityData = null;
            try {
                entityData = await repositoryManager.findOne({
                    repository: (entityDefinitions.entity && entityDefinitions.entity.data ) ? entityDefinitions.entity.data.dbName || entityDefinitions.entity.data.DbName : null,
                    entity: entityDefinitions.entity.data.RepositoryName || entity,
                    definitions: entityDefinitions,
                    getEntityDefinition: getEntityDefinition,
                    filter: filter,
                    options: {
                        load: options.load,
                    }
                });

                if (!isEmpty(entityData) && (entityData !== false)) {
                    log.info("Data retrived:", entityData);
                    resolve(this.newEntity(entity, entityData));
                } else {
                    log.info(cjs.i18n.__("Entity not found on repository"));
                    resolve(null);
                }
            } catch (e) {
                log.error(cjs.i18n.__("Could not retrive data from repository."));
                log.error(e);
                reject(e);
            }
        });
    };

    /**
     * Retrieve entities from
     * @param entity
     * @param filter
     * @param options
     * @returns {Promise<unknown>}
     */
    this.getEntities = (entity, filter, options = {}) => {
        return new Promise(async (resolve, reject) => {
            if (isEmpty(entity)) {
                log.error(cjs.i18n.__("Need to specify the entity to load data."));
                log.trace("error");
                resolve(null);
                return;
            }

            log.info(cjs.i18n.__("Retrieving entities from repository..."));
            let entityDefinitions = getEntityDefinition(entity);
            if (isEmpty(entityDefinitions)) {
                log.error(cjs.i18n.__(`No entity definitions found for "${entity}". Did you miss the entity file on directory?`));
                reject(null);
                return;
            }

            try {
                let entities = await repositoryManager.find({
                    repository: (entityDefinitions.entity && entityDefinitions.entity.data ) ? entityDefinitions.entity.data.dbName || entityDefinitions.entity.data.DbName : null,
                    entity: entityDefinitions.entity.data.RepositoryName || entity,
                    definitions: entityDefinitions,
                    getEntityDefinition: getEntityDefinition,
                    filter: filter,
                    options: {
                        page_size: (!isEmpty(options.page_size)) ? options.page_size : cjs.config.repository_page_size || 10,
                        page_number: options.page_number || 1,
                        sort: options.sort,
                        load: options.load,
                        cursor: options.cursor
                    }
                });
                if (options.cursor) {
                    log.info("Cursor retrieved");
                    resolve(entities);
                } else if (entities) {
                    log.info("Data retrieved");
                    if (options.rawData)
                        resolve(entities)
                    else {
                        let returnData = [];
                        for (let i = 0, j = entities.records.length; i < j; i++) { // converting data
                            returnData.push(await this.newEntity(entity, entities.records[i]));
                        }
                        entities.records = returnData;
                        resolve(entities);
                    }
                } else {
                    log.info("Entities not found");
                    resolve(null);
                }
            } catch (e) {
                log.error(cjs.i18n.__("Could not retrieve data from repository."));
                log.error(e);
                reject(e);
            }
        });
    };

    /**
     * Update entity in repository
     * @param entity
     * @param filter
     * @param data
     * @returns {Promise<unknown>}
     */
    this.saveEntity = (entity, filter, data) => {
        filter = filter || {};
        // convert array to object
        if (isArray(filter))
            filter = Object.assign({}, filter);

        return new Promise(async (resolve, reject) => {
            if (isEmpty(entity)) {
                log.error(cjs.i18n.__("Need to specify the entity to save data."));
                log.trace("error");
                resolve(null);
                return;
            }

            if (isEmpty(data)) {
                log.error(cjs.i18n.__("Need to specify the data to save the entity."));
                log.trace("error");
                resolve(null);
                return;
            }

            let entityDefinitions = getEntityDefinition(entity);
            if (!entityDefinitions) {
                log.error(cjs.i18n.__("Entity not defined. Did you missed the file on directory?"));
                reject(false);
                return false;
            }
            let entityData = null;
            data.__definitions = entityDefinitions;
            try {
                entityData = await repositoryManager.save({
                    repository: (entityDefinitions.entity && entityDefinitions.entity.data ) ? entityDefinitions.entity.data.dbName || entityDefinitions.entity.data.DbName : null,
                    entity: data,
                    definitions: entityDefinitions,
                    filter: filter
                });

                if (!isEmpty(entityData) && (entityData !== false)) {
                    log.info("Data retrived:", entityData);
                    resolve(this.newEntity(entity, entityData));
                } else {
                    log.info(cjs.i18n.__("Entity not saved on repository"));
                    resolve(null);
                }
            } catch (e) {
                log.error(cjs.i18n.__("Could not save data in repository."));
                log.error(e);
                reject(e);
            }
        });
    }

    /**
     * Remove entities from repository
     * @param entity
     * @param filter
     * @returns {Promise<unknown>}
     */
    this.removeEntities = (entity, filter) => {
        return new Promise(async (resolve, reject) => {
            if (isEmpty(entity)) {
                log.error(cjs.i18n.__("Need to specify the entity to load data."));
                log.trace("error");
                resolve(null);
                return;
            }

            if (isEmpty(filter)) {
                log.error(cjs.i18n.__("Need to specify the filter to return the entity."));
                log.trace("error");
                resolve(null);
                return;
            }
            log.info(cjs.i18n.__("Removing entities..."));
            let entityDefinitions = getEntityDefinition(entity);
            try {
                let response = await repositoryManager.remove({
                    repository: (entityDefinitions.entity && entityDefinitions.entity.data ) ? entityDefinitions.entity.data.dbName || entityDefinitions.entity.data.DbName : null,
                    entity: entityDefinitions.entity.data.RepositoryName || entity,
                    definitions: entityDefinitions,
                    filter: filter
                });

                if (response)
                    log.info("Data removed");
                else
                    log.info("Entities not removed");

                resolve(response);
            } catch (e) {
                log.error(cjs.i18n.__("Could not erase data from repository."));
                log.error(e);
                reject(e);
            }
        });
    }
}

module.exports = new EntityManager();