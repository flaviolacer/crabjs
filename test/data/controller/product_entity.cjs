/**
 * @Controller
 * @route('/product_entity')
 * @entity('product')
 */
function product_entity() {
    /**
     * @route('/test/items')
     * @method get
     */
    this.get_test = async function (req, res) {
        let cjs = require('../../../base/cjs.cjs');
        let ceb = await cjs.getControllerEntityBase('product');
        ceb.__get(req, res);
    }
}

module.exports = product_entity;