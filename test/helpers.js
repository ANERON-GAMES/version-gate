import assert from "node:assert/strict";
import { VersionGateError } from "../src/index.js";

export function assertError(fn, code, message) {
  assert.throws(fn, (error) => {
    assert.equal(error instanceof VersionGateError, true);
    assert.equal(error instanceof Error, true);
    assert.equal(error.name, "VersionGateError");
    assert.equal(error.code, code);
    assert.equal(error.message, message);
    assert.equal(typeof error.stack, "string");
    assert.match(error.stack, /VersionGateError/);
    return true;
  });
}
