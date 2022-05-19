// prototypes
String.prototype.contains = function (it) {
    return this.toLowerCase().indexOfRegex(it.toLowerCase()) !== -1;
};

String.prototype.replaceAll = function (search, replacement) {
    let target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

String.prototype.indexOfRegex = function(regex){
    let match = this.match(regex);
    return match ? this.indexOf(match[0]) : -1;
};

String.prototype.lastIndexOfRegex = function(regex){
    let match = this.match(regex);
    return match ? this.lastIndexOf(match[match.length-1]) : -1;
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

//global functions
global.isEmpty = function (obj) {
    return ((typeof obj === 'undefined' || obj === null || obj === '') || (isArray(obj) && (obj.length === 0)) || (isObject(obj) && (Object.keys(obj).length === 0 && obj.constructor === Object)));
};

global.sendJson = (res, content, status) => {
    res.status(status);
    res.json(content);
};

global.isArray = function(a) {
    return (!!a) && (a.constructor === Array);
};

global.isString = function(s) {
    return typeof s === "string";
};

global.isObject = function(obj) {
    return typeof obj === 'object' && !(obj instanceof Array)
};

global.isDate = function(obj) {
    return (obj instanceof Date);
};

global.extend = function (target) {
    if (target == null) return;
    let sources = [].slice.call(arguments, 1);
    sources.forEach(function (source) {
        for (let prop in source) {
            target[prop] = source[prop];
        }
    });
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
