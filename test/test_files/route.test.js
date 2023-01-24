// noinspection ExceptionCaughtLocallyJS

require("../../base/helper");
let cjs = require('../../base/cjs');
const core = require("../../base/core");
const routerManager = require('../../base/router-manager');
const assert = require('assert');
const axios = require('axios').default;
const defaultUrl = "http://127.0.0.1:3000"; // default loopback
const defaultController = '/product';
const defaultEntityController = 'product';

describe('Testing routing functions', function () {
    // removing security
    cjs.config.security = null; // disabling security

    // removing timeout from test phase
    this.timeout(0);
    it('Test if core was initialized and loading routes', () => {
        try {
            // set controller directory
            cjs.config.server_controllers_path = "../data/controller";
            // initialize server
            core.initExpress();
            // initialize router manager
            routerManager.init(core);
        } catch (e) {
            assert.fail("Failed initializing core:" + e.message + e.stack);
        }
    });
    it('Test GET route. Should return "ok"', async () => {
        try {
            let response = await axios.get(defaultUrl + defaultController + "/");
            assert.equal(response.data, "ok", "Failed request using method 'GET'. Different response returned.")
        } catch (e) {
            assert.fail("Failed request using method 'GET':" + e.message);
        }
    });
    it('Test POST route. Should return "ok"', async () => {
        try {
            let response = await axios.post(defaultUrl + defaultController + "/");
            assert.equal(response.data, "ok", "Failed request using method 'POST'. Different response returned.")
        } catch (e) {
            assert.fail("Failed request using method 'POST':" + e.message);
        }
    });
    it('Test PUT route. Should return "ok"', async () => {
        try {
            let response = await axios.put(defaultUrl + defaultController + "/");
            assert.equal(response.data, "ok", "Failed request using method 'PUT'. Different response returned.")
        } catch (e) {
            assert.fail("Failed request using method 'PUT':" + e.message);
        }
    });
    it('Test DELETE route. Should return "ok"', async () => {
        try {
            let response = await axios.delete(defaultUrl + defaultController + "/");
            assert.equal(response.data, "ok", "Failed request using method 'DELETE'. Different response returned.")
        } catch (e) {
            assert.fail("Failed request using method 'DELETE':" + e.message);
        }
    });
    it('Test invert order of annotations. Should return "ok"', async () => {
        try {
            let response = await axios.get(defaultUrl + defaultController + "/inv");
            assert.equal(response.data, "ok", "Failed request using method 'GET'. Different response returned.")
        } catch (e) {
            assert.fail("Failed request using method 'GET':" + e.message);
        }
    });
    it('Test setup param :id. Should return the value sent in path', async () => {
        try {
            let response = await axios.get(defaultUrl + defaultController + "/value");
            assert.equal(response.data, "value", "Failed request using method 'GET'. Different response returned.")
        } catch (e) {
            assert.fail("Failed request using method 'GET':" + e.message);
        }
    });
    it('Test if works with arrow functions. Should return the value sent in path', async () => {
        try {
            let response = await axios.get(defaultUrl + defaultController + "/arrow/value");
            assert.equal(response.data, "value", "Failed request using method 'GET'. Different response returned.")
        } catch (e) {
            assert.fail("Failed request using method 'GET':" + e.message);
        }
    });
    it('Test if private functions works. Should not work', async () => {
        try {
            let response = await axios.delete(defaultUrl + defaultController + "/arrow/value");
            assert.notEqual(response.data, "value", "Failed request using method 'DELETE'. Different response returned.")
        } catch (e) {
            assert.equal(e.code, "ERR_BAD_REQUEST", "Failed to validate return message:" + e.message);
        }
    });
    it('Test entity assciation (CRUD)', async () => {
        // save values to entity
        let newProduct = {
            name: "testname",
            description: "testdescription"
        };

        // empty repository to start tests
        await cjs.entityManager.removeEntities(defaultEntityController, {__force_delete: true});

        try {
            // test insert (POST)
            let responsePost = await axios.post(defaultUrl + `/${defaultEntityController}_entity/`, {
                name: newProduct.name,
                description: newProduct.description
            });

            if (isEmpty(responsePost.data)) {
                let error = new Error("Product not inserted.");
                error.code = "ERR_PRODUCT_EMPTY";
                throw error;
            }

            // test retrieve (GET)
            let responseGet = await axios.get(defaultUrl + `/${defaultEntityController}_entity/${responsePost.data.content._id}`);
            if (isEmpty(responseGet.data)) {
                let error = new Error("Cannot make request");
                error.code = "ERR_EMPTY";
                throw error;
            }

            let retProduct = responseGet.data.content;
            if (retProduct.name !== newProduct.name || retProduct.type === "error") {
                let error = new Error("Product dos not match with the saved one");
                error.code = "ERR_PRODUCT_EMPTY";
                throw error;
            }

            // test update (PUT)
            let responsePut = await axios.put(defaultUrl + `/${defaultEntityController}_entity/${responsePost.data.content._id}`, {
                name: newProduct.name + "1",
                description: newProduct.description
            });
            if (isEmpty(responsePut.data)) {
                let error = new Error("Cannot make request");
                error.code = "ERR_EMPTY";
                throw error;
            }

            // test if update worked
            let responseGetUpdate = await axios.get(defaultUrl + `/${defaultEntityController}_entity/${responsePost.data.content._id}`);
            let retProductUpdated = responseGetUpdate.data.content;

            if (isEmpty(retProductUpdated) || retProductUpdated.name !== newProduct.name + "1") {
                let error = new Error("Product dos not match with the updated one");
                error.code = "ERR_PRODUCT_UPDATE";
                throw error;
            }

            // test remove (DELETE)
            let responseDelete = await axios.delete(defaultUrl + `/${defaultEntityController}_entity/${responsePost.data.content._id}`);
            if (isEmpty(responseDelete.data)) {
                let error = new Error("Cannot make request");
                error.code = "ERR_EMPTY";
                throw error;
            }

            // test if delete worked
            let responseGetDelete = await axios.get(defaultUrl + `/${defaultEntityController}_entity/${responsePost.data.content._id}`);
            let retProductDeleted = responseGetDelete.data.content;

            if (!isEmpty(retProductDeleted)) {
                let error = new Error("Product still on database after delete");
                error.code = "ERR_PRODUCT_EXISTS";
                throw error;
            }

            // test multiple records
            // insert multiple records (POST)
            let insertEntities = [
                {name: newProduct.name, description: newProduct.description},
                {name: newProduct.name, description: newProduct.description + "1"},
                {name: newProduct.name, description: newProduct.description + "2"},
            ];
            let responseBatchPost = await axios.post(defaultUrl + `/${defaultEntityController}_entity/`, insertEntities);

            if (isEmpty(responseBatchPost.data)) {
                let error = new Error("Products not inserted.");
                error.code = "ERR_PRODUCT_EMPTY";
                throw error;
            }

            // validate that iserted 3
            if (responseBatchPost.data.content.insertedCount !== 3) {
                let error = new Error("Error trying to insert batch");
                error.code = "ERR_PRODUCT_BATCH";
                throw error;
            }

            // get multiple entities
            let responseGetMultiple = await axios.get(defaultUrl + `/${defaultEntityController}_entity/`);
            if (isEmpty(responseGetMultiple.data)) {
                let error = new Error("Cannot make request");
                error.code = "ERR_EMPTY";
                throw error;
            }

            // validate returned 3
            if (!isArray(responseGetMultiple.data.content.records) || responseGetMultiple.data.content.totalRecords < 3) {
                let error = new Error("Error trying to get multiple records");
                error.code = "ERR_PRODUCT_MULTIPLE";
                throw error;
            }

            // update multiple records
            let responsePutMultiple = await axios.put(defaultUrl + `/${defaultEntityController}_entity/`, {
                name: newProduct.name + "1",
                description: newProduct.description,
                __filter: {"name": newProduct.name}
            });
            if (isEmpty(responsePutMultiple.data)) {
                let error = new Error("Cannot make request");
                error.code = "ERR_EMPTY";
                throw error;
            }

            // validate update multiple records
            let responsePutGetMultiple = await axios.get(defaultUrl + `/${defaultEntityController}_entity/`);
            await responsePutGetMultiple.data.content.records.forEach(function (record) {
                if (record.name !== newProduct.name + "1") {
                    let error = new Error("Error trying to validate update multiple");
                    error.code = "ERR_PRODUCT_UPDATE";
                    throw error;
                }
            });

            // test remove (DELETE)
            let responseDeleteMultiple = await axios.delete(defaultUrl + `/${defaultEntityController}_entity/`, {data: {"name": newProduct.name + "1"}});
            if (isEmpty(responseDeleteMultiple.data)) {
                let error = new Error("Cannot make request");
                error.code = "ERR_EMPTY";
                throw error;
            }

            let responseDeleteGetMultiple = await axios.get(defaultUrl + `/${defaultEntityController}_entity/`);
            if (responseDeleteGetMultiple.data.content.totalRecords > 0) {
                let error = new Error("Error trying to validate delete multiple");
                error.code = "ERR_PRODUCT_UPDATE";
                throw error;
            }
        } catch (e) {
            assert.fail("Cannot process entity association. Error: " + e.message);
        }
    });
    it('Should stop with no errors', () => {
        try {
            core.stopServer();
        } catch (e) {
            assert.fail("Failed to stop core:" + e.message + e.stack);
        }
    });
});