const path = require("path");
const fs = require('fs');
const cjs = require("./cjs.cjs");
const handlebars = require("handlebars");
const swaggerUi = require("swagger-ui-express");

function swagger() {
    this.init = (swaggerFiles, core) => {
        // generate default config
        const source = fs.readFileSync(path.join(__dirname, "../templates/swagger.json"), {encoding: 'utf-8'});
        const template = handlebars.compile(source);

        cjs.config.swagger.info.authorizationUrl = cjs.config.security.jwt.token_signin_route;
        cjs.config.swagger.info.tokenUrl = cjs.config.security.jwt.refresh_token.refresh_token_route;
        cjs.config.swagger.info.apiServerAddress = new URL(cjs.config.application_prefix, cjs.config.host_address || "http://localhost").href;

        const swaggerDocument = JSON.parse(template(cjs.config.swagger.info));
        extend(swaggerDocument, swaggerFiles);
        cjs.secBypassRoutes.push(cjs.config.swagger.path.replaceAll("/", ""));

        let newSwaggerRoute = core.express.Router();
        newSwaggerRoute.use(cjs.config.swagger.path, swaggerUi.serve);

        let swaggerOptions = {};
        newSwaggerRoute.get(cjs.config.swagger.path, swaggerUi.setup(swaggerDocument, swaggerOptions));
        core.expressInstance.use(newSwaggerRoute);
    }
    this.insertRoute = (options, swaggerFiles) => {
        let swaggerPathItem = {};
        if (isEmpty(swaggerPathItem[options.method]))
            swaggerPathItem[options.method] = {
                "tags": options.tags,
                "summary": options.summary,
                "description": options.description,
                "security": [{
                    "apiauth": ["default"]
                }],
                "responses": {
                    "200": {
                        "description": "Successful operation",
                    },
                    "400": {
                        "description": "Invalid ID supplied"
                    },
                    "404": {
                        "description": options.entityName.charAt(0).toUpperCase() + options.entityName.slice(1) + " not found"
                    },
                    "405": {
                        "description": "Validation exception"
                    },
                    "406": {
                        "description": "Content empty or not alowed"
                    }
                },
            };
        swaggerFiles.paths = swaggerFiles.paths || {};
        let requestPath = options.path.endsWith('/') ? options.path.slice(0, -1) : options.path;
        if (isEmpty(swaggerFiles.paths[requestPath]))
            swaggerFiles.paths[requestPath] = swaggerPathItem;
        else {
            swaggerFiles.paths[requestPath][options.method] = swaggerPathItem[options.method];
        }
    }
}

module.exports = new swagger();