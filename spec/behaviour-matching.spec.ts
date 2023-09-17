import execa from "execa";
import fs from "fs-extra";
import os from "os";
import path from "path";
import requirefire from "../src";

describe("requirefire vs require behaviour matching", () => {
  describe.each([
    ["require", require],
    ["requirefire", requirefire()],
  ])("%s", (name, _require) => {
    test("should require modules", () => {
      const a = _require("./fixtures/mod_a");
      const b = _require("./fixtures/mod_b");
      expect(a.name).toEqual("a");
      expect(b.name).toEqual("b");
    });

    test("the same instance return cached versions of the same module when required twice", () => {
      const one = _require("./fixtures/mod_a");
      const two = _require("./fixtures/mod_a");
      expect(one).toBe(two);
    });

    test("transitive requires are required through requirefire", () => {
      jest.isolateModules(() => {
        const outer = _require("./fixtures/outer_transitive");
        const inner = _require("./fixtures/inner_transitive");
        expect(outer.inner.random).toEqual(inner.random);
      });
    });

    test("transitive requires have require extensions and resolve", () => {
      const outer = _require("./fixtures/outer_transitive");
      expect(outer.inner.requireKeys).toContain("cache");
      expect(outer.inner.requireKeys).toContain("extensions");
      expect(outer.inner.requireKeys).toContain("resolve");
    });

    test("transitive requires can resolve correctly", () => {
      const outer = _require("./fixtures/outer_transitive");
      expect(outer.inner.outerTransitiveResolve).toEqual(path.resolve(__dirname, "fixtures/outer_transitive.js"));
    });

    test("non-existent filepath modules throw a module not found error", () => {
      try {
        _require("/tmp/does-not-exist-requirefire-test.js");
      } catch (error: any) {
        expect(error).toBeTruthy();
        expect(error.code).toEqual("MODULE_NOT_FOUND");
        expect(error.message).toContain("Cannot find module '/tmp/does-not-exist-requirefire-test.js'");
        return;
      }
      // unreachable
      expect(false).toBe(true);
    });

    test("non-existent node_modules modules throw a module not found error", () => {
      try {
        _require("a-magical-package-that-does-everything");
      } catch (error: any) {
        expect(error).toBeTruthy();
        expect(error.code).toEqual("MODULE_NOT_FOUND");
        expect(error.message).toContain("Cannot find module 'a-magical-package-that-does-everything'");
        return;
      }
      // unreachable
      expect(false).toBe(true);
    });

    test("mutual (circular) requires can be required", () => {
      const a = _require("./fixtures/mutual_a");
      const b = _require("./fixtures/mutual_b");
      expect(a.getB()).toBe(b);
      expect(b.getA()).toBe(a);
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

    test("packages with combo esm/cjs exports configured can be requirefired", async () => {
      const modDir = fs.mkdtempSync(path.join(os.tmpdir(), "requirefire-"));
      await fs.rm(modDir, { recursive: true, force: true });
      await fs.mkdir(modDir);

      await fs.writeFile(path.join(modDir, "index.js"), `module.exports = require('dualexports')`);
      await fs.writeFile(
        path.join(modDir, "package.json"),
        JSON.stringify({
          name: "parent",
          version: "0.1.0",
          dependencies: {
            dualexports: `file:${path.resolve(path.join(__dirname, "fixtures", "dualexports"))}`,
          },
        })
      );

      await execa("npm", ["install"], { cwd: modDir });

      jest.isolateModules(() => {
        const mod = _require(modDir);
        expect(mod.foo).toEqual("bar");
      });
    });
  });
});
