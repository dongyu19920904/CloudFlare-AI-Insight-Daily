import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("summarize-worker-status flags stale running status without failing", () => {
  const dir = mkdtempSync(join(tmpdir(), "worker-status-summary-"));
  const statusPath = join(dir, "worker-status.json");
  const summaryPath = join(dir, "summary.md");

  writeFileSync(
    statusPath,
    JSON.stringify({
      success: true,
      statusKey: "scheduled-status:daily:2026-05-09",
      status: {
        state: "running",
        mode: "daily",
        date: "2026-05-09",
        startedAt: "2026-05-09T01:00:00.000Z",
        debug: {
          totalSourceItemCount: 24,
          sourceItemCounts: { news: 18, project: 3, socialMedia: 2, paper: 1 },
          sourceItemCountsAfterReplayFilter: { news: 15, project: 3, socialMedia: 2, paper: 1 },
          previousDayFilteredCounts: { news: 3, project: 0, socialMedia: 0, paper: 0 },
          promptTotalCandidateCount: 18,
          promptSelectedCounts: { news: 12, project: 1 },
          dailyFunFallbackInserted: false,
          dailyFunCandidateItems: 6,
          promptSelectionDiagnostics: {
            candidateCounts: { news: 15, project: 3 },
            selectedCounts: { news: 12, project: 1 },
            dailyFunCandidateCount: 6,
          },
        },
      },
    }),
    "utf-8"
  );

  const output = execFileSync(
    "python",
    [".github/scripts/summarize-worker-status.py"],
    {
      cwd: process.cwd(),
      encoding: "utf-8",
      env: {
        ...process.env,
        MODE: "daily",
        TARGET_DATE: "2026-05-09",
        STATUS_HTTP_CODE: "200",
        STATUS_RESPONSE_PATH: statusPath,
        GITHUB_STEP_SUMMARY: summaryPath,
        NOW_ISO: "2026-05-09T03:00:00.000Z",
      },
    }
  );

  assert.match(output, /::warning title=Worker status::/);
  assert.match(output, /freshness=possible stale running status/);

  const summary = readFileSync(summaryPath, "utf-8");
  assert.match(summary, /Freshness/);
  assert.match(summary, /possible stale running status/);
  assert.match(summary, /Status age \| 2 hours/);
  assert.match(summary, /Source item count \| 24/);
  assert.match(summary, /Source item counts \| \{"news":18,"project":3,"socialMedia":2,"paper":1\}/);
  assert.match(summary, /Previous-day filtered counts \| \{"news":3,"project":0,"socialMedia":0,"paper":0\}/);
  assert.match(summary, /Prompt candidate count \| 18/);
  assert.match(summary, /AI fun fallback inserted \| False/);
  assert.match(summary, /AI fun candidate items \| 6/);
  assert.match(summary, /AI fun candidate count \| 6/);
});

test("summarize-worker-status treats stale running status as notice when page is healthy", () => {
  const dir = mkdtempSync(join(tmpdir(), "worker-status-summary-"));
  const statusPath = join(dir, "worker-status.json");

  writeFileSync(
    statusPath,
    JSON.stringify({
      success: true,
      status: {
        state: "running",
        mode: "daily",
        date: "2026-05-09",
        startedAt: "2026-05-09T01:00:00.000Z",
      },
    }),
    "utf-8"
  );

  const output = execFileSync(
    "python",
    [".github/scripts/summarize-worker-status.py"],
    {
      cwd: process.cwd(),
      encoding: "utf-8",
      env: {
        ...process.env,
        MODE: "daily",
        TARGET_DATE: "2026-05-09",
        PAGE_HEALTH: "healthy",
        STATUS_HTTP_CODE: "200",
        STATUS_RESPONSE_PATH: statusPath,
        NOW_ISO: "2026-05-09T03:00:00.000Z",
      },
    }
  );

  assert.match(output, /::notice title=Worker status::/);
  assert.match(output, /freshness=stale running status, page already healthy/);
});

test("summarize-worker-status keeps healthy page notice focused on page state", () => {
  const dir = mkdtempSync(join(tmpdir(), "worker-status-summary-"));
  const statusPath = join(dir, "worker-status.json");
  const summaryPath = join(dir, "summary.md");

  writeFileSync(
    statusPath,
    JSON.stringify({
      success: true,
      statusKey: "scheduled-status:daily:2026-05-12",
      status: {
        state: "success",
        mode: "daily",
        date: "2026-05-12",
        finishedAt: "2026-05-12T10:00:00.000Z",
        debug: {
          dailyGenerated: true,
          dailyPublished: false,
          promptTotalCandidateCount: 34,
        },
      },
    }),
    "utf-8"
  );

  const output = execFileSync(
    "python",
    [".github/scripts/summarize-worker-status.py"],
    {
      cwd: process.cwd(),
      encoding: "utf-8",
      env: {
        ...process.env,
        MODE: "daily",
        TARGET_DATE: "2026-05-12",
        PAGE_HEALTH: "healthy",
        STATUS_HTTP_CODE: "200",
        STATUS_RESPONSE_PATH: statusPath,
        GITHUB_STEP_SUMMARY: summaryPath,
        NOW_ISO: "2026-05-12T10:05:00.000Z",
      },
    }
  );

  assert.match(output, /::notice title=Worker status::/);
  assert.match(output, /page=healthy/);
  assert.match(output, /state=success/);
  assert.match(output, /freshness=success/);
  assert.doesNotMatch(output, /published=False/);
  assert.doesNotMatch(output, /generated=True/);
  assert.doesNotMatch(output, /candidates=34/);

  const summary = readFileSync(summaryPath, "utf-8");
  assert.match(summary, /Page health \| healthy/);
  assert.match(summary, /Generated \| True/);
  assert.match(summary, /Published \| False/);
  assert.match(summary, /Prompt candidate count \| 34/);
});

test("summarize-worker-status treats error status as notice when page is healthy", () => {
  const dir = mkdtempSync(join(tmpdir(), "worker-status-summary-"));
  const statusPath = join(dir, "worker-status.json");
  const summaryPath = join(dir, "summary.md");

  writeFileSync(
    statusPath,
    JSON.stringify({
      success: true,
      statusKey: "scheduled-status:daily:2026-05-12",
      status: {
        state: "error",
        mode: "daily",
        date: "2026-05-12",
        finishedAt: "2026-05-12T04:00:00.000Z",
        error: "previous worker failure",
      },
    }),
    "utf-8"
  );

  const output = execFileSync(
    "python",
    [".github/scripts/summarize-worker-status.py"],
    {
      cwd: process.cwd(),
      encoding: "utf-8",
      env: {
        ...process.env,
        MODE: "daily",
        TARGET_DATE: "2026-05-12",
        PAGE_HEALTH: "healthy",
        STATUS_HTTP_CODE: "200",
        STATUS_RESPONSE_PATH: statusPath,
        GITHUB_STEP_SUMMARY: summaryPath,
        NOW_ISO: "2026-05-12T04:30:00.000Z",
      },
    }
  );

  assert.match(output, /::notice title=Worker status::/);
  assert.match(output, /state=error/);
  assert.match(output, /freshness=error status, page already healthy/);

  const summary = readFileSync(summaryPath, "utf-8");
  assert.match(summary, /Page health \| healthy/);
  assert.match(summary, /Error \| previous worker failure/);
});

test("summarize-worker-status downgrades stale mismatched error status when page is healthy", () => {
  const dir = mkdtempSync(join(tmpdir(), "worker-status-summary-"));
  const statusPath = join(dir, "worker-status.json");

  writeFileSync(
    statusPath,
    JSON.stringify({
      success: true,
      statusKey: "scheduled-status:daily:2026-05-10",
      status: {
        state: "error",
        mode: "daily",
        date: "2026-05-10",
        finishedAt: "2026-05-10T02:00:00.000Z",
        error: "old worker failure",
      },
    }),
    "utf-8"
  );

  const output = execFileSync(
    "python",
    [".github/scripts/summarize-worker-status.py"],
    {
      cwd: process.cwd(),
      encoding: "utf-8",
      env: {
        ...process.env,
        MODE: "daily",
        TARGET_DATE: "2026-05-12",
        PAGE_HEALTH: "healthy",
        STATUS_HTTP_CODE: "200",
        STATUS_RESPONSE_PATH: statusPath,
        NOW_ISO: "2026-05-12T04:30:00.000Z",
      },
    }
  );

  assert.match(output, /::notice title=Worker status::/);
  assert.match(output, /freshness=old error status, page already healthy/);
  assert.doesNotMatch(output, /does not match target/);
});