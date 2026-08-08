import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { runIsolatedAccountOpportunity } from "../src/accountOpportunityIsolation.js";

test("account opportunity failures stay isolated from combined daily runs", async () => {
  const result = await runIsolatedAccountOpportunity(
    async () => {
      throw new Error("account output failed validation");
    },
    "2026-08-05",
    "test combined run"
  );

  assert.deepEqual(result, {
    date: "2026-08-05",
    mode: "account-opportunity",
    accountOpportunityPublished: false,
    accountOpportunityIsolatedFailure: true,
    error: "account output failed validation",
  });
});

test("account recovery workflow treats a quality skip as an intentional outcome", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/ensure-daily-account-opportunity.yml", import.meta.url),
    "utf8"
  );

  assert.match(workflow, /id:\s*trigger/);
  assert.match(workflow, /accountOpportunityQualitySkipped/);
  assert.match(workflow, /quality_skipped=true/);
  assert.match(
    workflow,
    /steps\.trigger\.outputs\.quality_skipped != 'true'/
  );
});
