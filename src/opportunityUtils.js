import { getYearMonth } from "./contentUtils.js";

const OPPORTUNITY_LINK_LABEL =
  "- [💰 今日 AI 商机](%PATH%) - 从日报里提炼更能落地的机会";

const FRONT_MATTER_REGEX = /^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/;

export function buildOpportunityPaths(dateStr) {
  const yearMonth = getYearMonth(dateStr);

  return {
    yearMonth,
    rawFilePath: `opportunity/${dateStr}.md`,
    pagePath: `content/cn/opportunity/${yearMonth}/${dateStr}.md`,
    monthDirectoryIndexPath: `content/cn/opportunity/${yearMonth}/_index.md`,
    homePath: "content/cn/opportunity/_index.md",
    publicPath: `/opportunity/${yearMonth}/${dateStr}/`,
  };
}

export function insertOpportunityLinkIntoDailyNavigation(markdown, publicPath) {
  const content = String(markdown || "");
  const opportunityLink = OPPORTUNITY_LINK_LABEL.replace("%PATH%", publicPath);

  if (content.includes(opportunityLink)) {
    return content;
  }

  const quickNavHeader = "## ⚡ 快速导航";
  if (!content.includes(quickNavHeader)) {
    return `${content}\n\n${quickNavHeader}\n\n${opportunityLink}\n`;
  }

  return content.replace(
    quickNavHeader,
    `${quickNavHeader}\n\n${opportunityLink}`
  );
}

function stripFrontMatter(content) {
  return String(content || "").replace(FRONT_MATTER_REGEX, "");
}

function buildSectionHomeFrontMatter(dateStr, options = {}) {
  const {
    title = "AI商机",
    description = "与 AI日报共享同源信息，再额外筛选更偏实操的机会。",
    sectionPrefix = "/opportunity",
  } = options;
  const yearMonth = getYearMonth(dateStr);
  const nextPath = `${sectionPrefix}/${yearMonth}/${dateStr}`;

  return `---
linkTitle: AI商机
title: ${title}
breadcrumbs: false
next: ${nextPath}
description: "${description}"
cascade:
  type: docs
---
`;
}

export function updateSectionHomeIndexContent(
  existingContent,
  sectionContent,
  dateStr,
  options = {}
) {
  const {
    title = "AI商机",
    description = "与 AI日报共享同源信息，再额外筛选更偏实操的机会。",
    sectionPrefix = "/opportunity",
  } = options;
  const yearMonth = getYearMonth(dateStr);
  const nextPath = `${sectionPrefix}/${yearMonth}/${dateStr}`;

  let frontMatter = "";

  if (existingContent && FRONT_MATTER_REGEX.test(existingContent)) {
    frontMatter = existingContent.match(FRONT_MATTER_REGEX)[0];
    if (/^next:\s*.*$/m.test(frontMatter)) {
      frontMatter = frontMatter.replace(/^next:\s*.*$/m, `next: ${nextPath}`);
    } else {
      frontMatter = frontMatter.replace(
        /\r?\n---\s*\r?\n$/,
        `\nnext: ${nextPath}\n---\n`
      );
    }

    if (/^title:\s*.*$/m.test(frontMatter)) {
      frontMatter = frontMatter.replace(/^title:\s*.*$/m, `title: ${title}`);
    }
  } else {
    frontMatter = buildSectionHomeFrontMatter(dateStr, {
      title,
      description,
      sectionPrefix,
    });
  }

  const body = stripFrontMatter(sectionContent).trimStart();
  return `${frontMatter.trimEnd()}\n\n${body}`;
}
