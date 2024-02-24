// Variables
global.__cjs_base_path = __dirname;

// prototypes
String.prototype.contains = function (it, delimiter) {
    delimiter = delimiter || "";
    if (isString(it))
        return this.toLowerCase().indexOfRegex((delimiter + it + delimiter).toLowerCase()) !== -1;
    else if (isArray(it)) {
        for (let i = 0, j = it.length; i < j; i++) {
            if (this.toLowerCase().indexOfRegex((delimiter + it[i] + delimiter).toLowerCase()) !== -1)
                return true;
        }
    }
    return false;
};

String.prototype.replaceAll = function (search, replacement) {
    let target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

String.prototype.indexOfRegex = function (regex) {
    let match = this.match(regex);
    return match ? this.indexOf(match[0]) : -1;
};

String.prototype.lastIndexOfRegex = function (regex) {
    let match = this.match(regex);
    return match ? this.lastIndexOf(match[match.length - 1]) : -1;
};

Array.prototype.contains = function (k) {
    for (let p in this)
        if (this[p].toLowerCase && (this[p].toLowerCase() === k.toLowerCase()))
            return true;
    return false;
};

global.containsObjectKey = function (obj, k, key) {
    for (let p in obj) {
        let comp_value = obj[p][key];
        if (isEmpty(comp_value)) continue;
        if (comp_value === k)
            return p;
    }
    return false;
};

Array.prototype.clone = function () {
    return this.slice(0);
};

//global functions
global.isEmpty = function (obj) {
    return ((typeof obj === 'undefined' || obj === null || obj === '') || (isArray(obj) && (obj.length === 0) && Object.keys(obj).length === 0) || (isObject(obj) && (Object.keys(obj).length === 0 && obj.constructor === Object)));
};

global.sendJson = (res, content, status) => {
    res.status(status);
    res.json(content);
};

global.isArray = function (a) {
    return (!!a) && (a.constructor === Array);
};

global.isString = function (s) {
    return typeof s === "string";
};

global.isObject = function (obj) {
    return typeof obj === 'object' && !(obj instanceof Array) && obj !== null
};

global.isDate = function (obj) {
    return (obj instanceof Date);
};

global.isBoolean = function(val) {
    return val === false || val === true;
}

global.extend = function (target) {
    if (target == null) return;
    let sources = [].slice.call(arguments, 1);
    for(let i = 0, j = sources.length;i<j;i++) {
        let source = sources[i];
        for (let prop in source) {
            target[prop] = source[prop];
        }
    }
    return target;
};

global.extendRecursive = function (target) {
    if (target == null) return;
    let sources = [].slice.call(arguments, 1);
    sources.forEach(function (source) {
        for (let prop in source) {
            if (isObject(target[prop]))
                extendRecursive(target[prop], source[prop]);
            else
                target[prop] = source[prop];
        }
    });
    return target;
};

global.camelToSnakeCase = str => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
global.snakeToCamelCase = str =>
    str.toLowerCase().replace(/([-_][a-z])/g, group =>
        group
            .toUpperCase()
            .replace('-', '')
            .replace('_', '')
    );

global.lowerFirstLetter = string => {
    return string.charAt(0).toLowerCase() + string.slice(1);
}

//global.crypto = require('crypto');
const {createHmac, pbkdf2, randomBytes} = require('node:crypto');
global.hashHmac = function (text) {
    return createHmac('sha256', 'fgdgdfgcvbcvbvcbcv#')
        .update(text)
        .digest('hex');
};

global.verify_password = function (dbString, password) {
    if (isEmpty(dbString))
        return false;
    let pieces = dbString.split('$');
    let crypt_info = pieces[0].split("_");

    let iterations = parseInt(pieces[1]);
    let salt = pieces[2];
    let old_hash = pieces[3];
    let hashLength = (Buffer.from(old_hash, "base64")).length;
    let keybase = false;

    pbkdf2(password, salt, iterations, hashLength, crypt_info[1], function (err, key) {
        if (err)
            throw err;
        keybase = key.toString('base64');
    });

    require('deasync').loopWhile(function () {
        return !keybase;
    });

    return (keybase === old_hash);
};

global.encrypt_password = function (password) {
    let salt = randomBytes(32).toString('base64').substr(0, 12);
    let iterations = 10000;
    let keybase = false;


    pbkdf2(password, salt, iterations, 32, 'sha256', function (err, key) {
        keybase = 'pbkdf2_sha256$10000$' + salt + '$' + key.toString('base64');
    });

    require('deasync').loopWhile(function () {
        return !keybase;
    });

    return keybase;
};
