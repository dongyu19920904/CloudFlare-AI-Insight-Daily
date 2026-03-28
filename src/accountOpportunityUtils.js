import { getYearMonth } from "./contentUtils.js";

const FRONT_MATTER_REGEX = /^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/;

export const DEFAULT_ACCOUNT_OPPORTUNITY_PAGE_DESCRIPTION =
  "聚焦账号、镜像、平替、封号、支付限制和闲鱼新品机会。";

export const DEFAULT_ACCOUNT_OPPORTUNITY_SECTION_DESCRIPTION = `${DEFAULT_ACCOUNT_OPPORTUNITY_PAGE_DESCRIPTION}10点左右更新。`;

export function buildAccountOpportunityPaths(dateStr) {
  const yearMonth = getYearMonth(dateStr);

  return {
    yearMonth,
    rawFilePath: `account-opportunity/${dateStr}.md`,
    pagePath: `content/cn/account-opportunity/${yearMonth}/${dateStr}.md`,
    monthDirectoryIndexPath: `content/cn/account-opportunity/${yearMonth}/_index.md`,
    homePath: "content/cn/account-opportunity/_index.md",
    publicPath: `/account-opportunity/${yearMonth}/${dateStr}/`,
  };
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

function buildAccountOpportunityHomeFrontMatter(dateStr, options = {}) {
  const {
    title = "AI账号商机",
    description = DEFAULT_ACCOUNT_OPPORTUNITY_SECTION_DESCRIPTION,
    sectionPrefix = "/account-opportunity",
  } = options;
  const yearMonth = getYearMonth(dateStr);
  const nextPath = `${sectionPrefix}/${yearMonth}/${dateStr}`;

  return `---
linkTitle: AI账号商机
title: ${title}
breadcrumbs: false
next: ${nextPath}
description: "${description}"
cascade:
  type: docs
---
`;
}

export function updateAccountOpportunityHomeIndexContent(
  existingContent,
  sectionContent,
  dateStr,
  options = {}
) {
  const {
    title = "AI账号商机",
    description = DEFAULT_ACCOUNT_OPPORTUNITY_SECTION_DESCRIPTION,
    sectionPrefix = "/account-opportunity",
  } = options;
  const yearMonth = getYearMonth(dateStr);
  const nextPath = `${sectionPrefix}/${yearMonth}/${dateStr}`;

  let frontMatter = "";

  if (existingContent && FRONT_MATTER_REGEX.test(existingContent)) {
    frontMatter = existingContent.match(FRONT_MATTER_REGEX)[0];
    frontMatter = replaceOrInsertFrontMatterLine(frontMatter, "next", nextPath);
    frontMatter = replaceOrInsertFrontMatterLine(frontMatter, "title", title);
    frontMatter = replaceOrInsertFrontMatterLine(
      frontMatter,
      "description",
      `"${description}"`
    );
  } else {
    frontMatter = buildAccountOpportunityHomeFrontMatter(dateStr, {
      title,
      description,
      sectionPrefix,
    });
  }

  const body = stripFrontMatter(sectionContent).trimStart();
  return `${frontMatter.trimEnd()}\n\n${body}`;
}
