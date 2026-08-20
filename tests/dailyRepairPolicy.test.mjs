import test from "node:test";
import assert from "node:assert/strict";

import { shouldAdoptDailyRepair } from "../src/dailyRepairPolicy.js";

test("daily repair never replaces a draft with an invalid repair", () => {
  assert.equal(shouldAdoptDailyRepair({
    initialPassed: false,
    repairedPassed: false,
    initialQualityWarningCount: 4,
    repairedQualityWarningCount: 2,
  }), false);
});

test("daily repair adopts a valid repair when it fixes safety or quality", () => {
  assert.equal(shouldAdoptDailyRepair({
    initialPassed: false,
    repairedPassed: true,
    initialQualityWarningCount: 2,
    repairedQualityWarningCount: 2,
  }), true);
  assert.equal(shouldAdoptDailyRepair({
    initialPassed: true,
    repairedPassed: true,
    initialQualityWarningCount: 3,
    repairedQualityWarningCount: 1,
  }), true);
});

test("daily repair adopts a valid draft that moves closer to the TOP target", () => {
  assert.equal(shouldAdoptDailyRepair({
    initialPassed: true,
    repairedPassed: true,
    initialQualityWarningCount: 2,
    repairedQualityWarningCount: 2,
    initialTopItemCount: 6,
    repairedTopItemCount: 9,
    targetTopItemCount: 10,
  }), true);
  assert.equal(shouldAdoptDailyRepair({
    initialPassed: true,
    repairedPassed: true,
    initialQualityWarningCount: 1,
    repairedQualityWarningCount: 1,
    initialTopItemCount: 10,
    repairedTopItemCount: 11,
    targetTopItemCount: 10,
  }), false);
});
