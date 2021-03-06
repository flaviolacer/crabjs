const path = require("path");
const express = require('express');
const http = require("http");
const log = require("./log");
const cjs = require("./cjs");
const fs = require("fs");
const { I18n } = require('i18n')

function core() {
    /**
     * Express reuse
     */
    this.express = express;
    this.expressInstance = express();
    let expressInstance = this.expressInstance;
    this.server = null;
    let instance = this;

    /**
     * Start express server on predfined ports
     */
    this.startServer = () => {
        let port = normalizePort(cjs.config.server_port || process.env.SERVER_PORT || '3000');
        expressInstance.set('port', port);
        this.server = http.createServer(expressInstance);
        // set default timeout
        this.server.setTimeout(cjs.config.server_timeout);
        /**
         * Listen on provided port, on all network interfaces.
         */
        this.server.listen(port);
        this.server.on('error', onError);
        this.server.on('listening', onListening);
        /**
         * Normalize a port into a number, string, or false.
         */
        function normalizePort(val) {
            let port = parseInt(val, 10);

            if (isNaN(port)) {
                // named pipe
                return val;
            }

            if (port >= 0) {
                // port number
                return port;
            }

            return false;
        }

        /**
         * Event listener for HTTP server "error" event.
         */
        function onError(error) {
            if (error.syscall !== 'listen') {
                throw error;
            }

            let bind = typeof port === 'string'
                ? 'Pipe ' + port
                : 'Port ' + port;

            // handle specific listen errors with friendly messages
            log.error(cjs.i18n.__("CrabJS count not start!"));
            switch (error.code) {
                case 'EACCES':
                    log.error(bind + cjs.i18n.__(' requires elevated privileges'));
                    process.exit(1);
                    break;
                case 'EADDRINUSE':
                    log.error(bind + cjs.i18n.__(' is already in use'));
                    process.exit(1);
                    break;
                default:
                    throw error;
            }
        }

        /**
         * Event listener for HTTP server "listening" event.
         */
        function onListening() {
            let addr = instance.server.address();
            let bind = typeof addr === 'string'
                ? 'pipe ' + addr
                : addr.port;
            let host = addr.address;
            let localAddresses = ['::','127.0.0.1'];
            host = (localAddresses.contains(host)) ? "http://localhost" : 'http://' + host;

            log.force('\x1b[33m%s\x1b[0m', '--------------------------------------------------');
            log.force('\x1b[36m%s\x1b[0m', '   '+cjs.i18n.__('CrabJS started!'));
            log.force('\x1b[36m%s\x1b[0m', '   '+cjs.i18n.__('Server started at "')+host+':'+bind+'"');
            log.force('\x1b[33m%s\x1b[0m', '--------------------------------------------------\n');
        }
    }

    /**
     * Stop express server , just for tests
     */
    this.stopServer = () => {
        this.server.close();
    }

    /**
     * Initialize express server
     */
    this.initExpress = () => {
        // set views dir and template engine
        expressInstance.set('views', path.join(__dirname, 'views'));
        let ejs = require('ejs');
        expressInstance.engine('html', ejs.renderFile);
        expressInstance.set('view engine', 'html');
        // middlewares
        //expressInstance.use(logger('Response time\: :response-time\\n'));
        // catch not found
        // start server
        // set security
        expressInstance.use(require("./security"));
        this.startServer();
    }

    /**
     * Load custom config
     */
    this.loadCustomConfig = () => {
        let customConfigFilename = path.join(cjs.config.app_root,cjs.config.server_config_filename);
        if (fs.existsSync(customConfigFilename)) {
            let custom_config;
            try {
                custom_config = require(customConfigFilename);
            } catch(e) {
                log.error(cjs.i18n.__("Error on loading config file {{configFilename}}. Check the file format.", {configFilename: cjs.config.server_config_filename}));
                return;
            }
            // merge config session
            extendRecursive(cjs.config, custom_config);
        }
    }

    /**
     * Load locale info
     */
    this.loadLocales = () => {
        return new I18n({
            locales: [cjs.config.language],
            directory: path.join(__dirname, "../locales"),
            updateFiles: true
        });
    }
}

module.exports = new core();