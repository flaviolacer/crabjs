/**
 * @Entity
 * @RepositoryName('access_storage')
 */
function access_storage() {
    /**
     * @field("_id")
     * @primaryKey
     **/
    this.key;

    /** @field */
    this.value;
}

module.exports = access_storage;