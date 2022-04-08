import Module from "module";

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

  for (key in global) {
    if (ignore.includes(key)) {
      continue;
    }

    // key may be an invalid variable name (e.g. 'a-b')
    try {
      eval("var " + key + ";");
      src += "var " + key + " = global." + key + ";\n";
    } catch (e) { }
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
 */
const createRequirefire = () => {
  const cache: Record<string, Module> = {};

  function requireModule(targetPath: string, parentModule?: Module) {
    if (typeof targetPath !== "string") {
      throw new TypeError("Filename must be a string");
    }

    // Resolve full filename relative to the parent module
    targetPath = (Module as any)._resolveFilename(targetPath, parentModule);
    if (cache[targetPath]) {
      const existingModule = cache[targetPath];
      return existingModule.exports;
    }

    // Create testModule as it would be created by require()
    const targetModule = new Module(targetPath, parentModule);
    cache[targetPath] = targetModule;

    // We prepend a list of all globals declared with var so they can be overridden (without changing original globals)
    let prefix = getImportGlobalsSrc();

    // Intercept require calls when evaluating the inner module to use requirefire
    (targetModule as any).__requirefire__ = requireModule;
    (targetModule as any).__requirefire_process = process;

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
    const requirier = module.parent ? module.parent : undefined;
    return requireModule(path, requirier);
  }

  requireModule.cache = cache;
  requirefire.cache = cache;
  return requirefire;
};

export type Requirefire = ReturnType<typeof createRequirefire>;
export default createRequirefire;
