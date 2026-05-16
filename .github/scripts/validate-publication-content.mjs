#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";

import {
  validateAccountOpportunityPublication,
  validateDailyPublication,
  validateOpportunityPublication,
} from "../../src/publishValidation.js";

function markdownValue(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

function appendSummary(markdown) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  appendFileSync(summaryPath, `${markdown}\n`, "utf-8");
}

function readGitHubContentResponse(filePath) {
  if (!filePath) {
    throw new Error("PAGE_RESPONSE_PATH is required");
  }

  const payload = JSON.parse(readFileSync(filePath, "utf-8"));
  if (payload.message && !payload.content) {
    throw new Error(`GitHub content API error: ${payload.message}`);
  }

  if (!payload.content) {
    throw new Error("GitHub content API response does not include content");
  }

  return Buffer.from(String(payload.content).replace(/\s+/g, ""), "base64").toString("utf-8");
}

function stripFrontMatter(markdown) {
  return String(markdown || "").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function extractDailySummary(markdown) {
  const body = stripFrontMatter(markdown);
  const match = body.match(/^##\s*\*\*今日摘要\*\*\s*([\s\S]*?)(?=^##\s+)/m);
  const section = match?.[1] || "";
  const summary = section.replace(/```[a-zA-Z0-9_-]*\s*|```/g, "").trim();
  return summary || body;
}

function parseMinimumTopItems() {
  const parsed = Number.parseInt(String(process.env.MINIMUM_TOP_ITEMS || "0"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function validateByMode(mode, markdown) {
  const body = stripFrontMatter(markdown);

  if (mode === "daily") {
    return validateDailyPublication({
      summaryText: extractDailySummary(markdown),
      pageMarkdown: body,
      minimumTopItems: parseMinimumTopItems(),
    });
  }

  if (mode === "opportunity") {
    return validateOpportunityPublication({ markdown: body });
  }

  if (mode === "account-opportunity") {
    return validateAccountOpportunityPublication({ markdown: body });
  }

  throw new Error(`Unsupported publication mode: ${mode || "<empty>"}`);
}

const mode = process.env.MODE || "";
const targetDate = process.env.TARGET_DATE || "";
const responsePath = process.env.PAGE_RESPONSE_PATH || "publication-page.json";

try {
  const markdown = readGitHubContentResponse(responsePath);
  const result = validateByMode(mode, markdown);
  const issues = result.issues || [];
  const warnings = result.warnings || [];
  const annotation = result.ok ? "::notice" : "::error";

  console.log(
    `${annotation} title=Publication content validation::mode=${mode}, date=${targetDate || "unknown"}, ok=${result.ok}, issues=${issues.length}, warnings=${warnings.length}`
  );

  for (const issue of issues) {
    console.log(`::error title=Publication content issue::${String(issue)}`);
  }
  for (const warning of warnings) {
    console.log(`::warning title=Publication content warning::${String(warning)}`);
  }

  appendSummary([
    `## Publication Content Validation: ${mode} ${targetDate}`.trim(),
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Mode | ${markdownValue(mode)} |`,
    `| Date | ${markdownValue(targetDate)} |`,
    `| OK | ${markdownValue(result.ok)} |`,
    `| Issues | ${markdownValue(issues.join(" | "))} |`,
    `| Warnings | ${markdownValue(warnings.join(" | "))} |`,
  ].join("\n"));

  if (!result.ok) {
    process.exit(1);
  }
} catch (error) {
  console.log(`::error title=Publication content validation failed::${String(error?.message || error)}`);
  appendSummary([
    `## Publication Content Validation: ${mode} ${targetDate}`.trim(),
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Mode | ${markdownValue(mode)} |`,
    `| Date | ${markdownValue(targetDate)} |`,
    `| OK | false |`,
    `| Error | ${markdownValue(error?.message || error)} |`,
  ].join("\n"));
  process.exit(1);
}