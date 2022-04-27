const debug_level = {
    "info": 1,
    "warn": 2,
    "error": 3
}
function log() {
    this.info = (...args) => {
        if (debug_level[config.debug.level] <= 1)
            console.log(...args);
    }
    this.warn = (...args) => {
        if (debug_level[config.debug.level] <= 2)
            console.log("\x1b[33m%s\x1b[0m", ...args);
    }
    this.error = (...args) => {
        if (debug_level[config.debug.level] <= 3)
            console.log("\x1b[31m%s\x1b[0m", ...args);
    }
    this.force = (...args) => {
            console.log(...args);
    }
}

module.exports = new log();