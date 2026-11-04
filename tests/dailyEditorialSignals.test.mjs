import test from 'node:test';
import assert from 'node:assert/strict';
import { focusDailyDigestItem, getDailyEditorialPriority, isTitleOnlyDailyItem, isUnconfirmedDailyModelRumor } from '../src/dailyEditorialSignals.js';
import { buildDailyPromptSelection, getDailyPublisherKey, inferDailyPromptSourceType } from '../src/dailyPromptSelection.js';
import { buildDailyGenerationPromptInput } from '../src/dailyGenerationPromptInput.js';
import { capNewsItemsWithPublisherDiversity } from '../src/newsSourceDiversity.js';
import { ensureDailyMediaCoverage } from '../src/dailyMediaCoverage.js';

const news = (title, url, text, extra = {}) => ({
  type: 'news', title, url, description: text, published_date: '2026-11-03T18:00:00Z',
  details: { content_html: `<p>${text}</p>` }, ...extra,
});

test('an image-only teaser with channel footer is not a news or fun candidate', () => {
  const teaser = news('🖼 Ai第一个受害者出现了', 'https://t.me/aigc1024/26589', '', {
    details: { content_html: '<p>Ai第一个受害者出现了<br><a>AI探索</a> | Hermes/OpenClaw ｜ 优质资源 ｜ 优质信息</p><img src="https://cdn5.telesco.pe/file/post.jpg">' },
  });
  assert.equal(isTitleOnlyDailyItem(teaser), true);
  const result = buildDailyPromptSelection({ news: [teaser] });
  assert.equal(result.selectedContentItems.length, 0);
  assert.equal(result.dailyFunContentItems.length, 0);
  assert.equal(result.selectionDiagnostics.rejectedTitleOnlyCount, 1);
  assert.equal(isTitleOnlyDailyItem(news('发布了: DeepSeek 刚刚服务中断，谁还记得上次之后发生了什么？',
    'https://m.okjike.com/originalPosts/outage', 'DeepSeek 刚刚服务中断，谁还记得上次之后发生了什么？')), true);
});

test('model leak speculation is omitted without inventing a debunk', () => {
  const rumor = news('Anthropic Fable 5.5 模型泄露', 'https://www.36kr.com/p/rumor', '神秘仓库，发布状态尚不明确。');
  assert.equal(isUnconfirmedDailyModelRumor(rumor), true);
  const result = buildDailyPromptSelection({ news: [rumor] });
  assert.equal(result.selectedContentItems.length, 0);
  assert.equal(result.dailyFunContentItems.length, 0);
  assert.equal(isUnconfirmedDailyModelRumor(news('OpenAI API 密钥泄露', 'https://security.example.org/post', '密钥误传到 GitHub。')), false);
});

test('real major product updates outrank image-backed minor tools without guessing popularity', () => {
  const minor = news('Open Typora 0.22.0 增加 AI 审阅', 'https://www.v2ex.com/t/1', '本地 Markdown 文档可逐处审阅。', {
    source: 'OpenAI - anichikage', details: { content_html: '<p>本地 Markdown 文档可逐处审阅。</p><img src="https://images.example.org/editor.png">' },
  });
  const update = news('Claude 团队版现在可以自动连上企业插件', 'https://x.com/dotey/status/1', '登录 Claude 后，公司已开通的插件现在可以自动连上，不用再逐个授权。');
  const selection = buildDailyPromptSelection({ news: [minor, update] });
  assert.match(selection.selectedContentItems[0], /dotey/);
  assert.ok(selection.selectedContentItems.some(item => item.includes('v2ex.com')));
  const prompt = buildDailyGenerationPromptInput(selection.selectedContentItems, selection.dailyFunContentItems);
  assert.match(prompt, /TOP 候选 1:[\s\S]*dotey/);
  assert.doesNotMatch(prompt.split('【社媒精选专用候选素材】')[1] || '', /dotey/);
});

test('news truncation protects real company updates before the fixed cache fills with pictures', () => {
  const illustrated = Array.from({ length: 55 }, (_, i) => news(`AI 小工具界面 ${i}`, `https://t.me/channel/${i}`, '一个普通界面截图。'));
  const official = news('DeepSeek 发布新模型', 'https://api-docs.deepseek.com/news/release', '新模型已发布，提供代码与推理能力。');
  const capped = capNewsItemsWithPublisherDiversity([...illustrated, official], 50);
  assert.equal(capped.length, 50);
  assert.equal(capped[0], official);
  assert.ok(capped.includes(official));
});

test('a numbered daily digest supplies one complete event and its own image, not adjacent events', () => {
  const digest = news('AI日报：Hyra 2.0；SenseNova 发布', 'https://www.aibase.com/zh/news/32056', '', {
    details: { content_html: '<p>欢迎来到日报</p><p><strong>1、腾讯发布 Hyra 2.0</strong></p><p>三层 AI Agent 协作，支持科研工具研发。</p><p><img src="https://images.example.org/hyra.png"></p><p><strong>2、商汤发布 SenseNova</strong></p><p>另一个模型的记忆更新。</p><img src="https://images.example.org/sensenova.png">' },
  });
  const focused = focusDailyDigestItem(digest);
  assert.match(focused.title, /腾讯发布 Hyra/);
  assert.doesNotMatch(focused.details.content_html, /SenseNova|sensenova/);
  assert.match(digest.details.content_html, /SenseNova/);
  const result = buildDailyPromptSelection({ news: [digest] });
  assert.match(result.selectedContentItems.join('\n'), /hyra\.png/);
  assert.doesNotMatch(result.selectedContentItems.join('\n'), /sensenova/i);
});

test('Qiaomu and Guizang share one daily slot across X, Jike, main and fun pools', () => {
  const items = [
    news('Claude 辅助 Obsidian 记录的新工具', 'https://x.com/vista8/status/1', '编写本地程序保存选中文字与截图，展示具体操作。', { authors: '向阳乔木' }),
    news('GPT image 2.0 生成咖啡店插画', 'https://x.com/op7418/status/2', '上传咖啡照片，生成微缩建筑和店员，展示对照图片。', { authors: '歸藏' }),
    news('饮品照片变成微缩建筑', 'https://m.okjike.com/originalPosts/3', '上传咖啡照片，生成微缩建筑和店员，展示对照图片。', { authors: '归藏' }),
  ];
  assert.equal(new Set(items.map(getDailyPublisherKey)).size, 1);
  const result = buildDailyPromptSelection({ news: items });
  const combined = [...result.selectedContentItems, ...result.dailyFunContentItems];
  assert.equal(combined.length, 1);
});

test('an unattributed Telegram copy cannot bypass the combined creator limit', () => {
  const text = '玩一下 GPT image 2.0 吧！这个提示词能让咖啡照片变成杯子组成的门店插画。告诉模型具体咖啡豆产地后加入了云南风味，还有很多店员在里面工作。上传饮品照片，保留包装主体轮廓和品牌颜色，生成等轴测插画并拼接对比图。';
  const original = news('饮品照片生成门店插画', 'https://m.okjike.com/originalPosts/1', text, { authors: '歸藏' });
  const copied = news('🖼 玩一下 GPT image 2.0 吧！', 'https://t.me/channel/2', text);
  const jot = news('AI 开发本地笔记工具', 'https://x.com/vista8/status/3', '用快捷键把灵感与截图收进日记。', { authors: '向阳乔木' });
  const result = buildDailyPromptSelection({ news: [copied, original, jot] });
  const combined = [...result.selectedContentItems, ...result.dailyFunContentItems].join('\n');
  assert.doesNotMatch(combined, /t\.me\/channel\/2/);
  assert.equal((combined.match(/Url:/g) || []).length, 1);
});

test('aging routine self-promotion loses priority, but missing likes are never treated as zero', () => {
  const old = news('15 款 AI 设计工具实测', 'https://m.okjike.com/originalPosts/1', '整理工具入口与运行说明。', { published_date: '2026-11-02T00:00:00Z' });
  const fresh = { ...old, published_date: '2026-11-03T22:00:00Z' };
  const now = Date.parse('2026-11-04T01:00:00Z');
  assert.ok(getDailyEditorialPriority(old, now) < getDailyEditorialPriority(fresh, now));
  assert.equal(getDailyEditorialPriority(fresh, now), getDailyEditorialPriority({ ...fresh, likes: undefined }, now));
  assert.equal(inferDailyPromptSourceType(old), 'socialMedia');
});

test('a known article image is restored even after other articles meet the global illustration target', () => {
  const earlier = Array.from({ length: 6 }, (_, i) => `### ${i + 1}. 已有图片\n\n![图](https://images.example.org/${i}.png)\n\n---\n\n`).join('');
  const article = '### 7. 腾讯 Hyra 更新\n\n[科研工具架构更新](https://www.aibase.com/zh/news/32056)。\n\n---\n\n';
  const image = 'https://upload.chinaz.com/2026/1103/6392931979076550475830526.png';
  const result = ensureDailyMediaCoverage(earlier + article, [{
    url: 'https://www.aibase.com/zh/news/32056', title: 'Hyra 科研工具架构', placeholders: [`![Hyra](${image})`],
  }], 6, { coverEverySource: true });
  assert.equal(result.insertedCount, 1);
  assert.ok(result.markdown.includes(image));
  assert.match(result.markdown, /\.png "Hyra 科研工具架构"\)\n\n---/);
});
