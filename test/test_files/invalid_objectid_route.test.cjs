require("../../base/helper.cjs");
const assert = require("assert");
const path = require("path");
const axios = require("axios").default;
const core = require("../../base/core.cjs");
const cjs = require("../../base/cjs.cjs");
const log = require("../../base/log.cjs");
const routerManager = require("../../base/router-manager.cjs");
const entityManager = require("../../base/entity-manager.cjs");
const repositoryManager = require("../../base/repository-manager.cjs");

const appRoot = path.join(__dirname, "../data");
const defaultUrl = "http://127.0.0.1:3999";

describe("Testing invalid objectId route handling", function () {
    this.timeout(5000);

    before(async () => {
        cjs.config = require("../../defaults.json");
        cjs.config.app_root = appRoot;
        cjs.config.security = null;
        cjs.config.swagger.enabled = false;
        cjs.i18n = core.loadLocales();
        cjs.config.cachePath = path.join(cjs.config.app_root, cjs.config.cache_storage_path);
        core.loadCustomConfig();
        entityManager.init();
        cjs.entityManager = entityManager;
        cjs.repositoryManager = repositoryManager;
        log.info("Initializing CrabJS...");
        core.initExpress();
        await routerManager.init(core);
    });

    after(() => {
        core.stopServer();
    });

    it("returns 400 for InvalidObjectIdError without crashing the app", async () => {
        try {
            await axios.get(defaultUrl + "/invalid_objectid/");
            assert.fail("Expected request to fail with 400");
        } catch (e) {
            assert.equal(e.code, "ERR_BAD_REQUEST");
            assert.equal(e.response?.status, 400);
            assert.equal(e.response?.data?.content, "Invalid identifier");
            assert.equal(e.response?.data?.type, "error");
        }
    });
});
