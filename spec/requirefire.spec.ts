/* eslint-disable lodash/import-scope */
/* eslint-disable @typescript-eslint/no-var-requires */
import execa from "execa";
import fs from "fs-extra";
import os from "os";
import path from "path";
import type { Requirefire } from "../src";
import requirefire from "../src";

describe("requirefire", () => {
  let _require: Requirefire;
  beforeEach(() => {
    _require = requirefire();
  });

  it("should not use node's built in require to require modules", () => {
    jest.isolateModules(() => {
      const fired = _require("./fixtures/mod_a");
      const normal = require("./fixtures/mod_a");
      expect(fired).not.toBe(normal);
    });
  });

  it("the requirefire cache should be clearable", () => {
    const one = _require("./fixtures/mod_a");
    for (const key of Object.keys(_require.cache)) {
      delete _require.cache[key];
    }
    const two = _require("./fixtures/mod_a");
    expect(one).not.toBe(two);
    expect(one.name).toEqual(two.name);
  });

  test("different instances should return different versions of the same module when required twice", () => {
    const one = _require("./fixtures/mod_a");
    const two = requirefire()("./fixtures/mod_a");
    expect(one).not.toBe(two);
  });

  test("transitive requires are required through requirefire", () => {
    jest.isolateModules(() => {
      const outer = _require("./fixtures/outer_transitive");
      const inner = _require("./fixtures/inner_transitive");
      expect(outer.inner.random).toEqual(inner.random);
    });
  });

  test("transitive requires are can still be required through normal require", () => {
    jest.isolateModules(() => {
      const outer = _require("./fixtures/outer_transitive");
      const requiredInner = require("./fixtures/inner_transitive");
      expect(outer.inner.random).not.toEqual(requiredInner.random);
    });
  });

  test("has a cache separate from require", () => {
    _require("./fixtures/outer_transitive");
    expect(_require.cache).toHaveProperty([path.resolve(__dirname, "./fixtures/outer_transitive.js")]);
    expect(_require.cache).toHaveProperty([path.resolve(__dirname, "./fixtures/inner_transitive.js")]);
    expect(require.cache).not.toHaveProperty([path.resolve(__dirname, "./fixtures/outer_transitive.js")]);
    expect(require.cache).not.toHaveProperty([path.resolve(__dirname, "./fixtures/inner_transitive.js")]);
  });

  test("node modules required by requirefired modules are not themselves requirefired", () => {
    const a = _require("./fixtures/node_module_requirer_a");
    const b = _require("./fixtures/node_module_requirer_b");
    expect(a).not.toBe(b);
    expect(a.lodash).toBe(b.lodash);
    expect(a.lodash.omit).toBeTruthy();
  });

  test("modules without newlines at the end can be required", () => {
    _require("./fixtures/no-newline");
  });

  test("aliased modules that resolve to the same module should resolve to the same module if cached", () => {
    const linked = _require("./fixtures/linked_module");
    linked.foo = "not foo";
    const { linked: outerLinked } = _require("./fixtures/outer_linked_module");

    expect(linked).toBe(outerLinked);
  });

  test("packages with exports configured can be requirefired", async () => {
    const modDir = fs.mkdtempSync(path.join(os.tmpdir(), "requirefire-"));
    await fs.rm(modDir, { recursive: true, force: true });
    await fs.mkdir(modDir);

    await fs.writeFile(
      path.join(modDir, "index.js"),
      `module.exports = {
      main: require('subexports'),
      sub: require('subexports/sub'),
    }`
    );
    await fs.writeFile(
      path.join(modDir, "package.json"),
      JSON.stringify({
        name: "parent",
        version: "0.1.0",
        dependencies: {
          subexports: `file:${path.resolve(path.join(__dirname, "fixtures", "subexports"))}`,
        },
      })
    );

    await execa("npm", ["install"], { cwd: modDir });

    const mod = _require(modDir);
    expect(mod.main.key).toEqual("main");
    expect(mod.sub.key).toEqual("sub");
  });
});
