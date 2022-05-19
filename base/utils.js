const path = require("path");
const log = require('./log');
const fs = require('fs');

function Util() {
    this.cachePath = path.join(cjs.config.app_root, cjs.config.cacheStoragePath);

    this.checkLibExists = (libName) => {
        try {
            require.resolve(libName);
            return true;
        } catch (e) {
            return false;
        }
    }
    this.checkCachePath = () => {
        if (!fs.existsSync(this.cachePath))
            try {
                fs.mkdirSync(this.cachePath);
            } catch (e) {
               log.error(e);
            }
    }
}

module.exports = new Util();