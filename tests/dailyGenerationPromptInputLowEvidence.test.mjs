import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDailyGenerationPromptInput,
  countDailyTopEligiblePromptItems,
} from "../src/dailyGenerationPromptInput.js";

test('a concrete social product update fills the product section before a vague news item', () => {
  const news = Array.from({ length: 11 }, (_, index) => `News Title: AI research ${index}\nUrl: https://example.com/news-${index}\nContent Summary: AI research result.`);
  const product = 'socialMedia Post by 宝玉\nTitle: 豆包大模型 2.1 Pro 发布，API 上线火山方舟\nUrl: https://x.com/dotey/status/123\nContent: 模型更新了 Agent 和多模态能力。';
  const social = 'socialMedia Post by tester\nTitle: 一次 AI 开发者实测\nUrl: https://x.com/tester/status/456\nContent: 对比两个 AI 工具。';
  const prompt = buildDailyGenerationPromptInput([...news, product, social], []);
  const productSection = prompt.split('【产品与行业栏目专用候选素材】')[1]?.split('【')[0] || '';
  assert.match(productSection, /豆包大模型 2\.1 Pro 发布/);
  assert.doesNotMatch(prompt.split('【社媒精选专用候选素材】')[1]?.split('【')[0] || '', /豆包大模型 2\.1 Pro 发布/);
});


test("buildDailyGenerationPromptInput hides low-evidence AI workflow pitches from daily generation", () => {
  const normalItem = [
    "News Title: Claude Code adds a safer planning mode",
    "Published: 2026-06-10",
    "Url: https://example.com/claude-code-plan",
    "Content Summary: Claude Code improved planning for real coding workflows.",
  ].join("\n");
  const lowEvidencePitch = [
    "News Title: AI batch video workflow: five posts a day and ten thousand followers a week",
    "Published: 2026-06-10",
    "Url: https://t.me/aigc1024/21091",
    "Content Summary: The post only shows a video and copywriting, without GitHub, workflow files, configuration docs or official links.",
    "Placement Hint: This is a low-evidence AI workflow pitch. Keep it out of TOP; at most use it in watch section as unverified, or skip it.",
  ].join("\n");

  const promptInput = buildDailyGenerationPromptInput([normalItem, lowEvidencePitch], []);
  const watchOnlyMarker = "Some candidates may be AI workflow pitches without official";
  const primaryBlock = promptInput.split(watchOnlyMarker)[0];
  const watchOnlyBlock = promptInput.split(watchOnlyMarker)[1] || "";

  assert.match(primaryBlock, /Claude Code adds a safer planning mode/);
  assert.doesNotMatch(primaryBlock, /ten thousand followers a week/);
  assert.doesNotMatch(watchOnlyBlock, /ten thousand followers a week/);
  assert.doesNotMatch(watchOnlyBlock, /low-evidence AI workflow pitch/);
  assert.equal(countDailyTopEligiblePromptItems([normalItem, lowEvidencePitch]), 1);
});
