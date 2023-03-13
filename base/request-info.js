const log = require('./log');
let RequestInfo = function () {
    return function (req, res, next) {
        let unflatten = require("flat").unflatten;
        let content = unflatten(req.query);
        content = extend(content, req.body, req.params);

        log.info(req.method+' '+req.url+' '+'content:'+JSON.stringify(content));
        next();
    };
};

module.exports = RequestInfo;