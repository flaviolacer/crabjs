const path = require("path");
const fs = require('fs');
const log = require('./log');
const annotation = require('./annotation');
const repositoryManager = require("./repository-manager");
let cjs = require("./cjs");

function entityManager() {
    let instance = this;
    let config = cjs.config;

    // initialize entityDefinitions
    this.__entityDefinitions = {};
    let getEntityDefinition = (name) => {

        // check if already exists in memory
        if (!cjs.entityManager.__entityDefinitions[name]) {
            let entityFilename = name.contains("\\.") ? name : name + '.js';
            let entityFilepath = path.join(config.server_entities_path, entityFilename);
            if (!fs.existsSync(entityFilepath)) {
                entityFilepath = path.join(__dirname,"./entity/", entityFilename);
            }

            let annotations = annotation.parseSync(entityFilepath);

            if (isEmpty(annotations)) {
                return false;
            }

            // when class, merge function and classes - ES6
            if (annotations.classes) {
                let classKeys = Object.keys(annotations.classes);
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
        if (isEmpty(config.server_entities_path) || config.server_entities_path.startsWith('.') || !config.server_entities_path.startsWith('/'))
            cjs.config.server_entities_path = path.join(config.app_root, config.server_entities_path);
    };

    let createEntity = name => {
        if (isEmpty(name)) {
            log.error(cjs.i18n.__("You must specify the name of the entity to create a new one."));
            return;
        }
        let entityFilename = name.contains("\\.") ? name : name + '.js';
        let entityFilepath = path.join(config.server_entities_path, entityFilename);
        if (!fs.existsSync(entityFilepath)) {
            // system entity?
            entityFilepath = path.join(__dirname,"./entity/", entityFilename);
            if(!fs.existsSync(entityFilepath)) {
                log.error(cjs.i18n.__('Entity definition not found. Missing create it {{name}}?', {name: name}));
                return;
            }
        }
        // create entity and extend it to base
        let newEntityInstantiated = require(entityFilepath);
        if (newEntityInstantiated.constructor.name.toLowerCase() === "function") newEntityInstantiated = new newEntityInstantiated();
        // extend entitybase

        let definitions  = getEntityDefinition(name);
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
            let customEntityPath = (headerAnnotationKeys.contains("custompath")) ? headerAnnotationKeys["custompath"] : path.join(config.server_entities_path,"custom");
            try {
                EntityBase = require(path.join(customEntityPath, headerAnnotations["custom"] || headerAnnotations["custombase"] + ".js"));
            } catch(e) {
                log.error(cjs.i18n.__('Error loading custom entity. Verify if file exists on: {{customBaseLib}} ', {customBaseLib: customBaseLib}));
                return;
            }
        } else {
            EntityBase = require('./entity-base');
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
    this.setEntity = (name, initContent) => {
        let newEntityObj = createEntity(name);
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

    /**
     * Load entity class
     * @param name
     * @returns Entity
     */
    this.loadEntity = (name) => {
         return createEntity(name);
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
     * @returns {Promise<unknown>}
     */
    this.getEntity = (entity, filter) => {
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
            log.info(cjs.i18n.__("Get entity from repository"));

            let entityDefinitions = getEntityDefinition(entity);
            if (!entityDefinitions) {
                log.error(cjs.i18n.__("Entity not defined. Did you missed the file on directory?"));
                reject(false);
                return false;
            }
            let entityData = null;
            try {
                entityData = await repositoryManager.findOne({
                    repository: entityDefinitions.entity.repository,
                    entity: entityDefinitions.entity.data.RepositoryName || entity,
                    definitions: entityDefinitions,
                    filter: filter
                });

                if (!isEmpty(entityData)) {
                    log.info("Data retrived:", entityData);
                    resolve(this.newEntity(entity, entityData));
                } else {
                    log.info("Entity not found on repository");
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
    this.getEntities = (entity, filter, options) => {
        options = options || {};
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
                //log.error(cjs.i18n.__("No entity definitions found. Did you miss the "));
                reject(null);
                return;
            }

            try {
                let entities = await repositoryManager.find({
                    repository: entityDefinitions.entity.repository,
                    entity: entityDefinitions.entity.data.RepositoryName || entity,
                    definitions: entityDefinitions,
                    filter: filter,
                    page_size : options.page_size || config.repository_page_size || 10,
                    page_number: options.page_number || 1
                });

                if (entities) {
                    log.info("Data retrieved");
                    if (options.rawData)
                        resolve(entities)
                    else {
                        let returnData = [];
                        for(let i = 0,j = entities.records.length;i<j;i++) { // converting data
                            returnData.push(this.newEntity(entity, entities.records[i]));
                        }
                        entities.records = returnData;
                        resolve(entities);
                    }
                } else {
                    log.info("Entities not found");
                    resolve(null);
                }
            } catch(e) {
                log.error(cjs.i18n.__("Could not retrieve data from repository."));
                log.error(e);
                reject(e);
            }
        });
    };

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
                    repository: entityDefinitions.entity.repository,
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

module.exports = new entityManager();