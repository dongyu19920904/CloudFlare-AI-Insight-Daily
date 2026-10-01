import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStandaloneDailyFaqPromptInput,
  expandDailyFaqSourceItems,
  insertStandaloneDailyFaq,
  normalizeStandaloneDailyFaqSection,
  withDailyFaqDeadline,
} from '../src/dailyStandaloneFaq.js';
import { finalizeDailyShopFaq } from '../src/dailyShopFaq.js';

const sourceUrl = 'https://x.com/GeminiApp/status/2104660668859453637';
const sourceText = `News Title: Gemini App 更新\nSource: Google Gemini\nUrl: ${sourceUrl}\nContent Summary: Gemini 官方演示私人智能体功能。`;
const article = `## **🔥 今日焦点 TOP 1**\n\n[Gemini 官方演示私人智能体功能](${sourceUrl})。\n\n[up 知识库](https://github.com/byoungd/up)也在文中。`;
const context = { catalogUrl: 'https://www.aivora.cn/products', topics: ['Gemini'] };

test('missing FAQ prefers a matching official product post for a buyer question', () => {
  const unrelatedRepo = 'Project Name: up\nUrl: https://github.com/byoungd/up\nDescription: AI 学习指南';
  const input = buildStandaloneDailyFaqPromptInput('2026-09-29', article, [unrelatedRepo, sourceText], context);
  assert.equal(input.sourceUrl, sourceUrl);
  assert.equal(input.topic, 'Gemini');
  assert.match(input.prompt, /来源没有价格或额度，并不妨碍回答/);
  const answer = `## **❓ 相关问题**\n\n### Gemini 新功能，购买订阅前要确认什么？\n\n[Gemini 官方演示](${sourceUrl})展示了具体功能。先核对自己的实际入口，不能从演示推断所有套餐都支持。`;
  const normalized = normalizeStandaloneDailyFaqSection(answer, input.sourceUrl, input.sourceText, input.topic);
  assert.match(normalized, /购买订阅前/);
  assert.match(insertStandaloneDailyFaq(article, normalized), /相关问题/);
  const withFooter = `${article}\n\n---\n\n## **AI资讯日报语音版**\n\n[节目](https://example.com/podcast)`;
  assert.ok(insertStandaloneDailyFaq(withFooter, normalized).indexOf('相关问题') <
    insertStandaloneDailyFaq(withFooter, normalized).indexOf('AI资讯日报语音版'));
  assert.equal(buildStandaloneDailyFaqPromptInput('2026-09-29', insertStandaloneDailyFaq(article, normalized), [sourceText], context), null);
});

test('FAQ skips social reposts and rejects unsupported links or sales claims', () => {
  const repost = `News Title: Claude 账号消息\nUrl: https://t.me/aigc1024/25100\nContent Summary: 社交转述`;
  assert.equal(buildStandaloneDailyFaqPromptInput('2026-09-29', '[帖子](https://t.me/aigc1024/25100)', [repost], context), null);
  assert.equal(buildStandaloneDailyFaqPromptInput('2026-09-29', article, [sourceText]), null);
  const wrongLink = `## **❓ 相关问题**\n\n### Gemini 购买订阅前要确认什么？\n\n先读[另一个项目的说明](https://github.com/other/repo)，再核对自己的需求和仓库中的实际代码。`;
  assert.equal(normalizeStandaloneDailyFaqSection(wrongLink, sourceUrl, sourceText, 'Gemini'), '');
  assert.equal(normalizeStandaloneDailyFaqSection(wrongLink.replace('先读', '售价 99 元，先读').replace('https://github.com/other/repo', sourceUrl), sourceUrl, sourceText, 'Gemini'), '');
  assert.equal(normalizeStandaloneDailyFaqSection(wrongLink.replace('Gemini 购买订阅前', 'up 项目'), sourceUrl, sourceText, 'Gemini'), '');
});

test('FAQ can state that a price needs verification without asserting one', () => {
  const answer = `## **❓ 相关问题**\n\n### Gemini 订阅前要确认哪些功能？\n\n[Gemini 官方演示](${sourceUrl})展示了邮件整理功能。不能据此推断所有订阅套餐都支持，具体价格和套餐差异需要进一步确认。`;
  assert.match(normalizeStandaloneDailyFaqSection(answer, sourceUrl, sourceText, 'Gemini'), /价格和套餐差异需要进一步确认/);
  assert.equal(normalizeStandaloneDailyFaqSection(answer.replace('价格和套餐差异需要进一步确认', '价格为 99 元'), sourceUrl, sourceText, 'Gemini'), '');
});

test('optional FAQ timeout leaves the main article path free to continue', async () => {
  await assert.rejects(
    withDailyFaqDeadline(() => new Promise(() => {}), 5),
    /Optional FAQ generation timed out/
  );
  assert.equal(await withDailyFaqDeadline(() => Promise.resolve('ready'), 50), 'ready');
});

test('an official source used only in a supplemental section can support a buyer FAQ', () => {
  const supplementalItem = `socialMedia Post by Google Gemini\nTitle: Gemini App 演示清理收件箱\nUrl: ${sourceUrl}\nContent: 官方演示 Agent 处理邮件。`;
  const supplementalArticle = `## **社媒精选**\n\n### Gemini App 演示清理收件箱\n\n[Gemini 官方演示](${sourceUrl})展示邮件整理。`;
  const input = buildStandaloneDailyFaqPromptInput('2026-09-29', supplementalArticle, [supplementalItem], context);
  assert.equal(input.sourceUrl, sourceUrl);
  assert.equal(input.topic, 'Gemini');
});

test('an original project used in the article can answer a technical FAQ without a shop link', () => {
  const repoUrl = 'https://github.com/NVIDIA/OpenShell';
  const project = `Project Name: NVIDIA/OpenShell\nUrl: ${repoUrl}\nDescription: AI agent sandbox runtime written in Rust.`;
  const body = `## **🔥 今日焦点 TOP 1**\n\n### 1. OpenShell 安全运行时\n\n[OpenShell 仓库](${repoUrl})提供沙盒运行时。`;
  const input = buildStandaloneDailyFaqPromptInput('2026-09-30', body, [project], {
    catalogUrl: 'https://www.aivora.cn/products', topics: ['Grok'],
  });
  assert.equal(input.sourceUrl, repoUrl);
  assert.equal(input.topic, '');
  assert.match(input.prompt, /不要复述今日星标数/);
  assert.match(input.prompt, /首句直接回答/);
  const answer = `## **❓ 相关问题**\n\n### OpenShell 用来解决什么问题？\n\n[OpenShell 项目仓库](${repoUrl})描述了面向 AI Agent 的沙盒运行时。它适合需要隔离执行环境的工具，不能据此保证所有部署都安全。`;
  const normalized = normalizeStandaloneDailyFaqSection(answer, input.sourceUrl, input.sourceText);
  assert.ok(normalized);
  const result = insertStandaloneDailyFaq(body, normalized);
  assert.match(result, /相关问题/);
  assert.doesNotMatch(result, /aivora\.cn/);
  assert.doesNotMatch(finalizeDailyShopFaq(result, { catalogUrl: '', topics: [] }), /aivora\.cn/);
});

test('buyer FAQ retains rollout terms at the end of the cached official article', () => {
  const url = 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/argon/';
  const summary = `News Title: Gemini 新模型\nUrl: ${url}\nContent Summary: 新模型已经宣布。`;
  const rollout = '当前仅面向受邀用户；后续从 Google AI Ultra 订阅者开始开放，尚未公布具体日期。';
  const expanded = expandDailyFaqSourceItems([summary], { news: [{
    title: 'Gemini 新模型', url,
    details: { content_html: `<p>模型介绍${'能力细节。'.repeat(500)}</p><p>${rollout}</p>` },
  }] });
  const input = buildStandaloneDailyFaqPromptInput('2026-10-01', `[新模型](${url})`, expanded, context);
  assert.ok(input.sourceText.includes(rollout));
  assert.match(input.prompt, /当前可用.*受邀试用.*未来开放/);
  const answer = `## **❓ 相关问题**\n\n### Gemini 新模型，购买 Ultra 订阅就能用吗？\n\n现在还不能这样判断。[Google 公告](${url})说目前仅受邀用户能用，后续从 Google AI Ultra 订阅者开始开放。具体日期尚未公布，买订阅不能当成已获新模型权限。`;
  assert.ok(normalizeStandaloneDailyFaqSection(answer, url, input.sourceText, 'Gemini'));
  assert.equal(expandDailyFaqSourceItems([summary])[0], summary);
});

test('very long official FAQ sources keep both ends with a bounded input', () => {
  const summary = `News Title: Gemini\nUrl: ${sourceUrl}\nContent Summary: 摘要`;
  const expanded = expandDailyFaqSourceItems([summary], { news: [{
    title: 'Gemini', url: sourceUrl,
    details: { content_html: `<p>当前受邀试用。${'中间内容。'.repeat(2000)}后续从 Ultra 开放。</p>` },
  }] });
  assert.ok(expanded[0].length <= 6000);
  assert.match(expanded[0], /当前受邀试用/);
  assert.match(expanded[0], /后续从 Ultra 开放/);
  assert.match(expanded[0], /来源中间已省略/);
});

test('FAQ expansion leaves social reposts unchanged even with cached original text', () => {
  const url = 'https://t.me/aigc1024/25100';
  const repost = `News Title: Gemini\nUrl: ${url}\nContent Summary: 社交转述`;
  assert.deepEqual(expandDailyFaqSourceItems([repost], { news: [{
    url, details: { content_html: '<p>转述声称所有套餐可用。</p>' },
  }] }), [repost]);
});
