const path = require("path");
const express = require('express');
const http = require("http");
const log = require("./log");

function core() {
    /**
     * Express reuse
     */
    this.express = express;
    this.expressInstance = express();
    let expressInstance = this.expressInstance;

    /**
     * Start express server on predfined ports
     */
    let startServer = () => {
        let port = normalizePort(process.env.PORT || '3000');
        expressInstance.set('port', port);
        let server = http.createServer(expressInstance);
        // set default timeout
        server.setTimeout(300000);
        /**
         * Listen on provided port, on all network interfaces.
         */
        server.listen(port);
        server.on('error', onError);
        server.on('listening', onListening);
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
            log.error("CrabJS count not start!");
            switch (error.code) {
                case 'EACCES':
                    log.error(bind + ' requires elevated privileges');
                    process.exit(1);
                    break;
                case 'EADDRINUSE':
                    log.error(bind + ' is already in use');
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
            let addr = server.address();
            let bind = typeof addr === 'string'
                ? 'pipe ' + addr
                : addr.port;
            let host = addr.address;
            localAddresses = ['::','127.0.0.1'];
            host = (localAddresses.contains(host)) ? "http://localhost" : 'http://' + host;

            log.info('\x1b[33m%s\x1b[0m', '--------------------------------------------------');
            log.info('\x1b[36m%s\x1b[0m', '   CrabJS started!');
            log.info('\x1b[36m%s\x1b[0m', '   Server started at "'+host+':'+bind+'"');
            log.info('\x1b[33m%s\x1b[0m', '--------------------------------------------------\n');
        }
    }

    this.initExpress = () => {
        // set views dir and template engine
        expressInstance.set('express/views', path.join(__dirname, 'views'));
        let ejs = require('ejs');
        expressInstance.engine('html', ejs.renderFile);
        expressInstance.set('view engine', 'html');
        // middlewares
        //expressInstance.use(logger('Response time\: :response-time\\n'));
        // catch not found
        // start server
        startServer();
    }
}

module.exports = new core();