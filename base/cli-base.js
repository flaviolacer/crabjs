const fs = require('fs');
const path = require("path");
const handlebars = require("handlebars");
const cjs = require("./cjs");
cjs.config = require("../defaults.json")
// app libs
const core = require("./core");
// load default config
cjs.config.app_root = process.cwd();
// load locales
cjs.i18n = core.loadLocales();
core.loadCustomConfig();
const log = require("../base/log");

function cliBase() {
    this.init = () => {
        // copy app.js default
        fs.copyFileSync(path.join(__dirname, "../templates/init/app.js"), path.join(cjs.config.app_root, 'app.js'));
        // generate default config
        const source = fs.readFileSync(path.join(__dirname, "../templates/init/crabjs.template"), {encoding: 'utf-8'});
        const template = handlebars.compile(source);

        let utils = require("./utils");
        let generated_options = {
            "encryption_key": utils.UID("48"),
            "client_id": utils.UID("22"),
            "client_secret": utils.UID("43")
        };
        const contents = template(generated_options);
        try {
            // white config to directory
            fs.writeFileSync(path.join(cjs.config.app_root, 'crabjs.json'), contents);
            // get installed npm
            // import exec method from child_process module
            const {execSync} = require("child_process");
            let npm_bin = execSync("which npm").toString().replace(/\n/g, "");
            // creating default dirs
            let controllerDir = path.join(cjs.config.app_root, '/controller/');
            if (!fs.existsSync(controllerDir))
                fs.mkdirSync(controllerDir);
            let entityDir = path.join(cjs.config.app_root, '/entity/');
            if (!fs.existsSync(entityDir))
                fs.mkdirSync(entityDir);

            // install dependencies
            log.warn('Installing dependencies...')
            let spawn = require('child_process').spawn;
            let watcher = spawn(npm_bin, ["install", "-s", "crabjs", "--prefix", cjs.config.app_root]);
            watcher.on('exit', function () {
                const source_init = fs.readFileSync(path.join(__dirname, "../templates/init.template"), {encoding: 'utf-8'});
                const template_init = handlebars.compile(source_init);
                console.log(template_init(generated_options));
            });
        } catch (err) {
            log.error(`Oops! cannot create file: ${err.message}.`);
        }
    }

    this.showHelp = function () {
        let helpContent = fs.readFileSync(path.join(__dirname, "../templates/help.template"), {encoding: 'utf-8'});
        console.log(helpContent);
    }

    this.createController = function (controllerName) {
        const source = fs.readFileSync(path.join(__dirname, "../templates/controller.template"), {encoding: 'utf-8'});
        const template = handlebars.compile(source);
        const contents = template({name: controllerName});

        let controllerPath = path.join(cjs.config.app_root, "/controller/");
        if (!fs.existsSync(controllerPath)) {
            fs.mkdirSync(controllerPath);
        }

        try {
            fs.writeFileSync(path.join(controllerPath, controllerName + '.js'), contents);
            log.info('Controller created.\n');
        } catch (err) {
            log.error(`Oops! cannot create file: ${err.message}.`);
        }
    };

    this.createEntity = function (entityName) {
        const source = fs.readFileSync(path.join(__dirname, "../templates/entity.template"), {encoding: 'utf-8'});
        const template = handlebars.compile(source);
        const contents = template({name: entityName});

        let entityPath = path.join(cjs.config.app_root, "/entity/");
        if (!fs.existsSync(entityPath)) {
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
            case "help":
                this.showHelp();
                break;
            case "init":
                log.warn("Initializing project...")
                this.init();
                break;
            default:
                log.error("command not found. \n")
                this.showHelp();
        }
    }
}

module.exports = new cliBase();