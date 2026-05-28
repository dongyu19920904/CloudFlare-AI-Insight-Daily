import test from "node:test";
import assert from "node:assert/strict";

import {
  extractGithubTopProjectsFromMarkdown,
  filterGithubProjectsAgainstRecentTop,
  mergeRecentGithubTopProjects,
  normalizeGithubProjectUrl,
} from "../src/githubTopProjectDedupe.js";

test("normalizeGithubProjectUrl keeps only owner and repo", () => {
  assert.equal(
    normalizeGithubProjectUrl("https://github.com/Anthropics/Claude-Code/issues/1"),
    "github.com/anthropics/claude-code"
  );
  assert.equal(normalizeGithubProjectUrl("https://github.blog/changelog"), "");
});

test("filterGithubProjectsAgainstRecentTop filters projects used in the last 7 days", () => {
  const projects = [
    { title: "Claude Code", url: "https://github.com/anthropics/claude-code" },
    { title: "New MCP Tool", url: "https://github.com/example/mcp-tool" },
  ];
  const recent = [
    {
      date: "2026-05-25",
      title: "Claude Code",
      url: "https://github.com/Anthropics/Claude-Code",
      urlKey: "github.com/anthropics/claude-code",
    },
    {
      date: "2026-05-20",
      title: "Old MCP Tool",
      url: "https://github.com/example/mcp-tool",
      urlKey: "github.com/example/mcp-tool",
    },
  ];

  const result = filterGithubProjectsAgainstRecentTop(projects, recent, "2026-05-28", 7);

  assert.equal(result.filteredCount, 1);
  assert.deepEqual(result.filteredItems.map((item) => item.title), ["New MCP Tool"]);
});

test("extractGithubTopProjectsFromMarkdown reads GitHub links from TOP only", () => {
  const markdown = `
## **🔥 重磅 TOP 2**

### 1. [Claude Code 插件市场](https://github.com/anthropics/claude-code)
正文。

### 2. [OpenRouter 融资](https://x.com/op7418/status/1)
正文。

## **📌 值得关注**

- **[开源]** [Watch Only](https://github.com/example/watch-only) - 不应写入 TOP 去重。
`;

  const projects = extractGithubTopProjectsFromMarkdown(markdown, "2026-05-28");

  assert.deepEqual(projects, [
    {
      date: "2026-05-28",
      title: "Claude Code 插件市场",
      url: "https://github.com/anthropics/claude-code",
      urlKey: "github.com/anthropics/claude-code",
    },
  ]);
});

test("mergeRecentGithubTopProjects prunes records outside the window", () => {
  const merged = mergeRecentGithubTopProjects(
    [
      { date: "2026-05-19", title: "Old", url: "https://github.com/example/old" },
      { date: "2026-05-27", title: "Kept", url: "https://github.com/example/kept" },
    ],
    [{ date: "2026-05-28", title: "New", url: "https://github.com/example/new" }],
    "2026-05-28",
    7
  );

  assert.deepEqual(
    merged.map((item) => item.urlKey),
    ["github.com/example/new", "github.com/example/kept"]
  );
});
