import test from "node:test";
import assert from "node:assert/strict";

import { getSystemPromptSummarizationStepOne } from "../src/prompt/summarizationPromptStepZero.js";
import { getSystemPromptSummarizationStepThree } from "../src/prompt/summarizationPromptStepThree.js";

test("daily prompt uses the V3 topic structure without duplicating the summary", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-08-01");

  assert.match(prompt, /## \*\*🔥 今日焦点 TOP 6\*\*/);
  assert.match(prompt, /## \*\*⚡ 产品与功能更新\*\*/);
  assert.match(prompt, /## \*\*🧪 前沿研究与行业影响\*\*/);
  assert.match(prompt, /## \*\*⌘ 开源 TOP 项目\*\*/);
  assert.match(prompt, /## \*\*◉ 社媒精选\*\*/);
  assert.match(prompt, /至少输出上面四个专业栏目中的两个/);
  assert.match(prompt, /不要生成“今日摘要”“3分钟读懂今天”/);
  assert.doesNotMatch(prompt, /## \*\*📌 值得关注\*\*/);
  assert.doesNotMatch(prompt, /## \*\*🔮 AI趋势预测/);
});

test("daily prompt preserves date tolerance, dedupe, AI relevance, and GitHub safeguards", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-08-01");

  assert.match(prompt, /2026-08-01 当天素材/);
  assert.match(prompt, /前 48-60 小时/);
  assert.match(prompt, /同一 URL 只能出现一次/);
  assert.match(prompt, /纯手机、游戏主机、VPN、生活方式/);
  assert.match(prompt, /Source: GitHub Trending Daily/);
  assert.match(prompt, /最近 7 天/);
  assert.match(prompt, /GitHub Search/);
  assert.match(prompt, /今日焦点最多放 1 个 GitHub 项目/);
});

test("daily prompt rejects low-evidence promotions and requires factual media captions", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-08-01");

  assert.match(prompt, /Placement Hint: This is a low-evidence AI workflow pitch/);
  assert.match(prompt, /羊毛、优惠、代金券、免费额度、带货和强收益承诺/);
  assert.match(prompt, /Media References/);
  assert.match(prompt, /事实性短标题/);
  assert.match(prompt, /不要写 `image`、`图片`、`AI资讯图片`/);
  assert.match(prompt, /所有事实、数字、功能、价格和判断依据必须来自输入素材/);
});

test("daily prompt gives plain yellow conclusions and contextual cyan source links distinct roles", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-08-01");

  assert.match(prompt, /普通新闻、研究和社媒的三级标题必须是一句 14-30 个显示字符的关键结论/);
  assert.match(prompt, /开源标题保留 `owner\/repo`/);
  assert.match(prompt, /用途说明控制在 8-16 个显示字符/);
  assert.match(prompt, /不得包含 Markdown 链接/);
  assert.match(prompt, /正文不得以 Markdown 链接开头/);
  assert.match(prompt, /第二句或首段中部/);
  assert.match(prompt, /优先链接官方来源/);
  assert.match(prompt, /二次创作的关键结论句/);
  assert.match(prompt, /6-18 字的.*黄色短结论/);
  assert.match(prompt, /合计必须有 2-4 处黄色重点/);
  assert.match(prompt, /### 1\. 模型降价让开发者调用成本再松一截/);
  assert.match(prompt, /调用成本再降一截/);
  assert.match(prompt, /\[官方价格表列出的三款模型新费率\]\(URL\)/);
  assert.doesNotMatch(prompt, /### 1\. \[模型降价让开发者调用成本再松一截\]/);
});

test("AI fun remains source-driven and optional without blocking the daily", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-08-01");

  assert.match(prompt, /一个人 \+ 一个工具 \+ 一个动作 \+ 一个反常结果/);
  assert.match(prompt, /12-24 个中文字符/);
  assert.match(prompt, /Hook -> What -> Punchline/);
  assert.match(prompt, /至少两个真实细节/);
  assert.match(prompt, /写不出完整、有来源、有真实细节的趣闻时，省略整个栏目/);
  assert.match(prompt, /缺少趣闻不得影响其他栏目发布/);
  assert.match(prompt, /不靠“离谱、笑死、太抽象”充当笑点/);
});

test("daily prompt requires one current Aivora FAQ and forbids meta output", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-08-01");

  assert.match(prompt, /每天必须输出 1 条/);
  assert.match(prompt, /爱窝啦 Aivora/);
  assert.match(prompt, /主流 AI 账号、订阅选择和使用售后支持/);
  assert.match(prompt, /不要写成 AI 工具导航、官方体验入口或免注册聚合站/);
  assert.match(prompt, /不要把 GPT-4o 当成默认主推模型/);
  assert.match(prompt, /不要输出“素材不足”“无法生成”“请补充素材”/);
  assert.match(prompt, /只输出最终 Markdown 正文/);
});

test("summary prompt asks for three progressive sentences instead of parallel headlines", () => {
  const prompt = getSystemPromptSummarizationStepThree();

  assert.match(prompt, /大事件/);
  assert.match(prompt, /主线变化/);
  assert.match(prompt, /读者判断/);
  assert.match(prompt, /不能复述第一句/);
  assert.match(prompt, /不要写成三条并列新闻/);
  assert.match(prompt, /每行 24-44 个中文字符/);
  assert.match(prompt, /只输出 3 行纯文本/);
});
