import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDailyGenerationPromptInput,
  countDailyTopEligiblePromptItems,
  getDailyPromptAllocationStats,
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
  assert.match(promptInput, /不要因为它们出现在这里就塞进今日焦点/);
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

test("buildDailyGenerationPromptInput reserves rich project and social candidates for their sections", () => {
  const project = (index) => [
    `Project Name: project-${index}`,
    "Source: GitHub Trending Daily",
    `Url: https://github.com/example/project-${index}`,
  ].join("\n");
  const social = (index) => [
    `socialMedia Post by user-${index}`,
    `Url: https://x.com/user-${index}/status/${index}`,
    `Content: AI 编程实测 ${index}，包含不同的操作过程与结果。`,
  ].join("\n");
  const news = (index) => [
    `News Title: AI news ${index}`,
    `Url: https://example.com/news-${index}`,
    "Content Summary: AI 产品和行业变化。",
  ].join("\n");

  const promptInput = buildDailyGenerationPromptInput(
    [
      project(1), project(2), project(3),
      social(1), social(2), social(3), social(4),
      ...Array.from({ length: 9 }, (_, index) => news(index + 1)),
    ],
    [social(5)]
  );

  assert.match(promptInput, /栏目候选预算/);
  assert.match(promptInput, /GitHub 当日日榜项目 3 个、社媒原帖 4 条/);
  assert.match(promptInput, /为开源 TOP 项目单独预留 2 个/);
  assert.match(promptInput, /为社媒精选单独预留 3 条/);
  assert.match(promptInput, /今日焦点最多使用 2 条社媒/);
  assert.match(promptInput, /开源 TOP 项目专用候选素材/);
  assert.match(promptInput, /社媒精选专用候选素材/);
  assert.match(promptInput, /产品与行业栏目专用候选素材/);
  assert.match(promptInput, /只准写入后面的开源专用区/);
  assert.match(promptInput, /不得挪用专用区素材凑数/);
  assert.doesNotMatch(promptInput, /尚未使用的专用区合格素材提升到今日焦点/);
  assert.match(promptInput, /候选编号、筛选数量、淘汰原因和补位过程/);
  const selectedItems = [
    project(1), project(2), project(3),
    social(1), social(2), social(3), social(4),
    ...Array.from({ length: 9 }, (_, index) => news(index + 1)),
  ];
  assert.equal(countDailyTopEligiblePromptItems(selectedItems), 10);
  assert.deepEqual(getDailyPromptAllocationStats(selectedItems, [social(5)]), {
    topItems: 10,
    reservedProjectItems: 2,
    reservedSocialItems: 3,
    reservedPaperItems: 0,
    reservedNewsItems: 2,
  });
  assert.equal(promptInput.match(/user-5\/status\/5/g)?.length, 1);
  assert.doesNotMatch(promptInput, /AI趣闻专用候选素材/);
});

test("daily prompt allocation preserves TOP capacity when source volume is low", () => {
  const project = (index) => `Project Name: project-${index}\nUrl: https://github.com/example/project-${index}`;
  const social = (index) => `socialMedia Post by user-${index}\nUrl: https://x.com/user/status/${index}`;
  const news = (index) => `News Title: AI news ${index}\nUrl: https://example.com/news-${index}`;
  const selectedItems = [project(1), project(2), social(1), social(2), news(1), news(2), news(3), news(4)];

  assert.deepEqual(getDailyPromptAllocationStats(selectedItems), {
    topItems: 8,
    reservedProjectItems: 0,
    reservedSocialItems: 0,
    reservedPaperItems: 0,
    reservedNewsItems: 0,
  });
});

test("buildDailyGenerationPromptInput provides distinct TOP backup items without stealing the fun pool", () => {
  const news = (index) => [
    `News Title: AI news ${index}`,
    `Url: https://example.com/news-${index}`,
    `Content Summary: AI 产品变化 ${index}。`,
  ].join("\n");
  const social = (index) => [
    `socialMedia Post by backup-${index}`,
    `Url: https://x.com/backup/status/${index}`,
    `Content: 用户实测出现了不同结果 ${index}。`,
  ].join("\n");
  const primaryItems = Array.from({ length: 10 }, (_, index) => news(index + 1));

  const promptInput = buildDailyGenerationPromptInput(
    primaryItems,
    [
      social(1), social(2), social(3),
      ...Array.from({ length: 6 }, (_, index) => news(index + 11)),
    ]
  );

  assert.match(promptInput, /今日焦点去重备用素材/);
  assert.match(promptInput, /聚合文章也只能生成一条/);
  assert.match(promptInput, /TOP 候选 1:/);
  assert.match(promptInput, /每个 TOP 候选最多生成一条/);
  assert.equal((promptInput.match(/去重备用 \d:/g) || []).length, 5);
  assert.match(promptInput, /AI趣闻专用候选素材/);
  assert.equal((promptInput.match(/趣闻候选 \d:/g) || []).length, 1);
  assert.match(promptInput, /不得凭主观判断自行减为 6-9 条/);
});

test("buildDailyGenerationPromptInput removes duplicate source URLs and fills the TOP gap", () => {
  const sharedOne = [
    "News Title: 聚合报道里的模型价格消息",
    "Url: https://example.com/digest",
    "Content Summary: 模型价格准备调整。",
  ].join("\n");
  const sharedTwo = [
    "News Title: 聚合报道里的影像工具消息",
    "Url: https://example.com/digest",
    "Content Summary: 影像工具发布。",
  ].join("\n");
  const news = (index) => [
    `News Title: 独立消息 ${index}`,
    `Url: https://example.com/unique-${index}`,
    `Content Summary: 独立 AI 消息 ${index}。`,
  ].join("\n");
  const selectedItems = [
    sharedOne,
    sharedTwo,
    ...Array.from({ length: 8 }, (_, index) => news(index + 1)),
  ];
  const funItems = Array.from({ length: 4 }, (_, index) => news(index + 20));

  const promptInput = buildDailyGenerationPromptInput(selectedItems, funItems);

  assert.equal((promptInput.match(/https:\/\/example\.com\/digest/g) || []).length, 1);
  assert.match(promptInput, /其中至少使用 1 条补足去重后的 TOP 缺口/);
  assert.match(promptInput, /本次必须从这里选 1 条补足 TOP/);
  assert.equal(countDailyTopEligiblePromptItems(selectedItems, funItems), 10);
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
