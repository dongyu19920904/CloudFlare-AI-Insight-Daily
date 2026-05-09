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
          promptTotalCandidateCount: 18,
          promptSelectedCounts: { news: 12, project: 1 },
          promptSelectionDiagnostics: {
            candidateCounts: { news: 15, project: 3 },
            selectedCounts: { news: 12, project: 1 },
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
  assert.match(summary, /Prompt candidate count \| 18/);
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
