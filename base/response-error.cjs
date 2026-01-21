function ResponseError(content, code) {
    this.content = content;
    this.code = code;
}

module.exports = ResponseError;