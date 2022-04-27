const path = require("path");
const fs = require('fs');
const log = require('./log');
const annotation = require('./annotation');
const Error = require("./error");

function routerManager() {
    let instance = this;
    /**
     * Load controller files
     * @param core
     */
    this.init = (core) => {
        if (isEmpty(config.server_controllers_path) || config.server_controllers_path.startsWith('.') || !config.server_controllers_path.startsWith('/'))
            config.server_controllers_path = path.join(config.app_root, config.server_controllers_path);

        fs.readdir(config.server_controllers_path,async function (err, files) {
            //handling error
            if (err) {
                log.error('Unable to list files on directory: ' + err);
            } else {
                await files.forEach(async file => {
                    // parse annotation files
                    await annotation.parse(path.join(config.server_controllers_path, file), (err, annotations) => {
                        if (err) {
                            log.error(err)
                            return;
                        }
                        // get annotations info
                        let annotationFunctionsKeys = Object.keys(annotations.functions);
                        if (annotations.functions && annotationFunctionsKeys.length > 0) { // start mapping routes
                            let routesInfo;
                            try {
                                routesInfo = instance.getRoutesAnnotationsInfo(annotations);
                            } catch (e) {
                                log.error(`Annotation "@Controller" not found on controller file "${file}"`);
                            }

                            // create express routes
                            let newRoute = core.express.Router();

                            // get controller instantiated
                            let routerFileInstantiated = require(path.join(config.server_controllers_path, file));
                            if (routerFileInstantiated.constructor.name.toLowerCase() === "function") routerFileInstantiated = new routerFileInstantiated();

                            if (isEmpty(routerFileInstantiated)) {
                                log.error(`Empty controller info on controller "${routesInfo.controllerRoute.fname} (${file})". Missing module.exports?`);
                                return;
                            }

                            // define routes
                            for (let i = 0, j = routesInfo.routes.length; i < j; i++) {
                                let route = routesInfo.routes[i];
                                if (!route.data.method) {
                                    log.error(`@method not found at "${route.fname}" on controller "${routesInfo.controllerRoute.fname}"\n`);
                                    continue;
                                }
                                // check if route path was set
                                if (!route.data.route) {
                                    log.error(`@route not set at "${route.fname}" on controller "${routesInfo.controllerRoute.fname}"\n`);
                                    continue;
                                }

                                let routerMethodFunction = newRoute[route.data.method.toLowerCase()];
                                if (!routerMethodFunction) {
                                    log.warn(`Express method function (${route.data.method.toLowerCase()}) not found at "${route.fname}" on controller "${routesInfo.controllerRoute.fname}"\n`);
                                    continue;
                                }

                                if (isEmpty(routerFileInstantiated[route.fname])) {
                                    log.warn(`@function not set at "${route.fname}" on controller "${routesInfo.controllerRoute.fname}". Did you declared private?\n`);
                                    continue;
                                }

                                // set route path to controller instantiated function
                                newRoute[route.data.method.toLowerCase()](route.data.route, routerFileInstantiated[route.fname]);
                            }

                            // insert route on stack
                            core.expressInstance.use(routesInfo.controllerRoute.data.route, newRoute);
                        }
                    });
                });
                // load error catch routes
                core.expressInstance.use((req, res, next) => {
                    // catch 404 and forward to error handler
                    let err = new Error('Service or method not found', 404);
                    sendJson(res, err, 404);
                    next();
                });
            }
        });
    }

    /**
     * Get information about detected annotations
     * @param annotations
     * @returns {{routes: *[]}}
     */
    this.getRoutesAnnotationsInfo = (annotations) => {
        let routeInfo = {
            routes: []
        };

        // search for controller
        let functionKeys = Object.keys(annotations.functions);
        for (let i = 0, j = functionKeys.length; i < j; i++) {
            let functionAnnotationKey = functionKeys[i];
            if (Object.keys(annotations.functions[functionAnnotationKey]).contains('controller')) routeInfo.controllerRoute = {
                "fname": functionAnnotationKey, data: annotations.functions[functionAnnotationKey]
            }; else routeInfo.routes.push({
                "fname": functionAnnotationKey, data: annotations.functions[functionAnnotationKey]
            });
        }
        if (!routeInfo.controllerRoute) {
            throw new Error("Annotation Controller not found");
        }

        return routeInfo;
    };
}

module.exports = new routerManager();