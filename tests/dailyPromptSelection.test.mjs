import test from "node:test";
import assert from "node:assert/strict";

import { buildDailyPromptSelection } from "../src/dailyPromptSelection.js";

function buildNewsItem(index) {
  return {
    type: "news",
    title: `News ${index}`,
    description: `News description ${index}`,
    source: "AI Base",
    url: `https://example.com/news-${index}`,
    published_date: "2026-04-06",
    details: {
      content_html: `<p>News ${index} content</p>`,
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
            content_html: "<p>Social summary</p>",
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
