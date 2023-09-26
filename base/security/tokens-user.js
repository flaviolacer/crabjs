const cjs = require("../cjs");
const path = require("path");
const fs = require("fs");
const utils = require("../utils");
const log = require("../log");
const revokedTokenStorage = require('./tokens-revoked');

class tokensUsers {
    type = "file";
    entity = "__access_storage";

    getFileStorage() {
        this.securityConfig = cjs.config.security;
        this.dictionary = {};
        this.filename = !isEmpty(cjs.config.token_storage.revoked_filename) ? cjs.config.token_storage.revoked_filename : "utoken.json";
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

        this.save = (clientId, token, refreshToken, expires, refreshTokenExpires) => {
            loadFileData();
            let tokensInfo = (this.securityConfig.jwt.token_replace_new || isEmpty(this.dictionary[clientId].tokens)) ? {} : this.dictionary[clientId].tokens;
            tokensInfo[token] = {
                "date": new Date(),
                "expires": expires
            };
            this.dictionary[clientId] = this.dictionary[clientId] || {};
            this.dictionary[clientId].tokens = tokensInfo;

            if (!isEmpty(refreshToken)) {
                let refreshTokensInfo = (this.securityConfig.jwt.refresh_token.token_replace_new || isEmpty(this.dictionary[clientId].refreshTokens)) ? {} : this.dictionary[clientId].refreshTokens;
                refreshTokensInfo[refreshToken] = {
                    "date": new Date(),
                    "expires": refreshTokenExpires
                };
                this.dictionary[clientId].refreshTokens = refreshTokensInfo;
            }
            saveFileData();
        }

        this.get = (key) => {
            loadFileData();
            return this.dictionary[key];
        }

        this.remove = async (clientId, ignoreRefreshToken) => {
            loadFileData();
            if (!isEmpty(this.dictionary[clientId])) {
                // add on revoked tokens
                await revokedTokenStorage.addToken(clientId, this.dictionary[clientId].tokens);
                // add on revoked refresh Tokens
                if (!ignoreRefreshToken)
                    await revokedTokenStorage.addToken(clientId, this.dictionary[clientId].refreshTokens);
                //erase record
                delete this.dictionary[clientId];
                // save to storage (last generated)
                saveFileData();
            }
        }

        this.removeExpired = () => {
            loadFileData();
            if (!this.dictionary) return;
            // remove expired user tokens
            let userClientIds = Object.keys(this.dictionary);
            for (let i = 0, j = userClientIds.length; i < j; i++) {
                let userInfo = this.dictionary[userClientIds[i]];
                let tokens = extend({}, userInfo.tokens || {}, userInfo.refreshTokens || {});
                let tokensValues = Object.keys(tokens);
                for (let k = 0, n = tokensValues.length; k < n; k++) {
                    let tokenInfo = tokens[tokensValues[k]];
                    if (isString(tokenInfo.date)) tokenInfo.date = new Date(tokenInfo.date);
                    let secondsPassed = Math.abs((new Date().getTime() - tokenInfo.date.getTime()) / 1000);
                    if (secondsPassed >= tokenInfo.expires) {
                        if (userInfo.tokens[tokensValues[k]])
                            delete userInfo.tokens[tokensValues[k]]
                        else
                            delete userInfo.refreshTokens[tokensValues[k]];
                    }
                }
            }
            saveFileData();
        }
        return this;
    }

    getRepositoryStorage() {
        this.em = cjs.entityManager;
        this.securityConfig = cjs.config.security;

        this.save = async (clientId, token, refreshToken, expires, refreshTokenExpires) => {
            let repositoryInfo = await this.em.getEntity(this.entity, {client_id: clientId});
            let tokensInfo = (this.securityConfig.jwt.token_replace_new || isEmpty(repositoryInfo.data)) ? {
                "token": token,
                "date": new Date(),
                "expires": expires
            } : repositoryInfo.data;

            if (isEmpty(repositoryInfo)) {
                repositoryInfo = this.em.newEntity(this.entity);
                repositoryInfo.client_id = clientId;
            }

            repositoryInfo.refresh_token = false;
            repositoryInfo.data = tokensInfo;

            await repositoryInfo.save();

            if (!isEmpty(refreshToken)) {
                let refreshTokensInfo = {
                    "token": refreshToken,
                    "date": new Date(),
                    "expires": refreshTokenExpires
                };

                let repositoryRefreshInfo = await this.em.newEntity(this.entity, {
                    client_id: clientId,
                    data: refreshTokensInfo,
                    refresh_token: true
                });
                await repositoryRefreshInfo.save();
            }
        }

        this.get = async (client_id) => {
            return await this.em.getEntity(this.entity, {client_id: client_id});
        }

        this.remove = async (clientId, ignoreRefreshToken) => {
            let filter = {client_id: clientId};
            if (ignoreRefreshToken)
                filter.refresh_token = false;
            let tokens = await this.em.getEntities(this.entity, filter);
            for (let i = 0, j = tokens.length; i < j; i++) {
                let tokenInfo = tokens[i];
                // add on revoked tokens
                await revokedTokenStorage.addToken(clientId, tokenInfo.data);
            }
            await this.em.removeEntities(this.entity, {client_id: clientId});
        }

        this.removeExpired = () => {
            // remove revoked tokens
            let revokedStorage = this.em.loadEntity(this.entity);
            revokedStorage.removeExpired();
        }
        return this;
    }

    getRepository() {
        if (cjs.config.security.security_repository && cjs.config.security.security_repository.token_storage_type)
            this.type = cjs.config.security.security_repository.token_storage_type;

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
     * Add user token on storage
     * @param clientId
     * @param token
     * @param refreshToken
     * @param expires
     * @param refreshTokenExpires
     **/
    addToken(clientId, token, refreshToken, expires, refreshTokenExpires) {
        let repository = this.getRepository();
        repository.save(clientId, token, refreshToken, expires, refreshTokenExpires);
    }

    getToken(key) {
        let repository = this.getRepository();
        return repository.get(key);
    }

    /**
     * Remove user token
     * @param clientId
     * @param ignoreRefreshToken
     */
    removeToken(clientId, ignoreRefreshToken) {
        let repository = this.getRepository();
        return repository.remove(clientId, ignoreRefreshToken);
    }

    /**
     * Remove expired tokens
     */
    async removeTokenExpired() {
        let repository = this.getRepository();
        await repository.removeExpired();
    }
}

module.exports = new tokensUsers()