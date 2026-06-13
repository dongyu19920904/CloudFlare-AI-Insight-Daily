import test from "node:test";
import assert from "node:assert/strict";

import { buildOpportunityCandidates } from "../src/opportunityScoring.js";

test("buildOpportunityCandidates filters sources and GitHub repos used in recent opportunity memory", () => {
  const candidates = buildOpportunityCandidates(
    {
      news: [
        {
          title: "OpenAI account update repeated",
          description: "openai gpt account bundle update",
          source: "Folo",
          url: "https://example.com/repeated-openai?utm_source=folo",
          published_date: "2026-06-13",
          details: { content_html: "<p>openai gpt account release</p>" },
        },
        {
          title: "OpenAI account update fresh",
          description: "openai gpt account bundle update",
          source: "Folo",
          url: "https://example.com/fresh-openai",
          published_date: "2026-06-13",
          details: { content_html: "<p>openai gpt account release</p>" },
        },
      ],
      project: [
        {
          title: "Repeated MCP project",
          description: "github trending workflow plugin mcp integration",
          source: "GitHub Trending",
          url: "https://github.com/acme/repeated-mcp",
          published_date: "2026-06-13",
          details: { content_html: "<p>github workflow plugin mcp</p>" },
        },
        {
          title: "Fresh MCP project",
          description: "github trending workflow plugin mcp integration",
          source: "GitHub Trending",
          url: "https://github.com/acme/fresh-mcp",
          published_date: "2026-06-13",
          details: { content_html: "<p>github workflow plugin mcp</p>" },
        },
      ],
    },
    undefined,
    {
      recentReplayMemory: {
        sourceUrls: [{ key: "example.com/repeated-openai" }],
        githubProjects: [{ key: "github.com/acme/repeated-mcp" }],
        ruleIds: [],
        terms: [],
        lanes: [],
      },
    }
  );

  const allSupportingUrls = candidates.flatMap((candidate) =>
    (candidate.supportingItems || []).map((item) => item.url)
  );

  assert.ok(!allSupportingUrls.some((url) => /repeated-openai/.test(url)));
  assert.ok(!allSupportingUrls.some((url) => /repeated-mcp/.test(url)));
  assert.ok(allSupportingUrls.some((url) => /fresh-openai/.test(url)));
  assert.ok(allSupportingUrls.some((url) => /fresh-mcp/.test(url)));
});

test("buildOpportunityCandidates downranks rules and lanes repeated within the week", () => {
  const input = {
    news: [
      {
        title: "Cursor agent account update",
        description: "cursor pro cursor agent account bundle release",
        source: "AI Base",
        url: "https://example.com/cursor-fresh",
        published_date: "2026-06-13",
        details: { content_html: "<p>cursor agent release template workflow</p>" },
      },
    ],
  };

  const withoutReplay = buildOpportunityCandidates(input);
  const withReplay = buildOpportunityCandidates(input, undefined, {
    recentReplayMemory: {
      sourceUrls: [],
      githubProjects: [],
      ruleIds: [
        { key: "opportunity:2026-06-11:cursor", id: "cursor" },
        { key: "account-opportunity:2026-06-12:cursor", id: "cursor" },
      ],
      terms: [
        { key: "opportunity:2026-06-11:cursor", term: "cursor" },
        { key: "account-opportunity:2026-06-12:cursor", term: "cursor agent" },
      ],
      lanes: [
        { key: "opportunity:2026-06-11:account", id: "account" },
        { key: "account-opportunity:2026-06-12:account", id: "account" },
      ],
    },
  });

  assert.equal(withoutReplay[0].id, "cursor");
  assert.equal(withReplay[0].id, "cursor");
  assert.ok(withReplay[0].weeklyReplayPenalty > 0);
  assert.ok(withReplay[0].score < withoutReplay[0].score);
});
