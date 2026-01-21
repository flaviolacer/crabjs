const path = require("path");
const fs = require('fs');
const log = require('./log.cjs');
const annotation = require('./annotation.cjs');
const Error = require("./error.cjs");
const cjs = require("./cjs.cjs");
const swagger = require("./swagger.cjs");
const utils = require("./utils.cjs");

// set global controller entity base functions
cjs.getControllerEntityBase = async (entity) => {
    if (isEmpty(entity)) return null;
    let ControllerEntityBase = require('./controller-entity-base.cjs');
    let controllerEntityBase = new ControllerEntityBase();
    controllerEntityBase.__entity = await cjs.entityManager.loadEntity(entity);
    return (!isEmpty(controllerEntityBase.__entity)) ? controllerEntityBase : null;
};

function routerManager() {
    let instance = this;
    /**
     * Load controller files
     * @param core
     */
    this.init = async (core) => {
        let rawControllerPath = cjs.config.server_controllers_path;
        if (isEmpty(cjs.config.server_controllers_path) || cjs.config.server_controllers_path.startsWith('.') || !cjs.config.server_controllers_path.startsWith('/'))
            cjs.config.server_controllers_path = path.join(cjs.config.app_root, cjs.config.server_controllers_path);

        let files;
        try {
            files = fs.readdirSync(cjs.config.server_controllers_path)
        } catch (e) {
            log.error('Unable to list files on directory: ' + e);
            return;
        }

        let swaggerDocument = {};
        for (let i = 0, j = files.length; i < j; i++) {
            let file = files[i];
            // parse annotation files
            let annotations;
            try {
                annotations = await annotation.parse(path.join(cjs.config.server_controllers_path, file));
            } catch (e) {
                log.error(e)
                return;
            }
            // when class, merge function, fields and classes - ES6
            let hasEntity;
            if (annotations.classes) {
                let classKeys = Object.keys(annotations.classes);
                annotations.functions = annotations.functions || {};
                for (let i = 0, j = classKeys.length; i < j; i++) {
                    hasEntity = !isEmpty(annotations.classes[classKeys[i]].entity);
                    annotations.functions[classKeys[i]] = annotations.classes[classKeys[i]];
                }

                if (annotations.fields) {
                    let fieldKeys = Object.keys(annotations.fields);
                    for (let i = 0, j = fieldKeys.length; i < j; i++)
                        annotations.functions[fieldKeys[i]] = annotations.fields[fieldKeys[i]];
                }
            }

            // get annotations info
            let annotationFunctionsKeys = Object.keys(annotations.functions);
            if ((annotations.functions && annotationFunctionsKeys.length > 0) || hasEntity) { // start mapping routes
                let routesInfo;
                try {
                    routesInfo = await instance.getRoutesAnnotationsInfo(annotations);
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
                let newControllerFileInstantiated = require(path.join(cjs.config.server_controllers_path, file));
                if ((newControllerFileInstantiated.constructor && newControllerFileInstantiated.constructor.name.toLowerCase() === "function")) newControllerFileInstantiated = new newControllerFileInstantiated();
                else if (newControllerFileInstantiated.__esModule) {
                    let __esImport = await import(path.join(cjs.config.server_controllers_path, file));
                    if (__esImport.default && typeof __esImport.default === "function") {
                        newControllerFileInstantiated = new __esImport.default();
                    } else if (__esImport.default && typeof __esImport.default === "object") {
                        newControllerFileInstantiated = __esImport.default;
                    } else {
                        newControllerFileInstantiated = __esImport;
                    }
                }

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
                    ControllerBase = require('./controller-base.cjs');
                }

                let controllerBase = new ControllerBase();
                newControllerFileInstantiated = extend(controllerBase, newControllerFileInstantiated);
                newControllerFileInstantiated.controllerName = routesInfo.controllerRoute.fname;
                newControllerFileInstantiated.controllerRoute = routesInfo.controllerRoute.data.route;

                // if controller has entity tag, load controller-entity-base
                // save raw newControllerFileInstantiated
                let rawNewControllerFileInstantiated = Object.assign({}, newControllerFileInstantiated); //clone

                // check if bypass security
                if (headerAnnotationKeys.contains("nosecurity"))
                    cjs.secBypassRoutes.push(path.join(cjs.config.application_prefix, routesInfo.controllerRoute.data.route));

                // define entity routes
                if (headerAnnotationKeys.contains("entity")) {
                    let controllerEntityBase = await cjs.getControllerEntityBase(headerAnnotations["entity"]);
                    if (!isEmpty(controllerEntityBase)) {
                        newControllerFileInstantiated = extend(newControllerFileInstantiated, controllerEntityBase);

                        // create route mappings - restful pattern
                        let default_methods = ["get", "post", "put", "delete"];
                        for (let i = 0, j = default_methods.length; i < j; i++) {
                            let method = default_methods[i];
                            if (!isEmpty(newControllerFileInstantiated["__" + method])) {
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
                                        summary: headerAnnotations["sw" + method.toLowerCase() + "summary"] || cjs.i18n.__("This method {{methodAction}} {{entityName}} entitie(s).", {
                                            "methodAction": methodActionTxt,
                                            "entityName": routesInfo.controllerRoute.fname
                                        }),
                                        description: headerAnnotations["sw" + method.toLowerCase() + "description"],
                                        entityName: routesInfo.controllerRoute.fname
                                    };

                                    swagger.insertRoute(swaggerOptions, swaggerDocument);

                                    if (method === "get" || method === "put" || method === "delete") {
                                        newRoute[method]("/:filter", newControllerFileInstantiated["__" + method]);
                                        swaggerOptions.path = path.join(headerAnnotations.route, "/:filter");
                                        // insert route on swagger
                                        swaggerOptions.summary = headerAnnotations["sw" + method.toLowerCase() + "summaryfilter"] || swaggerOptions.summary;
                                        swaggerOptions.description = headerAnnotations["sw" + method.toLowerCase() + "descriptionfilter"] || swaggerOptions.description;
                                        swagger.insertRoute(swaggerOptions, swaggerDocument);
                                    }
                                    newRoute[method]("/", newControllerFileInstantiated["__" + method]);
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
                        log.warn(cjs.i18n.__('Function "{{functionName}}" on controller "{{routeInfoName}} not set". Did you declared private?\n', {
                            functionName: route.fname,
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

                        // check bypass security on route
                        // complete url
                        let routeData = route.data.route;
                        let routeLastData = "";
                        if (routeData.contains(':')) {
                            routeData = routeData.split(':')[0];
                            routeLastData = ".";
                        }
                        let routeComplete = path.join(cjs.config.application_prefix, headerAnnotations.route, routeData) + routeLastData;
                        if (route.data.hasOwnProperty("nosecurity")) {
                            cjs.secBypassRoutes.push(routeComplete);
                        }

                        let scopes = route.data["scopes"] || route.data["scope"];
                        if (!isEmpty(scopes)) {
                            if (isString(scopes))
                                scopes = scopes.split(",");
                            let scopeList = [];
                            for (let i = 0, j = scopes.length; i < j; i++)
                                scopeList.push(scopes[i].trim());
                            cjs.scopeRoutes[routeComplete] = cjs.scopeRoutes[routeComplete] || {};
                            cjs.scopeRoutes[routeComplete][route.data.method.toLowerCase()] = scopeList;
                        }

                        newRoute[route.data.method.toLowerCase()](route.data.route, methodFunction);
                        if (route.data.hasOwnProperty("priority") || route.data.hasOwnProperty("prior"))
                            utils.sendRouteToFirstOnMethod(newRoute, route.data.method.toLowerCase());
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
        }

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