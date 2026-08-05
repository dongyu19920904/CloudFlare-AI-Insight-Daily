import assert from "node:assert/strict";
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
