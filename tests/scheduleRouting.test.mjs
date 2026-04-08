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
  DAILY_BACKUP_CRON_SCHEDULE: "12 1 * * *",
  OPPORTUNITY_BACKUP_CRON_SCHEDULE: "32 1 * * *",
  ACCOUNT_OPPORTUNITY_BACKUP_CRON_SCHEDULE: "2 2 * * *",
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

test("resolveScheduledModeFromEvent maps the daily backup cron to daily-backup", () => {
  const mode = resolveScheduledModeFromEvent(
    {
      cron: "12 1 * * *",
      scheduledTime: Date.parse("2026-03-28T01:12:00.000Z"),
    },
    env
  );

  assert.equal(mode, "daily-backup");
});

test("resolveScheduledModeFromEvent maps the opportunity backup cron to opportunity-backup", () => {
  const mode = resolveScheduledModeFromEvent(
    {
      cron: "32 1 * * *",
      scheduledTime: Date.parse("2026-03-28T01:32:00.000Z"),
    },
    env
  );

  assert.equal(mode, "opportunity-backup");
});

test("resolveScheduledModeFromEvent maps the account backup cron to account-opportunity-backup", () => {
  const mode = resolveScheduledModeFromEvent(
    {
      cron: "2 2 * * *",
      scheduledTime: Date.parse("2026-03-28T02:02:00.000Z"),
    },
    env
  );

  assert.equal(mode, "account-opportunity-backup");
});
