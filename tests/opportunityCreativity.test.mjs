import test from "node:test";
import assert from "node:assert/strict";

import { buildDailyCreativityBrief, pickDailyCreativityModes } from "../src/opportunityCreativity.js";
import { opportunityPlaybook } from "../src/opportunityPlaybook.js";
import { accountOpportunityPlaybook } from "../src/accountOpportunityPlaybook.js";

test("pickDailyCreativityModes returns stable distinct modes for the same day", () => {
  const first = pickDailyCreativityModes(opportunityPlaybook, "2026-04-07");
  const second = pickDailyCreativityModes(opportunityPlaybook, "2026-04-07");

  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  assert.equal(new Set(first.map((mode) => mode.id)).size, 3);
});

test("buildDailyCreativityBrief balances imagination with same-day actionability", () => {
  const brief = buildDailyCreativityBrief(accountOpportunityPlaybook, "2026-04-07", {
    issueLabel: "AI账号商机",
    sectionLabels: ["今日主推", "平替机会"],
  });

  assert.match(brief, /今日创意卖法模式/);
  assert.match(brief, /有点反常识|异想天开/);
  assert.match(brief, /今晚先试|今天就能先试挂|今天就能试卖/);
  assert.match(brief, /今日主推 和 平替机会|今日主推.*平替机会/);
});
