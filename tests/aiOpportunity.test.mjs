import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOpportunityPaths,
  insertOpportunityLinkIntoDailyNavigation,
  updateSectionHomeIndexContent,
} from "../src/opportunityUtils.js";

test("buildOpportunityPaths returns the expected raw, content, and public paths", () => {
  const result = buildOpportunityPaths("2026-03-22");

  assert.deepEqual(result, {
    yearMonth: "2026-03",
    rawFilePath: "opportunity/2026-03-22.md",
    pagePath: "content/cn/opportunity/2026-03/2026-03-22.md",
    monthDirectoryIndexPath: "content/cn/opportunity/2026-03/_index.md",
    homePath: "content/cn/opportunity/_index.md",
    publicPath: "/opportunity/2026-03/2026-03-22/",
  });
});

test("insertOpportunityLinkIntoDailyNavigation adds an AI商机 link under quick navigation", () => {
  const input = `## **今日摘要**

\`\`\`
今天 AI 圈很热闹。
\`\`\`

## ⚡ 快速导航

- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## 今日AI资讯

### 1. 一条新闻
`;

  const output = insertOpportunityLinkIntoDailyNavigation(
    input,
    "/opportunity/2026-03/2026-03-22/"
  );

  assert.match(
    output,
    /- \[💰 今日 AI 商机]\(\/opportunity\/2026-03\/2026-03-22\/\) - 从日报里提炼更能落地的机会/
  );
});

test("insertOpportunityLinkIntoDailyNavigation is idempotent", () => {
  const input = `## ⚡ 快速导航

- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览
`;

  const once = insertOpportunityLinkIntoDailyNavigation(
    input,
    "/opportunity/2026-03/2026-03-22/"
  );
  const twice = insertOpportunityLinkIntoDailyNavigation(
    once,
    "/opportunity/2026-03/2026-03-22/"
  );

  const occurrences = (twice.match(/今日 AI 商机/g) || []).length;
  assert.equal(occurrences, 1);
});

test("updateSectionHomeIndexContent creates a section home with an opportunity next path", () => {
  const output = updateSectionHomeIndexContent("", "## **今日AI商机**", "2026-03-22", {
    title: "爱窝啦 AI 商机 2026/3/22",
    description: "从每天 AI 日报里提炼实操机会。",
    sectionPrefix: "/opportunity",
  });

  assert.match(output, /title: 爱窝啦 AI 商机 2026\/3\/22/);
  assert.match(output, /next: \/opportunity\/2026-03\/2026-03-22/);
  assert.match(output, /cascade:\s*\n\s*type: docs/);
  assert.match(output, /## \*\*今日AI商机\*\*/);
});
