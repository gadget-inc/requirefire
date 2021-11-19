"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const module_1 = __importDefault(require("module"));
/**
 * Declares all globals with a var and assigns the global object. Thus you're able to
 * override globals without changing the global object itself.
 *
 * Returns something like
 * "var console = global.console; var process = global.process; ..."
 */
const getImportGlobalsSrc = (ignore = []) => {
    let key, src = "";
    ignore = ignore || [];
    // global itself can't be overridden because it's the only reference to our real global objects
    ignore.push("global");
    // ignore 'module', 'exports' and 'require' on the global scope, because otherwise our code would
    // shadow the module-internal variables
    // @see https://github.com/jhnns/rewire-webpack/pull/6
    ignore.push("module", "exports", "require");
    for (key in global) {
        if (ignore.includes(key)) {
            continue;
        }
        // key may be an invalid variable name (e.g. 'a-b')
        try {
            eval("var " + key + ";");
            src += "var " + key + " = global." + key + "; ";
        }
        catch (e) { }
    }
    return src;
};
const moduleWrapper0 = module_1.default.wrapper[0];
const moduleWrapper1 = module_1.default.wrapper[1];
const loadModuleWithWrapper = (module, prefix, suffix) => {
    try {
        module_1.default.wrapper[0] = moduleWrapper0 + prefix;
        module_1.default.wrapper[1] = suffix + moduleWrapper1;
        module.load(module.id);
    }
    finally {
        module_1.default.wrapper[0] = moduleWrapper0;
        module_1.default.wrapper[1] = moduleWrapper1;
    }
};
/**
 * Produce a new requirefire instance.
 */
const createRequirefire = () => {
    const cache = {};
    function requireModule(targetPath, parentModule) {
        if (typeof targetPath !== "string") {
            throw new TypeError("Filename must be a string");
        }
        // Resolve full filename relative to the parent module
        targetPath = module_1.default._resolveFilename(targetPath, parentModule);
        if (cache[targetPath]) {
            const existingModule = cache[targetPath];
            return existingModule.exports;
        }
        // Create testModule as it would be created by require()
        const targetModule = new module_1.default(targetPath, parentModule);
        cache[targetPath] = targetModule;
        // We prepend a list of all globals declared with var so they can be overridden (without changing original globals)
        let prefix = getImportGlobalsSrc();
        // Intercept require calls when evaluating the rewired module to rewire those inner requires
        targetModule.__requirefire__ = requireModule;
        prefix += `
			  const __oldRequire = require;
			  require = function(path) {
			      if (module.__requirefire__ && path.startsWith('.')) {
              return module.__requirefire__(path, module);
			      } else {
              return __oldRequire(path);
			      }
			  };
			  require.extensions = __oldRequire.extensions;
			  require.resolve = __oldRequire.resolve;
    `;
        // Wrap module src inside IIFE so that function declarations do not clash with global variables
        // @see https://github.com/jhnns/rewire/issues/56
        prefix += `(function () {\n`;
        const suffix = `\n})();`;
        loadModuleWithWrapper(targetModule, prefix, suffix);
        return targetModule.exports;
    }
    function requirefire(path) {
        const requirier = module.parent ? module.parent : undefined;
        return requireModule(path, requirier);
    }
    requirefire.cache = cache;
    return requirefire;
};
exports.default = createRequirefire;
//# sourceMappingURL=index.js.map