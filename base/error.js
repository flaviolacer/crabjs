function Error(message, code, stack) {
    this.message = message;
    this.code = code;
    this.stack = stack;
}

module.exports = Error;