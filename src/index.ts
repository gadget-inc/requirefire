import fs from "fs";
import isBuiltinModule from "is-builtin-module";
import Module from "module";
import path from "path";

const isWindows = process.platform === "win32";

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

const stat = (Module as any)._stat;

function trySelfParentPath(parent?: Module) {
  if (!parent) return false;

  if (parent.filename) {
    return parent.filename;
  } else if (parent.id === "<repl>" || parent.id === "internal/preload") {
    try {
      return process.cwd() + path.sep;
    } catch {
      return false;
    }
  }
}

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

const CHAR_DOT = 46; /* . */
const CHAR_FORWARD_SLASH = 47; /* / */
const CHAR_BACKWARD_SLASH = 92; /* \ */

// Check if the file exists and is not a directory
// if using --preserve-symlinks and isMain is false,
// keep symlinks intact, otherwise resolve to the
// absolute realpath.
function tryFile(requestPath: string, _isMain?: boolean) {
  const rc = stat(requestPath);
  if (rc !== 0) return;
  return fs.realpathSync(requestPath);
}

// Given a path, check if the file exists with any of the set extensions
function tryExtensions(p: string, exts: string[], isMain?: boolean) {
  for (let i = 0; i < exts.length; i++) {
    const filename = tryFile(p + exts[i], isMain);

    if (filename) {
      return filename;
    }
  }
  return false;
}

/**
 * Produce a new requirefire instance.
 */
const createRequirefire = () => {
  const cache: Record<string, Module> = {};
  const pathCache: Record<string, string | boolean> = {};
  const packageJsonCache = new Map();
  const fallbackResolveFilename = (Module as any)._resolveFilename;
  const moduleParentCache = new WeakMap();

  function readPackage(requestPath: string) {
    const jsonPath = path.resolve(requestPath, "package.json");

    const existing = packageJsonCache.get(jsonPath);
    if (existing !== undefined) return existing;

    let json;
    try {
      json = fs.readFileSync(jsonPath, "utf-8");
    } catch (error) {
      packageJsonCache.set(jsonPath, false);
      return false;
    }

    try {
      const filtered = JSON.parse(json);
      packageJsonCache.set(jsonPath, filtered);
      return filtered;
    } catch (e: any) {
      e.path = jsonPath;
      e.message = "Error parsing " + jsonPath + ": " + e.message;
      throw e;
    }
  }

  function readPackageScope(checkPath: string) {
    const rootSeparatorIndex = checkPath.indexOf(path.sep);
    let separatorIndex;
    do {
      separatorIndex = checkPath.lastIndexOf(path.sep);
      checkPath = checkPath.slice(0, separatorIndex);
      if (checkPath.endsWith(path.sep + "node_modules")) return false;
      const pjson = readPackage(checkPath + path.sep);
      if (pjson)
        return {
          data: pjson,
          path: checkPath,
        };
    } while (separatorIndex > rootSeparatorIndex);
    return false;
  }

  function trySelf(parentPath: string | boolean | undefined, request: string) {
    if (!parentPath) return false;

    const { data: pkg } = readPackageScope(parentPath as string) || {};
    if (!pkg || pkg.exports === undefined) return false;
    if (typeof pkg.name !== "string") return false;

    if (request === pkg.name || request.startsWith(`${pkg.name}/`)) {
      return true;
    } else {
      return false;
    }
  }

  function tryPackage(requestPath: string, exts: string[], isMain?: boolean, originalPath?: string) {
    const pkg = readPackage(requestPath)?.main;

    if (!pkg) {
      return tryExtensions(path.resolve(requestPath, "index"), exts, isMain);
    }

    const filename = path.resolve(requestPath, pkg);
    let actual =
      tryFile(filename, isMain) || tryExtensions(filename, exts, isMain) || tryExtensions(path.resolve(filename, "index"), exts, isMain);
    if (actual === false) {
      actual = tryExtensions(path.resolve(requestPath, "index"), exts, isMain);
      if (!actual) {
        // eslint-disable-next-line no-restricted-syntax
        const err = new Error(`Cannot find module '${filename}'. ` + 'Please verify that the package.json has a valid "main" entry') as any;
        err.code = "MODULE_NOT_FOUND";
        err.path = path.resolve(requestPath, "package.json");
        err.requestPath = originalPath;
        // TODO(BridgeAR): Add the requireStack as well.
        throw err;
      } else {
        const jsonPath = path.resolve(requestPath, "package.json");
        process.emitWarning(
          `Invalid 'main' field in '${jsonPath}' of '${pkg}'. ` + "Please either fix that or report it to the module author",
          "DeprecationWarning",
          "DEP0128"
        );
      }
    }
    return actual;
  }

  /**
   * @param {string} request a relative or absolute file path
   * @param {Array<string>} paths file system directories to search as file paths
   * @param {boolean} isMain if the request is the main app entry point
   * @returns {string | false}
   */
  const findPath = function (request: string, paths: string[], isMain?: boolean) {
    const absoluteRequest = path.isAbsolute(request);
    if (absoluteRequest) {
      paths = [""];
    } else if (!paths || paths.length === 0) {
      return false;
    }

    const cacheKey = request + "\x00" + paths.join("\x00");
    const entry = pathCache[cacheKey];
    if (entry) return entry;

    let exts;
    const trailingSlash =
      request.length > 0 &&
      (request.charCodeAt(request.length - 1) === CHAR_FORWARD_SLASH ||
        (request.charCodeAt(request.length - 1) === CHAR_DOT &&
          (request.length === 1 ||
            request.charCodeAt(request.length - 2) === CHAR_FORWARD_SLASH ||
            (request.charCodeAt(request.length - 2) === CHAR_DOT &&
              (request.length === 2 || request.charCodeAt(request.length - 3) === CHAR_FORWARD_SLASH)))));

    const isRelative =
      request.charCodeAt(0) === CHAR_DOT &&
      (request.length === 1 ||
        request.charCodeAt(1) === CHAR_FORWARD_SLASH ||
        (isWindows && request.charCodeAt(1) === CHAR_BACKWARD_SLASH) ||
        (request.charCodeAt(1) === CHAR_DOT &&
          (request.length === 2 ||
            request.charCodeAt(2) === CHAR_FORWARD_SLASH ||
            (isWindows && request.charCodeAt(2) === CHAR_BACKWARD_SLASH))));
    let insidePath = true;
    if (isRelative) {
      const normalizedRequest = path.normalize(request);
      if (normalizedRequest.startsWith("..")) {
        insidePath = false;
      }
    }

    // For each path
    for (let i = 0; i < paths.length; i++) {
      // Don't search further if path doesn't exist and request is inside the path
      const curPath = paths[i];
      if (insidePath && curPath && stat(curPath) < 1) continue;

      const basePath = path.resolve(curPath, request);
      let filename;

      const rc = stat(basePath);
      if (!trailingSlash) {
        if (rc === 0) {
          // File.
          filename = fs.realpathSync(basePath);
        }

        if (!filename) {
          // Try it with each of the extensions
          if (exts === undefined) exts = Object.keys((Module as any)._extensions);
          filename = tryExtensions(basePath, exts, isMain);
        }
      }

      if (!filename && rc === 1) {
        // Directory.
        // try it with each of the extensions at "index"
        if (exts === undefined) exts = Object.keys((Module as any)._extensions);
        filename = tryPackage(basePath, exts, isMain, request);
      }

      if (filename) {
        pathCache[cacheKey] = filename;
        return filename;
      }

      const extensions = [""];
      if (exts !== undefined) {
        extensions.push(...exts);
      }
    }

    return false;
  };

  /** userland version of Module._resolveFilename that respects our own name => path cache */
  const resolveFilename = (request: string, parent?: Module, isMain?: boolean, options?: any) => {
    if (isBuiltinModule(request)) {
      return request;
    }

    if (options) {
      return fallbackResolveFilename(request, parent, isMain, options);
    }
    const paths = (Module as any)._resolveLookupPaths(request, parent);

    if (request[0] === "#" && (parent?.filename || parent?.id === "<repl>")) {
      const parentPath = parent?.filename ?? process.cwd() + path.sep;
      const pkg = readPackageScope(parentPath) || ({} as any);
      if (pkg.data?.imports != null) {
        return fallbackResolveFilename(request, parent, isMain, options);
      }
    }

    const parentPath = trySelfParentPath(parent);
    if (trySelf(parentPath, request)) {
      return fallbackResolveFilename(request, parent, isMain, options);
    }

    // Look up the filename first, since that's the cache key.
    const filename = findPath(request, paths, isMain);
    if (filename) return filename;
    const requireStack = [];
    for (let cursor = parent; cursor; cursor = moduleParentCache.get(cursor)) {
      requireStack.push(cursor.filename || cursor.id);
    }
    let message = `Cannot find module '${request}'`;
    if (requireStack.length > 0) {
      message = message + "\nRequire stack:\n- " + requireStack.join("\n- ");
    }
    // eslint-disable-next-line no-restricted-syntax
    const err = new Error(message) as any;
    err.code = "MODULE_NOT_FOUND";
    err.requireStack = requireStack;
    throw err;
  };

  function requireModule(targetPath: string, parentModule?: Module) {
    if (typeof targetPath !== "string") {
      throw new TypeError("Filename must be a string");
    }

    if (isBuiltinModule(targetPath)) {
      return require(targetPath);
    }

    // Resolve full filename relative to the parent module
    const actualPath = resolveFilename(targetPath, parentModule);
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
    const requirier = module.parent ? module.parent : undefined;
    return requireModule(path, requirier);
  }

  requireModule.cache = cache;
  requirefire.cache = cache;
  return requirefire;
};

export type Requirefire = ReturnType<typeof createRequirefire>;
export default createRequirefire;
