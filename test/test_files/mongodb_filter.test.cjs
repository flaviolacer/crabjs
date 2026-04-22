require("../../base/helper.cjs");
const assert = require("assert");
const cjs = require("../../base/cjs.cjs");
const MongoDBDriver = require("../../base/repository-drivers/mongodb.cjs");

cjs.config = cjs.config || {};
cjs.config.debug = cjs.config.debug || {level: "error"};

const definitions = {
    entity: {
        data: {
            RepositoryName: "products"
        }
    },
    fields: {
        name: {
            type: "string"
        },
        description: {
            type: "string"
        }
    }
};

const createDriver = () => {
    const aggregateCalls = [];
    const driver = new MongoDBDriver();

    driver.getDb = async () => driver.db;
    driver.db = {
        collection: () => ({
            aggregate: (pipeline) => {
                aggregateCalls.push(pipeline);
                return {
                    next: async () => ({count: 0}),
                    toArray: async () => []
                };
            }
        })
    };

    return {driver, aggregateCalls};
};

describe("Testing MongoDB filter translation", function () {
    it("escapes term values before building RegExp filters", async () => {
        const {driver, aggregateCalls} = createDriver();

        await driver.find({
            entity: "product",
            definitions,
            filter: {
                __term: {
                    fields: "name,description",
                    value: "ana teresa vianna["
                }
            }
        });

        const match = aggregateCalls[1][0].$match;
        const firstTermRegex = match.$and[0].$or[0].name;

        assert.ok(firstTermRegex instanceof RegExp);
        assert.equal(firstTermRegex.source, "ana teresa vianna\\[");
        assert.equal(firstTermRegex.test("ana teresa vianna["), true);
    });

    it("escapes like values and keeps regex values explicit", async () => {
        const likeContext = createDriver();

        await likeContext.driver.find({
            entity: "product",
            definitions,
            filter: {
                name: {
                    __like: "email+alias@example.com"
                }
            }
        });

        const likeRegex = likeContext.aggregateCalls[1][0].$match.name;
        assert.equal(likeRegex.source, "email\\+alias@example\\.com");

        const regexContext = createDriver();

        await regexContext.driver.find({
            entity: "product",
            definitions,
            filter: {
                name: {
                    __regex: "^ana.*\\[$"
                }
            }
        });

        const explicitRegex = regexContext.aggregateCalls[1][0].$match.name;
        assert.equal(explicitRegex.source, "^ana.*\\[$");
    });
});
