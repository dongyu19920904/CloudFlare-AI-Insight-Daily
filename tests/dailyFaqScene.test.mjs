import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildStandaloneDailyFaqPromptInput, normalizeStandaloneDailyFaqSection,
  insertStandaloneDailyFaq, withDailyFaqDeadline, getStandaloneDailyFaqSystemPrompt } from '../src/dailyStandaloneFaq.js';
import { finalizeDailyShopFaq } from '../src/dailyShopFaq.js';

const sourceUrl = 'https://github.com/example/skills';
const sourceText = `Project Name: skills\nUrl: ${sourceUrl}\nDescription: Claude Code 工作流技能库`;
const context = {
  catalogUrl: 'https://www.aivora.cn/products', topics: ['Claude'], sourceText,
  scene: { topic: 'Claude', sourceUrl, sourceText,
    product: { name: 'Claude Pro 充值续费', url: 'https://www.aivora.cn/products/verified-sku' },
    official: { url: 'https://support.claude.com/help', text: 'Pro subscribers can use Claude Code.' },
  },
};
const article = `## 新闻\r\n\r\n[Claude Code 技能库](${sourceUrl})\r\n\r\n![图片](https://example.org/image.png)\r\n\r\n`;
const oldFaq = '## **❓ 相关问题**\n\n### 项目是什么？\n\n旧问答。\n\n';
const footer = '## 页脚\r\n\r\n不能改变。\r\n';
const raw = `## **❓ 相关问题**\n\n### 买了 Claude 会员，为什么改代码还得重新交代？\n\n**缺的可能是流程，不是更贵的会员。** 今天的[技能库](${sourceUrl})把重复交代的工作步骤写成了说明。先装一个合适的 Skill，再拿小任务试跑，看看流程是否适合自己。已有账号，可以看看[爱窝啦·AI账号店的 Claude Pro 续费](AIVORA_PRODUCT_URL)，会员只是工具入口，技能需要另行安装。`;

test('scene FAQ can replace a generic FAQ and uses distinct news, official and delivery evidence', () => {
  const input = buildStandaloneDailyFaqPromptInput('2026-10-03', article + oldFaq, [sourceText], context);
  assert.equal(input.topic, 'Claude');
  assert.match(input.prompt, /B 场景型/);
  assert.match(input.prompt, /120-180/);
  assert.match(input.prompt, /不重写新闻正文/);
  assert.match(input.prompt, /AIVORA_PRODUCT_URL/);
  assert.match(getStandaloneDailyFaqSystemPrompt(), /只输出/);
});

test('normalization fills only a verified product URL and replacement preserves all non-FAQ bytes', () => {
  const section = normalizeStandaloneDailyFaqSection(raw, sourceUrl, sourceText, 'Claude', context);
  assert.ok(section);
  const result = finalizeDailyShopFaq(insertStandaloneDailyFaq(article + oldFaq + footer, section), context);
  assert.ok(result.startsWith(article));
  assert.ok(result.endsWith(footer));
  assert.equal((result.match(/^## .*相关问题/gm) || []).length, 1);
  assert.match(result, /verified-sku/);
  assert.doesNotMatch(result, /旧问答|AIVORA_PRODUCT_URL|准备比较当前公开/);
});

test('scene FAQ rejects refusal, invented URLs, duplicate brand, unsupported prices and empty answers', () => {
  for (const bad of ['', '我需要你确认后再写日报', raw.replace(sourceUrl, 'https://example.org/invented'),
    raw.replace('会员只是工具入口', '售价 99 元'), raw.replace('更贵的会员', '无限使用'),
    raw.replace('已有账号', '爱窝啦·AI账号店已有账号'), raw.replace('AIVORA_PRODUCT_URL', context.scene.product.url)]) {
    assert.equal(normalizeStandaloneDailyFaqSection(bad, sourceUrl, sourceText, 'Claude', context), '');
  }
});

// Exercise the actual optional block with external operations stubbed, not a second publishing path.
const scheduled = readFileSync(new URL('../src/handlers/scheduled.js', import.meta.url), 'utf8');
const start = scheduled.indexOf('    if (validation.ok) {', scheduled.indexOf('const funStatsBeforeStandaloneGeneration'));
const end = scheduled.indexOf('    dailySummaryMarkdownContent = normalizeMarkdownImageSyntax', start);
assert.ok(start >= 0 && end > start);
function runOptional(overrides = {}) {
  return vm.runInNewContext(`(async function(markdown) {
    let dailySummaryMarkdownContent = markdown; let validation = {ok:true}; const debugInfo = {};
    const env = {}; const dateStr = '2026-10-03'; const faqSourceItems = [];
    const dailyShopContext = {}; const outputOfCall3 = ''; const options = {dryRun:true};
    ${scheduled.slice(start, end)}
    return {markdown:dailySummaryMarkdownContent, debug:debugInfo};
  })`, {
    console: {warn() {}}, buildStandaloneDailyFaqPromptInput, normalizeStandaloneDailyFaqSection,
    insertStandaloneDailyFaq, withDailyFaqDeadline, getStandaloneDailyFaqSystemPrompt, finalizeDailyShopFaq,
    removeMarkdownCodeBlock: (text) => text, loadDailyFaqSceneContext: async () => context,
    generateContentWithTransportFallback: async () => raw,
    validateGeneratedDaily: () => ({ok:true}), ...overrides,
  });
}

test('optional fetch, model, invalid-output and deadline failures leave the ready article unchanged', async () => {
  const ready = article + oldFaq + footer;
  for (const overrides of [
    {loadDailyFaqSceneContext: async () => {throw new Error('offline');}},
    {generateContentWithTransportFallback: async () => {throw new Error('model offline');}},
    {generateContentWithTransportFallback: async () => '请确认之后再写'},
    {generateContentWithTransportFallback: () => new Promise(() => {}),
      withDailyFaqDeadline: (task) => withDailyFaqDeadline(task, 5)},
  ]) assert.equal((await runOptional(overrides)(ready)).markdown, ready);
});

test('successful optional runtime changes only FAQ and a late timed-out result cannot mutate publication', async () => {
  const ready = article + oldFaq + footer;
  const result = await runOptional()(ready);
  assert.equal(result.debug.dailyFaqSeparateGenerationInserted, true);
  assert.ok(result.markdown.startsWith(article));
  assert.ok(result.markdown.endsWith(footer));
  let finish;
  const late = await runOptional({
    generateContentWithTransportFallback: () => new Promise((resolve) => {finish = resolve;}),
    withDailyFaqDeadline: (task) => withDailyFaqDeadline(task, 5),
  })(ready);
  finish(raw);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(late.markdown, ready);
  assert.equal(late.debug.dailyFaqSeparateGenerationInserted, undefined);
});
