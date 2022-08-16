const cjs = require("./cjs");
const log = require('./log');
const fs = require('fs');
const path = require("path");
cjs.entityManager = require("./entity-manager");

class LocalStorage {
    static dictionary;

    constructor() {
        log.info("Initializing localStorage");
        this.default_options = extend({
            "type": "file"
        }, cjs.config.local_storage);

        if (this.default_options.type === "file") {
            LocalStorage.dictionary = {};
            this.filename = !isEmpty(cjs.config.local_storage.filename) ? cjs.config.local_storage.filename : "ls.json";
            this.storagePath = path.join(cjs.config.app_root, cjs.config.cache_storage_path, cjs.config.local_storage.path);
            this.filePath = path.join(this.storagePath, this.filename);
        }

        this.loadData();
    }

    loadFileData() {
        if (fs.existsSync(this.filePath)) {
            let contents = fs.readFileSync(this.filePath);
            if (!isEmpty(contents.toString())) LocalStorage.dictionary = JSON.parse(contents);
        }
    }

    loadData() {
        switch (this.default_options.type) {
            case "file":
                this.loadFileData();
                break;
            default:
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

    async setItem(key, value) {
        if (this.default_options.type === "file") {
            if (key && value) LocalStorage.dictionary[key] = value;
            this.saveData();
        } else if (this.default_options.type === "repository") {
            let em = cjs.entityManager;
            let item = await em.setEntity(this.default_options.entity, {
                key: key, value: value
            });
            item.save();
        }
    }

    async getItem(key) {
        if (this.default_options.type === "file") {
            return LocalStorage.dictionary[key];
        } else if (this.default_options.type === "repository") {
            let em = cjs.entityManager;
            let item = await em.getEntity(this.default_options.entity, {
                key: key
            });
            if (item) return item.value; else return null;
        }
    }
}

module.exports = new LocalStorage();