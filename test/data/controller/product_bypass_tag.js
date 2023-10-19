/**
 * @Controller
 * @route('/product_bypass_tag')
 */
function product_bypass_tag() {
    /**
     * Test default function method GET
     * @route('/')
     * @nosecurity
     * @method('GET')
     */
    this.test1 = function (req, res) {
        res.send("ok");
    }
}

module.exports = product_bypass_tag;