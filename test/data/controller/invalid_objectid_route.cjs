/**
 * @Controller
 * @route('/invalid_objectid')
 */
function invalid_objectid_route() {
    /**
     * @route('/')
     * @method get
     * @nosecurity
     */
    this.get = async function () {
        let error = new Error("Invalid ObjectId for field \"_id\"");
        error.name = "InvalidObjectIdError";
        error.statusCode = 400;
        error.meta = {
            entity: "product",
            field: "_id",
            operation: "find",
            value: "invalid-id"
        };
        throw error;
    };
}

module.exports = invalid_objectid_route;
