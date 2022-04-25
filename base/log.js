function log() {
    this.info = (...args) => {
        console.log(...args);
    }
    this.error = (...args) => {
        console.error(...args);
    }
}

module.exports = new log();