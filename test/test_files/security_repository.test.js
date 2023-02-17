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
cjs.entityManager = require("../../base/entity-manager");
const repositoryManager = require("../../base/repository-manager");
const userTokenStorage = require('../../base/security/tokens-user');
const revokedTokenStorage = require('../../base/security/tokens-revoked');

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
const repositoryTestConfig = {
    "default": "mongodb",
    "mongodb": {
        "host": "127.0.0.1",
        "port": 27017,
        "default_collection": "crabjs_test"
    }
};

let em;

describe('Testing security functions and configs with repository', function () {
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
        // set repository config
        cjs.config.repository = repositoryTestConfig;
        // set entity directory
        cjs.config.server_entities_path = "../data/entity";
        // security repository config
        cjs.config.security.security_repository = true;
        // security repository config
        userTokenStorage.type = "repository";
        revokedTokenStorage.type = "repository";

        // init server
        try {
            // set controller directory
            cjs.config.server_controllers_path = "../data/controller";
            // initialize server
            core.initExpress();
            // initialize router manager
            routerManager.init(core);
            // initialize router manager
            cjs.entityManager.init();
            em = cjs.entityManager;
        } catch (e) {
            assert.fail("Failed initializing core:" + e.message + e.stack);
        }

        try {
            // create credential on repository
            let newLogin = em.newEntity(cjs.config.security.security_entity);
            newLogin[defaultClientIdField] = securityCredentials[defaultClientIdField];
            newLogin[defaultClientSecretField] = securityCredentials[defaultClientSecretField];
            await newLogin.save();

            // set config credentials access
            let config = {
                headers: {}
            };

            config.headers[defaultClientIdField] = securityCredentials[defaultClientIdField];
            config.headers[defaultClientSecretField] = securityCredentials[defaultClientSecretField];
            let response = await axios.get(defaultUrl + defaultTokenSignInRoute, config);
            assert.ok(response.data.hasOwnProperty(defaultTokenField) && response.data.hasOwnProperty(defaultRefreshTokenField));
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
            config.headers[defaultTokenField] = authInfoGenerated[defaultTokenField];
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
                    "authorization": "Bearer " + authInfoGenerated[defaultTokenField]
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
            config.headers[defaultRefreshTokenField] = authInfoGenerated[defaultRefreshTokenField];
            let response = await axios.get(defaultUrl + defaultRefreshTokenRoute, config);
            assert.ok(response.data.hasOwnProperty(defaultTokenField) && response.data.hasOwnProperty(defaultRefreshTokenField));
            authInfoGenerated = response.data;
        } catch (e) {
            assert.fail("Failed request using method 'GET':" + e.message);
        }
    });
    it('Terminate server and tests', async () => {
        try {
            // remove credentials
            await em.removeEntities(cjs.config.security.security_entity, securityCredentials);
            // remove tokens
            await em.removeEntities(userTokenStorage.entity, {client_id: securityCredentials[defaultClientIdField]});
            // remove revoked tokens
            await em.removeEntities(revokedTokenStorage.entity, {client_id: securityCredentials[defaultClientIdField]});

            core.stopServer();
            repositoryManager.close();
            cjs.config.security = null;
        } catch (e) {
            assert.fail("Failed to stop core:" + e.message + e.stack);
        }
    });
});