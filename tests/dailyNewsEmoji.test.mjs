import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDailyNewsEmoji } from '../src/dailyNewsEmoji.js';

test('adds topic emojis to daily prose while preserving existing choices, Markdown and FAQ', () => {
  const raw = [
    '## **今日摘要**', '', '一句摘要。', '',
    '## **🔥 今日焦点 TOP 10**', '', '### 1. ChatGPT 改进语音输入', '',
    '**语音听写可编辑。** [报道](https://example.test/new)介绍了新能力。',
    '![有自己的图注 🔥](https://example.test/image.png "图注")', '',
    '### 2. 数学证明仍待验证', '', '**仍在核实。** [原帖](https://example.test/math)没有给出最终结论。',
    '## **⚡ 产品与功能更新**', '', '### Suno 视频工具', '', '已支持编辑🎬。',
    '## **◉ 社媒精选**', '', '### 签证讨论', '', '帖子在讨论签证政策。',
    '## **前沿研究**', '', '### 一个样本', '', '```md', '## 相关问题', '### 代码示例', '```', '', '同领域论文提供了不同视角。',
    '## **AI趣闻**', '', '### 元素周期表被用来给 AI 命名', '', '有人把模型名字排成了一张元素周期表。',
    '## **相关问题**', '', '### 去哪里核对？', '', '去看官方说明。', '',
  ].join('\r\n');
  const out = ensureDailyNewsEmoji(raw);
  assert.match(out, /\*\*语音听写可编辑。\*\* 🎙️ \[报道\]/u);
  assert.match(out, /\*\*仍在核实。\*\* 📐 \[原帖\]/u);
  assert.match(out, /已支持编辑🎬。/u);
  assert.match(out, /帖子在讨论签证政策📄。/u);
  assert.match(out, /同领域论文提供了不同视角📄。/u);
  assert.match(out, /排成了一张元素周期表🧪。/u);
  assert.equal(out.replace(/ (?:🎙️|📐)|📄|🧪/gu, ''), raw);
  assert.equal(ensureDailyNewsEmoji(out), out);
});

test('does not mistake emoji in link labels or fenced examples for visible prose coverage', () => {
  const raw = '## 开源 TOP 项目\n\n### Repo\n\n```\n🤔\n```\n\n[一手仓库🔗](https://github.com/example/repo)提供可本地运行的开源工具。\n';
  const rendered = ensureDailyNewsEmoji(raw);
  assert.match(rendered, /\[一手仓库🔗\]\(https:\/\/github\.com\/example\/repo\)提供可本地运行的开源工具📦。/u);
  const media = '## 今日焦点 TOP 10\n\n### 1. 只有配图\n\n![示例](https://example.test/a.webp)\n';
  assert.equal(ensureDailyNewsEmoji(media), media);
  assert.equal(ensureDailyNewsEmoji('## 相关问题\n\n### 不改问答\n\n内容。\n'), '## 相关问题\n\n### 不改问答\n\n内容。\n');
});

test('keeps one visible emoji and never changes balanced or titled Markdown destinations', () => {
  const header = '## 今日焦点 TOP 10\n\n### 1. ChatGPT 语音输入\n\n';
  const url = 'https://example.test/v1_(draft)/说明。html';
  const body = `实测看[原始语音输入](${url} "语音示例")可以转写。`;
  assert.equal(ensureDailyNewsEmoji(header + body), header + body.replace('可以转写。', '可以转写🎙️。'));
  const duplicates = '听写可编辑 🎙️   📝。\n\n后续还有 🇨🇳 标记。';
  assert.equal(ensureDailyNewsEmoji(header + duplicates).replace(/ +/g, ' '),
    header + '听写可编辑 🎙️ 。\n\n后续还有 标记。');
  const ownLine = header + '听写可编辑。\n🎙️\n';
  assert.equal(ensureDailyNewsEmoji(ownLine), ownLine);
  const multilineLink = `[原始语音输入](${url}\n "语音示例")`;
  const withTitle = header + `实测看${multilineLink}可以转写。\n`;
  const marked = ensureDailyNewsEmoji(withTitle);
  assert.ok(marked.includes(multilineLink));
  assert.equal(marked.replace(/ ?🎙️/u, ''), withTitle);
});
