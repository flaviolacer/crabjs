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
        let entityFilename = name.contains("\\.") ? name : name + '.js';
        let entityFilepath = path.join(config.server_entities_path, entityFilename);

        // check if already exists in memory
        if (!cjs.entityManager.__entityDefinitions[name]) {
            let annotations = annotation.parseSync(entityFilepath);

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
    }

    /**
     * Initialize entity manager
     */
    this.init = () => {
        if (isEmpty(config.server_entities_path) || config.server_entities_path.startsWith('.') || !config.server_entities_path.startsWith('/'))
            cjs.config.server_entities_path = path.join(config.app_root, config.server_entities_path);
    }

    let createEntity = name => {
        if (isEmpty(name)) {
            log.error(cjs.i18n.__("You must specify the name of the entity to create a new one."));
            return;
        }
        let entityFilename = name.contains("\\.") ? name : name + '.js';
        let entityFilepath = path.join(config.server_entities_path, entityFilename);
        if (!fs.existsSync(entityFilepath)) {
            log.error(cjs.i18n.__('Entity definition not found. Missing create it {{name}}?', {name: name}));
            return;
        }
        // create entity and extend is to base
        let newEntityInstantiated = require(entityFilepath);
        if (newEntityInstantiated.constructor.name.toLowerCase() === "function") newEntityInstantiated = new newEntityInstantiated();
        // extend entitybase
        let EntityBase = require('./entity-base');
        let entityBase = new EntityBase();
        newEntityInstantiated = extend(entityBase, newEntityInstantiated);

        // load entity definitions
        newEntityInstantiated.__definitions = getEntityDefinition(name);

        // load entity info
        newEntityInstantiated.entityName = name;
        let annotationMapKeys = Object.keys(newEntityInstantiated.__definitions.entity.data);

        // map annotation entity properties to the object
        for (let i = 0, j = annotationMapKeys.length; i < j; i++)
            newEntityInstantiated[lowerFirstLetter(annotationMapKeys[i])] = newEntityInstantiated.__definitions.entity.data[annotationMapKeys[i]];

        // remove entity definition
        delete newEntityInstantiated.entity;

        return newEntityInstantiated;
    }

    /**
     * Create entity to manipulate repository data
     * @param name
     * @param initContent
     * @returns Entity
     */
    this.newEntity = (name, initContent) => {
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
            await repositoryManager.insertBatch({
                repository: entityDefinitions.entity.repository,
                entity: entityDefinitions.entity.data.RepositoryName || entity,
                data: data
            });
            resolve();
        });
    }

    /**
     * Retrieve entity from repository
     * @param entity
     * @param filter
     * @returns {Promise<unknown>}
     */
    this.getEntity = (entity, filter) => {
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
    }
}

module.exports = new entityManager();