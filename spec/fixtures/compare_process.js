const { assert } = require('console');
const innerModuleProcess = require('./export_process');

assert(process == innerModuleProcess, "process and innerModuleProcess should be the same object");