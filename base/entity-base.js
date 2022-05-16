const repositoryManager = require("./repository-manager");
const log = require('./log');

function Entity() {
    // repository destination
    this.repository;
    // entityName
    this.entityName;
    // repositoryEntityName
    this.repositoryEntityName;
    // save entity on repository
    this.save = async (options) => {
        if (isEmpty(options) || !isObject(options)) // ignore if not object or empty
            options = {};

        options.entity = this; // send entity

        log.info(cjs.i18n.__('Saving entity "{{entityName}}"...', {entityName: this.entityName}));
        if(await repositoryManager.save(options))
            log.info(cjs.i18n.__('Entity "{{entityName}}" saved', {entityName: this.entityName}));
    };
}

module.exports = Entity;