/**
 * @Controller
 * @route('/product')
 */
function product() {
    /**
     * Test default function method GET
     * @route('/')
     * @method('GET')
     */
    this.test1 = function (req, res) {
        res.send("ok");
    }

    /**
     * Test default function method POST
     * @route('/')
     * @method('POST')
     */
    this.test2 = function (req, res) {
        res.send("ok");
    }

    /**
     * Test default function method PUT
     * @route('/')
     * @method('PUT')
     */
    this.test3 = function (req, res) {
        res.send("ok");
    }

    /**
     * Test default function method PUT
     * @route('/')
     * @method('DELETE')
     */
    this.test4 = function (req, res) {
        res.send("ok");
    }

    /**
     * Test default function inverting annotations
     *  @method('GET')
     *  @route('/inv')
     */
    this.test5 = function (req, res) {
        res.send("ok");
    }

    /**
     * Test default function with params
     * @route('/:id')
     * @method('GET')
     */
    this.test6 = function (req, res) {
        res.send(req.params.id);
    }

    /**
     * Test arrow functions
     * @route('/arrow/:id')
     * @method("GET")
     */
    this.test7 = (req, res) => {
        res.send(req.params.id);
    }

    /**
     * Error on private functions
     * @route('/arrow/:id')
     * @method('DELETE')
     */
    function test8(req, res) {
        res.send(req.params.id);
    }

    /**
     * Test default function to be before all annotations
     *  @method('GET')
     *  @route('/priority')
     *  @priority
     */
    this.test9 = function (req, res) {
        res.send("ok");
    }

}

module.exports = product;