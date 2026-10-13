import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dailyMediaSourceKey, extractSourcePageImages, enrichDailySourceMedia } from '../src/dailySourceMedia.js';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const imageResponse = () => new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } });
const article = (url) => `## 今日焦点\n\n### 一条新闻\n\n**判断不改。** [原文](${url})。\n\n`;
const row = (url, html = '') => ({url, title:'原文', details:{content_html:html}});

test('README resolves relative Markdown/HTML images and ignores badges, sponsors and avatars', () => {
  const base = 'https://raw.githubusercontent.com/owner/repo/develop/README.md';
  const images = extractSourcePageImages(`![Stars](https://img.shields.io/a)\n![Sponsor](https://example.org/a.jpg)\n<img src="./logo.png">\n![Demo](./demo.png)\n<img src="./assets/performance.png" width="800">`, base, {readme:true});
  assert.deepEqual(images.map((item) => item.url), [
    'https://raw.githubusercontent.com/owner/repo/develop/demo.png',
    'https://raw.githubusercontent.com/owner/repo/develop/assets/performance.png',
  ]);
});

test('article scopes real media, supports lazy loading and poster, never takes sidebar or script images', () => {
  const images = extractSourcePageImages(`<img src="/sidebar.jpg"><script><img src="/fake.jpg"></script><article><img data-src="/real.jpg" width="800"><video poster="/cover.jpg"></video></article><meta content="/og.jpg" property="og:image">`, 'https://example.org/news/a');
  assert.deepEqual(images.map((item) => item.url), ['https://example.org/real.jpg','https://example.org/cover.jpg','https://example.org/og.jpg']);
});

test('public source normalization removes tracking only, not article query IDs', () => {
  assert.equal(dailyMediaSourceKey('https://www.example.org/a?id=1&utm_source=folo#top'), 'https://example.org/a?id=1');
  assert.notEqual(dailyMediaSourceKey('https://example.org/a?id=1'), dailyMediaSourceKey('https://example.org/a?id=2'));
});

test('final coverage includes late fun and open-source blocks even after six existing images, not FAQ', async () => {
  const url = 'https://x.com/dotey/status/1';
  const top = Array.from({length:6}, (_, i) => `### ${i+1}. 已有\n\n![已有](https://cdn.example.org/${i}.jpg)`).join('\n\n');
  const markdown = `## TOP\n\n${top}\n\n## AI趣闻\n\n### 趣闻\n\n[引用帖](${url})\n\n## FAQ\n\n### 买什么？\n\n[重复引用](${url})`;
  const result = await enrichDailySourceMedia(markdown, {news:[row(url, '<img src="https://pbs.twimg.com/media/exact.jpg" width="1254" height="1254">')]}, {}, {fetchImpl:async () => imageResponse()});
  assert.equal(result.insertedCount, 1);
  assert.equal(result.requestCount, 1);
  assert.match(result.markdown.split('## FAQ')[0], /exact.jpg/);
  assert.doesNotMatch(result.markdown.split('## FAQ')[1], /exact.jpg/);
  assert.equal((await enrichDailySourceMedia(result.markdown, {}, {}, {fetchImpl:async () => {throw Error('must not fetch');}})).markdown, result.markdown);
});

test('missing article media is fetched from exact source and confirmed as real image', async () => {
  const url = 'https://example.org/news';
  const calls = [];
  const result = await enrichDailySourceMedia(article(url), {news:[row(url)]}, {}, {fetchImpl:async (target) => {
    calls.push(target);
    return target === url ? new Response('<article><img src="/chart.jpg"></article>', {headers:{'content-type':'text/html'}}) : imageResponse();
  }});
  assert.equal(result.insertedCount, 1);
  assert.deepEqual(calls, [url,'https://example.org/chart.jpg']);
  assert.match(result.markdown, /判断不改/);
});

test('GitHub uses returned README branch, does not guess main, and inserts first real screenshot', async () => {
  const url = 'https://github.com/owner/repo';
  const result = await enrichDailySourceMedia(article(url), {project:[row(url)]}, {}, {fetchImpl:async (target) => {
    if (target.endsWith('/readme')) return Response.json({download_url:'https://raw.githubusercontent.com/owner/repo/dev/README.md', content:btoa('![badge](https://img.shields.io/a)\n![demo](./demo.png)')});
    assert.equal(target, 'https://raw.githubusercontent.com/owner/repo/dev/demo.png');
    return imageResponse();
  }});
  assert.match(result.markdown, /dev\/demo.png/);
  assert.match(result.markdown, /README 展示图/);
});

test('404, nonimage and canonical mismatch skip only media and keep the complete article', async () => {
  const url = 'https://example.org/news';
  for (const response of [new Response('no',{status:404}),new Response('html',{headers:{'content-type':'text/html'}}),
    new Response('<link rel="canonical" href="https://example.org/"><article><img src="/bad.jpg"></article>',{headers:{'content-type':'text/html'}})]) {
    const result = await enrichDailySourceMedia(article(url), {news:[row(url)]}, {}, {fetchImpl:async () => response});
    assert.equal(result.markdown, article(url));
  }
});

test('private URLs and redirects, data URLs, tiny images and HTML returned as image are not published', async () => {
  const url = 'https://example.org/news';
  const dangerous = '<article><img src="http://127.0.0.1/a.png"><img src="https://localhost/a.png"><img src="data:image/png;base64,a"><img src="/pixel.jpg" width="1"><img src="/fake.jpg"></article>';
  const calls = [];
  const result = await enrichDailySourceMedia(article(url), {news:[row(url,dangerous)]}, {}, {fetchImpl:async (target) => {calls.push(target); return new Response('not image',{headers:{'content-type':'image/jpeg'}});}});
  assert.equal(result.markdown, article(url));
  assert.ok(calls.every((target) => target === 'https://example.org/fake.jpg'));
  const redirect = await enrichDailySourceMedia(article(url), {news:[row(url)]}, {}, {fetchImpl:async () => new Response(null,{status:302,headers:{location:'http://169.254.169.254/latest'}})});
  assert.equal(redirect.markdown, article(url));
});

test('slow source ends at the overall optional deadline and cannot mutate the ready daily later', async () => {
  const url = 'https://example.org/news';
  const result = await enrichDailySourceMedia(article(url), {news:[row(url)]}, {}, {deadlineMs:10, fetchImpl:async (_url,{signal}) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), {once:true});
  })});
  assert.equal(result.markdown, article(url));
  assert.equal(result.rows[0].status, 'skipped');
});

test('scheduled integration is optional after validation, before dry-run, after independent fun generation', () => {
  const scheduled = readFileSync(new URL('../src/handlers/scheduled.js', import.meta.url),'utf8');
  const handler = scheduled.slice(scheduled.indexOf('export async function handleScheduledDaily'));
  assert.ok(handler.indexOf('await enrichDailySourceMedia(') > handler.indexOf('if (!validation.ok)'));
  assert.ok(handler.indexOf('await enrichDailySourceMedia(') < handler.indexOf("debugInfo.dailyWouldPublish = true"));
  assert.match(handler, /Optional source media skipped/);
  assert.match(handler, /Object.values\(allUnifiedData \|\| \{\}\).flat\(\).map\(extractTelegramDailyImageCandidate\)/);
});
