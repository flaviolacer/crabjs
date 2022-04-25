function error(message, code, stack) {
    this.message = message;
    this.code = code;
    this.stack = stack;
}

module.exports = error;