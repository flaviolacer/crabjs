const cjs = require("./cjs");
const log = require('./log');

/**
 * Repository manager
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
        let connectionDriver = connectionInfo.driver || repository;

        if (isEmpty(RepositoryManager.connections[repository]))
            RepositoryManager.connections[repository] = this.loadDriver(connectionDriver);

        RepositoryManager.connections[repository].__connectionInfo = connectionInfo;
        return RepositoryManager.connections[repository];
    }

    loadDriver(repository) {
        let driverLib = './repository-drivers/' + repository;
        if (!require("./utils").checkLibExists(driverLib)) {
            log.error(cjs.i18n.__("Cannot load driver \"{{repository}}\". Perhaps still doesn't have driver for that. Check if the name is ok. \n", {repository: repository}));
            return null;
        } else
            return require(driverLib);
    }

    async save(options) {
        options.__errorMessage = "Cannot save entity \"{{entityName}}\", connection not found.";
        options.__command = "save";
        return await this.sendCommand(options);
    }

    async remove(options) {
        options.__errorMessage = "Cannot remove entity \"{{entityName}}\", connection not found.";
        options.__command = "remove";
        await this.sendCommand(options);
    }

    async insertBatch(options) {
        options.__errorMessage = "Cannot save batch using repository \"{{repository}}\"";
        options.__command = "insertBatch";
        await this.sendCommand(options);
    }

    async sendCommand(options) {
        let repository = options.repository || options.entity.repository;
        let conn = this.getConnection(options.repository);

        if (isEmpty(conn)) {
            log.error(cjs.i18n.__(options.__errorMessage, {
                repository: repository,
                entityName: (options.entity) ? options.entity.entityName : null
            }));
            return false
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

    async find(options) {
        let conn = this.getConnection(options.repository);
        if (isEmpty(conn))
            log.error(cjs.i18n.__("Cannot load data from repository \"{{options.repository}}\"", {repository: options.repository}));
        else
            return await conn.find(options).catch(function () {
                return false;
            }).then(function (data) {
                return data;
            });
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