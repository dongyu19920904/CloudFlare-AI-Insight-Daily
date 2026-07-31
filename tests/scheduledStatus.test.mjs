import test from "node:test";
import assert from "node:assert/strict";

import {
  buildScheduledProgressStatus,
  getScheduledStatusKey,
  getScheduledStatusKeys,
  inferScheduledOutcome,
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

test("buildScheduledProgressStatus keeps the existing schema and clamps progress", () => {
  assert.deepEqual(
    buildScheduledProgressStatus(
      { mode: "daily", date: "2026-07-31", startedAt: "start" },
      "generating",
      { progress: 140, selectedItems: 20 },
      "phase-time"
    ),
    {
      mode: "daily",
      date: "2026-07-31",
      startedAt: "start",
      progress: 100,
      selectedItems: 20,
      state: "running",
      phase: "generating",
      phaseAt: "phase-time",
    }
  );
});

test("inferScheduledOutcome distinguishes generated content from published content", () => {
  assert.deepEqual(
    inferScheduledOutcome("daily", {
      dailyGenerated: true,
      dailyValidationPassed: false,
      dailyPublished: false,
    }),
    {
      outcome: "not-published",
      published: false,
      taskOutcomes: [
        { task: "daily", outcome: "not-published", published: false },
      ],
    }
  );

  assert.equal(
    inferScheduledOutcome("opportunity", {
      opportunityGenerated: true,
      opportunityValidationPassed: true,
      opportunityPublished: true,
    }).outcome,
    "published"
  );
});

test("inferScheduledOutcome reports a partial combined run", () => {
  const result = inferScheduledOutcome("all", {
    daily: { dailyGenerated: true, dailyPublished: true },
    opportunity: {
      opportunityGenerated: true,
      opportunityValidationPassed: false,
      opportunityPublished: false,
    },
    accountOpportunity: {
      accountOpportunityGenerated: true,
      accountOpportunityPublished: true,
    },
  });

  assert.equal(result.outcome, "partial");
  assert.equal(result.published, true);
});
