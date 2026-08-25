import test from "node:test";
import assert from "node:assert/strict";

import { getSystemPromptAiOpportunity } from "../src/prompt/aiOpportunityPrompt.js";

test("getSystemPromptAiOpportunity defines a source-backed actionable opportunity editor", () => {
  const prompt = getSystemPromptAiOpportunity("2026-08-03", "### 当前业务");

  assert.match(prompt, /AI 商机产品主编/);
  assert.match(prompt, /低成本机会验证器/);
  assert.match(prompt, /官方发布、原项目、原作者/);
  assert.match(prompt, /社交信息只能发现线索/);
  assert.match(prompt, /先有真实信号，再推导可测试的商机/);
  assert.match(prompt, /先替读者找出今天能试的最小交付/);
  assert.match(prompt, /可以证明「有人公开展示或报告了这个场景」/);
  assert.match(prompt, /不得仅因缺少官方或付费证据把所有合格候选改写成/);
  assert.match(prompt, /绝不为了完整栏目凑数/);
});

test("getSystemPromptAiOpportunity asks for actionable 48-hour validation and stop conditions", () => {
  const prompt = getSystemPromptAiOpportunity("2026-08-03", "### 当前业务");

  assert.match(prompt, /48 小时最低成本验证/);
  assert.match(prompt, /目标鱼塘/);
  assert.match(prompt, /最小可验收交付/);
  assert.match(prompt, /第一单/);
  assert.match(prompt, /复购或沉淀资产/);
  assert.match(prompt, /停止条件/);
  assert.match(prompt, /必须先产生 1 个可展示样品/);
  assert.match(prompt, /单纯访谈、收藏项目、转述 README 不算完整验证/);
  assert.match(prompt, /发帖或录屏必须同时写清要观察什么反馈/);
});

test("getSystemPromptAiOpportunity restores productized pre-August editorial behavior", () => {
  const prompt = getSystemPromptAiOpportunity("2026-08-03", "### 当前业务");

  assert.match(prompt, /你负责排序和商品化/);
  assert.match(prompt, /必须输出恰好 1 个「今日主推」和至少 1 个「本周小试」/);
  assert.match(prompt, /优先把能形成可验收结果的候选放进「今日主推」/);
  assert.match(prompt, /不得让只有媒体或社交转述的候选排在它前面/);
  assert.match(prompt, /可展示的商品雏形/);
  assert.match(prompt, /2-4 项交付内容/);
  assert.match(prompt, /买家可检查的验收结果/);
  assert.match(prompt, /不夸张的测试标题或邀约句/);
  assert.match(prompt, /访谈可以跟在样品之后，不能成为唯一动作/);
  assert.match(prompt, /本节至少写 1 个小试，不得省略/);
});

test("getSystemPromptAiOpportunity keeps the concise publication structure", () => {
  const prompt = getSystemPromptAiOpportunity("2026-08-03", "### 当前业务");

  assert.match(prompt, /正文不得再输出一级标题/);
  assert.match(prompt, /- \*\*直接答案：\*\*/);
  assert.match(prompt, /## 直接结论/);
  assert.match(prompt, /## 今日主推/);
  assert.match(prompt, /## 本周小试/);
  assert.match(prompt, /## 今天别碰/);
  assert.match(prompt, /## 今日三步/);
  assert.match(prompt, /可验证信号/);
  assert.match(prompt, /证据与可信度/);
  assert.match(prompt, /第一单与复购/);
  assert.match(prompt, /风险与停止/);
  assert.match(prompt, /商业模式和交付类型用于提醒当天做出差异/);
  assert.match(prompt, /今日三步必须恰好 3 个一级列表项/);
  assert.match(prompt, /每项只有一个完整句子且不超过 80 个中文字符/);
  assert.doesNotMatch(prompt, /## 地图感/);
  assert.doesNotMatch(prompt, /配图建议/);
  assert.doesNotMatch(prompt, /今天就能发的文案/);
});

test("getSystemPromptAiOpportunity aligns headings, keywords, and evidence links with the daily reader", () => {
  const prompt = getSystemPromptAiOpportunity("2026-08-03", "### 当前业务");

  assert.match(prompt, /三级机会标题必须是纯文本/);
  assert.match(prompt, /不能把来源链接塞进标题/);
  assert.match(prompt, /第一句用粗体写最影响决策的关键判断/);
  assert.match(prompt, /额外加粗 2-4 个真正影响决策的短关键词/);
  assert.match(prompt, /链接负责可核验事实/);
  assert.match(prompt, /不写「原文」「点击这里」/);
});

test("getSystemPromptAiOpportunity forbids forced account resale and invented claims", () => {
  const prompt = getSystemPromptAiOpportunity("2026-08-03", "### 当前业务");

  assert.match(prompt, /不默认卖账号/);
  assert.match(prompt, /不默认挂闲鱼/);
  assert.match(prompt, /禁止虚构销量、利润率/);
  assert.match(prompt, /不要生成 aivora\.cn/);
  assert.match(prompt, /不得补写候选没有支持的事实/);
  assert.match(prompt, /鱼塘与笨办法.+待验证假设/s);
  assert.match(prompt, /不能把用户行为、痛点频率或市场缺口当作已确认事实/);
  assert.match(prompt, /验证多工具配置包有没有人要/);
  assert.match(prompt, /不要写「帮反复配置工具的开发者」/);
  assert.match(prompt, /本次候选输入未提供 \/ 未提取到/);
  assert.match(prompt, /零付费证据/);
  assert.match(prompt, /只有媒体或融资信息、无原项目 \/ 产品演示/);
  assert.match(prompt, /不能直接推导「无授权风险」「无合规风险」/);
  assert.match(prompt, /共同烦恼 \/ 共同痛点 \/ 共同问题 \/ 共同需求/);
  assert.match(prompt, /无已知商标 \/ 内容限制/);
  assert.match(prompt, /同一个来源 URL 在同一条机会里只能出现一次/);
});

test("getSystemPromptAiOpportunity keeps observation days honest", () => {
  const prompt = getSystemPromptAiOpportunity("2026-08-08", "### 当前业务");

  assert.match(prompt, /发布模式: 观察/);
  assert.match(prompt, /今天没有新的差异化商机，不凑数/);
  assert.match(prompt, /尚不进入成交阶段/);
  assert.match(prompt, /不得把它写成新机会、上架建议或已确认需求/);
  assert.match(prompt, /只有候选明确含「发布模式: 观察」时/);
  assert.match(prompt, /本稿就不是观察稿/);
  assert.match(prompt, /不得把「没有官方证据」误写成「什么都不能做」/);
});
