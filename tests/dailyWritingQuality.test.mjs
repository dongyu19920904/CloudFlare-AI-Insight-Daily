import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeDailyPresentationQuality,
  analyzeDailyReadability,
  collectDailyWritingStyleWarnings,
} from "../src/dailyWritingQuality.js";

test("daily style audit ignores normal Markdown structure, colons, and link targets", () => {
  const warnings = collectDailyWritingStyleWarnings(`---
title: 爱窝啦 AI 日报
canonical: https://news.aivora.cn/2026-08/2026-08-06/
---

### Motionly：一句话生成动效项目文件

**动效文件可以继续编辑。** [Motionly 项目说明](https://example.com:443/motionly)列出了当前能力。

![Motionly：编辑器界面](https://example.com/image.png "Motionly：编辑器界面")
`);

  assert.deepEqual(warnings, []);
});

test("daily presentation audit flags generic source labels, sparse copy, and weak highlights", () => {
  const markdown = `
## **🔥 今日焦点 TOP 10**

### 1. 模型开始主动回应画面变化

**模型会主动开口。** [实测推文](https://x.com/dev/status/1)展示了交互。今天可以先看演示。

### 2. 视频模型增加原生声音

**声音一起生成。** [AIBase 整理的公告](https://example.com/news-2)介绍了功能。开发者可以先核对限制。
`;

  const stats = analyzeDailyPresentationQuality(markdown);
  const warnings = collectDailyWritingStyleWarnings(markdown);

  assert.equal(stats.genericSourceLinkCount, 2);
  assert.equal(stats.awkwardFactLinkCount, 1);
  assert.equal(stats.underHighlightedItemCount, 2);
  assert.equal(stats.sparseItemCount, 2);
  assert.match(warnings.join("\n"), /generic source-only link labels/);
  assert.match(warnings.join("\n"), /too few short highlights/);
  assert.match(warnings.join("\n"), /too sparse for quick reading/);
});

test("daily presentation audit accepts natural fact links and three concise highlights", () => {
  const markdown = `
## **🔥 今日焦点 TOP 10**

### 1. 模型开始主动回应画面变化

**模型会主动开口。** 开发者的演示显示，[画面状态变化会直接触发模型回应](https://x.com/dev/status/1)。它还能识别页面里的 **关键操作**。首轮测试覆盖了 **三类任务**。演示目前只证明了单次操作，稳定性仍要另测。今天可以先拿重复表单做一次小范围测试。
`;

  assert.deepEqual(analyzeDailyPresentationQuality(markdown), {
    topItemCount: 1,
    genericSourceLinkCount: 0,
    awkwardFactLinkCount: 0,
    underHighlightedItemCount: 0,
    overHighlightedItemCount: 0,
    sparseItemCount: 0,
  });
  assert.deepEqual(collectDailyWritingStyleWarnings(markdown), []);
});

test("daily presentation audit flags author-attribution-only link labels", () => {
  const markdown = `
## **🔥 今日焦点 TOP 10**

### 1. Cursor 推出代码托管平台 Origin

**Origin 正式上线。** [宝玉整理的技术细节](https://x.com/dev/status/2)显示，单仓库达到每秒 **22.6 次提交**，全球同步低于 **400 毫秒**。多 Agent 团队可以先用测试仓库验证。
`;

  const stats = analyzeDailyPresentationQuality(markdown);
  const warnings = collectDailyWritingStyleWarnings(markdown);

  assert.equal(stats.genericSourceLinkCount, 1);
  assert.match(warnings.join("\n"), /generic source-only link labels/);
});

test("daily presentation audit flags source-led and overlong fact links", () => {
  const markdown = `
## **🔥 今日焦点 TOP 10**

### 1. 模型价格准备调整

**价格即将变化。** [AIBase 报道显示，某模型将在下周正式调整 API 调用价格](https://example.com/1)。开发者应先核对账单。当前变化涉及 **三个档位**。正式价格仍以官方页面为准。

### 2. 编程工具加入新模式

**新模式已经开放。** 团队演示了[这项能力如何在复杂代码仓库中自动拆解任务、连续完成多步修改、验证结果并生成审查报告](https://example.com/2)。测试覆盖 **两个仓库**。稳定性仍要继续观察。
`;

  const stats = analyzeDailyPresentationQuality(markdown);
  const warnings = collectDailyWritingStyleWarnings(markdown);

  assert.equal(stats.awkwardFactLinkCount, 2);
  assert.match(warnings.join("\n"), /awkward source-led or overlong link anchors/);
});

test("daily style audit warns on repeated generic judgments without rejecting prose", () => {
  const warnings = collectDailyWritingStyleWarnings(`
这意味着开发者需要重新判断。值得关注的是工具已经更新。可以看出市场仍在变化。
这是一个值得验证的信号。这是一个值得测试的机会。
对于开发者来说先试一次。对于设计师来说先看演示。对于团队来说先核对价格。
赋能业务并形成商业闭环。
`);

  assert.match(warnings.join("\n"), /generic judgment phrases/);
  assert.match(warnings.join("\n"), /这是一个值得/);
  assert.match(warnings.join("\n"), /对于\.\.\.来说/);
  assert.match(warnings.join("\n"), /model\/business jargon/);
});

test("daily readability audit reports long sentence density and semicolon chains", () => {
  const markdown = `
### 测试条目

**工具已经更新。** 这是一个包含产品名称、来源说明、精确数字、使用条件、适用人群、操作建议、后续风险、停止条件和官方限制规则的很长句子，读者需要一直记住前半句才能理解后面的结论和全部限制条件。
这是第二个同样把多个事实、背景、影响、动作、适用对象、部署前提和售后风险压在一起的超长句子，虽然每个信息都有用，但是连续阅读时仍然缺少自然停顿、清楚的句法边界和可以稍作思考的位置，读者还要回头确认每个修饰语究竟对应哪个结论。
第一项判断；第二项判断；第三项判断；第四项判断；第五项判断。
`;

  const stats = analyzeDailyReadability(markdown);
  const warnings = collectDailyWritingStyleWarnings(markdown);

  assert.equal(stats.veryLongSentenceCount, 2);
  assert.equal(stats.semicolonCount, 4);
  assert.ok(stats.p90SentenceLength > 75);
  assert.match(warnings.join("\n"), /dense long sentences/);
  assert.match(warnings.join("\n"), /overuses semicolons/);
});

test("daily readability audit accepts short sentences with Markdown evidence links", () => {
  const markdown = `
### 模型价格下调

**调用成本降了。** [官方价格表](https://example.com/pricing)显示三款模型降价。最高降幅达到 **80%**。开发者可以重新计算现有任务成本。
`;

  assert.deepEqual(analyzeDailyReadability(markdown), {
    sentenceCount: 4,
    overlongSentenceCount: 0,
    veryLongSentenceCount: 0,
    p90SentenceLength: 15,
    maxSentenceLength: 15,
    semicolonCount: 0,
  });
  assert.deepEqual(collectDailyWritingStyleWarnings(markdown), []);
});
