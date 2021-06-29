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
    const fired = _require("./fixtures/mod_a");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const normal = require("./fixtures/mod_a");
    expect(fired).not.toBe(normal);
  });

  it("the same instance return cached versions of the same module when required twice", () => {
    const one = _require("./fixtures/mod_a");
    const two = _require("./fixtures/mod_a");
    expect(one).toBe(two);
  });

  test("different instances should return different versions of the same module when required twice", () => {
    const one = _require("./fixtures/mod_a");
    const two = requirefire()("./fixtures/mod_a");
    expect(one).not.toBe(two);
  });

  test("transitive requires are required through requirefire", () => {
    const outer = _require("./fixtures/outer_transitive");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requiredInner = require("./fixtures/inner_transitive");
    expect(outer.inner.now).not.toEqual(requiredInner.now);
  });

  test("mutual (circular) requires can be required", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const a = require("./fixtures/mutual_a");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
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
});
