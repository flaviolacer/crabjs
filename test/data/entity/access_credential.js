/**
 * @Entity
 * @RepositoryName('access_credentials')
 */
function access_credential() {
    /**
     * @field
     * @primaryKey
     * @type = objectId
     * */
    this._id;

    /** @field */
    this.client_id;

    /**
     * @field
     * @required
     */
    this.client_secret;

    /**
     * @field
     */
    this.description;
}

module.exports = access_credential;