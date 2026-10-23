import { parseChecked } from "./parse.js";

export function compareVersions(left, right) {
  const parsedLeft = parseChecked(
    left,
    "invalid_version",
    "left must be a string",
    "left must be a semantic version"
  );
  const parsedRight = parseChecked(
    right,
    "invalid_version",
    "right must be a string",
    "right must be a semantic version"
  );
  return compareParsed(parsedLeft, parsedRight);
}

export function compareParsed(left, right) {
  if (left.major !== right.major) {
    return left.major < right.major ? -1 : 1;
  }
  if (left.minor !== right.minor) {
    return left.minor < right.minor ? -1 : 1;
  }
  if (left.patch !== right.patch) {
    return left.patch < right.patch ? -1 : 1;
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

function comparePrerelease(left, right) {
  if (left.length === 0 && right.length === 0) {
    return 0;
  }
  if (left.length === 0) {
    return 1;
  }
  if (right.length === 0) {
    return -1;
  }
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) {
    const compared = compareIdentifier(left[index], right[index]);
    if (compared !== 0) {
      return compared;
    }
  }
  if (left.length === right.length) {
    return 0;
  }
  return left.length < right.length ? -1 : 1;
}

function compareIdentifier(left, right) {
  const leftNumber = typeof left === "number";
  const rightNumber = typeof right === "number";
  if (leftNumber && rightNumber) {
    if (left < right) {
      return -1;
    }
    if (left > right) {
      return 1;
    }
    return 0;
  }
  if (leftNumber) {
    return -1;
  }
  if (rightNumber) {
    return 1;
  }
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
