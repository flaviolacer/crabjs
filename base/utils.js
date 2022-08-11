const path = require("path");
const log = require('./log');
const fs = require('fs');
const cjs = require("./cjs");

function Util() {
    this.cachePath = path.join(cjs.config.app_root, cjs.config.cache_storage_path);

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
}

module.exports = new Util();