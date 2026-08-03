import { getYearMonth } from "./contentUtils.js";

const OPPORTUNITY_LINK_LABEL =
  "- [🎯 今日 AI 商机](%PATH%) - 从日报里提炼更能落地的机会";

const QUICK_NAV_HEADER = "## ⚡ 快速导航";
const FRONT_MATTER_REGEX = /^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/;

export const DEFAULT_OPPORTUNITY_PAGE_DESCRIPTION =
  "从当天可核验的一手 AI 信号中筛选低成本机会，给出目标用户、最小交付、48 小时验证、风险与停止条件。";

export const DEFAULT_OPPORTUNITY_SECTION_TITLE = "爱窝啦 AI 商机";

export const DEFAULT_OPPORTUNITY_SECTION_DESCRIPTION = `${DEFAULT_OPPORTUNITY_PAGE_DESCRIPTION} 每天只保留达到证据门槛的机会。`;

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

export function stripTemplateOwnedOpportunityH1(markdown) {
  return String(markdown || "").replace(
    /^\uFEFF?[ \t]*#(?!#)[ \t]+[^\r\n]*(?:\r?\n){1,2}/,
    ""
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
    title = DEFAULT_OPPORTUNITY_SECTION_TITLE,
    description = DEFAULT_OPPORTUNITY_SECTION_DESCRIPTION,
    sectionPrefix = "/opportunity",
  } = options;

  return `---
linkTitle: AI商机
title: ${title}
type: opportunity
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
    title = DEFAULT_OPPORTUNITY_SECTION_TITLE,
    description = DEFAULT_OPPORTUNITY_SECTION_DESCRIPTION,
    sectionPrefix = "/opportunity",
  } = options;
  const yearMonth = getYearMonth(dateStr);
  const nextPath = `${sectionPrefix}/${yearMonth}/${dateStr}`;

  let frontMatter = "";

  if (existingContent && FRONT_MATTER_REGEX.test(existingContent)) {
    frontMatter = existingContent.match(FRONT_MATTER_REGEX)[0];
    frontMatter = removeFrontMatterLine(frontMatter, "next");
    frontMatter = replaceOrInsertFrontMatterLine(frontMatter, "title", title);
    frontMatter = replaceOrInsertFrontMatterLine(
      frontMatter,
      "description",
      `"${description}"`
    );
    frontMatter = replaceOrInsertFrontMatterLine(
      frontMatter,
      "type",
      "opportunity"
    );
  } else {
    frontMatter = buildSectionHomeFrontMatter(dateStr, {
      title,
      description,
      sectionPrefix,
    });
  }

  return `${frontMatter.trimEnd()}\n`;
}
