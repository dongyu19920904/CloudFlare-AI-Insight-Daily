import assert from "node:assert/strict";
import test from "node:test";

import { buildAccountOpportunityContextOptions } from "../src/accountOpportunityContext.js";

test("supply-driven merchant daily uses cached auxiliary sources and skips replay reads", () => {
  assert.deepEqual(
    buildAccountOpportunityContextOptions({ supplyDriven: true, dryRun: true }),
    {
      preferCachedData: true,
      cachedOnly: true,
      skipDailyReplay: true,
      loadOpportunityReplay: false,
      includeCurrentOpportunityReplay: false,
      skipSourceCacheWrite: true,
    },
  );
});

test("missing supply snapshot preserves the full legacy fallback context", () => {
  assert.deepEqual(
    buildAccountOpportunityContextOptions({ supplyDriven: false, dryRun: false }),
    {
      preferCachedData: true,
      cachedOnly: false,
      skipDailyReplay: false,
      loadOpportunityReplay: true,
      includeCurrentOpportunityReplay: true,
      skipSourceCacheWrite: false,
    },
  );
});
