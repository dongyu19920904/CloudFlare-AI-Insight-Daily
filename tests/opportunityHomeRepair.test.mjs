import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAccountOpportunityHomeRepairContent,
  buildOpportunityHomeRepairContent,
} from "../src/opportunityHomeRepair.js";

test("buildOpportunityHomeRepairContent repoints opportunity home from an existing page", () => {
  const existingHomeContent = `---
linkTitle: AI Opportunity
title: Old Opportunity 2026/6/21
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

  assert.match(repaired, /^title: New Opportunity 2026\/6\/22$/m);
  assert.match(repaired, /^next: \/opportunity\/2026-06\/2026-06-22$/m);
  assert.match(repaired, /## New opportunity body/);
  assert.doesNotMatch(repaired, /Old opportunity body/);
});

test("buildAccountOpportunityHomeRepairContent repoints account opportunity home from an existing page", () => {
  const existingHomeContent = `---
linkTitle: AI Account Opportunity
title: Old Account Opportunity 2026/6/21
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

  assert.match(repaired, /^title: New Account Opportunity 2026\/6\/22$/m);
  assert.match(repaired, /^next: \/account-opportunity\/2026-06\/2026-06-22$/m);
  assert.match(repaired, /## New account opportunity body/);
  assert.doesNotMatch(repaired, /Old account opportunity body/);
});
