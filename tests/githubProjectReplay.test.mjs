import test from "node:test";
import assert from "node:assert/strict";

import {
  collectGithubRepoKeysFromText,
  filterGithubProjectsAgainstPreviousTop,
  getGithubRepoKeyFromProjectItem,
} from "../src/githubProjectReplay.js";

test("collectGithubRepoKeysFromText finds GitHub urls and bare owner repo mentions", () => {
  const repoKeys = collectGithubRepoKeysFromText(
    "See https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools and garrytan/gstack."
  );

  assert.deepEqual([...repoKeys].sort(), [
    "garrytan/gstack",
    "x1xhlol/system-prompts-and-models-of-ai-tools",
  ]);
});

test("filterGithubProjectsAgainstPreviousTop removes repos already seen in monthly TOP", () => {
  const previousTopItems = [
    {
      title: "system-prompts-and-models-of-ai-tools: AI tool prompt collection",
      url: "https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools",
    },
    {
      title: "gstack: YC CEO AI coding stack",
      url: "https://x.com/garrytan/status/123",
    },
  ];
  const projectItems = [
    {
      type: "project",
      title: "System prompts and models of AI tools",
      url: "https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools",
    },
    {
      type: "project",
      title: "gstack",
      url: "https://github.com/garrytan/gstack",
    },
    {
      type: "project",
      title: "Fresh useful AI coding repo",
      url: "https://github.com/example/fresh-coding-repo",
    },
  ];

  const result = filterGithubProjectsAgainstPreviousTop(projectItems, previousTopItems);

  assert.equal(result.filteredCount, 2);
  assert.deepEqual(result.filteredItems.map((item) => getGithubRepoKeyFromProjectItem(item)), [
    "example/fresh-coding-repo",
  ]);
  assert.ok(result.filteredRepos.includes("x1xhlol/system-prompts-and-models-of-ai-tools"));
  assert.ok(result.filteredRepos.includes("garrytan/gstack"));
});
