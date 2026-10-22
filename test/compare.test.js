import assert from "node:assert/strict";
import test from "node:test";
import { compareVersions, parseVersion } from "../src/index.js";
import { assertError } from "./helpers.js";

const RELEASE_CHAIN = [
  "1.0.0-alpha",
  "1.0.0-alpha.1",
  "1.0.0-alpha.beta",
  "1.0.0-beta",
  "1.0.0-beta.2",
  "1.0.0-beta.11",
  "1.0.0-rc.1",
  "1.0.0"
];

const CORE_CHAIN = ["1.0.0", "2.0.0", "2.1.0", "2.1.1"];

test("precedence follows core, then prerelease, and ignores build", () => {
  assertIncreasing(RELEASE_CHAIN);
  assertIncreasing(CORE_CHAIN);
  assertSamePrecedence(["1.0.0-alpha+001", "1.0.0-alpha+20130313144700", "1.0.0-alpha"]);
  assertSamePrecedence(["1.0.0+20130313144700", "1.0.0", "1.0.0+001"]);
  assert.equal(compareVersions("1.0.0-beta.2", "1.0.0-beta.11"), -1);
  assert.equal(compareVersions("1.0.0-beta.11", "1.0.0-beta.2"), 1);
  assert.equal(compareVersions("1.0.0-1", "1.0.0-alpha"), -1);
  assert.equal(compareVersions("1.0.0-1", "1.0.0-0a"), -1);
  assert.equal(compareVersions("1.0.0-1", "1.0.0--"), -1);
  assert.equal(compareVersions("1.0.0-ALPHA", "1.0.0-alpha"), -1);
  assert.equal(compareVersions("1.0.0-alpha", "1.0.0-beta"), -1);
  assert.equal(compareVersions("1.0.0-rc", "1.0.0-rc1"), -1);
  assert.equal(compareVersions("1.0.0-alpha", "1.0.0-alpha0"), -1);
  assert.equal(compareVersions("1.0.0-alpha.0", "1.0.0-alpha0"), -1);
  assert.equal(compareVersions("1.0.0-alpha", "1.0.0-alpha.0"), -1);
  assert.equal(compareVersions("1.0.0-1", "1.0.0-1.0"), -1);
  assert.equal(compareVersions("2.0.0-alpha", "1.9.9"), 1);
  assert.equal(compareVersions("1.0.0", "1.0.1-alpha"), -1);
  assert.equal(compareVersions("1.0.0-zzz", "1.0.1-aaa"), -1);
  assert.equal(compareVersions("1.0.0-alpha", "1.0.0-alpha"), 0);
  assert.equal(Object.is(compareVersions("1.0.0", "1.0.0"), 0), true);
});

test("comparison is symmetric on a mixed set", () => {
  const versions = [
    "0.0.0",
    "0.0.1",
    "0.1.0",
    "1.0.0-1",
    "1.0.0-alpha",
    "1.0.0-alpha.1",
    "1.0.0-alpha.beta",
    "1.0.0-beta.2",
    "1.0.0-beta.11",
    "1.0.0-rc.1",
    "1.0.0",
    "1.0.0+build",
    "1.0.1-aaa",
    "1.9.9",
    "2.0.0-alpha",
    "2.0.0"
  ];
  for (const left of versions) {
    for (const right of versions) {
      const forward = compareVersions(left, right);
      const backward = compareVersions(right, left);
      assert.equal(forward + backward, 0, `${left} vs ${right}`);
      assert.equal(Object.is(forward, -0), false);
      assert.equal(Object.is(backward, -0), false);
      assert.equal([-1, 0, 1].includes(forward), true);
    }
  }
});

test("compareVersions checks the left string before the right string", () => {
  assertError(() => compareVersions(1, "also-bad"), "invalid_version", "left must be a string");
  assertError(
    () => compareVersions("nope", "1.0.0"),
    "invalid_version",
    "left must be a semantic version"
  );
  assertError(() => compareVersions("1.0.0", null), "invalid_version", "right must be a string");
  assertError(
    () => compareVersions("1.0.0", "1.2"),
    "invalid_version",
    "right must be a semantic version"
  );
  assertError(
    () => compareVersions(parseVersion("1.0.0"), parseVersion("1.0.0")),
    "invalid_version",
    "left must be a string"
  );
});

function assertIncreasing(versions) {
  for (let left = 0; left < versions.length; left += 1) {
    for (let right = left + 1; right < versions.length; right += 1) {
      assert.equal(compareVersions(versions[left], versions[right]), -1);
      assert.equal(compareVersions(versions[right], versions[left]), 1);
    }
    assert.equal(compareVersions(versions[left], versions[left]), 0);
  }
}

function assertSamePrecedence(versions) {
  for (const left of versions) {
    for (const right of versions) {
      assert.equal(compareVersions(left, right), 0, `${left} vs ${right}`);
    }
  }
}
