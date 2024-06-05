/// start CrabJS
require("./base/helper")
const log = require('./base/log');
let cjs = require("./base/cjs");
cjs.config = require("./defaults.json")
let core = require("./base/core");
const utils = require("./base/utils");
let routerManager = require("./base/router-manager");
let entityManager = require("./base/entity-manager");
const path = require("path");

exports.start = function (appDir, noserver) {
    process.env.DEBUG = "i18n:debug";
    cjs.entityManager = null;
    // global config
    cjs.config.app_root = appDir;
    // load locales
    cjs.i18n = core.loadLocales();
    cjs.config.cachePath = path.join(cjs.config.app_root, cjs.config.cache_storage_path);
    // check if custom config exists
    core.loadCustomConfig();
    log.info("Initializing CrabJS...");
    log.info("Loading Libraries...");
    // initializing express server
    core.initExpress(noserver);
    if (!noserver) {
        log.info("Loading Routes...");
        routerManager.init(core);
    }
    // load entityManager to memory
    entityManager.init();
    cjs.entityManager = entityManager;
    cjs.repositoryManager = require("./base/repository-manager");
    cjs.app = core.expressInstance;
    cjs.security = core.security;
    cjs.utils = utils;
    // return cjs object to app
    return cjs;
}