const cjs = require("./cjs");
const log = require('./log');
const Error = require("./error");
const localStorage = require('./localstorage');
const jwt = require('jsonwebtoken');
const securityConfig = cjs.config.security;
let tokenExpires, encryptionKey, refreshTokenEncryptionSecretKey, refreshTokenExpires;

if (securityConfig) {
// config values
    tokenExpires = securityConfig.jwt.token_expires || 300; // 5 min default
    encryptionKey = securityConfig.encryption_key || securityConfig.jwt.encryption_key;
    refreshTokenEncryptionSecretKey = securityConfig.jwt.refresh_token.token_secret || encryptionKey; // 5 min default
    refreshTokenExpires = securityConfig.jwt.refresh_token.token_expires || tokenExpires || 300; // 5 min default
    cjs.configSecureCredentials = cjs.configSecureCredentials || {};
    securityConfig.jwt.refresh_token = securityConfig.jwt.refresh_token || {};
}

/**
 * Add token to revoked list
 * @param tokens
 */
let addTokenRevokedList = (tokens) => {
    if (isEmpty(tokens)) return;
    let tokenRevoked = localStorage.getItem("tokenListRevoked") || {};
    for (let token in tokens) {
        let tokenInfo = tokens[token];
        tokenRevoked[token] = {"date": tokenInfo.date, expires: tokenInfo.expires};
    }
    localStorage.setItem("tokenListRevoked", tokenRevoked);
};

/**
 * Save user token
 * @param clientId
 * @param token
 * @param refreshToken
 */
let saveUserToken = (clientId, token, refreshToken) => {
    let tokenList = localStorage.getItem("tokenList") || {};
    tokenList[clientId] = tokenList[clientId] || {};
    let tokensInfo = (securityConfig.jwt.token_replace_new || isEmpty(tokenList[clientId].tokens)) ? {} : tokenList[clientId].tokens;
    tokensInfo[token] = {
        "date": new Date(),
        "expires": tokenExpires
    };
    tokenList[clientId].tokens = tokensInfo;

    if (refreshToken) {
        let refreshTokensInfo = (securityConfig.jwt.refresh_token.token_replace_new || isEmpty(tokenList[clientId].refreshTokens)) ? {} : tokenList[clientId].refreshTokens;
        refreshTokensInfo[refreshToken] = {
            "date": new Date(),
            "expires": refreshTokenExpires
        };
        tokenList[clientId].refreshTokens = refreshTokensInfo;
    }
    localStorage.setItem("tokenList", tokenList);
}

/**
 * Remove user token
 * @param clientId
 * @returns {null}
 */
let removeUserToken = (clientId, ignoreRefreshToken) => {
    let tokenList = localStorage.getItem("tokenList");
    if (tokenList && !isEmpty(tokenList[clientId])) {
        // add on revoked tokens
        addTokenRevokedList(tokenList[clientId].tokens);
        // add on revoked refresh Tokens
        if (!ignoreRefreshToken)
            addTokenRevokedList(tokenList[clientId].refreshTokens);
        //erase record
        delete tokenList[clientId];
        // save to storage (last generated)
        localStorage.setItem("tokenList", tokenList);
    } else return null;
}

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
        let err = new Error(cjs.i18n.__('Access denied. Error on generating token.'), 403);
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
let removeExpiredTokens = () => {
    let tokenList = localStorage.getItem("tokenList");
    if (!tokenList) return;
    // remove expired user tokens
    let apiUserClientIds = Object.keys(tokenList);
    for (let i = 0, j = apiUserClientIds.length; i < j; i++) {
        let apiUserInfo = tokenList[apiUserClientIds[i]];
        let tokens = extend({}, apiUserInfo.tokens || {}, apiUserInfo.refreshTokens || {});
        let tokensValues = Object.keys(tokens);
        for (let k = 0, n = tokensValues.length; k < n; k++) {
            let tokenInfo = tokens[tokensValues[k]];
            if (isString(tokenInfo.date)) tokenInfo.date = new Date(tokenInfo.date);
            let secondsPassed = Math.abs((new Date().getTime() - tokenInfo.date.getTime()) / 1000);
            if (secondsPassed >= tokenInfo.expires) {
                if (apiUserInfo.tokens[tokensValues[k]])
                    delete apiUserInfo.tokens[tokensValues[k]]
                else
                    delete apiUserInfo.refreshTokens[tokensValues[k]];
            }
        }
    }
    //save updated tokenlist
    localStorage.setItem("tokenList", tokenList);

    // remove revoked tokens
    let tokensRevoked = localStorage.getItem("tokenListRevoked") || {};
    let tokenRevokedKeys = Object.keys(tokensRevoked);
    for (let i = 0, j = tokenRevokedKeys.length; i < j; i++) {
        let tokenRevokedInfo = tokensRevoked[tokenRevokedKeys[i]];
        if (isString(tokenRevokedInfo.date)) tokenRevokedInfo.date = new Date(tokenRevokedInfo.date);
        let secondsRevokedPassed = Math.abs((new Date().getTime() - tokenRevokedInfo.date.getTime()) / 1000);
        if (secondsRevokedPassed >= tokenRevokedInfo.expires) delete tokensRevoked[tokenRevokedKeys[i]];
    }
    // save updated revoked list
    localStorage.setItem("tokenListRevoked", tokensRevoked);
};

/**
 * Check security - currently, the is only jwt security
 * @param req
 * @param res
 * @param next
 */
function security(req, res, next) {
    if (cjs.config.security && cjs.config.security.jwt) {
        let query = req.query || {};
        let body = req.body || {};
        let headers = req.headers || {};
        let securityConfig = cjs.config.security;

        if (isEmpty(securityConfig.encryption_key || securityConfig.jwt.encryption_key)) {
            let err = new Error(cjs.i18n.__('Access denied. Secret key not set.'), 403);
            log.error(cjs.i18n.__("You must set the secretKey in config file."));
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
            let testClientId = query[securityConfig.jwt.sign_clientid_field] || body[securityConfig.jwt.sign_clientid_field] || headers[securityConfig.jwt.sign_clientid_field];
            let testClientSecret = query[securityConfig.jwt.sign_clientid_field] || body[securityConfig.jwt.sign_clientid_field] || headers[securityConfig.jwt.sign_clientid_field];

            if (isEmpty(securityConfig.auth_entity)) { // config auth
                if (isEmpty(cjs.configSecureCredentials)) {
                    let configCredentials = securityConfig.credentials || [];

                    // validate using user set on config
                    if ((!isEmpty(securityConfig[securityConfig.jwt.sign_clientid_field]) && !isEmpty(securityConfig[securityConfig.jwt.sign_client_secret_field]))) {
                        let configUserCredentials = {};
                        configUserCredentials[securityConfig.jwt.sign_clientid_field] = securityConfig[securityConfig.jwt.sign_clientid_field];
                        configUserCredentials[securityConfig.jwt.sign_client_secret_field] = securityConfig[securityConfig.jwt.sign_client_secret_field];
                        configCredentials.push(configUserCredentials);
                    }

                    // populate config credentials in memory
                    cjs.configSecureCredentials = {};
                    for (let i = 0, j = configCredentials.length; i < j; i++)
                        cjs.configSecureCredentials[configCredentials[i][securityConfig.jwt.sign_clientid_field]] = configCredentials[i][securityConfig.jwt.sign_client_secret_field];
                }

                // check if credentials exists
                if (cjs.configSecureCredentials[testClientId] === testClientSecret) {
                    apiUserAuth.clientId = testClientId;
                    apiUserAuth.clientSecret = testClientSecret;
                }
            } else {
                //TODO: Implement repository
            }

            // do the authentication
            if (!isEmpty(apiUserAuth)) {
                let response = {token: generateToken(apiUserAuth)};
                // remove old token
                if (securityConfig.jwt.remove_tokens_auth)
                    removeUserToken(apiUserAuth.clientId);
                // generate refreshToken
                if (securityConfig.jwt.refresh_token)
                    response.refreshToken = generateToken(apiUserAuth, refreshTokenEncryptionSecretKey, refreshTokenExpires);
                // save new token
                saveUserToken(apiUserAuth.clientId, response.token, response.refreshToken);

                sendJson(res, response, 200);
                // remove expired tokens
                removeExpiredTokens();
            } else {
                let err = new Error(cjs.i18n.__('Access denied. Invalid credentials.'), 403);
                sendJson(res, err, 403);
            }
        } else if (urlInfo.pathname === securityConfig.jwt.refresh_token.refresh_token_route) { // refresh token - new token
            if (isEmpty(req.refresh_token)) req.refresh_token = (!isEmpty(securityConfig.jwt.refresh_token.refresh_token_field)) ? query[securityConfig.jwt.refresh_token.refresh_token_field] || body[securityConfig.jwt.refresh_token.refresh_token_field] : null;
            //check if token is revoked
            let tokensRevoked = localStorage.getItem("tokenListRevoked") || {};
            let authData = verifyToken(req.refresh_token, refreshTokenEncryptionSecretKey);
            if (isEmpty(tokensRevoked[req.refresh_token]) && authData) {
                // generate new token
                let response = {token: generateToken(authData)};
                if (securityConfig.jwt.refresh_token.reset_refresh_token) {
                    response.refreshToken = generateToken(authData, refreshTokenEncryptionSecretKey, refreshTokenExpires);
                    req.refresh_token = response.refreshToken;
                }

                // remove old token
                if (securityConfig.jwt.remove_tokens_auth) {
                    removeUserToken(authData.clientId, !securityConfig.jwt.refresh_token.reset_refresh_token);
                }

                // save new token
                saveUserToken(authData.clientId, response.token, req.refresh_token);
                sendJson(res, response, 200);
            } else {
                let err = new Error(cjs.i18n.__("Access denied. Invalid refresh token."), 403);
                sendJson(res, err, 403);
            }
            // remove expired tokens
            removeExpiredTokens();
        } else if (cjs.secBypassRoutes.contains(urlInfo.pathname)) next(); else { // not bypassed
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
            if (isEmpty(req.token)) req.token = (!isEmpty(securityConfig.jwt.token_field)) ? query[securityConfig.jwt.token_field] || body[securityConfig.jwt.token_field] : null;

            if (isEmpty(req.token)) {
                let err = new Error(cjs.i18n.__('Access denied'), 403);
                sendJson(res, err, 403);
            } else { // verify token
                //check if token is revoked
                let tokensRevoked = localStorage.getItem("tokenListRevoked") || {};
                let authData = verifyToken(req.token);
                if (isEmpty(tokensRevoked[req.token]) && authData) {
                    req.token_data = authData;
                    next();
                } else {
                    let err = new Error(cjs.i18n.__("Access denied. Invalid token."), 403);
                    sendJson(res, err, 403);
                    // remove expired tokens
                    removeExpiredTokens();
                }
            }
        }
    } else next();
}

module.exports = security;