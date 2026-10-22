import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_BUILD_IDENTIFIERS,
  MAX_IDENTIFIER_LENGTH,
  MAX_PRERELEASE_IDENTIFIERS,
  MAX_VERSION_LENGTH,
  formatVersion,
  parseVersion
} from "../src/index.js";
import { assertError } from "./helpers.js";

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

test("parseVersion splits core, prerelease, and build", () => {
  const parsed = parseVersion("1.2.3-alpha.1+001");
  assert.deepEqual(parsed, {
    major: 1,
    minor: 2,
    patch: 3,
    prerelease: ["alpha", 1],
    build: ["001"]
  });
  assert.deepEqual(Object.keys(parsed), ["major", "minor", "patch", "prerelease", "build"]);
  assert.equal(typeof parsed.prerelease[0], "string");
  assert.equal(typeof parsed.prerelease[1], "number");
  assert.equal(typeof parsed.build[0], "string");
  assert.equal(Object.is(parsed.major, 0), false);
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(Object.isFrozen(parsed.prerelease), true);
  assert.equal(Object.isFrozen(parsed.build), true);
  assert.throws(() => {
    parsed.major = 9;
  }, TypeError);
  assert.throws(() => {
    parsed.prerelease.push("nope");
  }, TypeError);
  assert.throws(() => {
    parsed.build.push("nope");
  }, TypeError);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), {
    major: 1,
    minor: 2,
    patch: 3,
    prerelease: ["alpha", 1],
    build: ["001"]
  });
});

test("a release version has empty prerelease and build lists", () => {
  const parsed = parseVersion("0.0.0");
  assert.deepEqual(parsed, {
    major: 0,
    minor: 0,
    patch: 0,
    prerelease: [],
    build: []
  });
  assert.equal(Object.is(parsed.major, 0), true);
  assert.equal(Object.is(parsed.minor, 0), true);
  assert.equal(Object.is(parsed.patch, 0), true);
  assert.equal(Object.isFrozen(parsed.prerelease), true);
  assert.equal(Object.isFrozen(parsed.build), true);
});

test("numeric prerelease stays numeric and build digits stay text", () => {
  assert.deepEqual(parseVersion("1.2.3-0").prerelease, [0]);
  assert.deepEqual(parseVersion("1.2.3-alpha-beta").prerelease, ["alpha-beta"]);
  assert.deepEqual(parseVersion("1.2.3-0a").prerelease, ["0a"]);
  assert.deepEqual(parseVersion("1.2.3+01").build, ["01"]);
  assert.deepEqual(parseVersion("1.2.3+0").build, ["0"]);
  assert.deepEqual(parseVersion("1.2.3+---").build, ["---"]);
  assert.deepEqual(parseVersion("1.2.3+build-1").build, ["build-1"]);
  assert.deepEqual(parseVersion("1.2.3+01.a-b").build, ["01", "a-b"]);
});

test("accepted version strings are already canonical", () => {
  const versions = [
    "0.0.0",
    "1.2.3",
    "1.2.3-alpha",
    "1.2.3-alpha.1",
    "1.2.3-0.3.7",
    "1.2.3-x.7.z.92",
    "1.2.3-alpha-beta",
    "1.2.3+20130313144700",
    "1.2.3+001",
    "1.2.3-beta+exp.sha.5114f85",
    "1.0.0-alpha",
    "1.0.0-alpha.1",
    "1.0.0-alpha.beta",
    "1.0.0-beta",
    "1.0.0-beta.2",
    "1.0.0-beta.11",
    "1.0.0-rc.1",
    `${MAX_SAFE}.0.0`,
    `0.${MAX_SAFE}.0`,
    `0.0.${MAX_SAFE}`,
    `1.2.3-${MAX_SAFE}`,
    `1.0.0-${"a".repeat(MAX_IDENTIFIER_LENGTH)}`,
    `1.0.0+${"0".repeat(MAX_IDENTIFIER_LENGTH)}`,
    prereleaseOfCount(MAX_PRERELEASE_IDENTIFIERS),
    buildOfCount(MAX_BUILD_IDENTIFIERS),
    sizedVersion(MAX_VERSION_LENGTH)
  ];
  for (const version of versions) {
    assert.equal(formatVersion(version), version, version);
    const parsed = parseVersion(version);
    assert.equal(formatVersion(version), version);
    assert.equal(parsed.major >= 0, true);
  }
});

test("core and prerelease numbers accept the largest safe integer and nothing past it", () => {
  assert.equal(parseVersion(`${MAX_SAFE}.0.0`).major, MAX_SAFE);
  assert.equal(parseVersion(`0.${MAX_SAFE}.0`).minor, MAX_SAFE);
  assert.equal(parseVersion(`0.0.${MAX_SAFE}`).patch, MAX_SAFE);
  assert.deepEqual(parseVersion(`1.2.3-${MAX_SAFE}`).prerelease, [MAX_SAFE]);
  assert.equal(parseVersion(`1.2.3-${"1".repeat(16)}`).prerelease[0], 1111111111111111);
  for (const version of [
    `${MAX_SAFE + 1}.0.0`,
    `0.${MAX_SAFE + 1}.0`,
    `0.0.${MAX_SAFE + 1}`,
    `1.2.3-${MAX_SAFE + 1}`,
    "1.2.3-9999999999999999",
    `1.2.3-${"9".repeat(16)}`,
    `1.2.3-${"9".repeat(17)}`
  ]) {
    assertError(
      () => parseVersion(version),
      "invalid_version",
      "version must be a semantic version"
    );
  }
});

test("identifier and version length boundaries", () => {
  assert.equal(
    formatVersion(`0.0.0-${"a".repeat(MAX_IDENTIFIER_LENGTH)}`),
    `0.0.0-${"a".repeat(MAX_IDENTIFIER_LENGTH)}`
  );
  assert.equal(
    formatVersion(`0.0.0+${"1".repeat(MAX_IDENTIFIER_LENGTH)}`),
    `0.0.0+${"1".repeat(MAX_IDENTIFIER_LENGTH)}`
  );
  assert.equal(formatVersion(sizedVersion(MAX_VERSION_LENGTH)), sizedVersion(MAX_VERSION_LENGTH));
  assert.equal(
    parseVersion(prereleaseOfCount(MAX_PRERELEASE_IDENTIFIERS)).prerelease.length,
    MAX_PRERELEASE_IDENTIFIERS
  );
  assert.equal(
    parseVersion(buildOfCount(MAX_BUILD_IDENTIFIERS)).build.length,
    MAX_BUILD_IDENTIFIERS
  );
  for (const version of [
    `0.0.0-${"a".repeat(MAX_IDENTIFIER_LENGTH + 1)}`,
    `0.0.0+${"1".repeat(MAX_IDENTIFIER_LENGTH + 1)}`,
    sizedVersion(MAX_VERSION_LENGTH + 1),
    prereleaseOfCount(MAX_PRERELEASE_IDENTIFIERS + 1),
    buildOfCount(MAX_BUILD_IDENTIFIERS + 1),
    `1.2.3-${"0".repeat(MAX_IDENTIFIER_LENGTH)}`
  ]) {
    assertError(
      () => parseVersion(version),
      "invalid_version",
      "version must be a semantic version"
    );
  }
});

test("invalid versions name the string and grammar failures apart", () => {
  for (const value of [
    undefined,
    null,
    1,
    1.2,
    true,
    false,
    1n,
    Symbol("1.2.3"),
    new String("1.2.3"),
    ["1.2.3"],
    { major: 1, minor: 2, patch: 3 },
    () => "1.2.3"
  ]) {
    assertError(() => parseVersion(value), "invalid_version", "version must be a string");
    assertError(() => formatVersion(value), "invalid_version", "version must be a string");
  }
  for (const version of [
    "",
    " ",
    "1",
    "1.2",
    "v1.2.3",
    "V1.2.3",
    "01.2.3",
    "1.02.3",
    "1.2.03",
    "00.0.0",
    "0.00.0",
    "0.0.00",
    "1.2.3-",
    "1.2.3+",
    "1.2.3-+build",
    "1.2.3-alpha.",
    "1.2.3-alpha..1",
    "1.2.3-.alpha",
    "1.2.3-01",
    "1.2.3-alpha.01",
    "1.2.3+ ",
    "1.2.3 ",
    " 1.2.3",
    "1.2.3\n",
    "1.2.3\t",
    "1.2.3-alpha+ ",
    "1.2.3-alpha+",
    "+1.2.3",
    ".1.2.3",
    "1.2.3.4.5",
    "1.2.3-alpha_beta",
    "1.2.3-α",
    "1.2.3+build+more",
    "1.2.3-alpha.+build",
    "1..2.3",
    "1.2..3",
    "-1.2.3",
    "1.2.3-.",
    "1.2.3+.",
    "1.2.3-alpha.1.",
    `1.2.3-${".".repeat(40)}`
  ]) {
    assertError(
      () => parseVersion(version),
      "invalid_version",
      "version must be a semantic version"
    );
  }
});

function prereleaseOfCount(count) {
  return `1.0.0-${Array.from({ length: count }, (_, index) => `a${index}`).join(".")}`;
}

function buildOfCount(count) {
  return `1.0.0+${Array.from({ length: count }, (_, index) => `b${index}`).join(".")}`;
}

function sizedVersion(length) {
  const build = [
    "b".repeat(MAX_IDENTIFIER_LENGTH),
    "c".repeat(MAX_IDENTIFIER_LENGTH),
    "d".repeat(MAX_IDENTIFIER_LENGTH)
  ].join(".");
  const prefix = "0.0.0-";
  const preLen = length - (prefix.length + 1 + build.length);
  return `${prefix}${"a".repeat(preLen)}+${build}`;
}
