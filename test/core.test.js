require("../base/helper")
global.config = require("../defaults.json")
const core = require('../base/core');
const assert = require('assert');

describe('Testing core functions', () => {
    it('should start without errors', () => {
        try {
            core.initExpress();
            core.stopServer();
        } catch (e) {
            assert.fail("Failed to start server:"+e.stack);
        }
    });
});