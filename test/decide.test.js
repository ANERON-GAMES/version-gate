import assert from "node:assert/strict";
import test from "node:test";
import {
  DECISION_ALLOW,
  DECISION_REFUSE,
  DECISION_WARN,
  MAX_BLOCKED_VERSIONS,
  REASON_BELOW_MINIMUM,
  REASON_BELOW_PREFERRED,
  REASON_BLOCKED,
  decideVersion
} from "../src/index.js";
import { assertError } from "./helpers.js";

test("the usage sample allows a current client, warns an old one, and refuses the rest", () => {
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

  assert.deepEqual(current, {
    decision: "allow",
    reason: null,
    client: "1.4.2",
    minimum: "1.2.0",
    preferred: "1.4.0",
    matched: null
  });
  assert.deepEqual(outdated, {
    decision: "warn",
    reason: "below_preferred",
    client: "1.2.5",
    minimum: "1.2.0",
    preferred: "1.4.0",
    matched: null
  });
  assert.deepEqual(rejected, {
    decision: "refuse",
    reason: "below_minimum",
    client: "1.1.0",
    minimum: "1.2.0",
    preferred: "1.4.0",
    matched: null
  });
  assert.deepEqual(broken, {
    decision: "refuse",
    reason: "blocked",
    client: "1.3.1+build.7",
    minimum: "1.2.0",
    preferred: "1.4.0",
    matched: "1.3.1"
  });
  assert.equal(current.decision, DECISION_ALLOW);
  assert.equal(outdated.decision, DECISION_WARN);
  assert.equal(outdated.reason, REASON_BELOW_PREFERRED);
  assert.equal(rejected.decision, DECISION_REFUSE);
  assert.equal(rejected.reason, REASON_BELOW_MINIMUM);
  assert.equal(broken.reason, REASON_BLOCKED);
});

test("at or above preferred is allowed, and newer than preferred stays allowed", () => {
  assertDecision(policy({ client: "1.4.0" }), DECISION_ALLOW, null, null);
  assertDecision(policy({ client: "9.0.0" }), DECISION_ALLOW, null, null);
  assertDecision(policy({ client: "1.4.0+build.1" }), DECISION_ALLOW, null, null);
  assertDecision(
    policy({ client: "2.0.0-alpha", preferred: "2.0.0" }),
    DECISION_WARN,
    REASON_BELOW_PREFERRED,
    null
  );
  assertDecision(policy({ client: "2.0.0", preferred: "2.0.0" }), DECISION_ALLOW, null, null);
});

test("the band from minimum up to preferred warns", () => {
  assertDecision(policy({ client: "1.2.0" }), DECISION_WARN, REASON_BELOW_PREFERRED, null);
  assertDecision(policy({ client: "1.3.9" }), DECISION_WARN, REASON_BELOW_PREFERRED, null);
  assertDecision(policy({ client: "1.4.0-rc.1" }), DECISION_WARN, REASON_BELOW_PREFERRED, null);
  assertDecision(
    policy({
      client: "1.0.0-Z",
      minimum: "1.0.0-ALPHA",
      preferred: "1.0.0-alpha",
      blocked: []
    }),
    DECISION_WARN,
    REASON_BELOW_PREFERRED,
    null
  );
  assertDecision(
    policy({
      client: "1.0.0-ALPHA",
      minimum: "1.0.0-ALPHA",
      preferred: "1.0.0-alpha",
      blocked: []
    }),
    DECISION_WARN,
    REASON_BELOW_PREFERRED,
    null
  );
  assertDecision(
    policy({
      client: "1.0.0-alpha",
      minimum: "1.0.0-ALPHA",
      preferred: "1.0.0-alpha",
      blocked: []
    }),
    DECISION_ALLOW,
    null,
    null
  );
});

test("equal minimum and preferred leave no warn band", () => {
  const input = policy({
    minimum: "1.4.0",
    preferred: "1.4.0",
    blocked: []
  });
  assertDecision({ ...input, client: "1.4.0" }, DECISION_ALLOW, null, null);
  assertDecision({ ...input, client: "1.4.0+sha" }, DECISION_ALLOW, null, null);
  assertDecision({ ...input, client: "1.4.1" }, DECISION_ALLOW, null, null);
  assertDecision({ ...input, client: "1.4.0-rc.1" }, DECISION_REFUSE, REASON_BELOW_MINIMUM, null);
  assertDecision({ ...input, client: "1.3.9" }, DECISION_REFUSE, REASON_BELOW_MINIMUM, null);
});

test("a blocked version refuses at or above the minimum, including above preferred", () => {
  assertDecision(policy({ client: "1.3.1" }), DECISION_REFUSE, REASON_BLOCKED, "1.3.1");
  assertDecision(
    policy({ client: "1.3.1+bbb", blocked: ["1.3.1+aaa", "1.2.0"] }),
    DECISION_REFUSE,
    REASON_BLOCKED,
    "1.3.1+aaa"
  );
  assertDecision(
    policy({ client: "3.0.0", blocked: ["3.0.0", "1.3.1"] }),
    DECISION_REFUSE,
    REASON_BLOCKED,
    "3.0.0"
  );
  assertDecision(
    policy({ client: "1.0.0", minimum: "1.0.0", blocked: ["1.0.0", "1.3.1"] }),
    DECISION_REFUSE,
    REASON_BLOCKED,
    "1.0.0"
  );
  assertDecision(policy({ client: "1.3.2" }), DECISION_WARN, REASON_BELOW_PREFERRED, null);
  assertDecision(
    policy({ client: "1.2.3-1", blocked: ["1.2.3"] }),
    DECISION_WARN,
    REASON_BELOW_PREFERRED,
    null
  );
});

test("below the minimum wins over the blocked list", () => {
  assertDecision(
    policy({ client: "1.1.0", blocked: ["1.1.0", "1.3.1"] }),
    DECISION_REFUSE,
    REASON_BELOW_MINIMUM,
    null
  );
  assertDecision(
    policy({ client: "1.2.0-rc.1", blocked: ["1.2.0-rc.1"] }),
    DECISION_REFUSE,
    REASON_BELOW_MINIMUM,
    null
  );
});

test("prerelease belongs to its own core", () => {
  assertDecision(
    policy({ client: "1.2.0-rc.1", minimum: "1.2.0", preferred: "1.4.0", blocked: [] }),
    DECISION_REFUSE,
    REASON_BELOW_MINIMUM,
    null
  );
  assertDecision(
    policy({
      client: "1.2.0",
      minimum: "1.2.0-rc.1",
      preferred: "1.2.0",
      blocked: []
    }),
    DECISION_ALLOW,
    null,
    null
  );
  assertDecision(
    policy({
      client: "1.2.0-rc.2",
      minimum: "1.2.0-rc.1",
      preferred: "1.2.0",
      blocked: []
    }),
    DECISION_WARN,
    REASON_BELOW_PREFERRED,
    null
  );
  assertDecision(
    policy({
      client: "2.0.0-alpha",
      minimum: "1.9.9",
      preferred: "2.0.0",
      blocked: []
    }),
    DECISION_WARN,
    REASON_BELOW_PREFERRED,
    null
  );
});

test("results are fresh objects and inputs stay put", () => {
  const blocked = Object.freeze(["1.5.0", "1.3.1"]);
  const input = Object.freeze({
    client: "1.3.1+keep",
    minimum: "1.2.0",
    preferred: "1.4.0",
    blocked
  });
  const first = decideVersion(input);
  const second = decideVersion(input);
  assert.notEqual(first, second);
  assert.deepEqual(first, second);
  assert.equal(input.blocked, blocked);
  assert.deepEqual([...blocked], ["1.5.0", "1.3.1"]);
  assert.equal(first.client, "1.3.1+keep");
  assert.equal(first.matched, "1.3.1");
  assert.deepEqual(Object.keys(first), [
    "decision",
    "reason",
    "client",
    "minimum",
    "preferred",
    "matched"
  ]);
});

test("a null-prototype object and a non-enumerable client are accepted", () => {
  const fromNull = Object.create(null);
  fromNull.client = "1.4.0";
  fromNull.minimum = "1.2.0";
  fromNull.preferred = "1.4.0";
  fromNull.blocked = [];
  assertDecision(fromNull, DECISION_ALLOW, null, null);

  const hidden = {
    minimum: "1.0.0",
    preferred: "1.0.0",
    blocked: []
  };
  Object.defineProperty(hidden, "client", {
    value: "1.0.0",
    enumerable: false
  });
  assertDecision(hidden, DECISION_ALLOW, null, null);
});

test("an inherited client is ignored", () => {
  const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, "client");
  Object.defineProperty(Object.prototype, "client", {
    value: "9.0.0",
    configurable: true
  });
  try {
    assertError(
      () =>
        decideVersion({
          minimum: "1.0.0",
          preferred: "1.0.0",
          blocked: []
        }),
      "invalid_client",
      "client must be a string"
    );
  } finally {
    if (descriptor === undefined) {
      delete Object.prototype.client;
    } else {
      Object.defineProperty(Object.prototype, "client", descriptor);
    }
  }
});

test("input shape is rejected before field values", () => {
  for (const value of [undefined, null, "1.0.0", 1, true, false, [], new Date(), new Map()]) {
    assertError(() => decideVersion(value), "invalid_input", "input must be a plain object");
  }
  class Box {
    constructor() {
      this.client = "1.0.0";
      this.minimum = "1.0.0";
      this.preferred = "1.0.0";
      this.blocked = [];
    }
  }
  assertError(() => decideVersion(new Box()), "invalid_input", "input must be a plain object");
  const foreign = Object.create({ client: "1.0.0" });
  foreign.minimum = "1.0.0";
  foreign.preferred = "1.0.0";
  foreign.blocked = [];
  assertError(() => decideVersion(foreign), "invalid_input", "input must be a plain object");

  const extra = policy({ nope: 1, client: "bad" });
  assertError(() => decideVersion(extra), "unknown_field", 'unknown field "nope"');
  const named = policy();
  named.zeta = 1;
  named.alpha = 1;
  named[Symbol("mark")] = 1;
  assertError(() => decideVersion(named), "unknown_field", 'unknown field "alpha"');
  const marked = policy();
  marked[Symbol("mark")] = 1;
  assertError(() => decideVersion(marked), "invalid_input", "input must not contain symbol keys");
});

test("field validation runs client, minimum, preferred, then blocked", () => {
  assertError(
    () => decideVersion(policy({ client: 1, minimum: 2, preferred: 3, blocked: "nope" })),
    "invalid_client",
    "client must be a string"
  );
  assertError(
    () => decideVersion(policy({ client: "1.2", minimum: "nope" })),
    "invalid_client",
    "client must be a semantic version"
  );
  assertError(
    () => decideVersion(policy({ minimum: null })),
    "invalid_minimum",
    "minimum must be a string"
  );
  assertError(
    () => decideVersion(policy({ minimum: "1.2", preferred: "bad" })),
    "invalid_minimum",
    "minimum must be a semantic version"
  );
  assertError(
    () => decideVersion(policy({ preferred: undefined })),
    "invalid_preferred",
    "preferred must be a string"
  );
  assertError(
    () => decideVersion(policy({ preferred: "1.2", blocked: "nope" })),
    "invalid_preferred",
    "preferred must be a semantic version"
  );
  assertError(
    () =>
      decideVersion(
        policy({
          client: "1.0.0",
          minimum: "2.0.0",
          preferred: "1.0.0",
          blocked: "1.0.0"
        })
      ),
    "invalid_blocked",
    "blocked must be an array"
  );
});

test("blocked entries, keys, size, and duplicates are reported in that order", () => {
  const tooMany = Array.from({ length: MAX_BLOCKED_VERSIONS + 1 }, (_, index) => `0.1.${index}`);
  tooMany[3] = "bad";
  assertError(
    () =>
      decideVersion(
        policy({
          minimum: "2.0.0",
          preferred: "1.0.0",
          blocked: tooMany
        })
      ),
    "invalid_blocked",
    `blocked must contain at most ${MAX_BLOCKED_VERSIONS} versions`
  );

  const fitting = Array.from({ length: MAX_BLOCKED_VERSIONS }, (_, index) => `0.1.${index}`);
  const allowed = decideVersion(
    policy({
      client: "1.0.0",
      minimum: "0.0.0",
      preferred: "1.0.0",
      blocked: fitting
    })
  );
  assert.equal(allowed.decision, DECISION_ALLOW);

  const keyed = ["1.2.0"];
  keyed.zeta = "1.2.1";
  keyed.alpha = "1.2.2";
  keyed[Symbol("mark")] = "1.2.3";
  assertError(
    () => decideVersion(policy({ blocked: keyed })),
    "invalid_blocked",
    'unknown blocked field "alpha"'
  );
  const marked = ["1.2.0"];
  marked[Symbol("mark")] = true;
  assertError(
    () => decideVersion(policy({ blocked: marked })),
    "invalid_blocked",
    "blocked must not contain symbol keys"
  );
  const oddIndex = ["1.0.0"];
  Object.defineProperty(oddIndex, "01", { value: "1.2.0", enumerable: true });
  assertError(
    () => decideVersion(policy({ blocked: oddIndex })),
    "invalid_blocked",
    'unknown blocked field "01"'
  );

  const hole = ["1.2.3"];
  hole.length = 3;
  hole[2] = "1.2.4";
  assertError(
    () => decideVersion(policy({ blocked: hole })),
    "invalid_blocked",
    "blocked[1] must be a string"
  );
  assertError(
    () => decideVersion(policy({ blocked: ["1.2.0", 2] })),
    "invalid_blocked",
    "blocked[1] must be a string"
  );
  assertError(
    () => decideVersion(policy({ blocked: ["1.2.0", "1.2"] })),
    "invalid_blocked",
    "blocked[1] must be a semantic version"
  );
  assertError(
    () =>
      decideVersion(
        policy({
          client: "1.0.0",
          minimum: "2.0.0",
          preferred: "1.0.0",
          blocked: ["1.1.0", "1.1.0+build"]
        })
      ),
    "invalid_blocked",
    "blocked versions must be unique"
  );
  assertError(
    () => decideVersion(policy({ blocked: ["1.2.3", "1.2.4", "1.2.3+other"] })),
    "invalid_blocked",
    "blocked versions must be unique"
  );
});

test("policy checks the floor before the preferred block", () => {
  assertError(
    () =>
      decideVersion(
        policy({
          client: "1.0.0",
          minimum: "2.0.0",
          preferred: "1.0.0",
          blocked: ["1.0.0"]
        })
      ),
    "invalid_policy",
    "preferred must be greater than or equal to minimum"
  );
  assertError(
    () =>
      decideVersion(
        policy({
          minimum: "1.0.0",
          preferred: "1.0.0-rc.1",
          blocked: []
        })
      ),
    "invalid_policy",
    "preferred must be greater than or equal to minimum"
  );
  assertError(
    () =>
      decideVersion(
        policy({
          minimum: "1.2.0",
          preferred: "1.2.0+aaa",
          blocked: ["1.2.0+bbb"]
        })
      ),
    "invalid_policy",
    "preferred must not be blocked"
  );
  assert.equal(
    decideVersion(
      policy({
        client: "1.2.1",
        minimum: "1.2.0",
        preferred: "1.3.0",
        blocked: ["0.9.0"]
      })
    ).decision,
    DECISION_WARN
  );
});

test("decisions do not read the clock or draw a random number", () => {
  const originalRandom = Math.random;
  const originalNow = Date.now;
  let randomCalls = 0;
  let nowCalls = 0;
  Math.random = () => {
    randomCalls += 1;
    return 0.5;
  };
  Date.now = () => {
    nowCalls += 1;
    return 0;
  };
  try {
    assertDecision(policy({ client: "1.2.5" }), DECISION_WARN, REASON_BELOW_PREFERRED, null);
    assert.equal(randomCalls, 0);
    assert.equal(nowCalls, 0);
  } finally {
    Math.random = originalRandom;
    Date.now = originalNow;
  }
});

function policy(overrides) {
  return {
    client: "1.4.2",
    minimum: "1.2.0",
    preferred: "1.4.0",
    blocked: ["1.3.1"],
    ...overrides
  };
}

function assertDecision(input, decision, reason, matched) {
  const result = decideVersion(input);
  assert.deepEqual(result, {
    decision,
    reason,
    client: input.client,
    minimum: input.minimum,
    preferred: input.preferred,
    matched
  });
}
