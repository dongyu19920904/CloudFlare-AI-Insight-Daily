import test from "node:test";
import assert from "node:assert/strict";

import {
  getSharedDailyWritingKernel,
  getSharedOpportunityWritingKernel,
} from "../src/prompt/sharedWritingKernel.js";

test("getSharedDailyWritingKernel exposes the reusable daily writing style", () => {
  const kernel = getSharedDailyWritingKernel();

  assert.match(kernel, /说人话/);
  assert.match(kernel, /先给结果，再补原因/);
  assert.match(kernel, /先给画面，再补概念/);
  assert.match(kernel, /像朋友聊天/);
  assert.match(kernel, /长短句交替/);
  assert.match(kernel, /展示，而不是解释/);
  assert.match(kernel, /素材普通也要写成成品/);
});

test("getSharedOpportunityWritingKernel adapts the daily style to money-making content", () => {
  const kernel = getSharedOpportunityWritingKernel();

  assert.match(kernel, /像日报，不像表单/);
  assert.match(kernel, /不是在填系统字段/);
  assert.match(kernel, /先替读者做判断/);
  assert.match(kernel, /把热闹翻译成小白能做的小机会/);
  assert.match(kernel, /先写买家今天为什么会心动/);
  assert.match(kernel, /少一点卖货腔/);
  assert.match(kernel, /轻微共情/);
  assert.match(kernel, /标题要有钩子/);
  assert.match(kernel, /可以单独截图转发/);
  assert.match(kernel, /像朋友圈转发导语/);
  assert.match(kernel, /“我也能试一下”/);
});
