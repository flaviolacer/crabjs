require("../../base/helper.cjs");
const assert = require("assert");
const cjs = require("../../base/cjs.cjs");
const userTokenStorage = require("../../base/security/tokens-user.cjs");
const revokedTokenStorage = require("../../base/security/tokens-revoked.cjs");
const log = require("../../base/log.cjs");

describe("Security storage guard", function () {
    let originalConfig;
    let originalEntityManager;
    let originalLogError;
    let loggedMessages;

    beforeEach(() => {
        originalConfig = cjs.config;
        originalEntityManager = cjs.entityManager;
        originalLogError = log.error;
        loggedMessages = [];

        cjs.config = {
            security: {
                security_repository: {
                    token_storage_type: "repository",
                    revoke_token_storage_type: "repository"
                }
            }
        };

        cjs.entityManager = {
            loadEntity: async () => undefined
        };

        log.error = (message) => {
            loggedMessages.push(message);
        };
    });

    afterEach(() => {
        cjs.config = originalConfig;
        cjs.entityManager = originalEntityManager;
        log.error = originalLogError;
    });

    it("does not throw when access token storage entity cannot be loaded", async () => {
        await assert.doesNotReject(async () => {
            await userTokenStorage.removeTokenExpired();
        });

        assert.ok(loggedMessages.some(message => message.includes('__access_storage')));
    });

    it("does not throw when revoked token storage entity cannot be loaded", async () => {
        await assert.doesNotReject(async () => {
            await revokedTokenStorage.removeTokenExpired();
        });

        assert.ok(loggedMessages.some(message => message.includes('__revoked_storage')));
    });
});
