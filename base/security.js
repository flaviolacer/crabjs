const cjs = require("./cjs");
const log = require('./log');
const Error = require("./error");
const userTokenStorage = require('./security/tokens-user');
const revokedTokenStorage = require('./security/tokens-revoked');
const jwt = require('jsonwebtoken');
let securityConfig;
let tokenExpires, encryptionKey, refreshTokenEncryptionSecretKey, refreshTokenExpires;

/** check OAuth2 Authentication
 * @param req
 * @returns {Promise<boolean>}
 */
let checkOAuth2Auth = async (req) => {
    let query = req.query || {};
    let body = req.body || {};
    let headers = req.headers || {};
    let em = cjs.entityManager;

    // check if there is basic auth
    if (!isEmpty(req.authInfo.testAuthUser)) {
        headers[securityConfig.jwt.sign_client_id_field] = req.authInfo.testAuthUser;
        headers[securityConfig.jwt.sign_client_secret_field] = req.authInfo.testAuthPass;
    }

    // check if there is clientId and clientSecret on config and matches with sent
    let testClientId = query[securityConfig.jwt.sign_client_id_field] || body[securityConfig.jwt.sign_client_id_field] || headers[securityConfig.jwt.sign_client_id_field];
    let testClientSecret = query[securityConfig.jwt.sign_client_secret_field] || body[securityConfig.jwt.sign_client_secret_field] || headers[securityConfig.jwt.sign_client_secret_field];

    if (!securityConfig.security_repository || securityConfig.security_repository.token_storage_type === "memory") { // config auth api
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
        if (!isEmpty(testClientId) && !isEmpty(testClientSecret) && cjs.configSecureCredentials[testClientId] === testClientSecret) {
            req.authInfo.clientId = testClientId;
            req.authInfo.clientSecret = testClientSecret;
            return true;
        }
    } else {
        let credentialSearchFields = {};
        credentialSearchFields[securityConfig.jwt.sign_client_id_field] = testClientId;
        credentialSearchFields[securityConfig.jwt.sign_client_secret_field] = testClientSecret;
        let credentials = await em.getEntity(securityConfig.security_entity, credentialSearchFields);
        if (credentials) {
            req.authInfo.clientId = testClientId;
            req.authInfo.clientSecret = testClientSecret;
            return true;
        }
    }
    return false;
}

/**
 * Check Auth Entity Authentication
 * @param req
 * @returns {Promise<boolean>}
 */
let checkAuthEntity = async (req) => {
    if (isEmpty(securityConfig.auth_entity)) return false;
    let em = cjs.entityManager;
    let ae = securityConfig.auth_entity;
    let authLoginFields = {};
    let testUsernameValue;
    let testPasswordValue;

    let grant_type = req.query["grant_type"] || req.body["grant_type"] || req.headers["grant_type"];
    let scope = req.query["scope"] || req.body["scope"] || req.headers["scope"];

    if (grant_type === "password") { // RFCOAuth2 // swagger
        securityConfig.auth_entity.request_username_field = "username";
        securityConfig.auth_entity.password_field = "password";
    }

    securityConfig.auth_entity.request_username_field = securityConfig.auth_entity.request_username_field || securityConfig.auth_entity.username_field;
    securityConfig.auth_entity.request_password_field = securityConfig.auth_entity.request_password_field || securityConfig.auth_entity.password_field;

    testUsernameValue = req.query[securityConfig.auth_entity.request_username_field] || req.body[securityConfig.auth_entity.request_username_field] || req.headers[securityConfig.auth_entity.request_username_field];
    testPasswordValue = req.query[securityConfig.auth_entity.request_password_field] || req.body[securityConfig.auth_entity.request_password_field] || req.headers[securityConfig.auth_entity.request_password_field];

    if (!isEmpty(req.authInfo.testAuthUser)) {
        testUsernameValue = req.authInfo.testAuthUser;
        testPasswordValue = req.authInfo.testAuthPass;
    }

    if (isEmpty(testUsernameValue) || isEmpty(testPasswordValue))
        return false;

    if (!isEmpty(scope))
        authLoginFields.scope = scope;

    authLoginFields[securityConfig.auth_entity.username_field] = testUsernameValue;

    let credential = await em.getEntity(ae.entity_name, authLoginFields);
    if (isEmpty(credential))
        return false;

    let repoPassword = credential[securityConfig.auth_entity.password_field];
    // security
    req.authInfo.authUser = credential[securityConfig.auth_entity.username_field];
    req.authInfo.authId = credential._id;
    return verify_password(repoPassword, testPasswordValue);
}

/**
 * @param req
 * @returns {Promise<boolean>}
 */
let checkAuthToken = async (req) => {
    // check if token was sent using token field
    req.token = req.token || ((!isEmpty(securityConfig.jwt.token_field)) ? req.query[securityConfig.jwt.token_field] || req.headers[securityConfig.jwt.token_field] || req.body[securityConfig.jwt.token_field] : null);
    if (!isEmpty(req.token)) {
        //check if token is revoked
        await removeExpiredTokens();
        let authData = verifyToken(req.token);
        if (isEmpty(await revokedTokenStorage.getToken(req.token)) && authData) {
            req.token_data = authData;
            return true;
        }
    }
    return false;
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
    delete payload.clientSecret;

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
 * Generate token for request
 */
let generateRequestToken = async function (res, apiUserAuth) {
    let response = {};
    response[securityConfig.jwt.token_field] = generateToken(apiUserAuth);
    // remove old token
    if (securityConfig.jwt.remove_tokens_auth)
        await userTokenStorage.removeToken(apiUserAuth.clientId);
    // generate refreshToken
    if (securityConfig.jwt.refresh_token)
        response[securityConfig.jwt.refresh_token.refresh_token_field] = generateToken(apiUserAuth, refreshTokenEncryptionSecretKey, refreshTokenExpires);
    // save new token
    await userTokenStorage.addToken(apiUserAuth.clientId, response[securityConfig.jwt.token_field], response[securityConfig.jwt.refresh_token.refresh_token_field], tokenExpires, refreshTokenExpires);

    response.token_type = "bearer";

    sendJson(res, response, 200);
    // remove expired tokens
    await removeExpiredTokens();
}

let normalizeRoute = (route) => {
    return (route.startsWith('/') ? "" : "/") + route + (route.endsWith('/') ? "" : "/");
}

let firstRequest = true;

/**
 * Check security - currently, the is only jwt security
 * @param req
 * @param res
 * @param next
 */
async function security(req, res, next) {
    if (cjs.config.security && cjs.config.security.jwt) {
        securityConfig = cjs.config.security;

        // initiate variables
        tokenExpires = securityConfig.jwt.token_expires || 300; // 5 min default
        encryptionKey = securityConfig.encryption_key || securityConfig.jwt.encryption_key;
        refreshTokenEncryptionSecretKey = securityConfig.jwt.refresh_token.token_secret || encryptionKey; // 5 min default
        refreshTokenExpires = securityConfig.jwt.refresh_token.token_expires || tokenExpires || 300; // 5 min default
        cjs.configSecureCredentials = cjs.configSecureCredentials || {};
        securityConfig.jwt.refresh_token = securityConfig.jwt.refresh_token || {};

        if (isEmpty(securityConfig.encryption_key || securityConfig.jwt.encryption_key)) {
            let err = new Error(cjs.i18n.__('Access denied. Secret key not set.'), 403);
            log.error(cjs.i18n.__("You must set the encryption_key in config file."));
            sendJson(res, err, 403);
            return;
        }

        req.authInfo = {};
        //Check if bearer exists
        if (securityConfig.jwt.header_authentication) {
            const authHeader = req.headers['authorization'];
            if (authHeader) {
                const headerAuthInfo = authHeader.split(' ');
                if (headerAuthInfo[0].toLowerCase() === 'basic') {
                    const base64Token = headerAuthInfo[1];
                    let decodedBasicInfo = Buffer.from(base64Token, 'base64').toString('ascii').split(':');
                    req.authInfo.testAuthUser = decodedBasicInfo[0];
                    req.authInfo.testAuthPass = decodedBasicInfo[1];
                } else { // bearer
                    req.token = headerAuthInfo[1];
                }
            }
        }

        // api authentication
        let isAuthenticated = await checkOAuth2Auth(req) || await checkAuthToken(req);

        // get route and check if is eligible
        // secBypassRoutes
        const baseURL = req.protocol + '://' + req.headers.host + '/';
        let urlInfo = new URL(req.url, baseURL);
        urlInfo.pathname += (urlInfo.pathname[urlInfo.pathname.length - 1] === "/" ? "" : "/");

        if (firstRequest) {
            // normalize bypass routes
            if (!isEmpty(cjs.secBypassRoutes)) {
                let tmpRoutes = [];
                await cjs.secBypassRoutes.forEach((route) => tmpRoutes.push(normalizeRoute(route)));
                cjs.secBypassRoutes = tmpRoutes;
            }
            securityConfig.jwt.token_signin_route = normalizeRoute(securityConfig.jwt.token_signin_route);
            if (securityConfig.auth_entity && securityConfig.auth_entity.route)
                securityConfig.auth_entity.route = normalizeRoute(securityConfig.auth_entity.route);
            securityConfig.jwt.refresh_token.refresh_token_route = normalizeRoute(securityConfig.jwt.refresh_token.refresh_token_route);
            firstRequest = false;
        }
        if ((urlInfo.pathname === securityConfig.jwt.token_signin_route)) { // auth api credencials
            if (isAuthenticated) {
                let payload = {};
                payload[securityConfig.jwt.sign_client_id_field] = req.authInfo[securityConfig.jwt.sign_client_id_field];
                await generateRequestToken(res, payload);
            } else {
                let err = new Error(cjs.i18n.__('Access denied. Invalid credentials.'), 403);
                sendJson(res, err, 403);
            }
        } else if (securityConfig.auth_entity && securityConfig.auth_entity.route && urlInfo.pathname === securityConfig.auth_entity.route && isAuthenticated) { // auth entity
            // is auth entity checked
            let authEntityChecked = await checkAuthEntity(req);
            if (authEntityChecked) {
                await generateRequestToken(res, req.authInfo);
            } else {
                let err = new Error(cjs.i18n.__('Access denied. Invalid authentication.'), 403);
                sendJson(res, err, 403);
            }
        } else if (urlInfo.pathname === securityConfig.jwt.refresh_token.refresh_token_route) { // refresh token - new token
            if (isEmpty(req.refresh_token)) req.refresh_token = (!isEmpty(securityConfig.jwt.refresh_token.refresh_token_field)) ? req.query[securityConfig.jwt.refresh_token.refresh_token_field] || req.headers[securityConfig.jwt.refresh_token.refresh_token_field] || req.body[securityConfig.jwt.refresh_token.refresh_token_field] : null;

            //check if token is revoked
            let authData = verifyToken(req.refresh_token, refreshTokenEncryptionSecretKey);
            if (isEmpty(await revokedTokenStorage.getToken(req.refresh_token)) && authData) {
                // generate new token
                let response = {};
                response[securityConfig.jwt.token_field] = generateToken(authData);
                if (securityConfig.jwt.refresh_token.reset_refresh_token) {
                    response[securityConfig.jwt.refresh_token.refresh_token_field] = generateToken(authData, refreshTokenEncryptionSecretKey, refreshTokenExpires);
                    req.refresh_token = response[securityConfig.jwt.refresh_token.refresh_token_field];
                }
                // remove old token
                if (securityConfig.jwt.remove_tokens_auth) {
                    await userTokenStorage.removeToken(authData.clientId, !securityConfig.jwt.refresh_token.reset_refresh_token);
                }
                // save new token
                await userTokenStorage.addToken(authData.clientId, response[securityConfig.jwt.token_field], req.refresh_token, tokenExpires, refreshTokenExpires);
                response.token_type = "bearer";

                sendJson(res, response, 200);
            } else {
                let err = new Error(cjs.i18n.__("Access denied. Invalid refresh token."), 403);
                sendJson(res, err, 403);
            }
            // remove expired tokens
            await removeExpiredTokens();
        } else if (urlInfo.pathname.contains(cjs.secBypassRoutes)) next();
        else { // not bypassed
            // check if token was sent using token field
            if (isAuthenticated) next();
            else {
                let err = new Error(cjs.i18n.__("Access denied. Request not authenticated."), 403);
                sendJson(res, err, 403);
            }
        }
    } else next();
}

module.exports = security;