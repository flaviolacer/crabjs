const cjs = require("./cjs");
const log = require('./log');
const url = require("url");
const Error = require("./error");
const localStorage = require('./localstorage');
const jwt = require('jsonwebtoken');

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
        let secretKey = cjs.config.security.secretKey || securityConfig.jwt.secretKey;
        if (isEmpty(secretKey)) {
            let err = new Error(cjs.i18n.__('Access denied. Secret key not set.'), 403);
            log.error(cjs.i18n.__("You must set the secretKey in config file."));
            sendJson(res, err, 403);
            return;
        }

        let saveUserToken = (clientId, token, expires) => {
            let tokenList = localStorage.getItem("tokenList") || {};
            tokenList[clientId] = {
                "token": token,
                "date": new Date(),
                "expires": expires
            };
            localStorage.setItem("tokenList", tokenList);
        }

        let addTokenRevokedList = (tokenInfo) => {
            let tokenRevoked = localStorage.getItem("tokenListRevoked") || {};
            tokenRevoked[tokenInfo.token] = {"date": tokenInfo.date, expires: tokenInfo.expires};
            localStorage.setItem("tokenListRevoked", tokenRevoked);
        };

        let removeUserToken = (clientId) => {
            let tokenList = localStorage.getItem("tokenList");
            if (tokenList && !isEmpty(tokenList[clientId])) {
                // add on revoked
                addTokenRevokedList(tokenList[clientId]);
                //erase record
                delete tokenList[clientId];
                // save to storage
                localStorage.setItem("tokenList", tokenList);
            } else
                return null;
        }

        let removeExpiredTokens = () => {
            let tokenList = localStorage.getItem("tokenList");
            if (!tokenList) return;
            // remove expired user tokens
            let apiUserClientIds = Object.keys(tokenList);
            for (let i = 0, j = apiUserClientIds.length; i < j; i++) {
                let tokenInfo = tokenList[apiUserClientIds[i]];
                if (isString(tokenInfo.date))
                    tokenInfo.date = new Date(tokenInfo.date);
                let secondsPassed = Math.abs((new Date().getTime() - tokenInfo.date.getTime()) / 1000);
                if (secondsPassed >= tokenInfo.expires)
                    delete tokenList[apiUserClientIds[i]];
            }
            //save updated tokenlist
            localStorage.setItem("tokenList", tokenList);

            // remove revoked tokens
            let tokensRevoked = localStorage.getItem("tokenListRevoked") || {};
            let tokenRevokedKeys = Object.keys(tokensRevoked);
            for (let i = 0, j = tokenRevokedKeys.length; i < j; i++) {
                let tokenRevokedInfo = tokensRevoked[tokenRevokedKeys[i]];
                if (isString(tokenRevokedInfo.date))
                    tokenRevokedInfo.date = new Date(tokenRevokedInfo.date);
                let secondsRevokedPassed = Math.abs((new Date().getTime() - tokenRevokedInfo.date.getTime()) / 1000);
                if (secondsRevokedPassed >= tokenRevokedInfo.expires)
                    delete tokensRevoked[tokenRevokedKeys[i]];
            }
            // save updated revoked list
            localStorage.setItem("tokenListRevoked", tokensRevoked);
        };

        // get route and check if is eligible
        // secBypassRoutes
        let urlInfo = url.parse(req.url);
        cjs.secBypassRoutes = cjs.secBypassRoutes || []; // memory allocation for url security bypass
        if (urlInfo.pathname === securityConfig.jwt.tokenRoute) { // request token
            let apiUserAuth = {};
            // check if there is clientId and clientSecret on config and matches with sent
            let testClientId = query[securityConfig.jwt.signClientIdField] || body[securityConfig.jwt.signClientIdField] || headers[securityConfig.jwt.signClientIdField];
            let testClientSecret = query[securityConfig.jwt.signClientIdField] || body[securityConfig.jwt.signClientIdField] || headers[securityConfig.jwt.signClientIdField];
            // validate using user set on config
            if ((!isEmpty(securityConfig[securityConfig.jwt.signClientIdField]) && !isEmpty(securityConfig[securityConfig.jwt.signClientSecretField])) && securityConfig[securityConfig.jwt.signClientIdField] === testClientId && securityConfig[securityConfig.jwt.signClientSecretField] === testClientSecret) {
                apiUserAuth.clientId = testClientId;
                apiUserAuth.clientSecret = testClientSecret;
            }
            //TODO: Implement repository

            // do the authentication
            if (!isEmpty(apiUserAuth)) {
                let tokenExpires = securityConfig.jwt.tokenExpires || 300; // 5 min default
                jwt.sign(apiUserAuth, secretKey, {
                    expiresIn: tokenExpires
                }, function (err, token) {
                    if (err) {
                        let err = new Error(cjs.i18n.__('Access denied. Error on generating token.'), 403);
                        sendJson(res, err, 403);
                    } else {
                        // remove old token
                        removeUserToken(apiUserAuth.clientId);
                        // save new token
                        saveUserToken(apiUserAuth.clientId, token, tokenExpires);
                        sendJson(res, {token: token}, 200);
                        // remove expired tokens
                        removeExpiredTokens();
                    }
                });
            } else {
                let err = new Error(cjs.i18n.__('Access denied. Invalid credentials.'), 403);
                sendJson(res, err, 403);
            }
        } else if (cjs.secBypassRoutes.contains(urlInfo.pathname))
            next();
        else { // not bypassed
            //Check if bearer exists
            if (securityConfig.jwt.tokenBearer) {
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
            if (isEmpty(req.token))
                req.token = (!isEmpty(securityConfig.jwt.tokenField)) ? query[securityConfig.jwt.tokenField] || body[securityConfig.jwt.tokenField] : null;

            if (isEmpty(req.token)) {
                let err = new Error(cjs.i18n.__('Access denied'), 403);
                sendJson(res, err, 403);
            } else { // verify token
                //check if token is revoked
                let tokensRevoked = localStorage.getItem("tokenListRevoked") || {};
                if (!isEmpty(tokensRevoked[req.token])) {
                    let err = new Error(cjs.i18n.__('Access denied. Invalid token.'), 403);
                    sendJson(res, err, 403);
                } else
                    jwt.verify(req.token, secretKey, function (err, authData) {
                        if (err) {
                            let err = new Error(cjs.i18n.__('Access denied. Invalid token.'), 403);
                            sendJson(res, err, 403);
                        } else {
                            console.log(authData);
                            next();
                        }
                        // remove expired tokens
                        removeExpiredTokens();
                    });
            }
        }
    }
}

module.exports = security;