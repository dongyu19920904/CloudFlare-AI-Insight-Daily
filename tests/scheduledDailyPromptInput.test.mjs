import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDailyGenerationPromptInput,
  countDailyTopEligiblePromptItems,
  getDailyPromptItemEventKey,
  getDailyPromptAllocationStats,
  isFirstPartyDailyModelLaunch,
  isOfficialDailyModelLaunch,
} from "../src/dailyGenerationPromptInput.js";

test("daily event keys group a model launch across official and user headlines, not later policy", () => {
  const official = "News Title: OpenAI 推出 GPT-6 Sol 与 GPT-6 Luna\nUrl: https://openai.com/index/introducing-gpt-6-sol-and-luna/";
  const user = "News Title: Codex 已经可以用 GPT-6 Sol 和 Luna\nUrl: https://www.v2ex.com/t/1244096";
  const policy = "News Title: OpenAI 更新 GPT-6 Sol 企业数据政策\nUrl: https://openai.com/index/gpt-6-sol-enterprise-policy/";
  assert.equal(getDailyPromptItemEventKey(official), getDailyPromptItemEventKey(user));
  assert.notEqual(getDailyPromptItemEventKey(official), "");
  assert.notEqual(getDailyPromptItemEventKey(official), getDailyPromptItemEventKey(policy));
});

test("official availability and first-party reshares are distinct from ordinary reactions", () => {
  const openai = "News Title: Introducing GPT‑6 Sol and Luna\nUrl: https://openai.com/index/introducing-gpt-6-sol-and-luna/";
  const anthropic = "News Title: Claude Opus 5.5 is available today.\nUrl: https://x.com/AnthropicAI/status/2102435703535939725";
  const reshare = "News Title: GPT-6 Sol and Luna are great models\nUrl: https://x.com/sama/status/2102464201335984392\nContent Summary: OpenAI: Please welcome GPT-6 Sol and GPT-6 Luna";
  const reaction = "News Title: GPT-6 Sol and Luna are great models\nUrl: https://x.com/sama/status/2102464201335984392\nContent Summary: I like the characters.";
  assert.equal(isOfficialDailyModelLaunch(openai), true);
  assert.equal(isOfficialDailyModelLaunch(anthropic), true);
  assert.equal(isOfficialDailyModelLaunch(reshare), false);
  assert.equal(isFirstPartyDailyModelLaunch(reshare), true);
  assert.equal(isFirstPartyDailyModelLaunch(reaction), false);
});

test("an official model announcement from social sources remains eligible for TOP", () => {
  const official = [
    "socialMedia Post by Anthropic",
    "Title: Anthropic 发布 Claude Opus 5.5",
    "Url: https://x.com/AnthropicAI/status/2102435703535939725",
    "Content: Claude Opus 5.5 正式发布。",
    "Placement Hint: Verified major model launch. Keep in TOP competition.",
  ].join("\n");
  const news = Array.from({ length: 10 }, (_, index) => [
    `News Title: 独立 AI 事件 ${index + 1}`,
    `Url: https://example.com/ai-${index + 1}`,
    "Content Summary: 一件独立的 AI 产品事件。",
  ].join("\n"));

  const prompt = buildDailyGenerationPromptInput([official, ...news]);
  assert.match(prompt, /TOP 候选 \d+:[\s\S]*Anthropic 发布 Claude Opus 5\.5/);
  assert.doesNotMatch(prompt, /社媒精选专用候选素材[\s\S]*Anthropic 发布 Claude Opus 5\.5/);
  assert.equal(countDailyTopEligiblePromptItems([official, ...news]), 10);
});

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

test("daily prompt allocation keeps at most one GitHub project in a low-volume TOP", () => {
  const project = (index) => `Project Name: project-${index}\nUrl: https://github.com/example/project-${index}`;
  const social = (index) => `socialMedia Post by user-${index}\nUrl: https://x.com/user/status/${index}`;
  const news = (index) => `News Title: AI news ${index}\nUrl: https://example.com/news-${index}`;
  const selectedItems = [project(1), project(2), social(1), social(2), news(1), news(2), news(3), news(4)];

  assert.deepEqual(getDailyPromptAllocationStats(selectedItems), {
    topItems: 7,
    reservedProjectItems: 1,
    reservedSocialItems: 0,
    reservedPaperItems: 0,
    reservedNewsItems: 0,
  });
});

test("daily prompt fills low-volume TOP slots after reserving extra GitHub projects", () => {
  const project = (index) => `Project Name: project-${index}\nUrl: https://github.com/example/project-${index}`;
  const news = (index) => `News Title: AI news ${index}\nUrl: https://example.com/news-${index}`;
  const selectedItems = [project(1), project(2), project(3), ...Array.from({ length: 6 }, (_, index) => news(index + 1))];
  const backupItems = Array.from({ length: 5 }, (_, index) => news(index + 20));

  const promptInput = buildDailyGenerationPromptInput(selectedItems, backupItems);
  const topCandidates = promptInput.match(/【今日焦点候选素材】[\s\S]*?(?=【今日焦点去重替换素材】|【开源 TOP 项目专用候选素材】)/)?.[0] || "";
  const openSourceCandidates = promptInput.match(/【开源 TOP 项目专用候选素材】[\s\S]*?(?=【|$)/)?.[0] || "";

  assert.match(topCandidates, /TOP 候选 10:/);
  assert.equal((topCandidates.match(/^Project Name:/gm) || []).length, 1);
  assert.equal((openSourceCandidates.match(/^Project Name:/gm) || []).length, 2);
  assert.equal(countDailyTopEligiblePromptItems(selectedItems, backupItems), 10);
});

test("daily prompt fills TOP before reserving an optional fun candidate", () => {
  const project = (index) => `Project Name: project-${index}\nUrl: https://github.com/example/project-${index}`;
  const news = (index) => `News Title: AI news ${index}\nUrl: https://example.com/news-${index}`;
  const selectedItems = [
    project(1), project(2), project(3),
    ...Array.from({ length: 7 }, (_, index) => news(index + 1)),
  ];
  const backupItems = [news(20), news(21)];

  const promptInput = buildDailyGenerationPromptInput(selectedItems, backupItems);

  assert.match(promptInput, /TOP 候选 10:/);
  assert.doesNotMatch(promptInput, /AI趣闻专用候选素材/);
  assert.equal(countDailyTopEligiblePromptItems(selectedItems, backupItems), 10);
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

  assert.match(promptInput, /今日焦点去重替换素材/);
  assert.match(promptInput, /聚合文章也只能生成一条/);
  assert.match(promptInput, /TOP 候选 1:/);
  assert.match(promptInput, /TOP 候选 10:/);
  assert.match(promptInput, /每个明确 TOP 候选都必须在今日焦点中一对一生成一条/);
  assert.equal((promptInput.match(/去重备用 \d:/g) || []).length, 5);
  assert.match(promptInput, /AI趣闻专用候选素材/);
  assert.equal((promptInput.match(/趣闻候选 \d:/g) || []).length, 1);
  assert.match(promptInput, /组成 10 条明确 TOP 候选/);
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
  assert.match(promptInput, /已从补位池提取 1 条，与原主候选组成 10 条明确 TOP 候选/);
  assert.match(promptInput, /TOP 候选 10:/);
  assert.equal((promptInput.match(/去重备用 \d:/g) || []).length, 2);
  assert.equal(countDailyTopEligiblePromptItems(selectedItems, funItems), 10);
});

test("buildDailyGenerationPromptInput keeps one Jev event across news and social reserves", () => {
  const selectedItems = [
    [
      "News Title: TypeSafe AI 推出只做决策的新模型",
      "Url: https://example.com/typesafe-model",
      "Content Summary: Jev 专注结构化决策，并开放候补名单。",
    ].join("\n"),
    [
      "News Title: Vercel AI Gateway 接入新决策模型",
      "Url: https://example.com/gateway-model",
      "Content Summary: 开发者现在可以通过网关调用 Jev。",
    ].join("\n"),
  ];
  const socialItems = [
    [
      "socialMedia Post by tester",
      "Url: https://x.com/tester/status/jev",
      "Content: 用户通过 Jev Waitlist，并用 Codex 调用成功。",
    ].join("\n"),
    ...Array.from({ length: 3 }, (_, index) => [
      `socialMedia Post by tester${index}`,
      `Url: https://x.com/tester/status/other-${index}`,
      `Content: AI 工具独立实测 ${index}。`,
    ].join("\n")),
  ];

  const promptInput = buildDailyGenerationPromptInput(selectedItems, socialItems);

  assert.match(promptInput, /typesafe-model/);
  assert.doesNotMatch(promptInput, /gateway-model|status\/jev/);
  assert.match(promptInput, /status\/other-0/);
});

test("buildDailyGenerationPromptInput keeps one ChatGPT GitHub PR event", () => {
  const selectedItems = [[
    "socialMedia Post by author",
    "Url: https://x.com/author/status/plan",
    "Content: ChatGPT Pro 分析 GitHub 仓库、编写技术方案并提交 PR。",
  ].join("\n")];
  const socialItems = [[
    "socialMedia Post by author",
    "Url: https://x.com/author/status/web-pr",
    "Content: ChatGPT 网页端粘贴 GitHub 链接后可修改代码并提交 PR。",
  ].join("\n")];

  const promptInput = buildDailyGenerationPromptInput(selectedItems, socialItems);

  assert.match(promptInput, /status\/plan/);
  assert.doesNotMatch(promptInput, /status\/web-pr/);
});

test("buildDailyGenerationPromptInput does not reintroduce the same Xiaomi quarter from backups", () => {
  const news = (index) => [
    `News Title: 独立 AI 消息 ${index}`,
    `Url: https://example.com/ai-${index}`,
    `Content Summary: 独立 AI 产品变化 ${index}。`,
  ].join("\n");
  const selectedItems = [
    [
      "News Title: 小米 Q2 净利润下滑但玄戒芯片出货破百万",
      "Url: https://example.com/xiaomi-q2-profit",
      "Content Summary: 小米二季度财报披露营收、净利润和汽车业务数据。",
    ].join("\n"),
    ...Array.from({ length: 8 }, (_, index) => news(index + 1)),
  ];
  const funItems = [
    [
      "News Title: 小米手机出货量全球 53 国进前三",
      "Url: https://example.com/xiaomi-q2-shipments",
      "Content Summary: 同一份小米 Q2 财报披露手机与 AIoT 收入。",
    ].join("\n"),
    news(20),
    news(21),
  ];

  const promptInput = buildDailyGenerationPromptInput(selectedItems, funItems);

  assert.doesNotMatch(promptInput, /xiaomi-q2-shipments/);
  assert.match(promptInput, /TOP 候选 10:[\s\S]*ai-20/);
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
