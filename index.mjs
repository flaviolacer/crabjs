/// start CrabJS
import "./base/helper.cjs";
import log from './base/log.cjs';
import cjs from "./base/cjs.cjs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
cjs.config = require("./defaults.json");
import core from "./base/core.cjs";
import utils from "./base/utils.cjs";
import path from "path";
import routerManager from "./base/router-manager.cjs";
import entityManager from "./base/entity-manager.cjs";
import repositoryManager from "./base/repository-manager.cjs";

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
 * @param options
 * @returns {Cjs}
 */
function start(appDir, options = {}) {
    options.noserver = options.noserver || false;
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
    core.initExpress(options.noserver, options);
    if (!options.noserver) {
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
     */
    cjs.response = (res, data, code) => {
        if ((!isEmpty(code) && code !== 200))
            utils.responseError(res, data, code);
        else
            utils.responseData(res, data);
    }
    // return cjs object to app
    /** @type {Cjs} */
    return cjs;
}

export default { start };