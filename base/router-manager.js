const path = require("path");
const fs = require('fs');
const log = require('./log');
const annotation = require('./annotation');
const error = require("./error");

function routerManager() {
    let instance = this;
    // load controller files
    this.init = (core) => {
        const controllerPath = path.join(appRootDir, 'controller');
        fs.readdir(controllerPath,async function (err, files) {
            //handling error
            if (err) {
                log.error('Unable to list files on directory: ' + err);
            } else {
                await files.forEach(async function (file) {
                    // parse annotation files
                    await annotation.parse(path.join(controllerPath, file), function (err, annotations) {
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
                            let routerFileInstantiated = require(path.join(controllerPath, file));
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
                                    log.error(`Express method function (${route.data.method.toLowerCase()}) not found at "${route.fname}" on controller "${routesInfo.controllerRoute.fname}"\n`);
                                    continue;
                                }

                                if (isEmpty(routerFileInstantiated[route.fname])) {
                                    log.error(`@function not set at "${route.fname}" on controller "${routesInfo.controllerRoute.fname}". Did you declared private?\n`);
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
                core.expressInstance.use(function (req, res, next) {
                    // catch 404 and forward to error handler
                    let err = new error('Service or method not found', 404);
                    sendJson(res, err, 404);
                    next();
                });
            }
        });
    }

    this.getRoutesAnnotationsInfo = (annotations) => {
        let routeInfo = {
            routes: []
        };

        // search for controller
        let functionKeys = Object.keys(annotations.functions);
        for (let i = 0, j = functionKeys.length; i < j; i++) {
            let functionAnnotationKey = functionKeys[i];
            if (Object.keys(annotations.functions[functionAnnotationKey]).contains('controller')) routeInfo.controllerRoute = {
                fname: functionAnnotationKey, data: annotations.functions[functionAnnotationKey]
            }; else routeInfo.routes.push({
                fname: functionAnnotationKey, data: annotations.functions[functionAnnotationKey]
            });
        }
        if (!routeInfo.controllerRoute) {
            throw new Error("Annotation Controller not found");
        }

        return routeInfo;
    };
}

module.exports = new routerManager;