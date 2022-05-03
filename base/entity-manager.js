const path = require("path");
const fs = require('fs');
const log = require('./log');
const annotation = require('./annotation');

function entityManager() {
    let instance = this;

    /**
     * Initialize entity manager
     */
    this.init = () => {
        if (isEmpty(config.server_entities_path) || config.server_entities_path.startsWith('.') || !config.server_entities_path.startsWith('/'))
            config.server_entities_path = path.join(config.app_root, config.server_entities_path);
    }

    // initialize entityDefinitions
    this._entityDefinitions = {};

    /**
     * Create entity to manipulate repository data
     * @param name
     * @returns {*}
     */
    this.createEntity = name => {
        if (isEmpty(name)) {
            log.error("You must specify the name of the entity to create a new one.");
            return;
        }
        let entityFilename = name.contains("\\.") ? name : name + '.js';
        let entityFilepath = path.join(config.server_entities_path, entityFilename);
        if (!fs.existsSync(entityFilepath)) {
            log.error(`Entity definition not found. Missing create it (${name})?`);
            return;
        }
        // create entity and extend is to base
        let newEntityInstantiated = require(entityFilepath);
        if (newEntityInstantiated.constructor.name.toLowerCase() === "function") newEntityInstantiated = new newEntityInstantiated();
        newEntityInstantiated = extend(newEntityInstantiated, require("./entity-base"));

        // load entity definitions
        // check if already exists in memory
        if (!em._entityDefinitions[name]) {
            let annotations = annotation.parseSync(entityFilepath);
            let annotationFunctionsKeys = Object.keys(annotations.functions);
            if (annotations.functions && annotationFunctionsKeys.length > 0) { // start mapping fields
                let entityInfo;
                try {
                    entityInfo = instance.getEntitiesAnnotationsInfo(annotations);
                } catch (e) {
                    log.error(`Annotation "@Entity" not found on entity file "${name}"`);
                }
                newEntityInstantiated._definitions = entityInfo;
            }
        } else
            newEntityInstantiated._definitions = em._entityDefinitions[name];

        return newEntityInstantiated;
    }

    /**
     * Get information about detected annotations
     * @param annotations
     * @returns {{routes: *[]}}
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

            if (fieldAnnotationData.contains('primary'))
                entityInfo.primaryKeys.push({
                    "fname": fieldAnnotationKey, data: annotations.fields[fieldAnnotationKey]
                }); else if (fieldAnnotationData.contains('field'))
                    entityInfo.fields[fieldAnnotationKey] = annotations.fields[fieldAnnotationKey]
        }

        if (!entityInfo.entity) {
            throw new Error("Annotation Entity not found");
        }

        return entityInfo;
    };
}

module.exports = new entityManager();