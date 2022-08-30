const fs = require("fs");

// annotation parser
function annotation() {
    let instance = this;
    this.parse = (file, callback) => {
        return new Promise((resolve, reject) => {
            callback = callback || (() => {
            });

            try {
                let fileContent = fs.readFileSync(file, {encoding: 'utf-8'});
                let annotations = instance.getAnnotations(fileContent);
                callback(null, annotations);
                resolve(annotations);
            } catch (e) {
                reject(e);
                callback(e);
            }
        });
    }

    this.parseSync = (file) => {
        try {
            let fileContent = fs.readFileSync(file, {encoding: 'utf-8'});
            return instance.getAnnotations(fileContent);
        } catch (e) {
            return null;
        }
    }

    this.getAnnotations = (fileContent) => {
        let annotationMainRegex = /(\/\*\*(([\s\n*@a-zA-Z0-9_\-=;'",():]*)|([\s\n*@a-zA-Z0-9_\-=;'",():\/]*))\*\/)(([a-zA-Z0-9_.=\s])*)/gm;

        let result = {
            classes: [],
            functions: [],
            fields: [],
        };

        let blockKey;
        let matches = [...fileContent.matchAll(annotationMainRegex)];

        if (isEmpty(matches)) {
            return {};
        }

        let annotationRegex = /@(([a-zA-Z_][a-zA-Z0-9]*)(.*))/g;
        let annotationMatches;
        let isClass = false;
        for (let i = 0, j = matches.length; i < j; i++) {
            let match = matches[i][0];
            /** TODO do better analysis */
            let matchType = (matches[i][5].contains('class')) ? 'class' : (matches[i][5].contains('function') || (matches[i][5].contains('this.') && matches[i][0].contains('@route'))) ? 'functions' : 'fields'
            if (matchType === 'class') /// for the other analisis
                isClass = true;
            // remove matched annotations from contents
            let annotationRegexBlock = /\/\*\*([\s\S]*?)\*\//g;
            let matchWithoutBlock = match.replace(annotationRegexBlock, '');
            fileContent = fileContent.replace(match, matchWithoutBlock);

            // discover annotation type
            if (matchType === 'functions' || matchType === 'class') {
                if (matches[i][2].contains(' let ') || matches[i][2].contains(' var ') || matches[i][2].contains(' const ')) continue; // private functions - ignore
                let stripValue = matches[i][5].replaceAll(/(class|async|function|this\.|[( '"=\n)])/, '');
                if (!isEmpty(stripValue))
                    blockKey = stripValue;
                else {
                    if (matches[i][2].contains('this.')) {
                        blockKey = (matches[i][2].split("this.")[1]).replaceAll(/[ =\n]/g, '');
                    } else continue; // error on function key detection
                }
            } else { // field
                let rawField = matches[i][5];
                blockKey = rawField.replaceAll(/(var|let|this.|const|[ ;=\n])/g, '');
            }

            annotationMatches = [...match.matchAll(annotationRegex)];
            for (let m = 0, n = annotationMatches.length; m < n; m++) {
                let annotationMatch = annotationMatches[m];
                let key = annotationMatch[2];
                let value = annotationMatch[3];
                if (value.startsWith(key))
                    value = value.substring(key.length);

                // cleanup values
                value = value.replaceAll(/([()'" =]|\*\/)/, '');

                if (matchType === 'class') {
                    if (isEmpty(result.classes[blockKey])) // classes but analized only one
                        result.classes[blockKey] = {};
                    result.classes[blockKey][key] = value;
                } else if (matchType === 'functions') {
                    if (isEmpty(result.functions[blockKey]))
                        result.functions[blockKey] = {};
                    result.functions[blockKey][key] = value;
                } else { // fields
                    if (isEmpty(result.fields[blockKey]))
                        result.fields[blockKey] = {};
                    result.fields[blockKey][key] = value;
                }
            }
        }

        if (Object.keys(result.classes).length === 0)
            delete result.classes;

        if (Object.keys(result.functions).length === 0)
            delete result.functions;

        if (Object.keys(result.fields).length === 0)
            delete result.fields;

        return result;
    }
}

module.exports = new annotation();