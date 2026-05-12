import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyHomeRepairContent, extractFrontMatterField } from "../src/dailyHomeRepair.js";

test("extractFrontMatterField reads quoted and unquoted front matter values", () => {
  assert.equal(extractFrontMatterField('---\ntitle: "AI Daily"\n---\n', "title"), "AI Daily");
  assert.equal(extractFrontMatterField("---\nnext: /2026-05/2026-05-12\n---\n", "next"), "/2026-05/2026-05-12");
  assert.equal(extractFrontMatterField("---\n---\n", "title"), "");
});

test("buildDailyHomeRepairContent repoints the home page from an existing daily page", () => {
  const existingHomeContent = `---
linkTitle: AI Daily
title: Old Daily
breadcrumbs: false
next: /2026-05/2026-05-11
---

Old body`;

  const dailyPageContent = `---
linkTitle: 05-12 Daily
title: AI Daily 2026-05-12
weight: 20
---

## Today

Current page body`;

  const repaired = buildDailyHomeRepairContent(existingHomeContent, dailyPageContent, "2026-05-12");

  assert.match(repaired, /^next: \/2026-05\/2026-05-12$/m);
  assert.match(repaired, /^title: AI Daily 2026-05-12$/m);
  assert.match(repaired, /## Today/);
  assert.match(repaired, /Current page body/);
  assert.doesNotMatch(repaired, /Old body/);
});
