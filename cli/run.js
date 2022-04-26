#!/usr/bin/env node
const path = require('path');
require(path.join(__dirname,"../base/helper"));
const cliBase = require(path.join(__dirname,"../base/cli-base"));
const log = require("../base/log");

const [, , ...args] = process.argv;
const pjson = require('../package.json');

log.warn(`\nGrabJS Cli command line. Version: ${pjson.version}`);

if (isEmpty(args)) {
    console.log(`Usage: cjs [command] [options] \n`);
    return;
}

if (args.contains('--h') || args.contains('--help')) {
    cliBase.showHelp();
} else {
    cliBase.process(args);
}



