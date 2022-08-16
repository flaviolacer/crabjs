require("../../base/helper");
let cjs = require('../../base/cjs');
const core = require("../../base/core");
const routerManager = require('../../base/router-manager');
const assert = require('assert');
const axios = require('axios').default;
const defaultUrl = "http://127.0.0.1:3000"; // default loopback
const defaultController = '/product';

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
    it('Should stop with no errors', () => {
        try {
            core.stopServer();
        } catch (e) {
            assert.fail("Failed to stop core:" + e.message + e.stack);
        }
    });
});