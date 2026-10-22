import { VersionGateError } from "./error.js";

export const MAX_VERSION_LENGTH = 256;
export const MAX_IDENTIFIER_LENGTH = 64;
export const MAX_PRERELEASE_IDENTIFIERS = 16;
export const MAX_BUILD_IDENTIFIERS = 16;

const MAX_NUMERIC_DIGITS = 16;

export function parseVersion(value) {
  return parseChecked(
    value,
    "invalid_version",
    "version must be a string",
    "version must be a semantic version"
  );
}

export function formatVersion(value) {
  return formatParsed(parseVersion(value));
}

export function parseChecked(value, code, stringMessage, semverMessage) {
  if (typeof value !== "string") {
    throw new VersionGateError(code, stringMessage);
  }
  const parsed = scan(value);
  if (parsed === null) {
    throw new VersionGateError(code, semverMessage);
  }
  return parsed;
}

export function formatParsed(version) {
  let text = `${version.major}.${version.minor}.${version.patch}`;
  if (version.prerelease.length > 0) {
    text += `-${version.prerelease.join(".")}`;
  }
  if (version.build.length > 0) {
    text += `+${version.build.join(".")}`;
  }
  return text;
}

function scan(text) {
  if (text.length === 0 || text.length > MAX_VERSION_LENGTH) {
    return null;
  }
  const cursor = { text, index: 0 };
  const major = readNumericIdentifier(cursor);
  if (major === null || !consume(cursor, ".")) {
    return null;
  }
  const minor = readNumericIdentifier(cursor);
  if (minor === null || !consume(cursor, ".")) {
    return null;
  }
  const patch = readNumericIdentifier(cursor);
  if (patch === null) {
    return null;
  }
  let prerelease = [];
  let build = [];
  if (peek(cursor) === "-") {
    cursor.index += 1;
    prerelease = readDotIdentifiers(cursor, "prerelease");
    if (prerelease === null) {
      return null;
    }
  }
  if (peek(cursor) === "+") {
    cursor.index += 1;
    build = readDotIdentifiers(cursor, "build");
    if (build === null) {
      return null;
    }
  }
  if (cursor.index !== text.length) {
    return null;
  }
  return seal(major, minor, patch, prerelease, build);
}

function readNumericIdentifier(cursor) {
  const raw = readDigits(cursor);
  if (raw === null || !isNumericIdentifier(raw)) {
    return null;
  }
  return Number(raw);
}

function readDigits(cursor) {
  const start = cursor.index;
  const text = cursor.text;
  if (start >= text.length || !isDigit(text[start])) {
    return null;
  }
  let index = start + 1;
  while (index < text.length && isDigit(text[index])) {
    index += 1;
  }
  cursor.index = index;
  return text.slice(start, index);
}

function isNumericIdentifier(raw) {
  if (raw.length > 1 && raw[0] === "0") {
    return false;
  }
  if (raw.length > MAX_NUMERIC_DIGITS) {
    return false;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0;
}

function readDotIdentifiers(cursor, mode) {
  const items = [];
  const limit = mode === "prerelease" ? MAX_PRERELEASE_IDENTIFIERS : MAX_BUILD_IDENTIFIERS;
  if (cursor.index >= cursor.text.length) {
    return null;
  }
  while (cursor.index < cursor.text.length) {
    const item = readOneIdentifier(cursor, mode);
    if (item === null) {
      return null;
    }
    items.push(item);
    if (items.length > limit) {
      return null;
    }
    if (peek(cursor) !== ".") {
      break;
    }
    cursor.index += 1;
    if (cursor.index >= cursor.text.length) {
      return null;
    }
  }
  if (items.length === 0) {
    return null;
  }
  return items;
}

function readOneIdentifier(cursor, mode) {
  const start = cursor.index;
  const text = cursor.text;
  if (start >= text.length || !isIdentChar(text[start])) {
    return null;
  }
  let index = start + 1;
  let digits = isDigit(text[start]);
  while (index < text.length && isIdentChar(text[index])) {
    if (!isDigit(text[index])) {
      digits = false;
    }
    index += 1;
  }
  const raw = text.slice(start, index);
  if (raw.length > MAX_IDENTIFIER_LENGTH) {
    return null;
  }
  cursor.index = index;
  if (!digits) {
    return raw;
  }
  if (mode === "build") {
    return raw;
  }
  if (!isNumericIdentifier(raw)) {
    return null;
  }
  return Number(raw);
}

function seal(major, minor, patch, prerelease, build) {
  return Object.freeze({
    major,
    minor,
    patch,
    prerelease: Object.freeze(prerelease),
    build: Object.freeze(build)
  });
}

function peek(cursor) {
  return cursor.text[cursor.index];
}

function consume(cursor, expected) {
  if (cursor.text[cursor.index] !== expected) {
    return false;
  }
  cursor.index += 1;
  return true;
}

function isDigit(char) {
  return char >= "0" && char <= "9";
}

function isIdentChar(char) {
  return (
    isDigit(char) || (char >= "A" && char <= "Z") || (char >= "a" && char <= "z") || char === "-"
  );
}
