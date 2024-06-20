let cjs = require('../base/cjs');
const debugLevel = {
    "debug": {value: 0},
    "info": {value: 1},
    "warn": {value: 2, colorTemplate: "\x1b[33m%s\x1b[0m"},
    "error": {value: 3, colorTemplate: "\x1b[31m%s\x1b[0m"}
}

function log() {
    let log = (level, ...args) => {
        let levelString = containsObjectKey(debugLevel, level, "value") || "info";
        if (debugLevel[cjs.config.debug.level].value <= level)
            console.log(debugLevel[levelString].colorTemplate || "", ...args);
    }

    this.info = (...args) => log(1, ...args);
    this.warn = (...args) => log(2, ...args);
    this.error = (...args) => log(3, ...args);

    this.trace = (levelColor, ...args) => {
        levelColor = levelColor || "info";
        let err = new Error();
        console.log(debugLevel[levelColor].colorTemplate || "", err.stack, ...args);
    }
    this.force = (...args) => {
        console.log(...args);
    }
}

module.exports = new log();