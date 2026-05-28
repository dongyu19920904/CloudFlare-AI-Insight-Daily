import test from "node:test";
import assert from "node:assert/strict";

import { getSystemPromptSummarizationStepOne } from "../src/prompt/summarizationPromptStepZero.js";
import { getSystemPromptSummarizationStepThree } from "../src/prompt/summarizationPromptStepThree.js";

test("AI趣闻 prompt asks for people-first, lightly humorous observation instead of comment搬运", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-03-26");

  assert.match(prompt, /画龙点睛之笔/);
  assert.match(prompt, /90 后、00 后中文互联网用户/);
  assert.match(prompt, /AI 爱好者、程序员、独立开发者、产品经理/);
  assert.match(prompt, /Claude、ChatGPT、Cursor、Codex/);
  assert.match(prompt, /Prompt、Token、API、IDE、终端/);
  assert.match(prompt, /挑 1 条最有天然趣味点/);
  assert.match(prompt, /开发者实测、AI 编程、模型翻车/);
  assert.match(prompt, /一个人 \+ 一个工具 \+ 一个动作 \+ 一个反常结果/);
  assert.match(prompt, /不要选纯论文、融资、模型参数/);
  assert.match(prompt, /离谱、笑死、太抽象、降智/);
  assert.match(prompt, /标题文字必须二次创作/);
  assert.match(prompt, /绝对不要直接复制原始新闻标题、推文正文、项目名长句/);
  assert.match(prompt, /12-24 个中文字符/);
  assert.match(prompt, /像 TOP 10 一样先写结果、反差或熟悉场景/);
  assert.match(prompt, /2D 游戏也开始找 AI 做动作了/);
  assert.match(prompt, /Codex 连转格式这种小活也接了/);
  assert.match(prompt, /正文（100-180字）/);
  assert.match(prompt, /开头 Hook/);
  assert.match(prompt, /中间 What/);
  assert.match(prompt, /结尾 Punchline/);
  assert.match(prompt, /包袱句/);
  assert.match(prompt, /半夜改 bug、Cursor 开着、终端红一片/);
  assert.match(prompt, /Token 见底、API 又 429/);
  assert.match(prompt, /这条真正的新意是什么、为什么值得今天占一个坑/);
  assert.match(prompt, /普通程序员\/AI 用户身上，哪里好笑/);
  assert.match(prompt, /马三立式“冷面包袱”/);
  assert.match(prompt, /学结构，不学口音、不照搬台词/);
  assert.match(prompt, /至少写出 2 个真实细节/);
  assert.match(prompt, /不要只复述标题或原文摘要/);
  assert.match(prompt, /工位同事、实习生、装机师傅/);
  assert.match(prompt, /以前人等编译，现在人和 AI 一起等报错/);
  assert.match(prompt, /工具很聪明，但人还是得收拾现场/);
  assert.match(prompt, /不要写成科技评论/);
  assert.match(prompt, /不要用“笑死”“太抽象”“离谱了”“绷不住了”当笑点/);
  assert.match(prompt, /不要输出写作过程或编辑说明/);
  assert.match(prompt, /这条小消息不能靠硬编段子撑起来/);
  assert.match(prompt, /适合当今天的轻量观察/);
  assert.match(prompt, /不要把网友评论当正文主体/);
  assert.match(prompt, /如果素材里有 `\[图片: \.\.\.\]`，\*\*必须\*\*放在该条末尾/);
  assert.match(prompt, /不要写成吐槽贴/);
  assert.match(prompt, /不要照搬任何特定演员的口音/);
  assert.match(prompt, /最后一段\/最后一句必须有包袱/);
  assert.match(prompt, /如果最后一句删掉后正文没有损失/);
  assert.match(prompt, /AI趣闻优先输出 1 条完整趣闻/);
  assert.match(prompt, /省略整个 AI趣闻栏目/);
  assert.match(prompt, /不要只保留空标题/);
  assert.doesNotMatch(prompt, /如果当天没有合适的趣闻，可以不写这一栏/);
});

test("daily prompt forbids meta commentary and requires a FAQ every day", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-03-27");

  assert.match(prompt, /不要输出任何元话术/);
  assert.match(prompt, /不要写“我看了一下今天的素材”/);
  assert.match(prompt, /今天新闻不够/);
  assert.match(prompt, /每天必须输出 1 条 FAQ/);
  assert.doesNotMatch(prompt, /可以省略此板块/);
});

test("daily prompt relaxes Top 10 backfill window for early-morning reports", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-03-27");

  assert.match(prompt, /允许补充前 2 天内/);
  assert.match(prompt, /只要没有与昨日日报明显重复/);
  assert.match(prompt, /如果当天是早上批次|早上 9 点|早间更新/);
  assert.match(prompt, /如果按 80 分筛完仍不足 10 条/);
  assert.match(prompt, /逐步放宽到 70 分|放宽到 70 分/);
});

test("daily prompt sharpens one-liner, watchlist, trend, and FAQ sections without changing structure", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-03-27");

  assert.match(prompt, /今天最该记住的判断/);
  assert.match(prompt, /趋势词、冲突词、变化词/);
  assert.match(prompt, /这条真正的新意是什么/);
  assert.match(prompt, /为什么值得多看一眼/);
  assert.match(prompt, /基于今天信号做近未来推演/);
  assert.match(prompt, /像真人答疑/);
});

test("daily prompt requires numbered Top items, section exclusivity, and GitHub project exposure", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-04-07");

  assert.match(prompt, /### 1\./);
  assert.match(prompt, /同一条内容只能出现在一个栏目|同一链接只允许出现一次/);
  assert.match(prompt, /已用清单/);
  assert.match(prompt, /不要为了凑数复用 TOP 里的同一条新闻/);
  assert.match(prompt, /图片优先但不能牺牲相关性/);
  assert.match(prompt, /明显不属于 AI 行业的新闻/);
  assert.match(prompt, /TOP 10 必须是 AI 直接主题/);
  assert.match(prompt, /任天堂\/Switch 涨价/);
  assert.match(prompt, /福利\/羊毛硬规则/);
  assert.match(prompt, /不能进入 TOP 10/);
  assert.match(prompt, /Placement Hint: This is a welfare\/freebie item/);
  assert.match(prompt, /GitHub|Project Name|开源项目/);
  assert.match(prompt, /Source: GitHub Trending Daily/);
  assert.match(prompt, /TOP 里的 GitHub 项目只能来自当天日榜/);
  assert.match(prompt, /来自 `GitHub Search`/);
  assert.match(prompt, /## \*\*📌 值得关注\*\*/);
  assert.match(prompt, /不要在标题里写/);
  assert.doesNotMatch(prompt, /值得关注（\d/);
});

test("daily prompt keeps FAQ model names current", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-05-10");

  assert.match(prompt, /GPT-5\.5|GPT-5 系列|GPT Pro/);
  assert.match(prompt, /不要再把 GPT-4o 当成默认主推模型/);
});

test("summary prompt asks for a three-line progression instead of three parallel headlines", () => {
  const prompt = getSystemPromptSummarizationStepThree();

  assert.match(prompt, /为什么值得在意/);
  assert.match(prompt, /今天发生了什么大事/);
  assert.match(prompt, /这件事背后说明了什么变化/);
  assert.match(prompt, /这对读者意味着什么/);
  assert.match(prompt, /不要把 3 行都写成并列新闻播报/);
  assert.match(prompt, /bottom line/);
});
