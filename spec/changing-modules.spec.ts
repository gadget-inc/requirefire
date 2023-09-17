import execa from "execa";
import fs from "fs-extra";
import Module from "module";
import os from "os";
import path from "path";
import requirefire from "../src";

describe("modules that change in the same process lifetime", () => {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "requirefire-"));
  let _require: (mod: string) => any;
  beforeEach(() => {
    _require = requirefire();
  });

  describe.each(["foo", "bar", "baz"])("case %s", (name) => {
    test("a file with different contents can be returned in a test", async () => {
      await fs.writeFile(path.join(tmpdir, "index.js"), `module.exports = "${name}";`);
      const result = _require(path.join(tmpdir, "index.js"));
      expect(result).toBe(name);
    });
  });

  test("a module that changes its main path between versions can be required with each version", async () => {
    // setup a parent module with a require of our test module
    const modDir = path.join(os.tmpdir(), "requirefire-test");
    await fs.rm(modDir, { recursive: true, force: true });
    await fs.mkdir(modDir);
    console.log(`running test in ${modDir}`)

    await fs.writeFile(path.join(modDir, "index.js"), `module.exports = require('test-mod');`);
    await fs.writeFile(path.join(modDir, "package.json"), JSON.stringify({
      name: "parent",
      version: "0.1.0",
      dependencies: {
        "test-mod": `file:${path.resolve(path.join(__dirname, "fixtures", "mod-v1"))}`
      }
    }));

    await execa("npm", ["install"], { cwd: modDir });

    // require the parent module, assert it returns the stuff from mod-v1
    const parent = _require(modDir);
    expect(parent.version).toEqual(1)

    // update the parent module to require mod-v2
    await fs.writeFile(path.join(modDir, "package.json"), JSON.stringify({
      name: "parent",
      version: "0.1.0",
      dependencies: {
        "test-mod": `file:${path.resolve(path.join(__dirname, "fixtures", "mod-v2"))}`
      }
    }));

    await execa("npm", ["install"], { cwd: modDir });

    (Module as any)._pathCache = Object.create(null)

    // create a new require function with a different cache
    _require = requirefire();
    // require the parent module, assert it returns the stuff from mod-v1
    debugger
    const newParent = _require(modDir);
    expect(newParent.version).toEqual(2);
  });
});
