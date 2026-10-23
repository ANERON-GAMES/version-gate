import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as api from "../src/index.js";
import { VersionGateError } from "../src/index.js";

test("public exports", () => {
  assert.deepEqual(Object.keys(api).sort(), [
    "DECISION_ALLOW",
    "DECISION_REFUSE",
    "DECISION_WARN",
    "MAX_BLOCKED_VERSIONS",
    "MAX_BUILD_IDENTIFIERS",
    "MAX_IDENTIFIER_LENGTH",
    "MAX_PRERELEASE_IDENTIFIERS",
    "MAX_VERSION_LENGTH",
    "REASON_BELOW_MINIMUM",
    "REASON_BELOW_PREFERRED",
    "REASON_BLOCKED",
    "VersionGateError",
    "compareVersions",
    "decideVersion",
    "formatVersion",
    "parseVersion"
  ]);
  assert.equal(api.DECISION_ALLOW, "allow");
  assert.equal(api.DECISION_WARN, "warn");
  assert.equal(api.DECISION_REFUSE, "refuse");
  assert.equal(api.REASON_BELOW_MINIMUM, "below_minimum");
  assert.equal(api.REASON_BLOCKED, "blocked");
  assert.equal(api.REASON_BELOW_PREFERRED, "below_preferred");
  assert.equal(api.MAX_VERSION_LENGTH, 256);
  assert.equal(api.MAX_IDENTIFIER_LENGTH, 64);
  assert.equal(api.MAX_PRERELEASE_IDENTIFIERS, 16);
  assert.equal(api.MAX_BUILD_IDENTIFIERS, 16);
  assert.equal(api.MAX_BLOCKED_VERSIONS, 128);
});

test("VersionGateError exposes code, name, and stack", () => {
  const error = new VersionGateError("invalid_client", "client must be a string");
  assert.equal(error instanceof Error, true);
  assert.equal(error instanceof VersionGateError, true);
  assert.equal(error.name, "VersionGateError");
  assert.equal(error.code, "invalid_client");
  assert.equal(error.message, "client must be a string");
  assert.equal(typeof error.stack, "string");
  assert.match(error.stack, /VersionGateError/);
});

test("package metadata names a public module", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.name, "@aneron/version-gate");
  assert.equal(pkg.private, undefined);
  assert.equal(pkg.author, "Vadim Gubin");
  assert.equal(pkg.type, "module");
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.sideEffects, false);
  assert.deepEqual(pkg.engines, { node: ">=20" });
  assert.equal(pkg.main, "./src/index.js");
  assert.equal(pkg.exports["."], "./src/index.js");
  assert.equal(pkg.dependencies, undefined);
  assert.deepEqual(pkg.files, ["src", "LICENSE", "README.md"]);
});

test("license names the copyright holder", () => {
  const license = readFileSync(new URL("../LICENSE", import.meta.url), "utf8");
  assert.match(license, /^MIT License/);
  assert.match(license, /Copyright \(c\) 2026 Vadim Gubin/);
});

test("readme has the required sections", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  for (const heading of [
    "## Purpose",
    "## Install",
    "## Usage",
    "## API",
    "## Design",
    "## License"
  ]) {
    assert.equal(readme.includes(heading), true, heading);
  }
});

test("library source has no comments, globals, or I/O", () => {
  const banned = [
    "setTimeout",
    "setInterval",
    "setImmediate",
    "Date.now",
    "Math.random",
    "fetch(",
    "node:",
    "console",
    "process",
    "globalThis",
    "require(",
    "Buffer",
    "XMLHttpRequest",
    "WebSocket",
    "localStorage",
    "//",
    "/*"
  ];
  const names = readdirSync(new URL("../src/", import.meta.url)).filter((name) =>
    name.endsWith(".js")
  );
  assert.deepEqual(names.sort(), ["compare.js", "decide.js", "error.js", "index.js", "parse.js"]);
  for (const name of names) {
    const source = readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
    for (const token of banned) {
      assert.equal(source.includes(token), false, `${name} contains ${token}`);
    }
    for (const line of source.split("\n")) {
      if (!line.includes(" from ")) {
        continue;
      }
      assert.match(line, /from "\.\/[a-z]+\.js";$/, line);
    }
  }
});

test("loading the module adds no global properties", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const script = [
    'const before = Object.getOwnPropertyNames(globalThis).sort().join("\\n");',
    'await import("./src/index.js");',
    'const after = Object.getOwnPropertyNames(globalThis).sort().join("\\n");',
    "if (before !== after) process.exit(2);"
  ].join("\n");
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
});
