const log = require('./log.cjs');
const fs = require('fs');
const cjs = require("./cjs.cjs");
const handlebars = require("handlebars");

/**
 * @class Util
 * @constructor
 */
function Util() {
    this.checkLibExists = (libName) => {
        try {
            require.resolve(libName);
            return libName;
        } catch (e) {
        }
        try {
            require.resolve(`${libName}.cjs`);
            return `${libName}.cjs`;
        } catch (e) {
        }
        return false;
    }

    this.checkCachePath = () => {
        if (!fs.existsSync(cjs.config.cachePath))
            try {
                fs.mkdirSync(cjs.config.cachePath);
            } catch (e) {
                log.error(e);
            }
    }

    this.UID = function (length) {
        if (typeof length === 'undefined') {
            length = 8;
        }
        if (length < 1) {
            console.warn('Invalid nonce length.');
        }
        let nonce = '';
        for (let i = 0; i < length; i++) {
            let character = Math.floor(Math.random() * 61);
            nonce += '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'.substring(character, character + 1);
        }
        return nonce;
    };

    this.responseError = function (res, message, code, data) {
        if (isEmpty(res) || res.headersSent) return;

        code = code || 500;
        let ResponseError = require("./response-error.cjs");
        let responseError = new ResponseError(message, code);
        responseError.type = "error";
        if (data)
            responseError.data = data;

        res.status(code);
        res.json(responseError);
    }

    function cleanEntity(data) {
        delete data.__definitions;
        delete data.entity;
    }

    this.responseData = function (res, content, params) {
        if (isEmpty(res) || res.headersSent) return;
        let response = {
            content: content
        };

        if (isObject(content)) {
            // check if is entity and remove unecessary fields
            if (content.entityName)
                cleanEntity(content);

            // clean internal variables
            let keys = Object.keys(content);
            for(let i = 0, j = keys.length; i < j; i++)
                if (keys[i].startsWith("__") || keys[i].startsWith("$"))
                    delete content[keys[i]];

            response["content"] = content;

            if (!isEmpty(params))
                response = extend(response, params);
            res.send(response);
        } else
            res.send(response);
    }

    this.removeRouteFromStack = (app, method, path) => {
        let routeStack = app.stack || [];
        if (path.contains(':')) {
            let infoPath = path.split(':');
            path = infoPath[0]+":";
            for (let i = 0, j = routeStack.length; i < j; i++)
                if (routeStack[i].route && routeStack[i].route.path.startsWith(path) && routeStack[i].route.methods[method]) {
                    routeStack.splice(i, 1);
                    return;
                }
        } else {
            for (let i = 0, j = routeStack.length; i < j; i++)
                if (routeStack[i].route && routeStack[i].route.path === path && routeStack[i].route.methods[method]) {
                    routeStack.splice(i, 1);
                    return;
                }
        }
    }

    this.sendRouteToFirstOnMethod = (app, method) => {
        let routeStack = app.stack || [];
        if (routeStack.length <= 1) return;
        let lastStackValue = app.stack.pop();
        for (let i = 0, j = routeStack.length; i < j; i++)
            if (routeStack[i].route.methods[method] && lastStackValue.route.methods[method]) {
                app.stack.splice(i, 0, lastStackValue);
                return;
            }
        app.stack.push(lastStackValue);
    }

    this.formatTextController = (text, params) => {
        if (isEmpty(text)) return;
        let textMatchRegex = /\$\[([\s\n*@a-zA-Z0-9_])*]/gm;
        let matches = [...text.matchAll(textMatchRegex)];
        if (matches.length === 0) return text;
        for (let i = 0, j = matches.length; i < j; i++) {
            let match = matches[i];
            let matchReplace = match[0];
            matchReplace = matchReplace.replace("$[", "{{").replace("]", "}}");
            text = text.replace(match[0], matchReplace);
        }
        const template = handlebars.compile(text);
        return template(params).toString();
    }
}

module.exports = new Util();