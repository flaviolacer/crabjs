/**
 * @Entity
 * @RepositoryName('products_custom')
 * @CustomBase('entity-base')
 */
function product_custom() {
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
     * @constructor
     */
    this.test = function() {

    }
}

module.exports = product_custom;