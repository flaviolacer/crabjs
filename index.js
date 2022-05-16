/// start CrabJS
require("./base/helper")
const log = require('./base/log');
let cjs = require("./base/cjs");
cjs.config = require("./defaults.json")
let core = require("./base/core");
let routerManager = require("./base/router-manager");
let entityManager = require("./base/entity-manager");

exports.start = function(appDir) {
    process.env.DEBUG = "i18n:debug";
    cjs.entityManager = null;
    // global config
    cjs.config.app_root = appDir;
    // check if custom config exists
    core.loadCustomConfig();
    // load locales
    cjs.i18n = core.loadLocales();
    log.info("Initializing CrabJS...");
    log.info("Loading Libraries...");
    // initializing express server
    core.initExpress();
    log.info("Loading Routes...");
    routerManager.init(core);
    // load entityManager to memory
    entityManager.init();
    cjs.entityManager = entityManager;
    // return cjs object to app
    return cjs;
}