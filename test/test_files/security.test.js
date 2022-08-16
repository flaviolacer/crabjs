require("../../base/helper");
let cjs = require('../../base/cjs');
const routerManager = require('../../base/router-manager');
const assert = require('assert');
const core = require("../../base/core");
const utils = require("../../base/utils");
const axios = require('axios').default;
const defaultUrl = "http://127.0.0.1:3000"; // default loopback
const defaultController = '/product';
const security = {...require("../../defaults.json").security};
const defaultClientIdField = security.jwt.sign_client_id_field;
const defaultClientSecretField = security.jwt.sign_client_secret_field;
const defaultTokenSignInRoute = security.jwt.token_signin_route;
const defaultTokenField = security.jwt.token_field;
const defaultRefreshTokenField = security.jwt.refresh_token.refresh_token_field;
const defaultRefreshTokenRoute = security.jwt.refresh_token.refresh_token_route;
const securityCredentials = {};
securityCredentials[defaultClientIdField] = "testId";
securityCredentials[defaultClientSecretField] = "testSecret";
let authInfoGenerated;

describe('Testing security functions and configs', function () {
    // removing timeout from test phase
    this.timeout(0);
    it('Config credential test', async () => {
        // set security
        cjs.config.security = {...require("../../defaults.json").security};
        // set credentials to test
        cjs.config.security[defaultClientIdField] = securityCredentials[defaultClientIdField];
        cjs.config.security[defaultClientSecretField] = securityCredentials[defaultClientSecretField];
        // set encryption key
        cjs.config.security.encryption_key = utils.UID(32); // random hash
        // bypass
        cjs.secBypassRoutes = ["product_bypass"];

        // init server
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

        try {
            // set config credentials access
            let config = {
                headers: {}
            };
            config.headers[defaultClientIdField] = securityCredentials[defaultClientIdField];
            config.headers[defaultClientSecretField] = securityCredentials[defaultClientSecretField];
            let response = await axios.get(defaultUrl + defaultTokenSignInRoute, config);
            assert.ok(response.data.hasOwnProperty('token') && response.data.hasOwnProperty('refreshToken'));
            authInfoGenerated = response.data;
        } catch (e) {
            assert.fail("Failed request using method 'GET':" + e.message);
        }
    });
    it('Test token access', async () => {
        try {
            // set config credentials access
            let config = {
                headers: {}
            };
            config.headers[defaultTokenField] = authInfoGenerated.token;
            let response = await axios.get(defaultUrl + defaultController + "/", config);
            assert.equal(response.data, "ok", "Failed request using method 'GET'. Different response returned.")
        } catch (e) {
            assert.fail("Failed request using method 'GET':" + e.message);
        }
    });
    it('Test BEARER token access', async () => {
        try {
            // set config credentials access
            let config = {
                headers: {
                    "authorization" : "Bearer "+authInfoGenerated.token
                }
            };
            let response = await axios.get(defaultUrl + defaultController + "/", config);
            assert.equal(response.data, "ok", "Failed request using method 'GET'. Different response returned.")
        } catch (e) {
            assert.fail("Failed request using method 'GET':" + e.message);
        }
    });
    it('Test BYPASS security access', async () => {
        try {
            let response = await axios.get(defaultUrl + defaultController + "_bypass/");
            assert.equal(response.data, "ok", "Failed request using method 'GET'. Different response returned.")
        } catch (e) {
            assert.fail("Failed request using method 'GET':" + e.message);
        }
    });
    it('Test refreshToken security access', async () => {
        try {
            // set config credentials access
            let config = {
                headers: {}
            };
            config.headers[defaultRefreshTokenField] = authInfoGenerated.refreshToken;
            let response = await axios.get(defaultUrl + defaultRefreshTokenRoute, config);
            assert.ok(response.data.hasOwnProperty('token') && response.data.hasOwnProperty('refreshToken'));
            authInfoGenerated = response.data;
        } catch (e) {
            assert.fail("Failed request using method 'GET':" + e.message);
        }
    });
    it('Terminate server and tests', () => {
        try {
            core.stopServer();
            cjs.config.security = null;
        } catch (e) {
            assert.fail("Failed to stop core:" + e.message + e.stack);
        }
    });
});