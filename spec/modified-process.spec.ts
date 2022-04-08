/* eslint-disable @typescript-eslint/no-var-requires */
import requirefire from "../src";

describe("requirefire with a modified process env", () => {

  test("the  process global is the same inside a required module and outside", () => {
    const innerProcess = require("./fixtures/export_process");
    expect(process).toBe(innerProcess)
    expect(global.process).toBe(innerProcess)
  });

  test("raw node require inheirts the modified process from the environment", () => {
    process.env.TEST_VAR_NODE = "foo";
    const mod = require("./fixtures/export_env");
    expect(mod.TEST_VAR_NODE).toBe("foo")
  });

  test("outer requirefired modules have the same process as inner requirefired modules", () => {
    const _require = requirefire()
    _require("./fixtures/compare_process");
  });

  test("the process global is the same inside a requirefire'd module and outside", () => {
    const _require = requirefire()
    const innerProcess = _require("./fixtures/export_process");
    expect(process).toBe(innerProcess)
    expect(global.process).toBe(innerProcess)
  });

  test("requirefired modules inherit the modified process from the environment when the requirefire is created before the process modification", () => {
    const _require = requirefire()
    process.env.TEST_VAR_A = "foo";
    const mod = _require("./fixtures/export_env");
    expect(mod.TEST_VAR_A).toBe("foo")
  });

  test("requirefired modules inherit the modified process from the environment when the requirefire is created after the process modification", () => {
    process.env.TEST_VAR_B = "bar";
    const _require = requirefire()
    const mod = _require("./fixtures/export_env");
    expect(mod.TEST_VAR_B).toBe("bar")
  });
});
