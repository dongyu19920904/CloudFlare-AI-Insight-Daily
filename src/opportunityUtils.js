import { getYearMonth } from "./contentUtils.js";

const OPPORTUNITY_LINK_LABEL =
  "- [🎯 今日 AI 商机](%PATH%) - 从日报里提炼更能落地的机会";

const QUICK_NAV_HEADER = "## ⚡ 快速导航";
const FRONT_MATTER_REGEX = /^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/;
const LATEST_OPPORTUNITY_SHORTCODE = "{{< latest-opportunity >}}";

export const DEFAULT_OPPORTUNITY_PAGE_DESCRIPTION =
  "与 AI日报共享同源信息，再额外筛选 AI 工具、AI账号和低门槛实操机会。";

export const DEFAULT_OPPORTUNITY_SECTION_DESCRIPTION = `${DEFAULT_OPPORTUNITY_PAGE_DESCRIPTION}10点左右更新。`;

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

  if (!content.includes(QUICK_NAV_HEADER)) {
    return `${content}\n\n${QUICK_NAV_HEADER}\n\n${opportunityLink}\n`;
  }

  return content.replace(
    QUICK_NAV_HEADER,
    `${QUICK_NAV_HEADER}\n\n${opportunityLink}`
  );
}

function stripFrontMatter(content) {
  return String(content || "").replace(FRONT_MATTER_REGEX, "");
}

function replaceOrInsertFrontMatterLine(frontMatter, field, value) {
  const pattern = new RegExp(`^${field}:\\s*.*$`, "m");

  if (pattern.test(frontMatter)) {
    return frontMatter.replace(pattern, `${field}: ${value}`);
  }

  return frontMatter.replace(/\r?\n---\s*\r?\n$/, `\n${field}: ${value}\n---\n`);
}

function removeFrontMatterLine(frontMatter, field) {
  const pattern = new RegExp(`^${field}:\\s*.*\\r?\\n?`, "m");
  return frontMatter.replace(pattern, "");
}

function buildSectionHomeFrontMatter(dateStr, options = {}) {
  const {
    title = "AI商机",
    description = DEFAULT_OPPORTUNITY_SECTION_DESCRIPTION,
    sectionPrefix = "/opportunity",
  } = options;

  return `---
linkTitle: AI商机
title: ${title}
breadcrumbs: false
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
    description = DEFAULT_OPPORTUNITY_SECTION_DESCRIPTION,
    sectionPrefix = "/opportunity",
  } = options;
  const yearMonth = getYearMonth(dateStr);
  const nextPath = `${sectionPrefix}/${yearMonth}/${dateStr}`;

  let frontMatter = "";

  if (existingContent && FRONT_MATTER_REGEX.test(existingContent)) {
    frontMatter = existingContent.match(FRONT_MATTER_REGEX)[0];
    frontMatter = removeFrontMatterLine(frontMatter, "next");
    frontMatter = replaceOrInsertFrontMatterLine(
      frontMatter,
      "description",
      `"${description}"`
    );
  } else {
    frontMatter = buildSectionHomeFrontMatter(dateStr, {
      title,
      description,
      sectionPrefix,
    });
  }

  return `${frontMatter.trimEnd()}\n\n${LATEST_OPPORTUNITY_SHORTCODE}`;
}
