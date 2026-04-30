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

test("buildDailyPromptSelection caps one company topic instead of backfilling repeats", () => {
  const result = buildDailyPromptSelection(
    {
      news: [
        {
          ...buildNewsItem(1),
          title: "OpenAI launches GPT Image 2",
          description: "ChatGPT image generation gets a new model.",
          source: "OpenAI Blog",
          url: "https://example.com/openai-gpt-image-2",
        },
        {
          ...buildNewsItem(2),
          title: "Sam Altman says image generation demand is high",
          description: "Sam Altman comments on OpenAI capacity and image demand.",
          source: "X - Sam Altman",
          url: "https://example.com/sam-altman-image-demand",
        },
        {
          ...buildNewsItem(3),
          title: "ChatGPT gets another image workflow update",
          description: "OpenAI adds a related image editing workflow.",
          source: "OpenAI Blog",
          url: "https://example.com/chatgpt-image-workflow",
        },
      ],
      project: [],
      socialMedia: [],
      paper: [],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 12,
      DAILY_PROMPT_MIN_ITEMS: 12,
      DAILY_PROMPT_NEWS_ITEMS: 10,
      DAILY_PROMPT_PROJECT_ITEMS: 0,
      DAILY_PROMPT_SOCIAL_ITEMS: 0,
      DAILY_PROMPT_PAPER_ITEMS: 0,
    }
  );

  assert.equal(result.selectedContentItems.length, 1);
  assert.match(result.selectedContentItems.join("\n"), /OpenAI|ChatGPT|Sam Altman|GPT Image/i);
});

test("buildDailyPromptSelection keeps at least one GitHub project even when project quota is zero", () => {
  const result = buildDailyPromptSelection(
    {
      news: Array.from({ length: 8 }, (_, index) => buildNewsItem(index + 1)),
      project: [buildProjectItem(1)],
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

  assert.equal(result.selectedContentItems.length, 4);
  assert.equal(result.selectedCounts.project, 1);
  assert.equal(result.selectedCounts.news, 3);
  assert.match(result.selectedContentItems.join("\n"), /Project Name:/);
});

test("buildDailyPromptSelection caps GitHub projects to two prompt slots", () => {
  const result = buildDailyPromptSelection(
    {
      news: Array.from({ length: 10 }, (_, index) => buildNewsItem(index + 1)),
      project: Array.from({ length: 6 }, (_, index) => buildProjectItem(index + 1)),
      socialMedia: [],
      paper: [],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 10,
      DAILY_PROMPT_NEWS_ITEMS: 8,
      DAILY_PROMPT_PROJECT_ITEMS: 8,
      DAILY_PROMPT_SOCIAL_ITEMS: 0,
      DAILY_PROMPT_PAPER_ITEMS: 0,
    }
  );

  const promptText = result.selectedContentItems.join("\n");
  assert.equal((promptText.match(/Project Name:/g) || []).length, 2);
  assert.equal(result.selectedProjectLikeCount, 2);
  assert.equal(result.selectedGithubProjectCount, 2);
  assert.match(promptText, /TOP10_PROJECT_ONLY/);
  assert.match(promptText, /MORE_DYNAMICS_PROJECT_ONLY/);
});

test("buildDailyPromptSelection filters GitHub projects repeated from previous daily", () => {
  const result = buildDailyPromptSelection(
    {
      news: Array.from({ length: 6 }, (_, index) => buildNewsItem(index + 1)),
      project: Array.from({ length: 3 }, (_, index) => buildProjectItem(index + 1)),
      socialMedia: [],
      paper: [],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 6,
      DAILY_PROMPT_NEWS_ITEMS: 4,
      DAILY_PROMPT_PROJECT_ITEMS: 8,
      DAILY_PROMPT_SOCIAL_ITEMS: 0,
      DAILY_PROMPT_PAPER_ITEMS: 0,
    },
    {
      previousDailyItems: [
        {
          title: "Project 3",
          url: "https://github.com/example/project-3",
        },
      ],
    }
  );

  const promptText = result.selectedContentItems.join("\n");
  assert.equal(result.previousProjectFiltered, 1);
  assert.doesNotMatch(promptText, /project-3/);
  assert.match(promptText, /project-2/);
  assert.match(promptText, /project-1/);
});
