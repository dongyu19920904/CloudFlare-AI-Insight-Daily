import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildAccountOpportunityHomeRepairContent,
  buildOpportunityHomeRepairContent,
} from "../src/opportunityHomeRepair.js";

test("buildOpportunityHomeRepairContent repoints opportunity home from an existing page", () => {
  const existingHomeContent = `---
linkTitle: AI Opportunity
title: AI Opportunity
breadcrumbs: false
description: "old"
cascade:
  type: docs
next: /opportunity/2026-06/2026-06-21
---

Old opportunity body`;

  const pageContent = `---
title: New Opportunity 2026/6/22
description: "new"
---

## New opportunity body`;

  const repaired = buildOpportunityHomeRepairContent(existingHomeContent, pageContent, "2026-06-22");

  assert.match(repaired, /^title: 爱窝啦 AI 商机$/m);
  assert.doesNotMatch(repaired, /^next:/m);
  assert.match(repaired, /^type: opportunity$/m);
  assert.doesNotMatch(repaired, /latest-opportunity/);
  assert.doesNotMatch(repaired, /## New opportunity body/);
  assert.doesNotMatch(repaired, /Old opportunity body/);
});

test("buildAccountOpportunityHomeRepairContent repoints account opportunity home from an existing page", () => {
  const existingHomeContent = `---
linkTitle: AI Account Opportunity
title: AI Account Opportunity
breadcrumbs: false
description: "old"
cascade:
  type: docs
next: /account-opportunity/2026-06/2026-06-21
---

Old account opportunity body`;

  const pageContent = `---
title: New Account Opportunity 2026/6/22
description: "new"
---

## New account opportunity body`;

  const repaired = buildAccountOpportunityHomeRepairContent(
    existingHomeContent,
    pageContent,
    "2026-06-22",
  );

  assert.match(repaired, /^title: AI Account Opportunity$/m);
  assert.match(repaired, /^type: account-opportunity$/m);
  assert.doesNotMatch(repaired, /^next:/m);
  assert.match(repaired, /\{\{< latest-account-opportunity >\}\}/);
  assert.doesNotMatch(repaired, /## New account opportunity body/);
  assert.doesNotMatch(repaired, /Old account opportunity body/);
});

test("opportunity recovery workflow accepts the dynamic latest-entry section home", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/ensure-daily-opportunity.yml", import.meta.url),
    "utf8",
  );

  assert.equal((workflow.match(/dynamic_latest = bool/g) || []).length, 3);
  assert.equal((workflow.match(/dynamic_latest or shortcode_current or actual == expected/g) || []).length, 2);
  assert.match(workflow, /if not dynamic_latest and .*actual != expected:/);
});

test("opportunity repair keeps the template-owned H1 and constrains the action list", () => {
  const scheduledHandler = readFileSync(
    new URL("../src/handlers/scheduled.js", import.meta.url),
    "utf8",
  );

  assert.match(scheduledHandler, /页面模板已经提供唯一 H1；正文不得输出一级标题/);
  assert.match(scheduledHandler, /今日三步必须恰好 3 个一级列表项/);
  assert.doesNotMatch(scheduledHandler, /必须包含：# 今日 AI 商机/);
});

test("general opportunity publication keeps the strong evidence gate", () => {
  const scheduledHandler = readFileSync(
    new URL("../src/handlers/scheduled.js", import.meta.url),
    "utf8",
  );
  const finalAssessment = scheduledHandler.match(
    /const candidateAssessment = buildOpportunityCandidateAssessment\([\s\S]*?supplementalEvidenceBySourceUrl:[\s\S]*?\n\s*}\n\s*\);/,
  )?.[0] || "";

  assert.match(finalAssessment, /requireStrongEvidence: true/);
  assert.match(finalAssessment, /allowObservationFallback: false/);
});
