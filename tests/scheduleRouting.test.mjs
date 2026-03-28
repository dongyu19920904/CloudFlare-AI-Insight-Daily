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
