import { VersionGateError } from "./error.js";
import { compareParsed } from "./compare.js";
import { formatParsed, parseChecked } from "./parse.js";

export const DECISION_ALLOW = "allow";
export const DECISION_WARN = "warn";
export const DECISION_REFUSE = "refuse";

export const REASON_BELOW_MINIMUM = "below_minimum";
export const REASON_BLOCKED = "blocked";
export const REASON_BELOW_PREFERRED = "below_preferred";

export const MAX_BLOCKED_VERSIONS = 128;

const INPUT_KEYS = new Set(["client", "minimum", "preferred", "blocked"]);

export function decideVersion(input) {
  const policy = readInput(input);
  const matched = findBlocked(policy.blocked, policy.client);
  if (compareParsed(policy.client, policy.minimum) < 0) {
    return outcome(DECISION_REFUSE, REASON_BELOW_MINIMUM, policy, null);
  }
  if (matched !== null) {
    return outcome(DECISION_REFUSE, REASON_BLOCKED, policy, formatParsed(matched));
  }
  if (compareParsed(policy.client, policy.preferred) < 0) {
    return outcome(DECISION_WARN, REASON_BELOW_PREFERRED, policy, null);
  }
  return outcome(DECISION_ALLOW, null, policy, null);
}

function outcome(decision, reason, policy, matched) {
  return {
    decision,
    reason,
    client: formatParsed(policy.client),
    minimum: formatParsed(policy.minimum),
    preferred: formatParsed(policy.preferred),
    matched
  };
}

function readInput(input) {
  if (!isPlainObject(input)) {
    throw new VersionGateError("invalid_input", "input must be a plain object");
  }
  const unknown = firstUnknown(input, INPUT_KEYS);
  if (unknown.name !== undefined) {
    throw new VersionGateError("unknown_field", `unknown field "${unknown.name}"`);
  }
  if (unknown.hasSymbol) {
    throw new VersionGateError("invalid_input", "input must not contain symbol keys");
  }
  const client = readVersion(input, "client");
  const minimum = readVersion(input, "minimum");
  const preferred = readVersion(input, "preferred");
  const blocked = readBlocked(input);
  if (compareParsed(preferred, minimum) < 0) {
    throw new VersionGateError(
      "invalid_policy",
      "preferred must be greater than or equal to minimum"
    );
  }
  for (const entry of blocked) {
    if (compareParsed(entry, preferred) === 0) {
      throw new VersionGateError("invalid_policy", "preferred must not be blocked");
    }
  }
  return { client, minimum, preferred, blocked };
}

function readVersion(input, label) {
  return parseChecked(
    own(input, label),
    `invalid_${label}`,
    `${label} must be a string`,
    `${label} must be a semantic version`
  );
}

function readBlocked(input) {
  const value = own(input, "blocked");
  if (!Array.isArray(value)) {
    throw new VersionGateError("invalid_blocked", "blocked must be an array");
  }
  if (value.length > MAX_BLOCKED_VERSIONS) {
    throw new VersionGateError(
      "invalid_blocked",
      `blocked must contain at most ${MAX_BLOCKED_VERSIONS} versions`
    );
  }
  rejectBlockedKeys(value);
  const blocked = [];
  for (let index = 0; index < value.length; index += 1) {
    blocked.push(
      parseChecked(
        value[index],
        "invalid_blocked",
        `blocked[${index}] must be a string`,
        `blocked[${index}] must be a semantic version`
      )
    );
  }
  for (let left = 0; left < blocked.length; left += 1) {
    for (let right = left + 1; right < blocked.length; right += 1) {
      if (compareParsed(blocked[left], blocked[right]) === 0) {
        throw new VersionGateError("invalid_blocked", "blocked versions must be unique");
      }
    }
  }
  return blocked;
}

function rejectBlockedKeys(blocked) {
  const names = [];
  let hasSymbol = false;
  for (const key of Reflect.ownKeys(blocked)) {
    if (typeof key === "symbol") {
      hasSymbol = true;
      continue;
    }
    if (key === "length") {
      continue;
    }
    if (!isArrayIndex(key, blocked.length)) {
      names.push(key);
    }
  }
  names.sort();
  if (names.length > 0) {
    throw new VersionGateError("invalid_blocked", `unknown blocked field "${names[0]}"`);
  }
  if (hasSymbol) {
    throw new VersionGateError("invalid_blocked", "blocked must not contain symbol keys");
  }
}

function isArrayIndex(key, length) {
  if (!/^(0|[1-9][0-9]*)$/.test(key)) {
    return false;
  }
  const index = Number(key);
  return Number.isSafeInteger(index) && index < length;
}

function findBlocked(blocked, client) {
  for (const entry of blocked) {
    if (compareParsed(entry, client) === 0) {
      return entry;
    }
  }
  return null;
}

function own(object, key) {
  if (!Object.hasOwn(object, key)) {
    return undefined;
  }
  return object[key];
}

function isPlainObject(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function firstUnknown(object, allowed) {
  const names = [];
  let hasSymbol = false;
  for (const key of Reflect.ownKeys(object)) {
    if (typeof key === "symbol") {
      hasSymbol = true;
      continue;
    }
    if (!allowed.has(key)) {
      names.push(key);
    }
  }
  names.sort();
  return { name: names[0], hasSymbol };
}
