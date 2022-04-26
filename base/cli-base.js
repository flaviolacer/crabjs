const fs = require('fs');
const path = require("path");
const handlebars = require("handlebars");
const log = require("../base/log");

function cliBase() {
    this.showHelp = function () {
        let helpContent = fs.readFileSync(path.join(__dirname, "../templates/help.template"), {encoding: 'utf-8'});
        console.log(helpContent);
    }

    this.createController = function(controllerName) {
        const source = fs.readFileSync(path.join(__dirname, "../templates/controller.template"), {encoding: 'utf-8'});
        const template = handlebars.compile(source);
        const contents = template({name: controllerName});

        let controllerPath = "./controller/";
        if (!fs.existsSync(controllerPath)){
            fs.mkdirSync(controllerPath);
        }

        try {
            fs.writeFileSync(path.join(controllerPath, controllerName + '.js'), contents);
            log.info('Controller created.\n');
        } catch (err) {
            log.error(`Oops! cannot create file: ${err.message}.`);
        }
    };

    this.createEntity = function(entityName) {
        const source = fs.readFileSync(path.join(__dirname, "../templates/entity.template"), {encoding: 'utf-8'});
        const template = handlebars.compile(source);
        const contents = template({name: entityName});

        let entityPath = "./entity/";
        if (!fs.existsSync(entityPath)){
            fs.mkdirSync(entityPath);
        }

        try {
            fs.writeFileSync(path.join(entityPath, entityName + '.js'), contents);
            log.info('Entity created.\n');
        } catch (err) {
            log.error(`Oops! cannot create file: ${err.message}.`);
        }
    };

    this.process = function (args) {
        let command = args[0];
        switch (command) {
            case "create":
                switch (args[1]) {
                    case "controller":
                        if (isEmpty(args[2]))
                            log.error(`you have to set the name for the controller. \n`)
                        else
                            this.createController(args[2]);
                        break;
                    case "entity":
                        if (isEmpty(args[2]))
                            log.error(`you have to set the name for the entity. \n`)
                        else
                            this.createEntity(args[2]);
                        break;
                    default:
                        if (isEmpty(args[1]))
                            log.error(`you have to set and option for create command. \n`)
                        else
                            log.error(`option '${args[1]}' not found on create command. \n`)
                        break;
                }
                break;
            default:
                log.error("command not found. \n")
                this.showHelp();
        }
    }
}

module.exports = new cliBase();