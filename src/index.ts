import { ResolverFactory } from "enhanced-resolve";
import fs from "fs";
import isBuiltinModule from "is-builtin-module";
import Module from "module";
import path from "path";

/**
 * Declares all globals with a var and assigns the global object. Thus you're able to
 * override globals without changing the global object itself.
 *
 * Returns something like
 * "var console = global.console; var process = global.process; ..."
 */
const getImportGlobalsSrc = (ignore: string[] = []) => {
  let key,
    src = "";

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
    } catch (e) {
      // suppress invalid variable names
    }
  }

  return src;
};

const moduleWrapper0 = (Module as any).wrapper[0];
const moduleWrapper1 = (Module as any).wrapper[1];

const loadModuleWithWrapper = (module: Module, prefix: string, suffix: string) => {
  try {
    (Module as any).wrapper[0] = moduleWrapper0 + prefix;
    (Module as any).wrapper[1] = suffix + moduleWrapper1;
    (module as any).load(module.id);
  } finally {
    (Module as any).wrapper[0] = moduleWrapper0;
    (Module as any).wrapper[1] = moduleWrapper1;
  }
};

/**
 * Produce a new requirefire instance.
 * 
 * @param contextModule The module that will be used as the parent module for the requirefire instance. Relative paths will be resolved relative to this module.
 */
const createRequirefire = (contextModule?: Module) => {
  if (!contextModule && module.parent) {
    contextModule = module.parent;
  }

  const cache: Record<string, Module> = {};
  const resolver = ResolverFactory.createResolver({
    useSyncFileSystemCalls: true,
    fileSystem: fs as any,
    conditionNames: ["require", "node"],
    extensions: [".js", ".json", ".node", ...Object.keys(require.extensions)],
  });

  function requireModule(request: string, parentModule?: Module) {
    if (typeof request !== "string") {
      throw new TypeError("Filename must be a string");
    }

    if (isBuiltinModule(request)) {
      return require(request);
    }

    // Resolve full filename relative to the parent module
    let actualPath: string;
    try {
      actualPath = resolver.resolveSync({}, parentModule ? path.dirname(parentModule.filename) : ".", request) as string;
    } catch (error: any) {
      const err = new Error(`Cannot find module '${request}'. Note: Using requirefire. Resolution error: ${error.message}`) as any;
      err.code = "MODULE_NOT_FOUND";
      throw err;
    }

    if (cache[actualPath]) {
      const existingModule = cache[actualPath];
      return existingModule.exports;
    }

    // Create testModule as it would be created by require()
    const targetModule = new Module(actualPath, parentModule);
    cache[actualPath] = targetModule;

    // Intercept require calls when evaluating the inner module to use requirefire
    (targetModule as any).__requirefire__ = requireModule;
    (targetModule as any).__requirefire_process = process;

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

  function requirefire(path: string) {
    return requireModule(path, contextModule);
  }

  requireModule.cache = cache;
  requirefire.cache = cache;
  return requirefire;
};

export type Requirefire = ReturnType<typeof createRequirefire>;
export default createRequirefire;
