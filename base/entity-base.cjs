const cjs = require("./cjs.cjs");
const repositoryManager = require("./repository-manager.cjs");
const log = require('./log.cjs');

function Entity() {
    /**
     * Repository of entity
     */
    this.repository;
    /**
     * Entity name
     */
    this.entityName;

    /**
     * Save entity in repository
     * @param options
     * @returns {Promise<void>}
     */
    this.save = async (options) => {
        if (isEmpty(options) || !isObject(options)) // ignore if not object or empty
            options = {};

        options.entity = this; // send entity

        log.info(cjs.i18n.__('Saving entity "{{entityName}}"...', {entityName: this.entityName}));
        let ret = await repositoryManager.save(options);
        if(ret)
            log.info(cjs.i18n.__('Entity "{{entityName}}" saved', {entityName: this.entityName}));
        return ret;
    };

    this.remove = async (options) => {
        if (isEmpty(options) || !isObject(options)) // ignore if not object or empty
            options = {};

        options.entity = this; // send entity

        log.info(cjs.i18n.__('Removing entity "{{entityName}}"...', {entityName: this.entityName}));
        if (await repositoryManager.remove(options))
            log.info(cjs.i18n.__('Entity "{{entityName}}" removed', {entityName: this.entityName}));
    }
}

module.exports = Entity;