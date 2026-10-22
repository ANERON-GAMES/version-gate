export class VersionGateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "VersionGateError";
    this.code = code;
  }
}
