import test from "node:test";
import assert from "node:assert/strict";

import {
  getScheduledStatusKey,
  getScheduledStatusKeys,
  storeScheduledRunStatus,
} from "../src/scheduledStatus.js";

test("getScheduledStatusKey builds stable current and dated keys", () => {
  assert.equal(getScheduledStatusKey("daily"), "scheduled-status:daily:current");
  assert.equal(
    getScheduledStatusKey("daily", "2026-05-09"),
    "scheduled-status:daily:2026-05-09"
  );
});

test("getScheduledStatusKeys can include a current alias for cron runs", () => {
  assert.deepEqual(getScheduledStatusKeys("daily", "2026-05-09"), [
    "scheduled-status:daily:2026-05-09",
  ]);
  assert.deepEqual(
    getScheduledStatusKeys("daily", "2026-05-09", {
      includeCurrentAlias: true,
    }),
    ["scheduled-status:daily:2026-05-09", "scheduled-status:daily:current"]
  );
});

test("storeScheduledRunStatus writes all requested status keys with ttl", async () => {
  const writes = [];
  const kv = {
    async put(key, value, options) {
      writes.push({ key, value: JSON.parse(value), options });
    },
  };

  await storeScheduledRunStatus(
    kv,
    "opportunity",
    "2026-05-09",
    { state: "success", mode: "opportunity" },
    { includeCurrentAlias: true, ttl: 123 }
  );

  assert.deepEqual(
    writes.map((write) => write.key),
    [
      "scheduled-status:opportunity:2026-05-09",
      "scheduled-status:opportunity:current",
    ]
  );
  assert.deepEqual(writes[0].value, {
    state: "success",
    mode: "opportunity",
  });
  assert.deepEqual(writes[0].options, { expirationTtl: 123 });
});
