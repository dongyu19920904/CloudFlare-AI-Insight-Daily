import test from "node:test";
import assert from "node:assert/strict";

import { opportunityPlaybook } from "../src/opportunityPlaybook.js";
import {
  extractOpportunityReplayMemoryFromMarkdown,
  mergeOpportunityReplayMemories,
  normalizeOpportunitySourceUrl,
  pruneOpportunityReplayMemory,
} from "../src/opportunityReplayDedupe.js";

test("normalizeOpportunitySourceUrl ignores tracking params and internal site links", () => {
  assert.equal(
    normalizeOpportunitySourceUrl("https://example.com/path/?utm_source=folo&ref=x"),
    "example.com/path"
  );
  assert.equal(normalizeOpportunitySourceUrl("https://news.aivora.cn/opportunity/2026-06/2026-06-10/"), "");
});

test("extractOpportunityReplayMemoryFromMarkdown captures source urls, GitHub projects, and topic rules", () => {
  const memory = extractOpportunityReplayMemoryFromMarkdown(
    `
---
title: test
---

## 今日主推
### [Claude workflow pack](https://example.com/claude-workflow?utm_source=folo)

- 参考来源：[Repo](https://github.com/Acme/Fresh-Agent/issues/12)
- 参考来源：[Claude update](https://anthropic.com/news/claude-test)
`,
    {
      date: "2026-06-12",
      section: "opportunity",
      playbook: opportunityPlaybook,
    }
  );

  assert.ok(memory.sourceUrls.some((record) => record.key === "example.com/claude-workflow"));
  assert.ok(memory.githubProjects.some((record) => record.key === "github.com/acme/fresh-agent"));
  assert.ok(memory.ruleIds.some((record) => record.id === "claude"));
  assert.ok(memory.ruleIds.some((record) => record.id === "workflow"));
});

test("mergeOpportunityReplayMemories dedupes repeated records", () => {
  const first = extractOpportunityReplayMemoryFromMarkdown(
    "### [Repo](https://github.com/acme/repeated)",
    { date: "2026-06-11", section: "opportunity", playbook: opportunityPlaybook }
  );
  const second = extractOpportunityReplayMemoryFromMarkdown(
    "### [Repo again](https://github.com/acme/repeated/pulls)",
    { date: "2026-06-12", section: "account-opportunity", playbook: opportunityPlaybook }
  );

  const merged = mergeOpportunityReplayMemories(first, second);

  assert.equal(
    merged.githubProjects.filter((record) => record.key === "github.com/acme/repeated").length,
    1
  );
});

test("pruneOpportunityReplayMemory keeps only records inside the lookback window", () => {
  const memory = {
    sourceUrls: [
      { key: "example.com/fresh", date: "2026-06-13", section: "opportunity" },
      { key: "example.com/old", date: "2026-06-01", section: "opportunity" },
    ],
    githubProjects: [
      { key: "github.com/acme/fresh", date: "2026-06-12", section: "opportunity" },
      { key: "github.com/acme/old", date: "2026-06-02", section: "opportunity" },
    ],
    ruleIds: [],
    terms: [],
    lanes: [],
    titles: [],
  };

  const pruned = pruneOpportunityReplayMemory(memory, "2026-06-14", 7);

  assert.deepEqual(pruned.sourceUrls.map((record) => record.key), ["example.com/fresh"]);
  assert.deepEqual(pruned.githubProjects.map((record) => record.key), ["github.com/acme/fresh"]);
});
