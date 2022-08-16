require("../../base/helper");
let cjs = require('../../base/cjs');
cjs.config = { ... require("../../defaults.json") };
cjs.config.app_root = __dirname;
cjs.config.hide_start_log = true;
const core = require('../../base/core');
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