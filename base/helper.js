// prototypes
String.prototype.contains = function (it) {
    return this.toLowerCase().indexOfRegex(it.toLowerCase()) !== -1;
};

String.prototype.replaceAll = function (search, replacement) {
    let target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

String.prototype.indexOfRegex = function(regex){
    var match = this.match(regex);
    return match ? this.indexOf(match[0]) : -1;
}

String.prototype.lastIndexOfRegex = function(regex){
    var match = this.match(regex);
    return match ? this.lastIndexOf(match[match.length-1]) : -1;
}

Array.prototype.contains = function (k) {
    for (let p in this)
        if (this[p].toLowerCase && (this[p].toLowerCase() === k.toLowerCase()))
            return true;
    return false;
};

//global functions
global.isEmpty = function (obj) {
    return ((typeof obj === 'undefined' || obj === null || obj === '') || (isArray(obj) && (obj.length === 0)) || (isObject(obj) && (!(obj instanceof Date) && Object.keys(obj).length === 0)));
};

global.sendJson = (res, content, status) => {
    res.status(status);
    res.json(content);
}

global.isArray = function(a) {
    return (!!a) && (a.constructor === Array);
};

global.isString = function(s) {
    return typeof s === "string";
}

global.isObject = function(obj) {
    return typeof obj === 'object' && !(obj instanceof Array)
};

global.isDate = function(obj) {
    return (obj instanceof Date);
};
