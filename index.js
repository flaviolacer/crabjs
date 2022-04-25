/// start CrabJS
const helpers = require("./base/helper")
let core = require("./base/core");
let entityManager = require("./base/entity-manager");
let routerManager = require("./base/router-manager");

exports.start = function(appDir) {
    global.appRootDir = appDir;
    console.log("Initializing CrabJS...");
    console.log("Loading Libraries...");
    // initializing express server
    core.initExpress();
    console.log("Loading Entities...");
    entityManager.init(core);
    console.log("Loading Routes...");
    routerManager.init(core);
}