const cjs = require("./cjs");
const log = require('./log');
const fs = require('fs');
const path = require("path");

class LocalStorage {
    static dictionary;

    constructor(options) {
        log.info("Initializing localStorage");
        this.default_options = extend({
            "type": "file"
        }, options);

        LocalStorage.dictionary = {};
        this.filename = !isEmpty(cjs.config.local_storage.filename) ? cjs.config.local_storage.filename : "ls.json";
        this.storagePath = path.join(cjs.config.app_root, cjs.config.cache_storage_path, cjs.config.local_storage.path);
        this.filePath = path.join(this.storagePath, this.filename);

        this.loadData();
    }

    loadFileData() {
        if (fs.existsSync(this.filePath)) {
            let contents = fs.readFileSync(this.filePath);
            if (!isEmpty(contents.toString()))
                LocalStorage.dictionary = JSON.parse(contents);
        }
    }

    loadData() {
        switch (this.default_options.type) {
            case "file":
            default:
                this.loadFileData();
                break;
        }
    }

    saveData() {
        try {
            if (!fs.existsSync(this.storagePath)) {
                let utils = require("./utils");
                utils.checkCachePath();
                fs.mkdirSync(this.storagePath);
            }

            fs.writeFileSync(this.filePath, JSON.stringify(LocalStorage.dictionary));
        } catch (e) {
            log.error(e);
        }
    }

    setItem(key, value) {
        if (key && value)
            LocalStorage.dictionary[key] = value;
        this.saveData();
    }

    getItem(key) {
        return LocalStorage.dictionary[key];
    }
}

module.exports = new LocalStorage();