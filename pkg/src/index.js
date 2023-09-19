"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const enhanced_resolve_1 = require("enhanced-resolve");
const fs_1 = __importDefault(require("fs"));
const is_builtin_module_1 = __importDefault(require("is-builtin-module"));
const module_1 = __importDefault(require("module"));
const path_1 = __importDefault(require("path"));
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
    // ignore the 'process' object, we give it special treatment
    ignore.push("process");
    for (key in globalThis) {
        if (ignore.includes(key)) {
            continue;
        }
        // key may be an invalid variable name (e.g. 'a-b')
        try {
            eval("var " + key + ";");
            src += "var " + key + " = global." + key + ";\n";
        }
        catch (e) {
            // suppress invalid variable names
        }
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
    const resolver = enhanced_resolve_1.ResolverFactory.createResolver({
        useSyncFileSystemCalls: true,
        fileSystem: new enhanced_resolve_1.CachedInputFileSystem(fs_1.default, 4000),
        extensions: [".js", ".json", ".node", ...Object.keys(require.extensions)]
    });
    function requireModule(request, parentModule) {
        if (typeof request !== "string") {
            throw new TypeError("Filename must be a string");
        }
        if ((0, is_builtin_module_1.default)(request)) {
            return require(request);
        }
        // Resolve full filename relative to the parent module
        const actualPath = resolver.resolveSync({}, parentModule ? path_1.default.dirname(parentModule.filename) : '.', request);
        if (!actualPath)
            throw new Error(`requirefire module not found: ${request}`);
        if (cache[actualPath]) {
            const existingModule = cache[actualPath];
            return existingModule.exports;
        }
        // Create testModule as it would be created by require()
        const targetModule = new module_1.default(actualPath, parentModule);
        cache[actualPath] = targetModule;
        // Intercept require calls when evaluating the inner module to use requirefire
        targetModule.__requirefire__ = requireModule;
        targetModule.__requirefire_process = process;
        // We prepend a list of all globals declared with var so they can be overridden (without changing original globals)
        let prefix = getImportGlobalsSrc();
        prefix += `
      const __oldRequire = require;

      require = function(path) {
        if (module.__requirefire__) {
          return module.__requirefire__(path, module);
        }

        return __oldRequire(path);
      };

      require.extensions = __oldRequire.extensions;
      require.resolve = __oldRequire.resolve;
      require.cache = module.__requirefire__ ? module.__requirefire__.cache : __oldRequire.cache;
      var process = module.__requirefire_process ? module.__requirefire_process : global.process;
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
    requireModule.cache = cache;
    requirefire.cache = cache;
    return requirefire;
};
exports.default = createRequirefire;
//# sourceMappingURL=index.js.map