require("../../base/helper");
let cjs = require('../../base/cjs');
const assert = require('assert');
cjs.entityManager = require("../../base/entity-manager");
const repositoryManager = require("../../base/repository-manager");

const repositoryTestConfig = {
    "default": "mongodb",
    "mongodb": {
        "host": "127.0.0.1",
        "port": 27017,
        "default_collection": "crabjs_test"
    },
    "mongodb2": {
        "driver": "mongodb",
        "host": "127.0.0.1",
        "port": 27017,
        "default_collection": "crabjs_test"
    }
};
const testEntityName = 'product';
const testProductItem = {
    "_id" : "628273f39dbb556469346494",
    "name" : "Test name",
    "description" : "Description teste"
}
let em;

describe('Testing repository functions', function () {
    // removing timeout from test phase
    this.timeout(0);
    it('Test loading and connection', () => {
        cjs.config.repository = repositoryTestConfig;
        try {
            // set entity directory
            cjs.config.server_entities_path = "../data/entity";
            // initialize router manager
            cjs.entityManager.init();
            em = cjs.entityManager;
        } catch (e) {
            assert.fail("Failed initializing entity manager:" + e.message + e.stack);
        }
    });
    it('Test insert entity on repository', async () => {
        try {
            let newProduct = em.newEntity(testEntityName);
            newProduct._id = testProductItem._id;
            newProduct.name = testProductItem.name;
            newProduct.description = testProductItem.description;
            await newProduct.save();
        } catch (e) {
            assert.fail("Failed on insert entity:" + e.message + e.stack);
        }
    });
    it('Test get entity from repository', async () => {
        try {
            let testProduct = await em.getEntity("product", {_id: testProductItem._id});
            assert.ok(testProduct);

        } catch (e) {
            assert.fail("Failed to get entity:" + e.message + e.stack);
        }
    });
    it('Test update entity in repository', async () => {
        try {
            let testProduct = await em.getEntity("product", {_id: testProductItem._id});
            testProduct.name = "test2";
            testProduct.save();
            assert.ok(testProduct);

        } catch (e) {
            assert.fail("Failed to update entity:" + e.message + e.stack);
        }
    });
    it('Test remove entity from repository', async () => {
        try {
            let testProduct = await em.getEntity("product", {_id: testProductItem._id});
            testProduct.remove();
        } catch (e) {
            assert.fail("Failed to remove entity:" + e.message + e.stack);
        }
    });
    it('Test insert entities in repository', async () => {
        try {
            // insertBatch
            let arrayInsert = [
                {name: testProductItem.name, definition: "Test1"},
                {name: testProductItem.name, definition: "Test2"},
                {name: testProductItem.name, definition: "Test3"},
                {name: testProductItem.name, definition: "Test4"},
                {name: testProductItem.name, definition: "Test5"},
            ];
            await em.insertBatch("product", arrayInsert);
        } catch (e) {
            assert.fail("Failed to insert entities:" + e.message + e.stack);
        }
    });
    it('Test to get entities from repository', async () => {
        try {
            // search for entities
            let entities = await em.getEntities("product", {name: testProductItem.name});
            assert.equal(entities.totalRecords, 5, "Failed on validation on get entities");
        } catch (e) {
            assert.fail("Failed to get entities:" + e.message + e.stack);
        }
    });
    it('Test remove entities from repository', async () => {
        try {
            await em.removeEntities("product", {"name": testProductItem.name});
        } catch (e) {
            assert.fail("Failed to remove entities:" + e.message + e.stack);
        }
    });
    it('Validate repository data', async () => {
        try {
            // search for entities
            let entities = await em.getEntities("product", {name: testProductItem.name});
            assert.equal(entities.totalRecords, 0, "Failed on validation on get entities");
        } catch (e) {
            assert.fail("Failed to get entity:" + e.message + e.stack);
        }
    });
    it('Test custom entity base', async () => {
        try {
            // search for entities
            let saveRet = em.newEntity('product_custom');
            assert.equal(saveRet.save(), "save", "Failed on validation on get entities");
        } catch (e) {
            assert.fail("Failed to get entity:" + e.message + e.stack);
        }
    });
    it('Close all connections', async () => {
        try {
            repositoryManager.close();
        } catch (e) {
            assert.fail("Failed to get entity:" + e.message + e.stack);
        }
    });
});