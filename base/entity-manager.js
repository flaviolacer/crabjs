const path = require("path");
const fs = require('fs');
const log = require('./log');
const annotation = require('./annotation');

function entityManager() {
    // load entity files
    this.init = (core) => {
        const entityPath = path.join(config.app_root, 'entity');
        fs.readdir(entityPath, function (err, files) {
            //handling error
            if (err) {
                log.error('Unable to list files on directory: ' + err);
            } else
            files.forEach(async function (file) {
                // parse annotation files
                await annotation.parse(path.join(entityPath, file), function(err, annotations) {
                    if (err) {
                        log.error(err)
                        return;
                    }
                    let annotationKeys = Object.keys(annotations);
                    if (annotationKeys.length > 0) {
                        for(let i = 0,j = annotationKeys.length;i < j;i++) {

                        }
                        //console.log(annotations);
                    }
                });
            });
        });
    }
}

module.exports = new entityManager();