import test from "node:test";
import assert from "node:assert/strict";

import {
  extractCronMinute,
  resolveScheduledModeFromEvent,
} from "../src/scheduleRouting.js";

const env = {
  DAILY_CRON_SCHEDULE: "0 1 * * *",
  OPPORTUNITY_CRON_SCHEDULE: "20 1 * * *",
  ACCOUNT_OPPORTUNITY_CRON_SCHEDULE: "50 1 * * *",
  BACKUP_CRON_SCHEDULE: "10 2 * * *",
};

test("extractCronMinute reads the first minute field from a standard cron expression", () => {
  assert.equal(extractCronMinute("0 1 * * *"), 0);
  assert.equal(extractCronMinute("20 1 * * *"), 20);
  assert.equal(extractCronMinute("50 1 * * *"), 50);
});

test("resolveScheduledModeFromEvent maps the shared cron's 01:00 UTC run to daily", () => {
  const mode = resolveScheduledModeFromEvent(
    {
      cron: "0,20,50 1 * * *",
      scheduledTime: Date.parse("2026-03-28T01:00:00.000Z"),
    },
    env
  );

  assert.equal(mode, "daily");
});

test("resolveScheduledModeFromEvent maps the shared cron's 01:20 UTC run to opportunity", () => {
  const mode = resolveScheduledModeFromEvent(
    {
      cron: "0,20,50 1 * * *",
      scheduledTime: Date.parse("2026-03-28T01:20:00.000Z"),
    },
    env
  );

  assert.equal(mode, "opportunity");
});

test("resolveScheduledModeFromEvent maps the shared cron's 01:50 UTC run to account-opportunity", () => {
  const mode = resolveScheduledModeFromEvent(
    {
      cron: "0,20,50 1 * * *",
      scheduledTime: Date.parse("2026-03-28T01:50:00.000Z"),
    },
    env
  );

  assert.equal(mode, "account-opportunity");
});

test("resolveScheduledModeFromEvent respects an explicit mode override", () => {
  const mode = resolveScheduledModeFromEvent(
    {
      cron: "0,20,50 1 * * *",
      scheduledTime: Date.parse("2026-03-28T01:00:00.000Z"),
    },
    env,
    "opportunity"
  );

  assert.equal(mode, "opportunity");
});

test("resolveScheduledModeFromEvent maps the backup cron to backup", () => {
  const mode = resolveScheduledModeFromEvent(
    {
      cron: "10 2 * * *",
      scheduledTime: Date.parse("2026-03-28T02:10:00.000Z"),
    },
    env
  );

  assert.equal(mode, "backup");
});

test("resolveScheduledModeFromEvent rehearsal for 2026-04-22 keeps every scheduled slot distinct", () => {
  const scenarios = [
    {
      cron: "0,20,50 1 * * *",
      scheduledTime: Date.parse("2026-04-22T01:00:00.000Z"),
      expected: "daily",
    },
    {
      cron: "0,20,50 1 * * *",
      scheduledTime: Date.parse("2026-04-22T01:20:00.000Z"),
      expected: "opportunity",
    },
    {
      cron: "0,20,50 1 * * *",
      scheduledTime: Date.parse("2026-04-22T01:50:00.000Z"),
      expected: "account-opportunity",
    },
    {
      cron: "10 2 * * *",
      scheduledTime: Date.parse("2026-04-22T02:10:00.000Z"),
      expected: "backup",
    },
  ];

  for (const scenario of scenarios) {
    assert.equal(
      resolveScheduledModeFromEvent(
        {
          cron: scenario.cron,
          scheduledTime: scenario.scheduledTime,
        },
        env
      ),
      scenario.expected
    );
  }
});
