function log() {
    this.info = (...args) => {
        console.log(...args);
    }
    this.error = (...args) => {
        console.log("\x1b[31m%s\x1b[0m",...args);
    }
    this.warn = (...args) => {
        console.log("\x1b[33m%s\x1b[0m",...args);
    }
}

module.exports = new log();