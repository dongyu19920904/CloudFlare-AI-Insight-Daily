import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDailyGenerationPromptInput,
  countDailyTopEligiblePromptItems,
} from "../src/dailyGenerationPromptInput.js";

test("buildDailyGenerationPromptInput includes AI fun candidates in the main generation prompt", () => {
  const primaryItems = [
    [
      "News Title: Codex 帮音频转 MP4",
      "Published: 2026-05-26",
      "Url: https://x.com/vista8/status/2058786114882900133",
      "Content Summary: X 不支持直接发音频，有人让 Codex 调用 ffmpeg 把音频转成 MP4 再发。",
    ].join("\n"),
  ];
  const funItems = [
    [
      "News Title: 现在的AI非常利好2D游戏开发，动作完全交给视频模型生成，卡牌、回合制、射击、对话类、塔防都能做。",
      "Published: 2026-05-26",
      "Url: https://x.com/Gorden_Sun/status/2058939766742335643",
      "Content Summary: Gorden Sun 提到 AI 利好 2D 游戏开发，动作可以交给视频模型生成，但仍需要玩法和数值支撑。",
    ].join("\n"),
  ];

  const promptInput = buildDailyGenerationPromptInput(primaryItems, funItems);

  assert.match(promptInput, /Codex 帮音频转 MP4/);
  assert.match(promptInput, /AI趣闻专用候选素材/);
  assert.match(promptInput, /必须先选 1 条写完整趣闻/);
  assert.match(promptInput, /没有人物、用户、工具动作或反常结果/);
  assert.doesNotMatch(promptInput, /兜底/);
  assert.match(promptInput, /不要因为它们出现在这里就塞进 TOP 10/);
  assert.match(promptInput, /Hook -> What -> Punchline/);
  assert.match(promptInput, /2058939766742335643/);
});

test("buildDailyGenerationPromptInput does not duplicate fun candidates already in primary items", () => {
  const sharedItem = [
    "News Title: Codex 帮音频转 MP4",
    "Published: 2026-05-26",
    "Url: https://x.com/vista8/status/2058786114882900133",
    "Content Summary: X 不支持直接发音频，有人让 Codex 调用 ffmpeg 把音频转成 MP4 再发。",
  ].join("\n");

  const promptInput = buildDailyGenerationPromptInput([sharedItem], [sharedItem]);

  assert.doesNotMatch(promptInput, /AI趣闻专用候选素材/);
  assert.equal(promptInput.match(/2058786114882900133/g)?.length, 1);
});

test("buildDailyGenerationPromptInput hides welfare items from daily generation", () => {
  const normalItem = [
    "News Title: Claude Code 更新计划模式",
    "Published: 2026-05-28",
    "Url: https://example.com/claude-code-plan",
    "Content Summary: Claude Code 增加新的代码规划能力。",
  ].join("\n");
  const welfareItem = [
    "News Title: LinuxDo 每日薅羊毛：一个 AI credit 福利",
    "Published: 2026-05-28",
    "Url: https://linux.do/t/free-ai-credit",
    "Content Summary: 一个限时 AI credit 福利，适合今天领取。",
    "Placement Hint: This is a welfare/freebie item. Put at most one such item in 值得关注, not TOP.",
  ].join("\n");

  const promptInput = buildDailyGenerationPromptInput([normalItem, welfareItem], []);

  assert.match(promptInput, /Claude Code 更新计划模式/);
  assert.doesNotMatch(promptInput, /LinuxDo/);
  assert.doesNotMatch(promptInput, /welfare\/freebie item/);
  assert.equal(countDailyTopEligiblePromptItems([normalItem, welfareItem]), 1);
});
