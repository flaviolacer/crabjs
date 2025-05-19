require("../../base/helper.cjs");
let cjs = require('../../base/cjs.cjs');
cjs.config = { ... require("../../defaults.json") };
cjs.config.app_root = __dirname;
cjs.config.hide_start_log = true;
// set entity directory
cjs.config.server_entities_path = "../data/entity.cjs";
const core = require('../../base/core.cjs');
cjs.i18n = core.loadLocales();
const assert = require('assert');

describe('Testing core functions', function () {
    // removing timeout from test phase
    this.timeout(0);
    it('Should start without errors', () => {
        try {
            core.initExpress();
            core.stopServer();
        } catch (e) {
            assert.fail("Failed to start server:" + e.message + e.stack);
        }
    });
});