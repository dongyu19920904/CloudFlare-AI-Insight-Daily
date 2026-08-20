import test from "node:test";
import assert from "node:assert/strict";

import { buildDailyPromptSelection } from "../src/dailyPromptSelection.js";

function buildNewsItem(index) {
  return {
    type: "news",
    title: `News ${index}`,
    description: `AI model news description ${index}`,
    source: "AI Base",
    url: `https://example.com/news-${index}`,
    published_date: "2026-04-06",
    details: {
      content_html: `<p>News ${index} content about AI tools and agents.</p>`,
    },
  };
}

function buildProjectItem(index) {
  return {
    type: "project",
    title: `Project ${index}`,
    description: `AI agent project description ${index}`,
    source: "GitHub Trending Daily",
    url: `https://github.com/example/project-${index}`,
    published_date: "2026-04-06",
    details: {
      owner: "example",
      language: "TypeScript",
      starsToday: 100 + index,
      totalStars: 1000 + index,
        sourceKind: "trending-daily",
        content_html: `<p>Project ${index} AI agent workflow template release</p>`,
    },
  };
}

test("buildDailyPromptSelection reserves prompt slots for GitHub projects", () => {
  const result = buildDailyPromptSelection(
    {
      news: Array.from({ length: 8 }, (_, index) => buildNewsItem(index + 1)),
      project: Array.from({ length: 3 }, (_, index) => buildProjectItem(index + 1)),
      socialMedia: [
        {
          type: "socialMedia",
          title: "Social post",
          authors: "tester",
          source: "X",
          url: "https://example.com/social-1",
          published_date: "2026-04-06",
          details: {
            content_html: "<p>Social summary about AI agents.</p>",
          },
        },
      ],
      paper: [],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 6,
      DAILY_PROMPT_NEWS_ITEMS: 3,
      DAILY_PROMPT_PROJECT_ITEMS: 2,
      DAILY_PROMPT_PROJECT_HARD_CAP: 2,
      DAILY_PROMPT_SOCIAL_ITEMS: 1,
      DAILY_PROMPT_PAPER_ITEMS: 0,
    }
  );

  assert.equal(result.selectedContentItems.length, 6);
  assert.equal(result.selectedCounts.news, 3);
  assert.equal(result.selectedCounts.project, 2);
  assert.equal(result.selectedCounts.socialMedia, 1);
  assert.match(result.selectedContentItems.join("\n"), /Project Name:/);
  assert.match(result.selectedContentItems.join("\n"), /Source: GitHub Trending Daily/);
  assert.match(result.selectedContentItems.join("\n"), /Stars Today:/);
  assert.deepEqual(result.allowedTopGithubProjectUrls.sort(), [
    "https://github.com/example/project-1",
    "https://github.com/example/project-2",
  ]);
});

test("buildDailyPromptSelection keeps four default project candidates for the open-source section", () => {
  const result = buildDailyPromptSelection({
    news: Array.from({ length: 4 }, (_, index) => buildNewsItem(index + 1)),
    project: Array.from({ length: 10 }, (_, index) => buildProjectItem(index + 1)),
    socialMedia: [],
    paper: [],
  });

  assert.equal(result.selectedCounts.project, 4);
});

test("buildDailyPromptSelection classifies direct X links from Folo feeds as social posts", () => {
  const result = buildDailyPromptSelection(
    {
      news: [
        {
          type: "news",
          title: "开发者分享 Claude Code 的上下文压缩实测",
          description: "一条来自 Folo 聚合源的 AI 编程实测。",
          source: "Folo Multi Feed",
          url: "https://x.com/example/status/123456789",
          published_date: "2026-08-02",
          authors: "example",
          details: {
            content_html: "<p>开发者展示 Claude Code 如何压缩上下文并减少重复读取。</p>",
          },
        },
      ],
      project: [],
      socialMedia: [],
      paper: [],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 1,
      DAILY_PROMPT_SOCIAL_ITEMS: 1,
    }
  );

  assert.equal(result.selectedCounts.news, 0);
  assert.equal(result.selectedCounts.socialMedia, 1);
  assert.match(result.selectedContentItems[0], /socialMedia Post by example/);
  assert.match(result.selectedContentItems[0], /x\.com\/example\/status/);
});

test("buildDailyPromptSelection treats project-like news as part of the project cap", () => {
  const result = buildDailyPromptSelection({
    news: [
      {
        ...buildNewsItem(1),
        title: "ColaMD 1.5 open-source project ships",
        description: "Markdown renders slides with a GitHub repo at github.com/marswaveai/ColaMD.",
        url: "https://example.com/colamd",
        details: {
          content_html: "<p>GitHub address: https://github.com/marswaveai/ColaMD</p>",
        },
      },
      ...Array.from({ length: 4 }, (_, index) => buildNewsItem(index + 2)),
    ],
    project: [buildProjectItem(1)],
    socialMedia: [],
    paper: [],
  });

  const selectedText = result.selectedContentItems.join("\n");
  assert.match(selectedText, /Project Name:/);
  assert.doesNotMatch(selectedText, /ColaMD/i);
});

test("buildDailyPromptSelection only allows AI-related daily trending projects for TOP", () => {
  const searchProject = buildProjectItem(1);
  searchProject.title = "Claude helper from search";
  searchProject.source = "GitHub Search";
  searchProject.details.sourceKind = "search";

  const nonAiTrendingProject = buildProjectItem(2);
  nonAiTrendingProject.title = "invoice-exporter";
  nonAiTrendingProject.description = "A small accounting CSV export utility.";
  nonAiTrendingProject.details.content_html = "<p>A small accounting CSV export utility.</p>";

  const aiTrendingProject = buildProjectItem(3);
  aiTrendingProject.title = "mcp-agent-workbench";
  aiTrendingProject.description = "AI agent workbench for testing MCP server workflows.";

  const result = buildDailyPromptSelection(
    {
      news: Array.from({ length: 2 }, (_, index) => buildNewsItem(index + 1)),
      project: [searchProject, nonAiTrendingProject, aiTrendingProject],
      socialMedia: [],
      paper: [],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 4,
      DAILY_PROMPT_NEWS_ITEMS: 2,
      DAILY_PROMPT_PROJECT_ITEMS: 2,
      DAILY_PROMPT_PROJECT_HARD_CAP: 2,
      DAILY_PROMPT_SOCIAL_ITEMS: 0,
      DAILY_PROMPT_PAPER_ITEMS: 0,
    }
  );

  const promptText = result.selectedContentItems.join("\n");
  assert.match(promptText, /mcp-agent-workbench/);
  assert.doesNotMatch(promptText, /Claude helper from search/);
  assert.doesNotMatch(promptText, /invoice-exporter/);
  assert.deepEqual(result.allowedTopGithubProjectUrls, ["https://github.com/example/project-3"]);
});

test("buildDailyPromptSelection keeps one major AI vendor from flooding the prompt", () => {
  const result = buildDailyPromptSelection(
    {
      news: [
        {
          ...buildNewsItem(1),
          title: "Anthropic explains Claude interpretability breakthrough",
          description: "Claude can translate internal activations into natural language.",
          url: "https://example.com/anthropic-1",
        },
        {
          ...buildNewsItem(2),
          title: "Claude refuses a shutdown blackmail scenario",
          description: "Anthropic safety test reveals hidden model reasoning.",
          url: "https://example.com/anthropic-2",
        },
        {
          ...buildNewsItem(3),
          title: "OpenAI releases realtime voice models",
          description: "ChatGPT voice and realtime transcription get dedicated models.",
          url: "https://example.com/openai-voice",
        },
        {
          ...buildNewsItem(4),
          title: "Google ships Gemini low latency model",
          description: "Gemini Flash-Lite focuses on cheaper inference.",
          url: "https://example.com/google-gemini",
        },
      ],
      project: [],
      socialMedia: [],
      paper: [],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 4,
      DAILY_PROMPT_NEWS_ITEMS: 4,
      DAILY_PROMPT_PROJECT_ITEMS: 0,
      DAILY_PROMPT_SOCIAL_ITEMS: 0,
      DAILY_PROMPT_PAPER_ITEMS: 0,
    }
  );

  const selectedAnthropicItems = result.selectedContentItems.filter((item) =>
    /Anthropic|Claude/i.test(item)
  );

  assert.equal(selectedAnthropicItems.length, 1);
});

test("buildDailyPromptSelection keeps one Xiaomi earnings story", () => {
  const result = buildDailyPromptSelection(
    {
      news: [
        {
          ...buildNewsItem(1),
          title: "小米 Q2 营收破千亿但 AI 业务仍在投入",
          description: "小米披露季度营收、汽车交付与玄戒芯片进展。",
          url: "https://example.com/xiaomi-q2-earnings",
        },
        {
          ...buildNewsItem(2),
          title: "小米手机出货量全球 53 国进前三",
          description: "同一份小米 Q2 财报的手机与 AIoT 数据。",
          url: "https://example.com/xiaomi-q2-shipments",
        },
        {
          ...buildNewsItem(3),
          title: "OpenAI releases a new realtime model",
          description: "The official release adds low-latency AI voice support.",
          url: "https://example.com/openai-realtime",
        },
      ],
      project: [],
      socialMedia: [],
      paper: [],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 3,
      DAILY_PROMPT_NEWS_ITEMS: 3,
      DAILY_PROMPT_PROJECT_ITEMS: 0,
      DAILY_PROMPT_SOCIAL_ITEMS: 0,
      DAILY_PROMPT_PAPER_ITEMS: 0,
    }
  );

  assert.equal(result.selectedContentItems.filter((item) => /小米|玄戒|xiaomi/i.test(item)).length, 1);
  assert.match(result.selectedContentItems.join("\n"), /OpenAI releases a new realtime model/);
});

test("buildDailyPromptSelection keeps one welfare item available for watch section", () => {
  const result = buildDailyPromptSelection({
    news: [
      ...Array.from({ length: 30 }, (_, index) => buildNewsItem(index + 1)),
      {
        type: "news",
        title: "LinuxDo 每日薅羊毛：一个值得领的 AI 福利",
        description: "今天最值得看的优惠福利，适合放在值得关注里提醒读者。",
        source: "每日薅羊毛",
        url: "https://linux.do/t/free-ai-credit",
        published_date: "2026-05-09",
        details: {
          content_html: "<p>一个限时 AI credit 福利，适合今天领取。</p>",
        },
      },
    ],
    project: [],
    socialMedia: [],
    paper: [],
  });

  const promptText = result.selectedContentItems.join("\n");
  assert.match(promptText, /每日薅羊毛/);
  assert.match(promptText, /Placement Hint: This is a welfare\/freebie item/);
});

test("buildDailyPromptSelection filters unrelated tech and game news before prompting", () => {
  const result = buildDailyPromptSelection(
    {
      news: [
        {
          type: "news",
          title: "GrapheneOS fixes an Android VPN leak",
          description: "A mobile security patch for VPN traffic leakage.",
          source: "Security News",
          url: "https://example.com/android-vpn-leak",
          published_date: "2026-05-10",
          details: {
            content_html: "<p>Android VPN traffic could leak outside the tunnel.</p>",
          },
        },
        {
          type: "news",
          title: "Nintendo raises Switch 2 prices",
          description: "Game console pricing changes in Japan and the US.",
          source: "Game News",
          url: "https://example.com/nintendo-price",
          published_date: "2026-05-10",
          details: {
            content_html: "<p>Supply chain costs pushed console prices higher. An unrelated sidebar mentions AI once.</p>",
          },
        },
        {
          type: "socialMedia",
          title: "dotey on X",
          description: "",
          authors: "dotey",
          source: "X",
          url: "https://example.com/nintendo-social",
          published_date: "2026-05-10",
          details: {
            content_html: "<p>任天堂全线涨价，Switch 2 日本涨20%，美国9月跟进。评论区顺手提了一次 AI。</p>",
          },
        },
        {
          type: "news",
          title: "Mac mini becomes a local AI agent server",
          description: "Developers are using Apple Silicon machines to run private AI agents.",
          source: "Developer Post",
          url: "https://example.com/mac-ai-agent",
          published_date: "2026-05-10",
          details: {
            content_html: '<p>Local AI agent infrastructure is moving onto Mac mini.</p><img src="https://example.com/mac.jpg">',
          },
        },
      ],
      project: [],
      socialMedia: [],
      paper: [],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 3,
      DAILY_PROMPT_NEWS_ITEMS: 3,
      DAILY_PROMPT_PROJECT_ITEMS: 0,
      DAILY_PROMPT_SOCIAL_ITEMS: 0,
      DAILY_PROMPT_PAPER_ITEMS: 0,
    }
  );

  const promptText = result.selectedContentItems.join("\n");
  assert.match(promptText, /local AI agent server/i);
  assert.match(promptText, /Placement Hint: This item has usable media/);
  assert.doesNotMatch(promptText, /GrapheneOS/i);
  assert.doesNotMatch(promptText, /Nintendo/i);
  assert.doesNotMatch(promptText, /Switch 2/i);
  assert.equal(result.selectionDiagnostics.rejectedNonAiCount, 3);
});

test("buildDailyPromptSelection filters lifestyle filler even when body mentions AI incidentally", () => {
  const result = buildDailyPromptSelection(
    {
      news: [
        {
          type: "news",
          title: "告别盲目锻炼，这份周练计划直接照做",
          description: "面向新手、中级和高级人群的健身训练计划。",
          source: "Lifestyle",
          url: "https://example.com/workout-plan",
          published_date: "2026-05-10",
          details: {
            content_html: "<p>这是一份完整周练计划。文章评论里顺手提到 AI 从业者也久坐。</p>",
          },
        },
        {
          type: "news",
          title: "男人终极训练与强肾健体课程",
          description: "彭祖健体训练，正文顺手提到 AI 从业者久坐。",
          source: "Lifestyle",
          url: "https://example.com/fitness-course",
          published_date: "2026-08-20",
          details: { content_html: "<p>健体课程，AI 只是顺带提及。</p>" },
        },
        {
          type: "news",
          title: "中国咖啡一哥换对手了",
          description: "瑞幸与库迪的咖啡市场竞争。",
          source: "Business",
          url: "https://example.com/coffee",
          published_date: "2026-08-20",
          details: { content_html: "<p>咖啡行业文章提到门店用 AI 排班。</p>" },
        },
        {
          type: "news",
          title: "德国电价上涨后阳台光伏走红",
          description: "家庭光伏发电与能源价格。",
          source: "Energy",
          url: "https://example.com/solar",
          published_date: "2026-08-20",
          details: { content_html: "<p>能源报道顺手提及 AI 数据中心。</p>" },
        },
        {
          type: "news",
          title: "OpenAI ships a new agent workflow",
          description: "A concrete AI agent product update for developers.",
          source: "AI Base",
          url: "https://example.com/openai-agent-workflow",
          published_date: "2026-05-10",
          details: {
            content_html: "<p>OpenAI agent workflow update for developer automation.</p>",
          },
        },
      ],
      project: [],
      socialMedia: [],
      paper: [],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 2,
      DAILY_PROMPT_NEWS_ITEMS: 2,
      DAILY_PROMPT_PROJECT_ITEMS: 0,
      DAILY_PROMPT_SOCIAL_ITEMS: 0,
      DAILY_PROMPT_PAPER_ITEMS: 0,
    }
  );

  const promptText = result.selectedContentItems.join("\n");
  assert.match(promptText, /OpenAI ships a new agent workflow/);
  assert.doesNotMatch(promptText, /周练计划/);
  assert.doesNotMatch(promptText, /workout-plan/);
  assert.doesNotMatch(promptText, /强肾健体|咖啡一哥|阳台光伏/);
  assert.equal(result.selectionDiagnostics.rejectedNonAiCount, 4);
});

test("buildDailyPromptSelection presents media-backed candidates near prompt front", () => {
  const lowStarProject = buildProjectItem(1);
  lowStarProject.title = "Agent CLI project update";
  lowStarProject.description = "AI agent command line project update";
  lowStarProject.details = {
    ...lowStarProject.details,
    starsToday: 1,
    content_html: "<p>AI agent command line project update.</p>",
  };

  const result = buildDailyPromptSelection(
    {
      news: [
        {
          ...buildNewsItem(1),
          title: "OpenAI launches visual agent dashboard",
          description: "AI agent release with an official screenshot.",
          url: "https://example.com/media-news",
          details: {
            content_html:
              '<p>OpenAI launches a visual agent dashboard.</p><img src="https://example.com/dashboard.jpg" alt="dashboard">',
          },
        },
      ],
      project: [lowStarProject],
      socialMedia: [],
      paper: [],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 2,
      DAILY_PROMPT_NEWS_ITEMS: 1,
      DAILY_PROMPT_PROJECT_ITEMS: 1,
      DAILY_PROMPT_PROJECT_HARD_CAP: 1,
      DAILY_PROMPT_SOCIAL_ITEMS: 0,
      DAILY_PROMPT_PAPER_ITEMS: 0,
    }
  );

  assert.match(result.selectedContentItems[0], /News Title: OpenAI launches visual agent dashboard/);
  assert.match(result.selectedContentItems[0], /Media References:/);
  assert.equal(result.selectionDiagnostics.selectedMediaCount, 1);
  assert.equal(result.selectionDiagnostics.selectedMediaInFirstFive, 1);
});

test("buildDailyPromptSelection does not expose volatile Telegram CDN images", () => {
  const result = buildDailyPromptSelection({
    news: [{
      ...buildNewsItem(1),
      title: "Moonshot publishes a new AI vision benchmark",
      description: "A reproducible AI vision benchmark update.",
      url: "https://t.me/example/1",
      details: {
        content_html: '<p>Benchmark details.</p><img src="https://cdn5.telesco.pe/file/example.jpg" alt="benchmark">',
      },
    }],
    project: [],
    socialMedia: [],
    paper: [],
  });

  assert.equal(result.itemsWithMedia, 0);
  assert.equal(result.mediaCandidates.length, 0);
  assert.doesNotMatch(result.selectedContentItems.join("\n"), /Media References|telesco\.pe/);
});

test("buildDailyPromptSelection rejects profile avatars but keeps article media", () => {
  const result = buildDailyPromptSelection(
    {
      news: [
        {
          ...buildNewsItem(1),
          title: "开发者展示 AI 编程助手的新交互",
          url: "https://x.com/developer/status/1",
          details: {
            content_html: '<p>开发者展示 AI 编程助手。</p><img src="https://pbs.twimg.com/profile_images/123/user_normal.jpg" alt="avatar">',
          },
        },
        {
          ...buildNewsItem(2),
          title: "开发者展示 AI 视频模型的新画面",
          url: "https://x.com/developer/status/2",
          details: {
            content_html: '<p>开发者展示 AI 视频模型。</p><img src="https://pbs.twimg.com/media/demo.jpg" alt="video demo">',
          },
        },
      ],
      project: [],
      socialMedia: [],
      paper: [],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 2,
      DAILY_PROMPT_NEWS_ITEMS: 0,
      DAILY_PROMPT_SOCIAL_ITEMS: 2,
      DAILY_PROMPT_PROJECT_ITEMS: 0,
      DAILY_PROMPT_PAPER_ITEMS: 0,
    },
  );

  assert.equal(result.itemsWithMedia, 1);
  assert.equal(result.mediaCandidates.length, 1);
  assert.equal(result.mediaCandidates[0].url, "https://x.com/developer/status/2");
  assert.doesNotMatch(result.selectedContentItems.join("\n"), /profile_images|user_normal/);
  assert.match(result.selectedContentItems.join("\n"), /pbs\.twimg\.com\/media\/demo\.jpg/);
});

test("buildDailyPromptSelection keeps a human-facing fun candidate pool outside main ranking", () => {
  const result = buildDailyPromptSelection(
    {
      news: [
        {
          ...buildNewsItem(1),
          title: "OpenAI updates enterprise admin controls",
          description: "Important but dry AI product governance update.",
          url: "https://example.com/admin-controls",
        },
        {
          type: "news",
          title: "用户让 Kimi WebBridge 自动填完一张复杂表单",
          description: "一个用户把浏览器里的重复点击交给 AI 处理，原本十几步的流程变成一句话。",
          source: "即刻",
          url: "https://m.okjike.com/originalPosts/kimi-form",
          published_date: "2026-05-16",
          details: {
            content_html:
              '<p>用户体验 Kimi WebBridge 自动填表，截图里能看到浏览器被 AI 接管。</p><img src="https://example.com/kimi.jpg">',
          },
        },
      ],
      project: [],
      socialMedia: [],
      paper: [
        {
          type: "paper",
          title: "A benchmark paper about AI medication recommendation",
          description: "Benchmark paper",
          source: "arXiv",
          url: "https://arxiv.org/abs/2605.14543",
          published_date: "2026-05-16",
          details: {
            content_html: "<p>Abstract about AI medication recommendation benchmark.</p>",
          },
        },
      ],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 1,
      DAILY_PROMPT_NEWS_ITEMS: 1,
      DAILY_PROMPT_PROJECT_ITEMS: 0,
      DAILY_PROMPT_SOCIAL_ITEMS: 0,
      DAILY_PROMPT_PAPER_ITEMS: 0,
      DAILY_FUN_FALLBACK_CANDIDATES: 3,
    }
  );

  assert.equal(result.selectedContentItems.length, 1);
  assert.match(result.dailyFunContentItems.join("\n"), /Kimi WebBridge/);
  assert.doesNotMatch(result.dailyFunContentItems.join("\n"), /benchmark paper/i);
  assert.equal(result.selectionDiagnostics.dailyFunCandidateCount, result.dailyFunContentItems.length);
  assert.ok(result.selectionDiagnostics.dailyFunCandidateCount >= 1);
});

test("buildDailyPromptSelection reserves one strong fun candidate when primary prompt would consume them all", () => {
  const topics = [
    "Kimi 填表多点十下",
    "Codex 把音频装进视频",
    "Claude 测试认错又重跑",
    "Cursor 终端红屏巡逻",
    "ChatGPT 行程排成早八",
    "Gemini 截图分类分太细",
    "MCP 插件串门走错门",
    "Sora 动图多长一秒",
    "Grok 群聊总结抓错重点",
    "Agent 周报写出工位味",
    "Copilot 注释越改越长",
    "Roo Code 脚本跑到加班",
  ];
  const funNewsItems = topics.map((topic, index) => ({
    type: "news",
    title: topic,
    description: "开发者在即刻分享 AI 编程实测，工具接管浏览器和终端，结果把小任务办得过分认真。",
    source: "即刻",
    url: `https://m.okjike.com/originalPosts/fun-${index + 1}`,
    published_date: "2026-05-29",
    details: {
      content_html:
        "<p>用户截图演示 Cursor、Claude 和浏览器一起处理报错，AI 自动点击、改代码、重试，最后还要人来收拾现场。</p>",
    },
  }));

  const result = buildDailyPromptSelection(
    {
      news: funNewsItems,
      project: [],
      socialMedia: [],
      paper: [],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 12,
      DAILY_PROMPT_NEWS_ITEMS: 12,
      DAILY_PROMPT_PROJECT_ITEMS: 0,
      DAILY_PROMPT_SOCIAL_ITEMS: 0,
      DAILY_PROMPT_PAPER_ITEMS: 0,
      DAILY_PROMPT_ENTITY_HARD_CAP: 99,
      DAILY_FUN_FALLBACK_CANDIDATES: 12,
    }
  );

  const primaryItems = new Set(result.selectedContentItems);
  const funOnlyItems = result.dailyFunContentItems.filter((item) => !primaryItems.has(item));

  assert.equal(result.selectedContentItems.length, 11);
  assert.ok(funOnlyItems.length >= 1);
  assert.equal(result.selectionDiagnostics.dailyFunReservedFromPrimary, true);
  assert.equal(result.selectionDiagnostics.dailyFunCandidateSamples[0].reservedForFun, true);
  assert.match(funOnlyItems.join("\n"), /Kimi 填表|收拾现场/);
});

test("buildDailyPromptSelection returns diagnostics for status reporting", () => {
  const result = buildDailyPromptSelection(
    {
      news: Array.from({ length: 3 }, (_, index) => buildNewsItem(index + 1)),
      project: [buildProjectItem(1)],
      socialMedia: [],
      paper: [],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 4,
      DAILY_PROMPT_NEWS_ITEMS: 3,
      DAILY_PROMPT_PROJECT_ITEMS: 1,
      DAILY_PROMPT_SOCIAL_ITEMS: 0,
      DAILY_PROMPT_PAPER_ITEMS: 0,
    }
  );

  assert.deepEqual(result.selectionDiagnostics.candidateCounts, {
    project: 1,
    news: 3,
    socialMedia: 0,
    paper: 0,
  });
  assert.deepEqual(result.selectionDiagnostics.selectedCounts, {
    project: 1,
    news: 3,
    socialMedia: 0,
    paper: 0,
  });
  assert.equal(result.selectionDiagnostics.maxItems, 4);
  assert.equal(result.selectionDiagnostics.quotas.news, 3);
});
