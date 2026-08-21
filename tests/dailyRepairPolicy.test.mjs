import test from "node:test";
import assert from "node:assert/strict";

import {
  scoreDailyQualityWarnings,
  shouldAdoptDailyRepair,
} from "../src/dailyRepairPolicy.js";

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

test("daily repair compares warning severity when warning categories stay the same", () => {
  const initialWarnings = [
    "Daily professional sections are below target: expected 3, got 2",
    "Daily industry section is below target: expected 1, got 0",
    "Daily TOP items have too few short highlights: 7",
    "Daily TOP items are too sparse for quick reading: 6",
  ];
  const repairedWarnings = [
    "Daily professional sections are below target: expected 3, got 2",
    "Daily industry section is below target: expected 1, got 0",
    "Daily TOP items have too few short highlights: 7",
    "Daily TOP items are too sparse for quick reading: 2",
  ];

  assert.ok(
    scoreDailyQualityWarnings(repairedWarnings) < scoreDailyQualityWarnings(initialWarnings)
  );
  assert.equal(shouldAdoptDailyRepair({
    initialPassed: true,
    repairedPassed: true,
    initialQualityWarningCount: initialWarnings.length,
    repairedQualityWarningCount: repairedWarnings.length,
    initialQualityWarnings: initialWarnings,
    repairedQualityWarnings: repairedWarnings,
    initialTopItemCount: 10,
    repairedTopItemCount: 10,
    targetTopItemCount: 10,
  }), true);
  assert.equal(shouldAdoptDailyRepair({
    initialPassed: true,
    repairedPassed: true,
    initialQualityWarnings: repairedWarnings,
    repairedQualityWarnings: initialWarnings,
    initialTopItemCount: 10,
    repairedTopItemCount: 10,
    targetTopItemCount: 10,
  }), false);
});

test("daily repair does not trade fuller TOP coverage for worse writing quality", () => {
  assert.equal(shouldAdoptDailyRepair({
    initialPassed: true,
    repairedPassed: true,
    initialQualityWarnings: ["Daily TOP items are too sparse for quick reading: 2"],
    repairedQualityWarnings: ["Daily TOP items are too sparse for quick reading: 6"],
    initialTopItemCount: 8,
    repairedTopItemCount: 10,
    targetTopItemCount: 10,
  }), false);
});
