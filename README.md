# @aneron/version-gate

Decide whether a client version may connect, should connect with an update warning, or must be refused.

The package is a pure function. It parses and compares semantic versions itself. It does not read a clock, draw random numbers, open a connection, or perform I/O. There are no runtime dependencies and no global state.

## Purpose

`decideVersion` answers one question: given the version a client presents, the oldest version that may connect, the versions that must not connect, and the version that should no longer warn, which of `allow`, `warn`, or `refuse` applies?

`allow` and `warn` both mean the client may connect. `warn` means the client is still inside the supported band but older than the preferred version, so the caller can ask for an update. `refuse` means the client must not connect. The caller owns that connection. This package only classifies the version.

A client below the minimum is refused. A client that matches a blocked version, and is not already below the minimum, is refused. A client at or above the minimum and below the preferred version is warned. A client at or above the preferred version is allowed. A version newer than the preferred version is allowed too. Preferred is the start of the silent band, not a ceiling.

## Install

```sh
npm install @aneron/version-gate
```

The package name is `@aneron/version-gate`. It is an ES module and needs Node.js 20 or newer. It has no runtime dependencies.

```js
import { decideVersion } from "@aneron/version-gate";
```

`npm test` runs the test suite. `npm run lint` checks the source. `npm run format:check` checks formatting. Continuous integration runs those three checks on Node.js 20 and Node.js 22.

## Usage

Pass the presented client version and the three rules. Every version is a semantic version string. `blocked` is an array, and an empty array means nothing is blocked.

```js
import { decideVersion } from "@aneron/version-gate";

const current = decideVersion({
  client: "1.4.2",
  minimum: "1.2.0",
  preferred: "1.4.0",
  blocked: ["1.3.1"]
});

const outdated = decideVersion({
  client: "1.2.5",
  minimum: "1.2.0",
  preferred: "1.4.0",
  blocked: ["1.3.1"]
});

const rejected = decideVersion({
  client: "1.1.0",
  minimum: "1.2.0",
  preferred: "1.4.0",
  blocked: ["1.3.1"]
});

const broken = decideVersion({
  client: "1.3.1+build.7",
  minimum: "1.2.0",
  preferred: "1.4.0",
  blocked: ["1.3.1"]
});
```

`current` may connect with no warning:

```js
{
  decision: "allow",
  reason: null,
  client: "1.4.2",
  minimum: "1.2.0",
  preferred: "1.4.0",
  matched: null
}
```

`outdated` may connect, and the caller can ask for an update to `1.4.0`:

```js
{
  decision: "warn",
  reason: "below_preferred",
  client: "1.2.5",
  minimum: "1.2.0",
  preferred: "1.4.0",
  matched: null
}
```

`rejected` is older than the minimum, so it must not connect:

```js
{
  decision: "refuse",
  reason: "below_minimum",
  client: "1.1.0",
  minimum: "1.2.0",
  preferred: "1.4.0",
  matched: null
}
```

`broken` matches the blocked release. Build metadata does not keep it off that list:

```js
{
  decision: "refuse",
  reason: "blocked",
  client: "1.3.1+build.7",
  minimum: "1.2.0",
  preferred: "1.4.0",
  matched: "1.3.1"
}
```

The same parser and comparator are available on their own:

```js
import { compareVersions, formatVersion, parseVersion } from "@aneron/version-gate";

parseVersion("1.2.3-alpha.1+001");
// { major: 1, minor: 2, patch: 3, prerelease: ["alpha", 1], build: ["001"] }

compareVersions("1.0.0-alpha", "1.0.0");
// -1

formatVersion("1.2.3+001");
// "1.2.3+001"
```

Invalid input throws `VersionGateError`. The `code` and `message` are stable.

```js
import { VersionGateError, decideVersion } from "@aneron/version-gate";

try {
  decideVersion({
    client: "1.2",
    minimum: "1.0.0",
    preferred: "1.2.0",
    blocked: []
  });
} catch (error) {
  if (error instanceof VersionGateError) {
    error.code; // "invalid_client"
    error.message; // client must be a semantic version
  } else {
    throw error;
  }
}
```

## API

### `decideVersion(input)`

Return the decision for one client version.

`input` must be a plain object. Its prototype is `Object.prototype` or `null`. Arrays, class instances, and other objects are rejected. Only own properties are read. Unknown string keys, including non-enumerable keys, are rejected. Symbol keys are rejected. When several unknown string keys are present, the lexicographically first name is the one reported. An unknown string key is reported before a symbol key.

| Field       | Required | Accepted values                                                            |
| ----------- | -------- | -------------------------------------------------------------------------- |
| `client`    | yes      | Semantic version string. The version the client presented.                 |
| `minimum`   | yes      | Semantic version string. The oldest version that may connect.              |
| `preferred` | yes      | Semantic version string. The oldest version that connects with no warning. |
| `blocked`   | yes      | Array of semantic version strings. May be empty. At most 128 entries.      |

There are no defaults. A missing field fails the check for that field. `null` is never treated as an empty list or a missing version. The object is not mutated, and neither is `blocked`.

`preferred` must be greater than or equal to `minimum` by version precedence. `preferred` must not have the same precedence as any blocked entry. Those two checks run after the fields have been parsed. The floor is checked first, then the preferred block.

The decision checks run in this order. The first match wins.

1. If `client` is below `minimum`, refuse with `below_minimum`. A blocked entry for that same version does not change the reason.
2. If `client` has the same precedence as a blocked entry, refuse with `blocked`.
3. If `client` is below `preferred`, warn with `below_preferred`.
4. Otherwise allow. `reason` is `null`.

Each call returns a new plain object:

| Field       | Type                                                           | Meaning                                                                                     |
| ----------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `decision`  | `"allow"`, `"warn"`, or `"refuse"`                             | Whether the client may connect, may connect with an update warning, or must not connect.    |
| `reason`    | `"below_minimum"`, `"blocked"`, `"below_preferred"`, or `null` | Why the decision was not a silent allow. `null` when `decision` is `"allow"`.               |
| `client`    | string                                                         | Canonical client version. For every accepted input this is the same string that was passed. |
| `minimum`   | string                                                         | Canonical minimum version.                                                                  |
| `preferred` | string                                                         | Canonical preferred version.                                                                |
| `matched`   | string or `null`                                               | The blocked entry that matched, in canonical form. `null` unless `reason` is `"blocked"`.   |

`allow` and `warn` may connect. `refuse` may not. The returned strings keep build metadata. Comparison and blocked matching ignore it, so `1.3.1+build.7` matches a blocked `1.3.1`, and `matched` is the blocked entry `1.3.1`.

The decision strings are also exported as `DECISION_ALLOW`, `DECISION_WARN`, and `DECISION_REFUSE`. The reason strings are exported as `REASON_BELOW_MINIMUM`, `REASON_BLOCKED`, and `REASON_BELOW_PREFERRED`.

### `parseVersion(value)`

Parse one semantic version string into a frozen plain object.

| Argument | Type   | Role                   |
| -------- | ------ | ---------------------- |
| `value`  | string | Version text to parse. |

The result has exactly these own string keys:

| Field        | Type         | Meaning                                                                  |
| ------------ | ------------ | ------------------------------------------------------------------------ |
| `major`      | safe integer | Major number.                                                            |
| `minor`      | safe integer | Minor number.                                                            |
| `patch`      | safe integer | Patch number.                                                            |
| `prerelease` | frozen array | Identifiers after `-` and before `+`. Empty when there is no prerelease. |
| `build`      | frozen array | Identifiers after `+`. Empty when there is no build.                     |

A numeric prerelease identifier is a number. Every other prerelease identifier, and every build identifier, is a string. Build identifiers keep leading zeros. `1.2.3+01` has build `["01"]`, not `[1]`. `1.2.3-0` has prerelease `[0]`.

The object and both arrays are frozen. A caller that wants the text back can pass the original string to `formatVersion`. A reconstructed object is not a version string and is rejected by `formatVersion`.

### `formatVersion(value)`

Parse `value` and return its canonical text.

Every string `parseVersion` accepts is already canonical, so `formatVersion` returns that same string. Major, minor, patch, and numeric prerelease identifiers cannot carry leading zeros. Build text is copied as written. The function is the check that a string is acceptable and stable.

### `compareVersions(left, right)`

Compare two semantic version strings by precedence.

| Argument | Type   | Role            |
| -------- | ------ | --------------- |
| `left`   | string | First version.  |
| `right`  | string | Second version. |

The return value is `-1` when `left` is lower, `1` when `left` is higher, and `0` when they have the same precedence. It is never any other number. Build metadata is ignored, so versions that differ only by build compare equal.

`left` is validated completely before `right`. A parsed object is not a string and is rejected.

Core numbers are compared first, numerically. A prerelease is lower than the same core without a prerelease, and only then. `1.0.0-alpha` is below `1.0.0`, while `2.0.0-alpha` is above `1.9.9`. `1.0.0` is below `1.0.1-alpha` because the patch number is compared before either prerelease.

When the cores match and both versions have a prerelease, identifiers are compared from the left:

1. Identifiers that are numbers are compared numerically. `beta.2` is below `beta.11`.
2. Identifiers that are strings are compared by UTF-16 code unit, which for these identifiers is ASCII order. `ALPHA` is below `alpha`. `rc` is below `rc1`.
3. A number is below a string. `1` is below `alpha`, below `0a`, and below `-`.
4. When one prerelease is a prefix of the other, the longer one is higher. `alpha` is below `alpha.1`.

### Version grammar

A version is `major.minor.patch`, optionally followed by `-` and dot-separated prerelease identifiers, optionally followed by `+` and dot-separated build identifiers. The letters are ASCII. A leading `v` is rejected. Partial versions such as `1.2` are rejected. Whitespace is rejected. The string is not trimmed.

| Piece                     | Rule                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `major`, `minor`, `patch` | Digits. No leading zero unless the number is `0`. At most 16 digits, and the value must be a safe integer.                                             |
| prerelease identifier     | Either a numeric identifier with the same rules as the core, or one to 64 ASCII letters, digits, and hyphens containing at least one letter or hyphen. |
| build identifier          | One to 64 digits, or one to 64 ASCII letters, digits, and hyphens containing at least one letter or hyphen. Leading zeros are kept.                    |
| counts                    | At most 16 prerelease identifiers and 16 build identifiers.                                                                                            |
| whole string              | 1 to 256 characters.                                                                                                                                   |

Empty identifiers, doubled dots, a trailing `.`, `-`, or `+`, and a second `+` are rejected. These limits are exported as `MAX_VERSION_LENGTH` (`256`), `MAX_IDENTIFIER_LENGTH` (`64`), `MAX_PRERELEASE_IDENTIFIERS` (`16`), and `MAX_BUILD_IDENTIFIERS` (`16`). `decideVersion` also exports `MAX_BLOCKED_VERSIONS` (`128`).

`blocked` is read as a dense array. Own keys other than `length` and the canonical indexes `0` through `length - 1` are rejected. A hole is rejected when that index is read. Entries are parsed in index order. Two entries with the same precedence are rejected, including entries that differ only by build metadata. Duplicate detection runs after each entry has been parsed and before the preferred-version policy checks.

### Errors

`VersionGateError` extends `Error`. `name` is `"VersionGateError"`. `code` is a stable string. `message` is a stable description.

```js
new VersionGateError(code, message);
```

Validation stops at the first problem. For `decideVersion` the order is: plain object, unknown string keys, symbol keys, `client`, `minimum`, `preferred`, `blocked` shape, `blocked` length, `blocked` keys, each `blocked` entry, `blocked` uniqueness, preferred against minimum, preferred against the blocked list.

| `code`              | `message`                                            |
| ------------------- | ---------------------------------------------------- |
| `invalid_input`     | `input must be a plain object`                       |
| `unknown_field`     | `unknown field "<name>"`                             |
| `invalid_input`     | `input must not contain symbol keys`                 |
| `invalid_version`   | `version must be a string`                           |
| `invalid_version`   | `version must be a semantic version`                 |
| `invalid_version`   | `left must be a string`                              |
| `invalid_version`   | `left must be a semantic version`                    |
| `invalid_version`   | `right must be a string`                             |
| `invalid_version`   | `right must be a semantic version`                   |
| `invalid_client`    | `client must be a string`                            |
| `invalid_client`    | `client must be a semantic version`                  |
| `invalid_minimum`   | `minimum must be a string`                           |
| `invalid_minimum`   | `minimum must be a semantic version`                 |
| `invalid_preferred` | `preferred must be a string`                         |
| `invalid_preferred` | `preferred must be a semantic version`               |
| `invalid_blocked`   | `blocked must be an array`                           |
| `invalid_blocked`   | `blocked must contain at most 128 versions`          |
| `invalid_blocked`   | `unknown blocked field "<name>"`                     |
| `invalid_blocked`   | `blocked must not contain symbol keys`               |
| `invalid_blocked`   | `blocked[<index>] must be a string`                  |
| `invalid_blocked`   | `blocked[<index>] must be a semantic version`        |
| `invalid_blocked`   | `blocked versions must be unique`                    |
| `invalid_policy`    | `preferred must be greater than or equal to minimum` |
| `invalid_policy`    | `preferred must not be blocked`                      |

`parseVersion` and `formatVersion` use `version must be a string` and `version must be a semantic version`. `compareVersions` uses the `left` and `right` messages. The `128` in the length message is `MAX_BLOCKED_VERSIONS`.

## Design

The decision is separate from the connection. A caller that opens a socket, writes a log, or shows an update notice needs those effects at the call site, where a test can see them. The classifier takes strings in and returns a plain object. The same arguments always return the same decision.

The three outcomes are the whole result. `warn` is not a soft refusal: the client is still allowed to connect. Putting that case in `decision` keeps a caller from treating every non-allow as a disconnect. `reason` explains the non-silent cases and is `null` for `allow`, so a silent connection does not carry a leftover explanation.

The floor is checked before the block list. A client older than `minimum` has to move up to a supported version anyway. Naming that same old version in `blocked` does not change the reason, and `matched` stays `null`. Once the client is inside the supported band, a blocked release is more specific than a warning, including when the blocked release is newer than `preferred`. A known-bad release above the floor is refused even though a neighbor of it would be allowed or warned.

Preferred is a floor for silence. Clients newer than it are allowed. A ceiling would refuse a client that has already updated past the version the caller had in mind, which is the opposite of an update warning. When `preferred` and `minimum` are equal, the warn band is empty: every connecting client is on the preferred precedence or newer.

Build metadata is ignored for precedence and for blocked identity, and it is kept on the returned strings. Two builds of `1.3.1` are the same release for this decision. The caller can still see which build text arrived, because `client` echoes it, and can see which blocked entry matched, because `matched` echoes that entry rather than the client text.

Prerelease belongs to its core. `1.2.0-rc.1` is below a minimum of `1.2.0` and is refused. It is not treated as `1.2.0`. A minimum of `1.2.0-rc.1` does accept `1.2.0`, because the release is above that prerelease. Core numbers are compared before prerelease identifiers, so a prerelease of a newer core is not pushed below an older release.

Numeric identifiers are safe integers so the comparison is exact. Leading zeros are rejected on the core and on numeric prerelease identifiers, which keeps every accepted string equal to the canonical text. Build identifiers are not numbers, so a build of `01` stays `01`. The length caps keep one call bounded: 256 characters, 64 characters per identifier, 16 identifiers on each side of the core, and 128 blocked versions.

The blocked list is a set by precedence. Duplicates, including a pair that differs only by build, are a bad rule set and throw before a decision is made. The preferred version is rejected from that set for the same reason: the version a caller would name in a warning cannot also be a version that must be refused. A preferred version below the minimum is rejected first, so the floor stays the lower bound of the warn band.

Unknown fields throw. A forgotten rename should not disappear into a decision. Inherited fields are not read, so a property sitting on a prototype cannot supply `client`. The input has to own each field.

This module does not schedule work, store the rule set, or remember a previous client. Each call is independent.

## License

MIT License

Copyright (c) 2026 Vadim Gubin

The complete terms are in the [LICENSE](LICENSE) file.
