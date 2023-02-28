/**
 * @Entity
 * @RepositoryName('products')
 */
function product() {
    /**
     * @field
     * @primaryKey
     * @type = objectId
     * */
    this._id;

    /** @field */
    this.name;

    /**
     * @field
     * @required
     */
    this.description;

    /**
     * @field
     * @type = float
     */
    this.price;

    /**
     * @field
     * @defaultValue = 'item'
     */
    this.type;

    /**
     * @constructor
     */
    this.test = function() {

    }
}

module.exports = product;