/// start CrabJS
require("./base/helper")
const path = require("path");
const fs = require('fs');
const log = require('./base/log');
global.config = require("./defaults.json")
let core = require("./base/core");
let routerManager = require("./base/router-manager");
let entityManager = require("./base/entity-manager");

exports.start = function(appDir) {
    // global config
    global.config.app_root = (appDir);

    // check if custom config exists
    let customConfigFilename = path.join(config.app_root,config.server_config_filename);
    if (fs.existsSync(customConfigFilename)) {
        let custom_config = require(customConfigFilename);
        // merge config session
        extend(global.config, custom_config);
    }

    log.info("Initializing CrabJS...");
    log.info("Loading Libraries...");
    // initializing express server
    core.initExpress();
    log.info("Loading Routes...");
    routerManager.init(core);
    // load entityManager to memory
    entityManager.init();
    global.em = entityManager;
}