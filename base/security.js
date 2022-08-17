const cjs = require("./cjs");
const log = require('./log');
const Error = require("./error");
const userTokenStorage = require('./security/tokens-user');
const revokedTokenStorage = require('./security/tokens-revoked');
const jwt = require('jsonwebtoken');
let securityConfig;
let tokenExpires, encryptionKey, refreshTokenEncryptionSecretKey, refreshTokenExpires;

/**
 * Generate new token
 * @param payload
 * @param forcedSecretKey
 * @param forcedTokenExpires
 * @returns {*|null}
 */
let generateToken = (payload, forcedSecretKey, forcedTokenExpires) => {
    forcedSecretKey = forcedSecretKey || encryptionKey;
    forcedTokenExpires = forcedTokenExpires || tokenExpires;

    // remove payload default previous info
    delete payload.iat;
    delete payload.exp;

    try {
        return jwt.sign(payload, forcedSecretKey, {
            expiresIn: forcedTokenExpires
        });
    } catch (e) {
        log.error(e);
        return null;
    }
}

/**
 * Verify tokens
 * @param token
 * @param forcedSecretKey
 * @returns {*|boolean}
 */
let verifyToken = (token, forcedSecretKey) => {
    forcedSecretKey = forcedSecretKey || encryptionKey;
    try {
        return jwt.verify(token, forcedSecretKey);
    } catch {
        return false;
    }
}

/**
 * Remove expired tokens
 */
let removeExpiredTokens = async () => {
    await userTokenStorage.removeTokenExpired();
    await revokedTokenStorage.removeTokenExpired();
};

/**
 * Check security - currently, the is only jwt security
 * @param req
 * @param res
 * @param next
 */
async function security(req, res, next) {
    if (cjs.config.security && cjs.config.security.jwt) {
        if (!isEmpty(cjs.config.security))
            securityConfig = cjs.config.security;

        // config values
        tokenExpires = securityConfig.jwt.token_expires || 300; // 5 min default
        encryptionKey = securityConfig.encryption_key || securityConfig.jwt.encryption_key;
        refreshTokenEncryptionSecretKey = securityConfig.jwt.refresh_token.token_secret || encryptionKey; // 5 min default
        refreshTokenExpires = securityConfig.jwt.refresh_token.token_expires || tokenExpires || 300; // 5 min default
        cjs.configSecureCredentials = cjs.configSecureCredentials || {};
        securityConfig.jwt.refresh_token = securityConfig.jwt.refresh_token || {};

        let query = req.query || {};
        let body = req.body || {};
        let headers = req.headers || {};

        if (isEmpty(securityConfig.encryption_key || securityConfig.jwt.encryption_key)) {
            let err = new Error(cjs.i18n.__('Access denied. Secret key not set.'), 403);
            log.error(cjs.i18n.__("You must set the encryption_key in config file."));
            sendJson(res, err, 403);
            return;
        }

        // get route and check if is eligible
        // secBypassRoutes
        const baseURL = req.protocol + '://' + req.headers.host + '/';
        let urlInfo = new URL(req.url, baseURL);
        cjs.secBypassRoutes = cjs.secBypassRoutes || []; // memory allocation for url security bypass
        if (urlInfo.pathname === securityConfig.jwt.token_signin_route) { // request token
            let apiUserAuth = {};
            // check if there is clientId and clientSecret on config and matches with sent
            let testClientId = query[securityConfig.jwt.sign_client_id_field] || body[securityConfig.jwt.sign_client_id_field] || headers[securityConfig.jwt.sign_client_id_field];
            let testClientSecret = query[securityConfig.jwt.sign_client_secret_field] || body[securityConfig.jwt.sign_client_secret_field] || headers[securityConfig.jwt.sign_client_secret_field];

            if (!securityConfig.security_repository) { // config auth api
                if (isEmpty(cjs.configSecureCredentials)) {
                    let configCredentials = securityConfig.credentials || [];

                    // validate using user set on config
                    if ((!isEmpty(securityConfig[securityConfig.jwt.sign_client_id_field]) && !isEmpty(securityConfig[securityConfig.jwt.sign_client_secret_field]))) {
                        let configUserCredentials = {};
                        configUserCredentials[securityConfig.jwt.sign_client_id_field] = securityConfig[securityConfig.jwt.sign_client_id_field];
                        configUserCredentials[securityConfig.jwt.sign_client_secret_field] = securityConfig[securityConfig.jwt.sign_client_secret_field];
                        configCredentials.push(configUserCredentials);
                    }

                    // populate config credentials in memory
                    cjs.configSecureCredentials = {};
                    for (let i = 0, j = configCredentials.length; i < j; i++)
                        cjs.configSecureCredentials[configCredentials[i][securityConfig.jwt.sign_client_id_field]] = configCredentials[i][securityConfig.jwt.sign_client_secret_field];
                }

                // check if credentials exists
                if (cjs.configSecureCredentials[testClientId] === testClientSecret) {
                    apiUserAuth.clientId = testClientId;
                    apiUserAuth.clientSecret = testClientSecret;
                }
            } else {
                let em = cjs.entityManager;
                let credentialSearchFields = {};
                credentialSearchFields[securityConfig.jwt.sign_client_id_field] = testClientId;
                credentialSearchFields[securityConfig.jwt.sign_client_secret_field] = testClientSecret;
                let credentials = await em.getEntity(securityConfig.security_entity, credentialSearchFields);
                if (credentials) {
                    apiUserAuth.clientId = testClientId;
                    apiUserAuth.clientSecret = testClientSecret;
                }
            }

            // do the authentication
            if (!isEmpty(apiUserAuth)) {
                let response = {token: generateToken(apiUserAuth)};
                // remove old token
                if (securityConfig.jwt.remove_tokens_auth)
                    await userTokenStorage.removeToken(apiUserAuth.clientId);
                // generate refreshToken
                if (securityConfig.jwt.refresh_token)
                    response.refreshToken = generateToken(apiUserAuth, refreshTokenEncryptionSecretKey, refreshTokenExpires);
                // save new token
                await userTokenStorage.addToken(apiUserAuth.clientId, response.token, response.refreshToken, tokenExpires, refreshTokenExpires);

                sendJson(res, response, 200);
                // remove expired tokens
                await removeExpiredTokens();
            } else {
                let err = new Error(cjs.i18n.__('Access denied. Invalid credentials.'), 403);
                sendJson(res, err, 403);
            }
        } else if (urlInfo.pathname === securityConfig.jwt.refresh_token.refresh_token_route) { // refresh token - new token
            if (isEmpty(req.refresh_token)) req.refresh_token = (!isEmpty(securityConfig.jwt.refresh_token.refresh_token_field)) ? query[securityConfig.jwt.refresh_token.refresh_token_field] || headers[securityConfig.jwt.refresh_token.refresh_token_field] || body[securityConfig.jwt.refresh_token.refresh_token_field] : null;
            //check if token is revoked
            let authData = verifyToken(req.refresh_token, refreshTokenEncryptionSecretKey);
            if (isEmpty(await revokedTokenStorage.getToken(req.refresh_token)) && authData) {
                // generate new token
                let response = {token: generateToken(authData)};
                if (securityConfig.jwt.refresh_token.reset_refresh_token) {
                    response.refreshToken = generateToken(authData, refreshTokenEncryptionSecretKey, refreshTokenExpires);
                    req.refresh_token = response.refreshToken;
                }

                // remove old token
                if (securityConfig.jwt.remove_tokens_auth) {
                    await userTokenStorage.removeToken(authData.clientId, !securityConfig.jwt.refresh_token.reset_refresh_token);
                }

                // save new token
                await userTokenStorage.addToken(authData.clientId, response.token, req.refresh_token, tokenExpires, refreshTokenExpires);
                sendJson(res, response, 200);
            } else {
                let err = new Error(cjs.i18n.__("Access denied. Invalid refresh token."), 403);
                sendJson(res, err, 403);
            }
            // remove expired tokens
            await removeExpiredTokens();
        } else if (cjs.secBypassRoutes.contains(urlInfo.pathname.replaceAll("/",""))) next();
        else { // not bypassed
            //Check if bearer exists
            if (securityConfig.jwt.token_bearer) {
                const bearerHeader = headers['authorization'];
                if (bearerHeader) {
                    const bearer = bearerHeader.split(' ');
                    const bearerToken = bearer[1];
                    if (!isEmpty(bearerToken)) {
                        req.token = bearerToken;
                    }
                }
            }

            // check if token was sent using token field
            if (isEmpty(req.token)) req.token = (!isEmpty(securityConfig.jwt.token_field)) ? query[securityConfig.jwt.token_field] || headers[securityConfig.jwt.token_field] || body[securityConfig.jwt.token_field] : null;

            if (isEmpty(req.token)) {
                let err = new Error(cjs.i18n.__('Access denied'), 403);
                sendJson(res, err, 403);
            } else { // verify token
                //check if token is revoked
                let authData = verifyToken(req.token);
                if (isEmpty(await revokedTokenStorage.getToken(req.token)) && authData) {
                    req.token_data = authData;
                    next();
                } else {
                    let err = new Error(cjs.i18n.__("Access denied. Invalid token."), 403);
                    sendJson(res, err, 403);
                    // remove expired tokens
                    await removeExpiredTokens();
                }
            }
        }
    } else next();
}

module.exports = security;