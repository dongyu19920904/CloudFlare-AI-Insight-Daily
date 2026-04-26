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

test("buildDailyPromptSelection backfills same-topic items with distinct URLs when prompt would be too thin", () => {
  const result = buildDailyPromptSelection(
    {
      news: Array.from({ length: 12 }, (_, index) => ({
        ...buildNewsItem(index + 1),
        title: "GPT Image 2 Prompt example",
        url: `https://example.com/gpt-image-${index + 1}`,
      })),
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

  assert.equal(result.selectedContentItems.length, 12);
  assert.match(result.selectedContentItems.join("\n"), /gpt-image-12/);
});
