const path = require("path");
const fs = require('fs');
const log = require('./log');
const annotation = require('./annotation');
const Error = require("./error");
const cjs = require("./cjs");
const swagger = require("./swagger");
const utils = require("./utils");

// set global controller entity base functions
cjs.getControllerEntityBase = (entity) => {
    if (isEmpty(entity)) return null;
    let ControllerEntityBase = require('./controller-entity-base');
    let controllerEntityBase = new ControllerEntityBase();
    controllerEntityBase.__entity = cjs.entityManager.loadEntity(entity);
    return (!isEmpty(controllerEntityBase.__entity)) ? controllerEntityBase : null;
};
function routerManager() {
    let instance = this;
    let config = cjs.config;
    /**
     * Load controller files
     * @param core
     */
    this.init = (core) => {
        let rawControllerPath = config.server_controllers_path;
        if (isEmpty(config.server_controllers_path) || config.server_controllers_path.startsWith('.') || !config.server_controllers_path.startsWith('/'))
            cjs.config.server_controllers_path = path.join(config.app_root, config.server_controllers_path);

        fs.readdir(config.server_controllers_path, async function (err, files) {
                //handling error
                if (err) {
                    log.error('Unable to list files on directory: ' + err);
                } else {
                    let swaggerDocument = {};
                    await files.forEach(async file => {
                            // parse annotation files
                            await annotation.parse(path.join(config.server_controllers_path, file), async (err, annotations) => {
                                if (err) {
                                    log.error(err)
                                    return;
                                }
                                // when class, merge function, fields and classes - ES6
                                if (annotations.classes) {
                                    let classKeys = Object.keys(annotations.classes);
                                    for (let i = 0, j = classKeys.length; i < j; i++)
                                        annotations.functions[classKeys[i]] = annotations.classes[classKeys[i]];
                                    let fieldKeys = Object.keys(annotations.fields);
                                    for (let i = 0, j = fieldKeys.length; i < j; i++)
                                        annotations.functions[fieldKeys[i]] = annotations.fields[fieldKeys[i]];
                                }

                                // get annotations info
                                let annotationFunctionsKeys = Object.keys(annotations.functions);
                                if (annotations.functions && annotationFunctionsKeys.length > 0) { // start mapping routes
                                    let routesInfo;
                                    try {
                                        routesInfo = instance.getRoutesAnnotationsInfo(annotations);
                                    } catch (e) {
                                        log.error(cjs.i18n.__('Annotation "@Controller" not found on controller file "{{file}}"', {file: file}));
                                    }

                                    // swagger implementation
                                    swaggerDocument.tags = swaggerDocument.tags || [];
                                    swaggerDocument.tags.push({
                                        name: routesInfo.controllerRoute.fname
                                    });
                                    let swaggerFileTag = routesInfo.controllerRoute.fname;

                                    const entries = Object.entries(routesInfo.controllerRoute.data);
                                    let headerAnnotationKeys =
                                        entries.map(([key]) => {
                                            return key.toLowerCase();
                                        });
                                    let headerAnnotations = Object.fromEntries(
                                        entries.map(([key, value]) => {
                                            return [key.toLowerCase(), value];
                                        }),
                                    );

                                    // create express routes
                                    let newRoute = core.express.Router();

                                    // get controller instantiated
                                    let newControllerFileInstantiated = require(path.join(config.server_controllers_path, file));
                                    if (newControllerFileInstantiated.constructor.name.toLowerCase() === "function") newControllerFileInstantiated = new newControllerFileInstantiated();

                                    if (isEmpty(newControllerFileInstantiated)) {
                                        log.error(cjs.i18n.__('Empty controller info on controller "{{fname}} ({{file}})". Missing module.exports?', {
                                            fname: routesInfo.controllerRoute.fname,
                                            file: file
                                        }));
                                        return;
                                    }

                                    // extend it to controller-base if entity exists or custom controller base exists
                                    let ControllerBase;
                                    let customBaseLib = headerAnnotationKeys.contains("custom") || headerAnnotationKeys.contains("custombase");
                                    if (customBaseLib) {
                                        let customEntityPath = (headerAnnotationKeys.contains("custompath")) ? headerAnnotationKeys["custompath"] : path.join(config.server_entities_path, "custom");
                                        try {
                                            ControllerBase = require(path.join(customEntityPath, headerAnnotations["custom"] || headerAnnotations["custombase"] + ".js"));
                                        } catch (e) {
                                            log.error(cjs.i18n.__('Error loading custom controller route. Verify if file exists on: {{customBaseLib}} ', {customBaseLib: customBaseLib}));
                                            return;
                                        }
                                    } else {
                                        ControllerBase = require('./controller-base');
                                    }

                                    let controllerBase = new ControllerBase();
                                    newControllerFileInstantiated = extend(controllerBase, newControllerFileInstantiated);
                                    newControllerFileInstantiated.controllerName = routesInfo.controllerRoute.fname;
                                    newControllerFileInstantiated.controllerRoute = routesInfo.controllerRoute.data.route;

                                    // if controller has entity tag, load controller-entity-base
                                    // save raw newControllerFileInstantiated
                                    let rawNewControllerFileInstantiated = Object.assign({}, newControllerFileInstantiated); //clone
                                    if (headerAnnotationKeys.contains("entity")) {
                                        let controllerEntityBase = cjs.getControllerEntityBase(headerAnnotations["entity"]);
                                        if (!isEmpty(controllerEntityBase)) {
                                            newControllerFileInstantiated = extend(newControllerFileInstantiated, controllerEntityBase);

                                            // create route mappings - restful pattern
                                            let default_methods = ["get", "post", "put", "delete"];
                                            for (let i = 0, j = default_methods.length; i < j; i++) {
                                                let method = default_methods[i];
                                                if (!isEmpty(newControllerFileInstantiated["__"+method])) {
                                                    let methodActionTxt = "return";
                                                    try {
                                                        switch (method.toLowerCase()) {
                                                            case "post":
                                                                methodActionTxt = "insert";
                                                                break;
                                                            case "put":
                                                                methodActionTxt = "update";
                                                                break;
                                                            case "delete":
                                                                methodActionTxt = "remove";
                                                                break;
                                                            default:
                                                        }

                                                        let swaggerOptions = {
                                                            method: method,
                                                            path: path.join(headerAnnotations.route, "/"),
                                                            tags: [swaggerFileTag],
                                                            summary: headerAnnotations["sw_" + method.toLowerCase() + "_summary"] || cjs.i18n.__("This method {{methodAction}} {{entityName}} entitie(s).", {
                                                                "methodAction": methodActionTxt,
                                                                "entityName": routesInfo.controllerRoute.fname
                                                            }),
                                                            description: headerAnnotations["sw_" + method.toLowerCase() + "_description"],
                                                            entityName: routesInfo.controllerRoute.fname
                                                        };

                                                        swagger.insertRoute(swaggerOptions, swaggerDocument);

                                                        if (method === "get" || method === "put" || method === "delete") {
                                                            newRoute[method]("/:filter", newControllerFileInstantiated["__"+method]);
                                                            swaggerOptions.path = path.join(headerAnnotations.route, "/:filter");
                                                            // insert route on swagger
                                                            swaggerOptions.summary = headerAnnotations["sw_" + method.toLowerCase() + "_summary_filter"] || swaggerOptions.summary;
                                                            swaggerOptions.description = headerAnnotations["sw_" + method.toLowerCase() + "_description_filter"] || swaggerOptions.description;
                                                            swagger.insertRoute(swaggerOptions, swaggerDocument);
                                                        }
                                                        newRoute[method]("/", newControllerFileInstantiated["__"+method]);
                                                    } catch (e) {
                                                        log.error(cjs.i18n.__('Cannot associate default entity methods to controller "{{controller}}". Missing default functions ou wrong functions format?', {
                                                            controller: newControllerFileInstantiated.controllerName
                                                        }));
                                                        break;
                                                    }
                                                }
                                            }
                                        } else {
                                            log.error(cjs.i18n.__('Entity "{{entity}}" not found on association to controller "{{controller}}". Missing entity on dir?', {
                                                entity: headerAnnotations["entity"],
                                                controller: newControllerFileInstantiated.controllerName
                                            }));
                                        }
                                    }

                                    // define routes
                                    for (let i = 0, j = routesInfo.routes.length; i < j; i++) {
                                        let route = routesInfo.routes[i];
                                        if (!route.data.method) {
                                            log.error(cjs.i18n.__('@method not found at function "{{routeName}}" on controller "{{routeInfoName}}"\n', {
                                                routeName: route.fname,
                                                routeInfoName: routesInfo.controllerRoute.fname
                                            }));
                                            continue;
                                        }
                                        // check if route path was set
                                        if (!route.data.route) {
                                            log.error(cjs.i18n.__('@route not set at "{{routeName}}" on controller "{{routeInfoName}}"\n', {
                                                routeName: route.fname,
                                                routeInfoName: routesInfo.controllerRoute.fname
                                            }));
                                            continue;
                                        }

                                        let routerMethodFunction = newRoute[route.data.method.toLowerCase()];
                                        if (!routerMethodFunction) {
                                            log.warn(cjs.i18n.__('Express method function ({{method}}) not found at "{{routeName}}" on controller "{{routeInfoName}}"\n', {
                                                method: route.data.method.toLowerCase(),
                                                routeName: route.fname,
                                                routeInfoName: routesInfo.controllerRoute.fname
                                            }));
                                            continue;
                                        }

                                        if (isEmpty(newControllerFileInstantiated[route.fname])) {
                                            log.warn(cjs.i18n.__('@function not set at "${routeName}" on controller "{{routeInfoName}}". Did you declared private?\n', {
                                                routeName: route.fname,
                                                routeInfoName: routesInfo.controllerRoute.fname
                                            }));
                                            continue;
                                        }

                                        // set route path to controller instantiated function
                                        try {
                                            // get swagger annotations
                                            let swaggerTextVariables = {
                                                entityName: headerAnnotations["entity"] || "",
                                                controllerFile: path.join(rawControllerPath, file)
                                            }

                                            // swagger annotation texts
                                            route.data.summary = utils.formatTextController(route.data.summary, swaggerTextVariables);
                                            route.data.description = utils.formatTextController(route.data.description, swaggerTextVariables);

                                            // insert on swagger document
                                            swagger.insertRoute({
                                                method: route.data.method.toLowerCase(),
                                                path: path.join(headerAnnotations.route, route.data.route),
                                                tags: [swaggerFileTag],
                                                summary: route.data.summary || path.join(rawControllerPath, file),
                                                description: route.data.description,
                                                entityName: routesInfo.controllerRoute.fname
                                            }, swaggerDocument);
                                            // remore previous route configured
                                            utils.removeRouteFromStack(newRoute, route.data.method.toLowerCase(), route.data.route);
                                            // if controller entity was used then associate controller in function
                                            let methodFunction = rawNewControllerFileInstantiated[route.fname] || rawNewControllerFileInstantiated.__proto__[route.fname];
                                            //if (!isEmpty(controllerEntityBase.__entity) && !isEmpty(methodFunction))
                                            //    methodFunction

                                            newRoute[route.data.method.toLowerCase()](route.data.route, methodFunction);
                                        } catch (e) {
                                            log.error(e);
                                        }
                                    }

                                    // check if prefix exists
                                    if (!isEmpty(cjs.config.application_prefix)) {
                                        if (!cjs.config.application_prefix.startsWith("/"))
                                            cjs.config.application_prefix = "/" + cjs.config.application_prefix;
                                        routesInfo.controllerRoute.data.route = path.join(cjs.config.application_prefix, routesInfo.controllerRoute.data.route);
                                    }

                                    // insert route on stack
                                    core.expressInstance.use(routesInfo.controllerRoute.data.route, newRoute);
                                }
                            });
                        }
                    );

                    // swagger integration
                    if (cjs.config.swagger && cjs.config.swagger.enabled)
                        swagger.init(swaggerDocument, core);

                    // load error catch routes
                    core.expressInstance.use((req, res, next) => {
                        // catch 404 and forward to error handler
                        let err = new Error('Service or method not found', 404);
                        sendJson(res, err, 404);
                        next();
                    });
                }
            }
        );
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