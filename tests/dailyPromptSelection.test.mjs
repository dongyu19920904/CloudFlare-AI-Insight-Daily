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
    description: `Project description ${index}`,
    source: "GitHub Trending",
    url: `https://github.com/example/project-${index}`,
    published_date: "2026-04-06",
    details: {
      owner: "example",
      language: "TypeScript",
      starsToday: 100 + index,
      totalStars: 1000 + index,
      content_html: `<p>Project ${index} workflow template release</p>`,
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
  assert.match(result.selectedContentItems.join("\n"), /Stars Today:/);
});

test("buildDailyPromptSelection keeps default project candidates from flooding the prompt", () => {
  const result = buildDailyPromptSelection({
    news: Array.from({ length: 4 }, (_, index) => buildNewsItem(index + 1)),
    project: Array.from({ length: 10 }, (_, index) => buildProjectItem(index + 1)),
    socialMedia: [],
    paper: [],
  });

  assert.equal(result.selectedCounts.project, 1);
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
  assert.equal(result.selectionDiagnostics.rejectedNonAiCount, 1);
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
