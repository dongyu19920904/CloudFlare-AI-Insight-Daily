import test from "node:test";
import assert from "node:assert/strict";

import { collectDailyWritingStyleWarnings } from "../src/dailyWritingQuality.js";

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
