require("../../base/helper");
let cjs = require('../../base/cjs');
const core = require("../../base/core");
const assert = require('assert');

describe('Testing loading config functions', function() {
    // removing timeout from test phase
    this.timeout(0);
    it('Configurations loaded?', () => {
        // change directory to access the test config
        cjs.config.server_config_filename = "../data/config/" + cjs.config.server_config_filename;
        core.loadCustomConfig();
        assert.equal(cjs.config.configdata, true, "Failed on validate custom config file");
    });
});