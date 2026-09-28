import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStandaloneDailyFaqPromptInput,
  insertStandaloneDailyFaq,
  normalizeStandaloneDailyFaqSection,
  withDailyFaqDeadline,
} from '../src/dailyStandaloneFaq.js';

const sourceUrl = 'https://github.com/mvschwarz/openrig';
const sourceText = `Project Name: openrig：多智能体统一框架\nSource: GitHub Trending Daily\nUrl: ${sourceUrl}\nDescription: AI agent project that coordinates multiple agents.`;
const article = `## **🔥 今日焦点 TOP 1**\n\n[openrig 展示多智能体协作方式](${sourceUrl})。`;

test('missing FAQ can use a cited original project without inventing a shop link', () => {
  const input = buildStandaloneDailyFaqPromptInput('2026-09-28', article, [sourceText]);
  assert.equal(input.sourceUrl, sourceUrl);
  const answer = `## **❓ 相关问题**\n\n### openrig 适合拿来做什么？\n\n它展示了多智能体协作的项目结构。[仓库说明列出了核心实现](${sourceUrl})。先看项目的实际代码与说明，再判断是否适合自己的任务。`;
  const normalized = normalizeStandaloneDailyFaqSection(answer, input.sourceUrl, input.sourceText);
  assert.match(normalized, /openrig 适合拿来做什么/);
  assert.match(insertStandaloneDailyFaq(article, normalized), /相关问题/);
  const withFooter = `${article}\n\n---\n\n## **AI资讯日报语音版**\n\n[节目](https://example.com/podcast)`;
  assert.ok(insertStandaloneDailyFaq(withFooter, normalized).indexOf('相关问题') <
    insertStandaloneDailyFaq(withFooter, normalized).indexOf('AI资讯日报语音版'));
  assert.equal(buildStandaloneDailyFaqPromptInput('2026-09-28', insertStandaloneDailyFaq(article, normalized), [sourceText]), null);
});

test('FAQ skips social reposts and rejects unsupported links or sales claims', () => {
  const repost = `News Title: Claude 账号消息\nUrl: https://t.me/aigc1024/25100\nContent Summary: 社交转述`;
  assert.equal(buildStandaloneDailyFaqPromptInput('2026-09-28', '[帖子](https://t.me/aigc1024/25100)', [repost]), null);
  const wrongLink = `## **❓ 相关问题**\n\n### openrig 适合拿来做什么？\n\n先读[另一个项目的说明](https://github.com/other/repo)，再核对自己的需求和仓库中的实际代码。`;
  assert.equal(normalizeStandaloneDailyFaqSection(wrongLink, sourceUrl, sourceText), '');
  assert.equal(normalizeStandaloneDailyFaqSection(wrongLink.replace('先读', '售价 99 元，先读').replace('https://github.com/other/repo', sourceUrl), sourceUrl, sourceText), '');
});

test('optional FAQ timeout leaves the main article path free to continue', async () => {
  await assert.rejects(
    withDailyFaqDeadline(() => new Promise(() => {}), 5),
    /Optional FAQ generation timed out/
  );
  assert.equal(await withDailyFaqDeadline(() => Promise.resolve('ready'), 50), 'ready');
});
