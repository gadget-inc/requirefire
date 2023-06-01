/* eslint-disable lodash/import-scope */
/* eslint-disable @typescript-eslint/no-var-requires */
import path from "path";
import requirefire, { Requirefire } from "../src";

describe("requirefire", () => {
  let _require: Requirefire;
  beforeEach(() => {
    _require = requirefire();
  });

  it("should require modules", () => {
    const a = _require("./fixtures/mod_a");
    const b = _require("./fixtures/mod_b");
    expect(a.name).toEqual("a");
    expect(b.name).toEqual("b");
  });

  it("should not use node's built in require to require modules", () => {
    jest.isolateModules(() => {
      const fired = _require("./fixtures/mod_a");
      const normal = require("./fixtures/mod_a");
      expect(fired).not.toBe(normal);
    });
  });

  it("the same instance return cached versions of the same module when required twice", () => {
    const one = _require("./fixtures/mod_a");
    const two = _require("./fixtures/mod_a");
    expect(one).toBe(two);
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
      const requiredInner = require("./fixtures/inner_transitive");
      expect(outer.inner.now).not.toEqual(requiredInner.now);
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

  test("has a cache separate from require", () => {
    _require("./fixtures/outer_transitive");
    expect(_require.cache).toHaveProperty([path.resolve(__dirname, "./fixtures/outer_transitive.js")]);
    expect(_require.cache).toHaveProperty([path.resolve(__dirname, "./fixtures/inner_transitive.js")]);
    expect(require.cache).not.toHaveProperty([path.resolve(__dirname, "./fixtures/outer_transitive.js")]);
    expect(require.cache).not.toHaveProperty([path.resolve(__dirname, "./fixtures/inner_transitive.js")]);
  });

  test("mutual (circular) requires can be required", () => {
    const a = require("./fixtures/mutual_a");
    const b = require("./fixtures/mutual_b");
    expect(a.getB()).toBe(b);
    expect(b.getA()).toBe(a);
  });

  test("mutual (circular) requires can be requirefired", () => {
    const a = _require("./fixtures/mutual_a");
    const b = _require("./fixtures/mutual_b");
    expect(a.getB()).toBe(b);
    expect(b.getA()).toBe(a);
  });

  test("node modules required by requirefired modules are not themselves requirefired", () => {
    const a = _require("./fixtures/node_module_requirer_a");
    const b = _require("./fixtures/node_module_requirer_b");
    expect(a).not.toBe(b);
    expect(a.lodash).toBe(b.lodash);
    expect(a.lodash.omit).toBeTruthy();
  });

  test("modules without newlines at the end can be required", () => {
    const mod = _require("./fixtures/no-newline");
  });

  test("aliased modules that resolve to the same module should resolve to the same module if cached", () => {
    const linked = _require("./fixtures/linked_module");
    linked.foo = "not foo";
    const { linked: outerLinked } = _require("./fixtures/outer_linked_module");

    expect(linked).toBe(outerLinked);
  });
});
