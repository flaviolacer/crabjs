const cjs = require("../cjs");
const path = require("path");
const fs = require("fs");
const utils = require("../utils");
const log = require("../log");

class tokensRevoked {
    type = "file";
    entity = "";

    getFileStorage() {
        this.dictionary = {};
        this.filename = !isEmpty(cjs.config.token_storage.revoked_filename) ? cjs.config.token_storage.revoked_filename : "rtoken.json";
        this.storagePath = path.join(cjs.config.app_root, cjs.config.cache_storage_path, cjs.config.token_storage.path);
        this.filename = path.join(this.storagePath, this.filename);
        let loadFileData = () => {
            if (fs.existsSync(this.filename)) {
                let contents = fs.readFileSync(this.filename);
                if (!isEmpty(contents.toString())) this.dictionary = JSON.parse(contents);
            }
        }

        let saveFileData = () => {
            try {
                if (!fs.existsSync(this.storagePath)) {
                    utils.checkCachePath();
                    fs.mkdirSync(this.storagePath);
                }

                fs.writeFileSync(this.filename, JSON.stringify(this.dictionary));
            } catch (e) {
                log.error(e);
            }
        }

        this.save = (clientId, key, value) => {
            loadFileData();
            value.client_id = clientId;
            this.dictionary[key] = value;
            saveFileData();
        }

        this.get = (key) => {
            loadFileData();
            return this.dictionary[key];
        }

        this.remove = (key) => {
            loadFileData();
            delete this.dictionary[key];
            saveFileData();
        }

        this.removeExpired = () => {
            loadFileData();
            // remove revoked tokens
            let tokenRevokedKeys = Object.keys(this.dictionary);
            for (let i = 0, j = tokenRevokedKeys.length; i < j; i++) {
                let tokenRevokedInfo = this.dictionary[tokenRevokedKeys[i]];
                if (isString(tokenRevokedInfo.date)) tokenRevokedInfo.date = new Date(tokenRevokedInfo.date);
                let secondsRevokedPassed = Math.abs((new Date().getTime() - tokenRevokedInfo.date.getTime()) / 1000);
                if (secondsRevokedPassed >= tokenRevokedInfo.expires) delete this.dictionary[tokenRevokedKeys[i]];
            }
            saveFileData();
        }
        return this;
    }

    getRepositoryStorage() {
        this.em = cjs.entityManager;
        this.get = async (key) => {
            return await this.em.getEntity(this.entity, {token: key});
        }
        this.save = async (clientId, key, value) => {
            let tokenItem = this.em.setEntity(this.entity, {token: key, client_id: clientId, data: value});
            await tokenItem.save();
        }
        this.remove = async (key) => {
            await this.em.remove(this.entity, {token: key});
        }

        this.removeExpired = () => {
            // remove revoked tokens
            let revokedStorage = this.em.loadEntity(this.entity);
            revokedStorage.removeExpired();
        }

        return this;
    }

    getRepository() {
        switch (this.type) {
            case "file":
                return this.getFileStorage();
            case "repository":
                return this.getRepositoryStorage();
            default:
                break;
        }

    }

    /**
     * Add token to revoked list
     * @param clientId
     * @param data
     **/
    async addToken(clientId, data) {
        let repository = this.getRepository();
        await repository.save(clientId, data.token, {"date": data.date, expires: data.expires});
    }

    getToken(key) {
        let repository = this.getRepository();
        return repository.get(key);
    }

    removeToken(key) {
        let repository = this.getRepository();
        return repository.remove(key);
    }

    /**
     * Remove expired tokens
     */
    removeTokenExpired() {
        let repository = this.getRepository();
        return repository.removeExpired();
    }
}

module.exports = new tokensRevoked()