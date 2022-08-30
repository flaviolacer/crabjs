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
     * @returns {string}
     */
    this.save = (options) => {
        return "save";
    };

    this.remove = (options) => {
        return "remove"
    }
}

module.exports = Entity;