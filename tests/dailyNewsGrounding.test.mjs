import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyPromptSelection } from '../src/dailyPromptSelection.js';
import { buildDailyGenerationPromptInput } from '../src/dailyGenerationPromptInput.js';
import { extractDailyArticleEvidence, groundDailyNewsSources, isDiscussionMetadataOnly } from '../src/dailyNewsGrounding.js';
import { getSystemPromptSummarizationStepOne } from '../src/prompt/summarizationPromptStepZero.js';
import fs from 'node:fs';

const meta = {
  type: 'news', title: 'Muse Wonder', source: 'Hacker News: Best - meetpateltech',
  url: 'https://research.meta.ai/blog/muse-wonder', published_date: '2026-10-12T16:48:01.930Z',
  details: { content_html: '<p>Article URL: https://research.meta.ai/blog/muse-wonder</p><p>Comments URL: https://news.ycombinator.com/item?id=50059115</p><p>Points: 492</p><p># Comments: 266</p>' },
};
const evidence = {
  title: 'Muse Wonder: A Frontier Model For Personal & Professional AI Agents',
  excerpt: 'Meta introduces Muse Wonder and Muse Wonder Full for personal and professional agents. Active Memory recalls relevant context. Active Focus supports sustained work and coding tasks.',
  url: meta.url, kind: 'article-excerpt',
};
const articleHtml = `<html><head><link rel="canonical" href="${meta.url}"></head><body>
<nav>Music generation on another page</nav><main><h1>${evidence.title}</h1><p>${evidence.excerpt}</p></main>
<footer>Unrelated music products</footer></body></html>`;

test('actual generation input carries original article facts, not only HN discussion metadata', () => {
  const item = { ...meta, details: { ...meta.details, articleEvidence: evidence } };
  const selected = buildDailyPromptSelection({ news: [item] }).selectedContentItems;
  const prompt = buildDailyGenerationPromptInput(selected);
  assert.match(prompt, /Original Article Title: .*Personal & Professional AI Agents/);
  assert.match(prompt, /Content Summary: Meta introduces Muse Wonder/);
  assert.match(prompt, /Discovery Metadata: Discovered via a discussion feed/);
  assert.doesNotMatch(prompt, /Points: 492|Comments: 266/);
  assert.doesNotMatch(prompt, /Content Summary: Article URL:/);
});

test('long image URLs cannot consume the factual excerpt budget and media stays available separately', () => {
  const image = `https://cdn.example.com/${'x'.repeat(700)}.jpg`;
  const item = { type: 'news', title: 'AI robot planning', url: 'https://example.com/robot', source: 'Original publisher',
    details: { content_html: `<img src="${image}"><p>AI robot experiments use system-level policies, not music generation. The original article describes the actual tested control workflow.</p>` } };
  const selected = buildDailyPromptSelection({ news: [item] }).selectedContentItems.join('\n');
  assert.match(selected, /Content Summary: AI robot experiments use system-level policies/);
  assert.ok(selected.includes(`Media References: ![image](${image})`));
  assert.doesNotMatch(selected.split('Media References:')[0], /cdn\.example/);
});

test('fetched original excerpts retain availability facts beyond a short marketing introduction', () => {
  const item = { ...meta, details: { ...meta.details, articleEvidence: {
    ...evidence, excerpt: `${'Personal and professional agents. '.repeat(20)}Wonder is available through Meta Model API and Muse Code.`,
  } } };
  const input = buildDailyPromptSelection({ news: [item] }).selectedContentItems.join('\n');
  assert.match(input, /Wonder is available through Meta Model API and Muse Code/);
});

test('discussion-only detection does not discard real reporting or substantive HN summaries', () => {
  assert.equal(isDiscussionMetadataOnly(meta), true);
  assert.equal(isDiscussionMetadataOnly({ ...meta, details: { content_html: `${meta.details.content_html}<p>A real report about agents with its own facts.</p>` } }), false);
  assert.equal(isDiscussionMetadataOnly({ type: 'news', description: evidence.excerpt }), false);
});

test('article parsing keeps the actual heading and article paragraphs, not footer products', () => {
  const result = extractDailyArticleEvidence(articleHtml, meta.url);
  assert.equal(result.title, evidence.title);
  assert.equal(result.excerpt, evidence.excerpt);
  assert.doesNotMatch(result.excerpt, /Music|music/);
  assert.equal(extractDailyArticleEvidence('<html><body><div id="app"></div></body></html>', meta.url), null);
  assert.equal(extractDailyArticleEvidence(articleHtml.replace(meta.url, 'https://research.meta.ai/other-article'), meta.url), null);
});

test('page description is explicitly a partial source, not a fabricated full article', () => {
  const html = `<title>${evidence.title}</title><meta name="description" content="${evidence.excerpt}">`;
  assert.equal(extractDailyArticleEvidence(html, meta.url).kind, 'page-description');
});

test('grounding reuses complete sources and supplies the real Meta category to actual generation', async () => {
  const complete = { type: 'news', title: 'AI agent workflow', url: 'https://example.com/complete', details: { content_html: '<p>Complete AI agent workflow reporting with actual steps and results.</p>' } };
  let calls = 0;
  const data = { news: [meta, complete], project: [{ id: 'unchanged' }] };
  const result = await groundDailyNewsSources(data, [], { fetchImpl: async () => {
    calls++; return new Response(articleHtml, { headers: { 'Content-Type': 'text/html' } });
  } });
  assert.equal(calls, 1);
  assert.equal(result.grounded, 1);
  assert.equal(result.data.news[1], complete);
  assert.equal(result.data.project, data.project);
  assert.equal(data.news[0].details.articleEvidence, undefined);
  const input = buildDailyGenerationPromptInput(buildDailyPromptSelection(result.data).selectedContentItems);
  assert.match(input, /personal and professional agents/);
  assert.doesNotMatch(input, /音乐生成/);
});

test('unreadable article is replaced from the same pool, not an edition-wide exception', async () => {
  const headlines = ['Claude Code terminal permissions', 'GPT voice conversation', 'Gemini camera translation', 'Cursor repository indexing', 'DeepSeek reasoning API', 'Qwen robot navigation', 'Mistral document OCR', 'GLM legal evaluation', 'Perplexity citation search', 'Grok video editing', 'Llama local inference', 'Copilot pull request review', 'Whisper speech transcription', 'Flux image generation', 'Ollama model deployment', 'LangChain agent tracing'];
  const healthy = headlines.map((title, i) => ({ type: 'news', title, url: `https://publisher-${i}.example.com/ai-${i}`, source: `Original publisher ${i}`, published_date: meta.published_date,
    details: { content_html: `<p>AI news: ${title}. This source contains the specific feature and its usage boundary.</p>` } }));
  const result = await groundDailyNewsSources({ news: [meta, ...healthy] }, [], { fetchImpl: async () => new Response('blocked', { status: 403 }) });
  assert.equal(result.replaced, 1);
  assert.equal(result.data.news.length, 16);
  assert.equal(result.rows[0].reason, 'article-http-403');
  const selected = buildDailyPromptSelection(result.data, { DAILY_PROMPT_ENTITY_HARD_CAP: '20' }).selectedContentItems;
  assert.ok(selected.length >= 10);
  assert.doesNotMatch(buildDailyGenerationPromptInput(selected), /muse-wonder/);
});

test('grounding request budget stays bounded and rejects unsafe hosts and cross-article redirects', async () => {
  let calls = 0;
  const many = Array.from({ length: 14 }, (_, i) => ({ ...meta, url: `https://example.com/article-${i}` }));
  const result = await groundDailyNewsSources({ news: many }, [], { fetchImpl: async () => {
    calls++; return new Response(null, { status: 302, headers: { Location: 'https://127.0.0.1/private' } });
  } });
  assert.equal(calls, 6);
  assert.equal(result.grounded, 0);
  const unsafe = await groundDailyNewsSources({ news: [{ ...meta, url: 'https://localhost./private' }] }, [], { fetchImpl: async () => { throw new Error('must not fetch'); } });
  assert.equal(unsafe.requests, 0);
  assert.equal(unsafe.rows[0].reason, 'non-public-article-url');
});

test('slow article respects abort and cannot hold the daily indefinitely', async () => {
  const started = Date.now();
  const result = await groundDailyNewsSources({ news: [meta] }, [], { deadlineMs: 15, fetchImpl: async (_url, { signal }) => {
    await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  assert.equal(result.replaced, 1);
  assert.ok(Date.now() - started < 1000);
});

test('original facts rules and daily-only integration do not alter opportunity scheduling', () => {
  assert.match(getSystemPromptSummarizationStepOne('2026-10-13'), /不得从陌生产品名猜/);
  assert.match(getSystemPromptSummarizationStepOne('2026-10-13'), /不能合并主语后共享权限/);
  assert.match(getSystemPromptSummarizationStepOne('2026-10-13'), /不等于日报当天/);
  const scheduled = fs.readFileSync(new URL('../src/handlers/scheduled.js', import.meta.url), 'utf8');
  assert.equal((scheduled.match(/groundDailyNews: true/g) || []).length, 1);
  assert.ok(scheduled.indexOf('groundDailyNews: true') > scheduled.indexOf('export async function handleScheduledDaily('));
});
