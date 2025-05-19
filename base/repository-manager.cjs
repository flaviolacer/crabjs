const cjs = require("./cjs.cjs");
const log = require('./log.cjs');
const Constants = require("./constants.cjs");

/**
 * Repository manager
 *
 * Error codes:
 * 2 - connection error
 * 5 - required field was not set
 */
/**
 * @class RepositoryManager
 */
class RepositoryManager {
    static connections = [];

    getConnection(repository) {
        repository = repository || (cjs.config.repository ? cjs.config.repository.default : null);
        if (isEmpty(repository)) {
            log.error(cjs.i18n.__("Cannot save entity in empty repository. No default repository is set"));
            return;
        }

        // get connection info
        let connectionInfo = cjs.config.repository[repository];
        let connectionDriver = connectionInfo.driver || "mongodb";

        if (isEmpty(RepositoryManager.connections[repository])) {
            let Driver = this.loadDriver(connectionDriver);
            RepositoryManager.connections[repository] = new Driver();
        }

        RepositoryManager.connections[repository].__connectionInfo = connectionInfo;
        return RepositoryManager.connections[repository];
    }

    loadDriver(repository) {
        let driverLib = './repository-drivers/' + repository;
        let driverFile = require("./utils.cjs").checkLibExists(driverLib);
        if (!driverFile) {
            log.error(cjs.i18n.__("Cannot load driver \"{{repository}}\". Perhaps still doesn't have driver for that. Check if the name is ok. \n", {repository: repository}));
            return null;
        } else
            return require(driverFile);
    }

    async save(options) {
        options.__errorMessage = "Cannot save entity \"{{entityName}}\", connection not found.";
        options.__command = "save";
        return await this.sendCommand(options);
    }

    async remove(options) {
        options.__errorMessage = "Cannot remove entity \"{{entityName}}\", connection not found.";
        options.__command = "remove";
        return await this.sendCommand(options);
    }

    async insertBatch(options) {
        options.__errorMessage = "Cannot save batch using repository \"{{repository}}\"";
        options.__command = "insertBatch";
        return await this.sendCommand(options);
    }

    async sendCommand(options) {
        let repository = options.repository || options.entity.repository;
        let conn = this.getConnection(options.repository);

        if (isEmpty(conn)) {
            log.error(cjs.i18n.__(options.__errorMessage, {
                repository: repository,
                entityName: (options.entity) ? options.entity.entityName : null
            }));
            return {
                error: true,
                error_message: options.__errorMessage,
                error_code: Constants.CONNECTION_ERROR
            }
        }
        return await conn[options.__command](options);
    }

    async findOne(options) {
        let conn = this.getConnection(options.repository);
        if (isEmpty(conn))
            log.error(cjs.i18n.__("Cannot find one data using repository \"{{options.repository}}\"", {repository: options.repository}));
        else
            return await conn.findOne(options).catch(function (e) {
                log.error(e);
                return false;
            }).then(function (obj) {
                return obj;
            });
    }

    find(options) {
        let conn = this.getConnection(options.repository);

        if (isEmpty(conn))
            log.error(cjs.i18n.__("Cannot load data from repository \"{{options.repository}}\"", {repository: options.repository}));
        else {
            try {
                return conn.find(options);
            } catch (e) {
                return false;
            }
        }
    }

    close(connection) {
        if (connection) {
        } else {
            if (!isEmpty(RepositoryManager.connections))
                Object.keys(RepositoryManager.connections).forEach(function(key) {
                    RepositoryManager.connections[key].close();
                });
        }
    }
}

module.exports = new RepositoryManager();