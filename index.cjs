/// start CrabJS
require("./base/helper")
const log = require('./base/log');
let cjs = require("./base/cjs");
cjs.config = require("./defaults.json")
let core = require("./base/core");
const utils = require("./base/utils");
let routerManager = require("./base/router-manager");
let entityManager = require("./base/entity-manager");
let repositoryManager = require("./base/repository-manager");
const path = require("path");

/**
 * @typedef Cjs
 * @type {object}
 * @property {entityManager} entityManager
 * @property {repositoryManager} repositoryManager
 * @property {utils} utils
 * @property {function} response
 **/
/**
 * @module Cjs
 */
/**
 * @param {string} appDir
 * @param {bool} noserver
 * @returns {Cjs}
 */
exports.start = function (appDir, noserver = false) {
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
    cjs.repositoryManager = repositoryManager;
    cjs.app = core.expressInstance;
    cjs.security = core.security;
    cjs.utils = utils;

    /**
     * @param res
     * @param data
     * @param code
     * @param options
     */
    cjs.response = (res, data, code, options) => {
        options = options || {};
        options.error = options.error || false;
        if (options.error)
            utils.responseError(res, data, code, options.data);
        else
            utils.responseData(res, data);
    }
    // return cjs object to app
    /** @type {Cjs} */
    return cjs;
}