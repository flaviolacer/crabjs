function Entity() {
    this.repository;
    this.entityName;

    this.save = () => {
        return "save";
    };

    this.remove = () => {
        return "remove"
    }
}

module.exports = Entity;