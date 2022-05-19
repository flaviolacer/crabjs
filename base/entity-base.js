const repositoryManager = require("./repository-manager");
const log = require('./log');

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
     * Name of the entity in repository
     */
    this.repositoryEntityName;

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
        if (await repositoryManager.save(options))
            log.info(cjs.i18n.__('Entity "{{entityName}}" saved', {entityName: this.entityName}));
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