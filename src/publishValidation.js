const COMMON_FAILURE_PATTERNS = [
  /i can't discuss that/i,
  /i cannot discuss that/i,
  /i can't help/i,
  /would you like help/i,
  /set up an api integration/i,
  /素材不足/i,
  /无法生成/i,
];

import { normalizeGithubProjectUrl } from "./githubTopProjectDedupe.js";
import { extractNumberedDailyItems } from "./dailyMarkdownItems.js";
import { collectDailyWritingStyleWarnings } from "./dailyWritingQuality.js";
import { validateOpportunityAivoraLinks } from "./opportunityAivoraLinkPolicy.js";
import {
  containsDomesticAccountProduct,
  isOfficialAccountOpportunityUrl,
} from "./accountOpportunityUtils.js";
import {
  classifyOpportunityEvidence,
} from "./opportunityEvidence.js";
import { normalizeOpportunitySourceUrl } from "./opportunityReplayDedupe.js";
import { getModelManipulationPatterns } from "./geoCitationPolicy.js";

const DAILY_META_PATTERNS = [
  /AI思考:?/i,
  /我看了一下(今天|这批)?素材/,
  /(按照|根据).{0,12}(日期过滤规则|容错机制|评分系统)/,
  /素材(质量)?参差不齐/,
  /我会按照.{0,12}筛选/,
];

const MODEL_MANIPULATION_PATTERNS = getModelManipulationPatterns();

const DAILY_WATCH_HEADING_PATTERN = /^##\s*\*\*.*(?:\uD83D\uDCCC|\uD83C\uDFAF|值得关注|关注).*\*\*/im;
const DAILY_FUN_HEADING_PATTERN = /^##\s*\*\*.*(?:\uD83D\uDE04|\uD83D\uDE06|AI\s*趣闻|趣闻).*\*\*/im;
const DAILY_BRIEFING_V2_HEADING_PATTERN = /^##\s*\*{0,2}\s*⏱(?:️)?\s*3\s*分钟读懂今天\s*\*{0,2}\s*$/im;
const DAILY_LEGACY_SUMMARY_HEADING_PATTERN = /^##\s*\*{0,2}\s*今日摘要\s*\*{0,2}\s*$/im;
const DAILY_PRODUCT_HEADING_PATTERN = /^##\s*\*{0,2}.*产品与功能更新.*\*{0,2}\s*$/im;
const DAILY_RESEARCH_HEADING_PATTERN = /^##\s*\*{0,2}.*前沿研究(?:与行业影响)?.*\*{0,2}\s*$/im;
const DAILY_INDUSTRY_HEADING_PATTERN = /^##\s*\*{0,2}.*行业(?:变化与个人影响|展望与社会影响).*\*{0,2}\s*$/im;
const DAILY_OPEN_SOURCE_HEADING_PATTERN = /^##\s*\*{0,2}.*开源\s*TOP\s*项目.*\*{0,2}\s*$/im;
const DAILY_SOCIAL_HEADING_PATTERN = /^##\s*\*{0,2}.*社媒精选.*\*{0,2}\s*$/im;

const DAILY_V3_SECTION_SPECS = [
  { name: "product", label: "产品与功能更新", pattern: DAILY_PRODUCT_HEADING_PATTERN },
  { name: "research", label: "前沿研究", pattern: DAILY_RESEARCH_HEADING_PATTERN },
  { name: "industry", label: "行业变化与个人影响", pattern: DAILY_INDUSTRY_HEADING_PATTERN },
  { name: "openSource", label: "开源 TOP 项目", pattern: DAILY_OPEN_SOURCE_HEADING_PATTERN },
  { name: "social", label: "社媒精选", pattern: DAILY_SOCIAL_HEADING_PATTERN },
];

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function stripOpportunityReplayMetadata(markdown) {
  return String(markdown || "").replace(
    /<!--\s*opportunity-replay:\s*\{[^\n]*\}\s*-->/g,
    ""
  );
}

function canonicalizeUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(String(url).trim());
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_/i.test(key) || key === "ref" || key === "si") {
        parsed.searchParams.delete(key);
      }
    }
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    const query = parsed.searchParams.toString();
    return `${parsed.origin.toLowerCase()}${pathname}${query ? `?${query}` : ""}`;
  } catch {
    return String(url).trim().toLowerCase();
  }
}

function normalizeLinkTitle(title) {
  return String(title || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_+=[\]{};:'",.<>/?\\|，。！？、；：“”‘’（）【】《》·—…-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function areSimilarLinkTitles(leftTitle, rightTitle) {
  const left = normalizeLinkTitle(leftTitle);
  const right = normalizeLinkTitle(rightTitle);

  if (!left || !right) return false;
  if (left === right) return true;

  if (left.length >= 10 && right.length >= 10) {
    return left.includes(right) || right.includes(left);
  }

  return false;
}

function collectMarkdownIssues(markdown, options = {}) {
  const {
    label = "内容",
    requiredPhrases = [],
    forbiddenPhrases = [],
    forbiddenPatterns = [],
    minChars = 0,
  } = options;

  const normalized = normalizeText(markdown);
  const issues = [];

  if (!normalized) {
    issues.push(`${label}为空`);
    return issues;
  }

  if (minChars > 0 && normalized.length < minChars) {
    issues.push(`${label}过短`);
  }

  for (const pattern of COMMON_FAILURE_PATTERNS) {
    if (pattern.test(normalized)) {
      issues.push(`${label}命中失败兜底文案`);
      break;
    }
  }

  for (const phrase of requiredPhrases) {
    if (!String(markdown || "").includes(phrase)) {
      issues.push(`${label}缺少必需片段: ${phrase}`);
    }
  }

  for (const phrase of forbiddenPhrases) {
    if (String(markdown || "").includes(phrase)) {
      issues.push(`${label}包含禁止片段: ${phrase}`);
    }
  }

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(String(markdown || ""))) {
      issues.push(`${label}包含禁止模式: ${pattern}`);
    }
  }

  return issues;
}

function extractSection(markdown, headingPattern) {
  const content = String(markdown || "");
  const match = content.match(headingPattern);
  if (!match || match.index == null) return "";

  const startIndex = match.index;
  const remaining = content.slice(startIndex + match[0].length);
  const nextSectionMatch = remaining.match(/\n##\s+/);
  const endIndex = nextSectionMatch
    ? startIndex + match[0].length + nextSectionMatch.index
    : content.length;

  return content.slice(startIndex, endIndex);
}

function extractSectionUrls(markdown) {
  const content = String(markdown || "");
  return [...content.matchAll(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g)]
    .filter((match) => match.index == null || content[match.index - 1] !== "!")
    .map((match) => canonicalizeUrl(match[1]))
    .filter(Boolean);
}

function extractSectionLinks(markdown) {
  const content = String(markdown || "");
  return [...content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)]
    .filter((match) => match.index == null || content[match.index - 1] !== "!")
    .map((match) => ({
      title: match[1],
      url: canonicalizeUrl(match[2]),
    }))
    .filter((item) => item.url);
}

function isNoiseSectionLink(link) {
  if (!link?.url) return true;
  try {
    const parsed = new URL(link.url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return hostname === "aivora.cn" || hostname === "news.aivora.cn";
  } catch {
    return false;
  }
}

function getSectionBody(section) {
  return String(section || "").replace(/^##[^\n]*(?:\n|$)/, "").trim();
}

function countContentSourceLinks(section) {
  return extractSectionLinks(section).filter((link) => !isNoiseSectionLink(link)).length;
}

function hasLinkedLevel3Heading(section) {
  return /^###\s+(?:\d+\.\s+)?\[[^\]]+\]\(https?:\/\/[^\s)]+\)/m.test(
    String(section || "")
  );
}

function collectMissingLinkedHeadingIssues(markdown, sectionSpecs = [], label = "内容") {
  const issues = [];

  for (const spec of sectionSpecs) {
    const section = extractSection(markdown, spec.pattern);
    if (!section) continue;
    if (!hasLinkedLevel3Heading(section)) {
      issues.push(`${label}${spec.name}标题必须使用原始信息源链接`);
    }
  }

  return issues;
}

function sourceEvidenceLineHasMarkdownLink(markdown) {
  return /^-\s*证据来源[:：].*\[[^\]]+\]\(https?:\/\/[^\s)]+\)/m.test(
    String(markdown || "")
  );
}

function extractPrimarySectionLinks(markdown) {
  const content = String(markdown || "");
  const primaryLinks = [];
  const seen = new Set();

  const addLink = (link) => {
    if (!link || isNoiseSectionLink(link)) return;
    const key = `${link.url}|${normalizeLinkTitle(link.title)}`;
    if (seen.has(key)) return;
    seen.add(key);
    primaryLinks.push(link);
  };

  for (const match of content.matchAll(/^###\s+(?:\d+\.\s+)?\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gm)) {
    addLink({
      title: match[1],
      url: canonicalizeUrl(match[2]),
    });
  }

  for (const line of content.split(/\n+/)) {
    if (!/^\s*[-*]\s+/.test(line)) continue;
    const firstLink = extractSectionLinks(line).find((link) => !isNoiseSectionLink(link));
    addLink(firstLink);
  }

  if (primaryLinks.length === 0) {
    for (const context of extractLinkContexts(content)) {
      addLink(context.links.find((link) => !isNoiseSectionLink(link)));
    }
  }

  return primaryLinks;
}

function extractNumberedTopItems(markdown) {
  return extractNumberedDailyItems(markdown).map((item) => ({
    ...item,
    url: canonicalizeUrl(item.url),
  }));
}

function extractLinkContexts(markdown) {
  return String(markdown || "")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => /\[[^\]]+\]\(https?:\/\/[^\s)]+\)/.test(chunk))
    .map((chunk) => ({
      chunk,
      links: extractSectionLinks(chunk),
    }));
}

function isOpenSourceProjectContext(context, url = "") {
  const text = `${context || ""} ${url || ""}`;
  if (/github\.com\/(?!features\/|topics\/|marketplace\/|blog\/)[^/\s)#?]+\/[^/\s)#?]+/i.test(text)) return true;
  if (/gitlab\.com\/[^/\s)#?]+\/[^/\s)#?]+/i.test(text)) return true;
  if (/huggingface\.co\/[^/\s)#?]+\/[^/\s)#?]+/i.test(text)) return true;
  return /开源(项目|库|工具|模型)|GitHub\s*(项目|仓库)|仓库|repo(?:sitory)?|open[-\s]?source\s+project|Star|stars/i.test(text);
}

function isWelfareContext(context, url = "") {
  const text = `${context || ""} ${url || ""}`;
  return /每日薅羊毛|薅羊毛|羊毛|福利|优惠|限免|白嫖|折扣|兑换|代金券|coupon|promo|discount|free|credit/i.test(text);
}

function isPaperLikeContext(context, url = "") {
  const text = `${context || ""} ${url || ""}`;
  return /arxiv\.org|huggingface\.co\/papers|论文|研究|paper|abstract|benchmark|dataset/i.test(text);
}

function hasDirectAiSignal(text) {
  return (
    /\b(ai|agi|llm|gpt|chatgpt|claude|gemini|openai|anthropic|deepmind|xai|grok|copilot|sora|llama|mistral|deepseek|qwen|kimi|cursor|codex|mcp|rag|agent|agentic)\b/i.test(String(text || "")) ||
    /人工智能|大模型|生成式|智能体|多模态|机器学习|深度学习|神经网络|算力|推理|训练|提示词|开源模型|本地模型|AI原生|AI化|AI产品|AI工具|AI生图|AI芯片|寒武纪|Vibe Coding/i.test(String(text || ""))
  );
}

function hasStrongAiSignal(text) {
  return (
    /\b(ai|agi|llm|gpt|chatgpt|claude|gemini|openai|anthropic|deepmind|xai|grok|copilot|sora|llama|mistral|deepseek|qwen|kimi|cursor|codex|mcp|rag|agent|agentic)\b/i.test(String(text || "")) ||
    /人工智能|大模型|生成式|智能体|多模态|机器学习|深度学习|神经网络|算力|提示词|开源模型|本地模型|AI原生|AI化|AI产品|AI工具|AI生图|AI芯片|寒武纪|Vibe Coding/i.test(String(text || ""))
  );
}

function hasKnownNonAiDailyNoise(text) {
  const normalized = String(text || "");
  return (
    /grapheneos|android\s+vpn|vpn\s+leak/i.test(normalized) ||
    /(任天堂|nintendo|switch\s*\d?|游戏主机).{0,30}(涨价|价格|price|日本|美国|跟进)/i.test(normalized) ||
    /(涨价|价格|price|日本|美国|跟进).{0,30}(任天堂|nintendo|switch\s*\d?|游戏主机)/i.test(normalized) ||
    /(锻炼|健身|周练计划|训练计划|workout|fitness|exercise\s+plan|training\s+plan).{0,40}(照做|新手|中级|高级|身体|肌肉|减脂|routine|weekly|beginner|intermediate|advanced)/i.test(normalized) ||
    /(照做|新手|中级|高级|身体|肌肉|减脂|routine|weekly|beginner|intermediate|advanced).{0,40}(锻炼|健身|周练计划|训练计划|workout|fitness|exercise\s+plan|training\s+plan)/i.test(normalized)
  );
}

function isKnownNonAiLinkTopic(title) {
  const linkTitle = String(title || "");
  if (hasStrongAiSignal(linkTitle)) return false;
  return hasKnownNonAiDailyNoise(linkTitle);
}

function isKnownNonAiTopTopic(item) {
  const title = String(item?.title || "");
  return isKnownNonAiLinkTopic(title);
}

function collectDuplicateUrlsBySection(sectionMap) {
  const firstSeenSectionByUrl = new Map();
  const duplicates = [];

  for (const [sectionName, urls] of Object.entries(sectionMap)) {
    for (const url of urls) {
      if (!firstSeenSectionByUrl.has(url)) {
        firstSeenSectionByUrl.set(url, sectionName);
        continue;
      }

      const firstSection = firstSeenSectionByUrl.get(url);
      if (firstSection !== sectionName) {
        duplicates.push({ url, firstSection, sectionName });
      }
    }
  }

  return duplicates;
}

function collectDuplicateTopicsBySection(sectionMap) {
  const duplicates = [];
  const seen = [];

  for (const [sectionName, links] of Object.entries(sectionMap)) {
    for (const link of links) {
      const matched = seen.find((existing) => {
        if (existing.sectionName === sectionName) return false;
        if (existing.url && link.url && existing.url === link.url) return true;
        return areSimilarLinkTitles(existing.title, link.title);
      });

      if (matched) {
        duplicates.push({
          firstSection: matched.sectionName,
          sectionName,
          title: link.title,
        });
        continue;
      }

      seen.push({
        sectionName,
        title: link.title,
        url: link.url,
      });
    }
  }

  return duplicates;
}

function collectDailyStructureIssues(pageMarkdown, options = {}) {
  const issues = [];
  const minimumTopItems = Math.max(0, Number(options.minimumTopItems) || 0);
  const hardMinimumTopItems = options.hardMinimumTopItems == null
    ? minimumTopItems
    : Math.max(0, Number(options.hardMinimumTopItems) || 0);
  const minimumOpenSourceItems = Math.max(0, Number(options.minimumOpenSourceItems) || 0);
  const minimumSocialItems = Math.max(0, Number(options.minimumSocialItems) || 0);
  const minimumResearchItems = Math.max(0, Number(options.minimumResearchItems) || 0);
  const minimumIndustryItems = Math.max(0, Number(options.minimumIndustryItems) || 0);
  const minimumTopicSections = Math.max(0, Number(options.minimumTopicSections) || 0);
  const enforceTopGithubProjectAllowlist = Boolean(options.enforceTopGithubProjectAllowlist);
  const allowedTopGithubProjectKeys = new Set(
    (options.allowedTopGithubProjectUrls || [])
      .map((url) => normalizeGithubProjectUrl(url))
      .filter(Boolean)
  );
  const faqHeadingPattern = /^##\s*\*\*❓\s*相关问题(?:（仅1条）)?\*\*/im;
  const topSection = extractSection(
    pageMarkdown,
    /^##\s*\*{0,2}.*(?:今日焦点|重磅).*TOP.*\*{0,2}\s*$/im,
  );

  if (!faqHeadingPattern.test(String(pageMarkdown || ""))) {
    issues.push("日报页面缺少必需片段: ## **❓ 相关问题**");
  }

  if (!topSection) {
    issues.push("日报页面缺少 TOP 栏目");
    return issues;
  }

  const topItems = extractNumberedTopItems(topSection);

  if (topItems.length === 0) {
    issues.push("Daily top items must use numbered headings");
  }

  if (topItems.some((item) => !item.url)) {
    issues.push("Daily TOP items must contain an original source link");
  }

  topItems.forEach((item, index) => {
    if (item.number !== index + 1) {
      issues.push("Daily top item numbers must be unique and sequential");
    }
  });

  if (hardMinimumTopItems > 0 && topItems.length < hardMinimumTopItems) {
    issues.push(`Daily top items are insufficient: expected at least ${hardMinimumTopItems}`);
  } else if (minimumTopItems > 0 && topItems.length < minimumTopItems) {
    issues.push(`Daily TOP is below target: expected ${minimumTopItems}, got ${topItems.length}`);
  }

  if (/已合并处理|同一来源|见第\s*\d+\s*条|此条与第\s*\d+\s*条/i.test(topSection)) {
    issues.push("Daily top items must not contain merge-note placeholders");
  }

  const seenTopUrls = new Set();
  for (const item of topItems) {
    if (item.url && seenTopUrls.has(item.url)) {
      issues.push("Daily TOP reuses the same source URL");
      break;
    }
    if (item.url) seenTopUrls.add(item.url);
  }

  const duplicateTopTopic = topItems.some((item, index) =>
    topItems.slice(0, index).some((existing) => areSimilarLinkTitles(existing.title, item.title)),
  );
  if (duplicateTopTopic) {
    issues.push("Daily TOP reuses the same story");
  }

  const topOpenSourceProjectCount = topItems.filter((item) =>
    isOpenSourceProjectContext(item.context, item.url),
  ).length;
  if (topOpenSourceProjectCount > 1) {
    issues.push("Daily TOP must contain at most one GitHub/open-source project item");
  }

  if (topItems.some((item) => isWelfareContext(item.context, item.url))) {
    issues.push("Daily welfare/freebie items should stay in watch section, not TOP");
  }

  if (enforceTopGithubProjectAllowlist) {
    const disallowedGithubTopProject = topItems.some((item) => {
      const urlKey = normalizeGithubProjectUrl(item.url);
      if (!urlKey) return false;
      return !allowedTopGithubProjectKeys.has(urlKey);
    });
    if (disallowedGithubTopProject) {
      issues.push("Daily TOP GitHub project must come from today's GitHub Trending Daily candidates");
    }
  }

  if (topItems.some((item) => isKnownNonAiTopTopic(item))) {
    issues.push("Daily TOP contains a known non-AI topic");
  }

  const watchSection = extractSection(pageMarkdown, DAILY_WATCH_HEADING_PATTERN);
  const funSection = extractSection(pageMarkdown, DAILY_FUN_HEADING_PATTERN);
  const v3Sections = DAILY_V3_SECTION_SPECS
    .map((spec) => ({ ...spec, section: extractSection(pageMarkdown, spec.pattern) }))
    .filter((spec) => Boolean(spec.section));

  if (!watchSection && v3Sections.length === 0) {
    issues.push("Daily page must contain a watch section heading or V3 topic sections");
  } else if (watchSection && countContentSourceLinks(watchSection) === 0) {
    issues.push("Daily watch section must contain at least one source item");
  }
  for (const spec of v3Sections) {
    if (countContentSourceLinks(spec.section) === 0) {
      issues.push(`Daily ${spec.label} section must contain at least one source item`);
    }
  }
  if (v3Sections.length > 0 && v3Sections.length < 2) {
    issues.push("Daily V3 should contain at least two topic sections");
  }
  if (minimumTopicSections > 0 && v3Sections.length < minimumTopicSections) {
    issues.push(`Daily professional sections are below target: expected ${minimumTopicSections}, got ${v3Sections.length}`);
  }
  if (funSection && countContentSourceLinks(funSection) === 0) {
    issues.push("Daily AI fun section must contain at least one source item");
  }

  const primarySectionLinks = {
    TOP: extractSectionLinks(topSection).filter((link) => !isNoiseSectionLink(link)),
    ...(watchSection
      ? { watch: extractSectionLinks(watchSection).filter((link) => !isNoiseSectionLink(link)) }
      : {}),
    ...Object.fromEntries(v3Sections.map((spec) => [
      spec.name,
      extractSectionLinks(spec.section).filter((link) => !isNoiseSectionLink(link)),
    ])),
    fun: extractSectionLinks(funSection).filter((link) => !isNoiseSectionLink(link)),
  };
  if (collectDuplicateUrlsBySection(primarySectionLinks).length > 0) {
    issues.push("Daily primary sections reuse the same source URL");
  }
  if (collectDuplicateTopicsBySection(primarySectionLinks).length > 0) {
    issues.push("Daily primary sections reuse the same story");
  }

  const watchOpenSourceProjectCount = extractLinkContexts(watchSection).reduce(
    (count, item) =>
      count + item.links.filter((link) => isOpenSourceProjectContext(item.chunk, link.url)).length,
    0,
  );
  if (watchOpenSourceProjectCount > 2) {
    issues.push("Daily watch section must contain at most two GitHub/open-source project items");
  }

  const openSourceSection = v3Sections.find((spec) => spec.name === "openSource")?.section || "";
  const openSourceLinks = extractSectionLinks(openSourceSection).filter((link) => !isNoiseSectionLink(link));
  const socialSection = v3Sections.find((spec) => spec.name === "social")?.section || "";
  const socialLinks = extractSectionLinks(socialSection).filter((link) => !isNoiseSectionLink(link));
  const researchSection = v3Sections.find((spec) => spec.name === "research")?.section || "";
  const researchLinks = extractSectionLinks(researchSection).filter((link) => !isNoiseSectionLink(link));
  const industrySection = v3Sections.find((spec) => spec.name === "industry")?.section || "";
  const industryLinks = extractSectionLinks(industrySection).filter((link) => !isNoiseSectionLink(link));
  if (openSourceLinks.length > 3) {
    issues.push("Daily open-source section must contain at most three source items");
  }
  if (minimumOpenSourceItems > 0 && openSourceLinks.length < minimumOpenSourceItems) {
    issues.push(`Daily open-source section is below target: expected ${minimumOpenSourceItems}, got ${openSourceLinks.length}`);
  }
  if (minimumSocialItems > 0 && socialLinks.length < minimumSocialItems) {
    issues.push(`Daily social section is below target: expected ${minimumSocialItems}, got ${socialLinks.length}`);
  }
  if (minimumResearchItems > 0 && researchLinks.length < minimumResearchItems) {
    issues.push(`Daily research section is below target: expected ${minimumResearchItems}, got ${researchLinks.length}`);
  }
  if (minimumIndustryItems > 0 && industryLinks.length < minimumIndustryItems) {
    issues.push(`Daily industry section is below target: expected ${minimumIndustryItems}, got ${industryLinks.length}`);
  }
  if (enforceTopGithubProjectAllowlist) {
    const disallowedOpenSourceProject = openSourceLinks.some((link) => {
      const urlKey = normalizeGithubProjectUrl(link.url);
      return urlKey && !allowedTopGithubProjectKeys.has(urlKey);
    });
    if (disallowedOpenSourceProject) {
      issues.push("Daily open-source projects must come from today's GitHub Trending Daily candidates");
    }
  }

  const watchWelfareCount = extractLinkContexts(watchSection).reduce(
    (count, item) => count + item.links.filter((link) => isWelfareContext(item.chunk, link.url)).length,
    0,
  );
  if (watchWelfareCount > 1) {
    issues.push("Daily watch section must contain at most one welfare/freebie item");
  }

  const watchKnownNonAiTopic = extractLinkContexts(watchSection).some((item) =>
    item.links.some((link) => isKnownNonAiLinkTopic(link.title)),
  );
  if (watchKnownNonAiTopic) {
    issues.push("Daily watch section contains a known non-AI topic");
  }

  const v3KnownNonAiTopic = v3Sections.some((spec) =>
    extractLinkContexts(spec.section).some((item) =>
      item.links.some((link) => isKnownNonAiLinkTopic(link.title)),
    ),
  );
  if (v3KnownNonAiTopic) {
    issues.push("Daily V3 topic sections contain a known non-AI topic");
  }

  const funKnownNonAiTopic = extractLinkContexts(funSection).some((item) =>
    item.links.some((link) => isKnownNonAiLinkTopic(link.title)),
  );
  if (funKnownNonAiTopic) {
    issues.push("Daily AI fun section contains a known non-AI topic");
  }

  const funPaperLikeTopic = extractLinkContexts(funSection).some((item) =>
    item.links.some((link) => isPaperLikeContext(item.chunk, link.url)),
  );
  if (funPaperLikeTopic) {
    issues.push("Daily AI fun section uses a paper/arXiv source");
  }

  const faqSection = extractSection(pageMarkdown, faqHeadingPattern);
  if (faqSection) {
    const faqBody = getSectionBody(faqSection);
    if (normalizeText(faqBody).length < 50) {
      issues.push("Daily FAQ section must not be empty");
    }
    if (!/aivora\.cn/i.test(faqSection)) {
      issues.push("Daily FAQ section must include an Aivora link");
    }
  }
  if (/\bGPT-4o\b/i.test(faqSection) && !/\bGPT-4o\b/i.test(topSection)) {
    issues.push("Daily FAQ uses outdated GPT-4o default model");
  }

  return issues;
}

function collectDailyBriefingIssues(pageMarkdown) {
  const markdown = String(pageMarkdown || "");
  const requiredLabels = ["发生了什么", "为什么重要", "今天可以做"];
  const missingV2Labels = requiredLabels.filter(
    (label) => !new RegExp(`(?:\\*\\*)?${label}(?:\\*\\*)?\\s*[：:]`).test(markdown),
  );

  if (DAILY_BRIEFING_V2_HEADING_PATTERN.test(markdown) && missingV2Labels.length === 0) {
    return [];
  }

  if (DAILY_LEGACY_SUMMARY_HEADING_PATTERN.test(markdown)) {
    return [];
  }

  if (DAILY_BRIEFING_V2_HEADING_PATTERN.test(markdown)) {
    return missingV2Labels.map((label) => `日报 3 分钟导读缺少字段: ${label}`);
  }

  return ["日报页面缺少可用导读结构: 今日摘要或旧版3分钟读懂今天"];
}

function isSoftDailyPublicationIssue(issue) {
  return (
    issue === "Daily TOP reuses the same source URL" ||
    issue === "Daily TOP must contain at most one GitHub/open-source project item" ||
    issue === "Daily page must contain a watch section heading or V3 topic sections" ||
    issue === "Daily V3 should contain at least two topic sections" ||
    issue === "Daily AI fun section must contain at least one source item" ||
    issue === "Daily AI fun section contains a known non-AI topic" ||
    issue === "Daily AI fun section uses a paper/arXiv source" ||
    /^Daily (?:产品与功能更新|前沿研究|行业变化与个人影响|开源 TOP 项目|社媒精选) section must contain at least one source item$/.test(issue) ||
    /^Daily (?:TOP|open-source section|social section|research section|industry section|professional sections) (?:is|are) below target:/.test(issue)
  );
}

export function validateDailyPublication({
  summaryText,
  pageMarkdown,
  minimumTopItems = 0,
  hardMinimumTopItems,
  minimumOpenSourceItems = 0,
  minimumSocialItems = 0,
  minimumResearchItems = 0,
  minimumIndustryItems = 0,
  minimumTopicSections = 0,
  allowedTopGithubProjectUrls = [],
  enforceTopGithubProjectAllowlist = false,
}) {
  const writingStyleWarnings = collectDailyWritingStyleWarnings(pageMarkdown);
  const collectedIssues = [
    ...collectMarkdownIssues(summaryText, {
      label: "日报摘要",
      minChars: 30,
    }),
    ...collectMarkdownIssues(pageMarkdown, {
      label: "日报页面",
      minChars: 300,
      requiredPhrases: ["aivora.cn"],
      forbiddenPatterns: [
        ...DAILY_META_PATTERNS,
        ...MODEL_MANIPULATION_PATTERNS,
      ],
    }),
    ...collectDailyBriefingIssues(pageMarkdown),
    ...collectDailyStructureIssues(pageMarkdown, {
      minimumTopItems,
      hardMinimumTopItems,
      minimumOpenSourceItems,
      minimumSocialItems,
      minimumResearchItems,
      minimumIndustryItems,
      minimumTopicSections,
      allowedTopGithubProjectUrls,
      enforceTopGithubProjectAllowlist,
    }),
  ];

  const issues = collectedIssues.filter((issue) => !isSoftDailyPublicationIssue(issue));
  const warnings = [
    ...collectedIssues.filter(isSoftDailyPublicationIssue),
    ...writingStyleWarnings,
  ];

  return {
    ok: issues.length === 0,
    issues,
    warnings,
  };
}

function extractLevel3Blocks(section) {
  const content = String(section || "");
  const matches = [...content.matchAll(/^###\s+.+$/gm)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? content.length;
    return content.slice(start, end).trim();
  });
}

function hasOpportunityEvidenceLink(block) {
  return /^-\s*\*{0,2}(?:证据来源|证据与可信度)(?:[:：]\*{0,2}|\*{0,2}[:：]).*\[[^\]]+\]\(https?:\/\/[^\s)]+\)/m.test(
    String(block || "")
  );
}

function collectOpportunityGroupedFieldIssues(markdown) {
  const issues = [];
  const mainSection = extractSection(markdown, /^##\s+今日主推(?:\s|$).*$/im);
  const requiredFields = [
    "证据与可信度",
    "鱼塘与笨办法",
    "最小交付",
    "48小时验证",
    "第一单与复购",
    "风险与停止",
  ];

  for (const block of extractLevel3Blocks(mainSection)) {
    for (const field of requiredFields) {
      const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`^-\\s*\\*{0,2}${escaped}(?:[:：]\\*{0,2}|\\*{0,2}[:：])`, "m").test(block)) {
        issues.push(`AI 商机“今日主推”缺少六组字段中的“${field}”`);
      }
    }
  }

  return issues;
}

function buildEvidenceByUrl(sourceEvidence = []) {
  const evidenceByUrl = new Map();
  for (const record of sourceEvidence || []) {
    const url = canonicalizeUrl(record?.url);
    if (!url) continue;
    evidenceByUrl.set(url, record);
  }
  return evidenceByUrl;
}

function linkLabelOverstatesDestination(link) {
  try {
    const parsed = new URL(link?.url || "");
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const isGithubRepositoryRoot =
      parsed.hostname.toLowerCase() === "github.com" && pathParts.length === 2;
    const labelClaimsSpecificPage =
      /(?:(?:license|许可证?|许可)\s*(?:文件|页)|定价页|价格页|pricing\s*page|教程(?:直达|页|链接)|安装文档(?:页|链接)|文档页)/i.test(
        link?.title || ""
      );
    return isGithubRepositoryRoot && labelClaimsSpecificPage;
  } catch {
    return false;
  }
}

const OPPORTUNITY_SENSITIVE_BOUNDARY_PATTERN =
  /没有取得|没有|尚无|尚未|未获|未确认|未提供|未提取到|待核验|待核对|待确认|仍待|仍需|仍缺|还需|有待|需要核对|需要确认|需核对|需确认|先核对|先确认|应核对|应确认|必须核对|必须确认|不明确|未知|缺少官方|不承诺|不能确认|无法确认|无法核验|不能证明|不启动|不进入|不新增|建议(?:定价|报价)|先(?:定价|报价)|试(?:挂|卖)|(?:测试|验证|试探)(?:价|价格|报价|定价)|暂定(?:价|价格)|价格假设|报价假设/;

function collectOpportunitySourcePolicyIssues(
  markdown,
  {
    allowedSourceUrls = null,
    allowedRejectedSourceUrls = null,
    sourceEvidence = [],
    observationMode = false,
  } = {}
) {
  const issues = [];
  const allowedQualified = Array.isArray(allowedSourceUrls)
    ? new Set(allowedSourceUrls.map(canonicalizeUrl).filter(Boolean))
    : null;
  const allowedRejected = Array.isArray(allowedRejectedSourceUrls)
    ? new Set(allowedRejectedSourceUrls.map(canonicalizeUrl).filter(Boolean))
    : allowedQualified;
  const evidenceByUrl = buildEvidenceByUrl(sourceEvidence);
  const directSection = extractSection(markdown, /^##\s+直接结论(?:\s|$).*$/im);
  const mainSection = extractSection(markdown, /^##\s+今日主推(?:\s|$).*$/im);
  const smallSection = extractSection(markdown, /^##\s+本周小试(?:\s|$).*$/im);
  const avoidSection = extractSection(markdown, /^##\s+今天别碰(?:\s|$).*$/im);
  const actionSection = extractSection(markdown, /^##\s+今日三步(?:\s|$).*$/im);
  const opportunityBlocks = [
    ...extractLevel3Blocks(mainSection),
    ...extractLevel3Blocks(smallSection),
  ];

  for (const block of opportunityBlocks) {
    if (/^###\s+\[[^\]]+\]\(https?:\/\//m.test(block)) {
      issues.push("AI 商机机会标题必须是纯文本，原始链接应放在证据来源字段");
    }

    if (!hasOpportunityEvidenceLink(block)) {
      const heading = normalizeText(block.match(/^###\s+(.+)$/m)?.[1] || "未命名机会").slice(0, 80);
      issues.push(`AI 商机每个机会都必须在证据来源字段同一行提供原始链接（机会：${heading}）`);
    }

    const blockLinks = extractSectionLinks(block).filter((link) => !isNoiseSectionLink(link));
    const blockSourceUrls = blockLinks.map((link) => normalizeOpportunitySourceUrl(link.url));
    if (new Set(blockSourceUrls).size !== blockSourceUrls.length) {
      issues.push("AI 商机同一条机会不得重复引用同一个来源链接");
    }
    if (blockLinks.some(linkLabelOverstatesDestination)) {
      issues.push("AI 商机来源链接文字不能把 GitHub 仓库首页描述成 LICENSE、定价页或教程直达页");
    }
    const criticalFactPattern =
      /(?:¥|￥|\$\s*\d|美元|元\s*\/(?:月|年)|价格|售价|额度|封号|下线|退役|正式上线|政策|授权|许可(?:证)?|license)/i;
    const criticalFactClauses = block
      .split(/\r?\n|[。；;]/)
      .filter((clause) => criticalFactPattern.test(clause));
    const unsupportedCriticalFactClause = criticalFactClauses.find(
      (clause) => !OPPORTUNITY_SENSITIVE_BOUNDARY_PATTERN.test(clause)
    );
    if (
      criticalFactClauses.length > 0 &&
      !blockLinks.some((link) => {
        const evidence =
          evidenceByUrl.get(link.url) ||
          classifyOpportunityEvidence({ url: link.url }, "");
        return evidence.isPrimary === true;
      }) &&
      unsupportedCriticalFactClause
    ) {
      const clausePreview = normalizeText(unsupportedCriticalFactClause).slice(0, 140);
      issues.push(`AI 商机涉及价格、状态、政策或许可事实时必须引用官方或原项目来源（触发句：${clausePreview}）`);
    }
  }

  if (allowedQualified) {
    const qualifiedSections = [directSection, mainSection, smallSection, actionSection].join("\n");
    for (const link of extractSectionLinks(qualifiedSections)) {
      if (isNoiseSectionLink(link)) continue;
      if (!allowedQualified.has(link.url)) {
        issues.push(`AI 商机主推或行动区包含合格候选之外的来源链接: ${link.url}`);
      }
    }
  }

  if (allowedRejected) {
    const avoidLinks = extractSectionLinks(avoidSection).filter(
      (link) => !isNoiseSectionLink(link)
    );
    for (const link of avoidLinks) {
      if (!allowedRejected.has(link.url)) {
        issues.push(`AI 商机“今天别碰”包含被拒候选之外的来源链接: ${link.url}`);
      }
    }

    if (Array.isArray(allowedRejectedSourceUrls)) {
      const avoidBody = getSectionBody(avoidSection);
      const usesDefaultAvoid = /今天没有额外需要点名的高风险方向/.test(avoidBody);
      if (!usesDefaultAvoid && allowedRejected.size === 0) {
        issues.push("AI 商机没有被拒候选时，“今天别碰”不得点名具体方向");
      } else if (!usesDefaultAvoid && avoidLinks.length === 0) {
        issues.push("AI 商机“今天别碰”点名具体方向时必须引用被拒候选来源");
      }
    }
  }

  return {
    issues,
    opportunityCount: opportunityBlocks.length,
  };
}

function collectOpportunityLengthIssues(markdown) {
  const issues = [];
  const maxDirectChars = 360;
  const maxMainChars = 1200;
  const maxSmallChars = 650;
  const maxActionChars = 520;
  const directSection = extractSection(markdown, /^##\s+直接结论(?:\s|$).*$/im);
  const mainSection = extractSection(markdown, /^##\s+今日主推(?:\s|$).*$/im);
  const smallSection = extractSection(markdown, /^##\s+本周小试(?:\s|$).*$/im);
  const actionSection = extractSection(markdown, /^##\s+今日三步(?:\s|$).*$/im);
  const mainBlocks = extractLevel3Blocks(mainSection);
  const smallBlocks = extractLevel3Blocks(smallSection);

  const directLength = normalizeText(getSectionBody(directSection)).length;
  if (directLength > maxDirectChars) {
    issues.push(`AI 商机“直接结论”过长（${directLength}/${maxDirectChars}），应让读者在 20 秒内完成判断`);
  }
  for (const block of mainBlocks) {
    const blockLength = normalizeText(block).length;
    if (blockLength > maxMainChars) {
      issues.push(`AI 商机“今日主推”单条过长（${blockLength}/${maxMainChars}），应压缩重复背景和项目说明`);
    }
  }
  for (const block of smallBlocks) {
    const blockLength = normalizeText(block).length;
    if (blockLength > maxSmallChars) {
      issues.push(`AI 商机“本周小试”单条过长（${blockLength}/${maxSmallChars}），应只保留验证所需信息`);
    }
  }
  const actionLength = normalizeText(getSectionBody(actionSection)).length;
  if (actionLength > maxActionChars) {
    issues.push(`AI 商机“今日三步”过长（${actionLength}/${maxActionChars}），应只保留动作、对象和可观察结果`);
  }

  return issues;
}

function collectOpportunityActionShapeIssues(markdown) {
  const issues = [];
  const actionSection = extractSection(markdown, /^##\s+今日三步(?:\s|$).*$/im);
  const actionBody = getSectionBody(actionSection);
  const nonEmptyLines = actionBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const actionItems = nonEmptyLines.filter((line) => /^[-*+]\s+\S/.test(line));

  if (actionItems.length !== 3 || nonEmptyLines.length !== actionItems.length) {
    issues.push("AI 商机“今日三步”必须恰好是 3 个一级列表项，不得附加段落或子列表");
  }
  if (actionItems.some((line) => /\[[^\]]+\]\(https?:\/\//i.test(line))) {
    issues.push("AI 商机“今日三步”不得重复来源链接，只保留动作、对象和可观察结果");
  }
  if (
    actionItems.some(
      (line) => normalizeText(line.replace(/[*_`]/g, "")).length > 100
    )
  ) {
    issues.push("AI 商机“今日三步”每项最多 100 个字符，应删掉背景和第二句解释");
  }

  return issues;
}

const OPPORTUNITY_UNSCOPED_EVIDENCE_GAP_PATTERN =
  /(?:目前|尚)?(?:无|没有|零)([^。！？；，,\n]{0,40}(?:用户(?:使用)?记录|用户原话|买家(?:痛点)?访谈|询价记录|issues?[^。！？；，,\n]{0,12}(?:讨论|反馈)|付费证据|付费意向|付费记录))/gi;
const OPPORTUNITY_UNSAFE_AVOID_PATTERNS = [
  /(?:原文|报道|文章|媒体转述|媒体报道)[^。！？；\n]{0,30}(?:无|没有|未提供)[^。！？；\n]{0,24}(?:原项目|官方|产品演示|可复现)/i,
  /(?:只有|仅有)(?:融资|采访|媒体|报道)[^。！？；\n]{0,48}(?:无|没有|未提供)[^。！？；\n]{0,30}(?:官方|原项目|GitHub|产品主页|产品演示|可复现)/i,
];

export function normalizeOpportunityEvidenceBoundaryLanguage(
  markdown,
  { observationMode = false } = {}
) {
  let normalized = String(markdown || "")
    .split("\n")
    .map((line) => {
      const stopBoundary = line.search(/(?:\*\*)?(?:停止条件|何时停)：(?:\*\*)?/);
      const evidenceText = stopBoundary >= 0 ? line.slice(0, stopBoundary) : line;
      const stopText = stopBoundary >= 0 ? line.slice(stopBoundary) : "";
      return evidenceText.replace(
        OPPORTUNITY_UNSCOPED_EVIDENCE_GAP_PATTERN,
        (_, gap) => `本次候选输入未提供${String(gap || "").replace(/^任何/, "")}`
      ) + stopText;
    })
    .join("\n");
  normalized = normalized.replace(
    /(?:无已知|未发现)[^。！？；\n]{0,24}(?:商标|内容|依赖|许可|授权)(?:限制|风险|问题)?/gi,
    "相关商标、内容、依赖与授权边界仍待核对"
  );

  let inAvoidSection = false;
  normalized = normalized
    .split("\n")
    .map((line) => {
      if (/^##\s+/.test(line)) {
        inAvoidSection = /^##\s+今天别碰(?:\s|$)/.test(line);
        return line;
      }
      const unsafeSourceGapPattern = OPPORTUNITY_UNSAFE_AVOID_PATTERNS.find(
        (pattern) => pattern.test(line)
      );
      if (!unsafeSourceGapPattern) {
        return line;
      }

      if (!inAvoidSection) {
        const scopedSourceGapPattern = new RegExp(
          `(?:这篇|该)?(?:${unsafeSourceGapPattern.source})(?:链接|页面|入口)?`,
          unsafeSourceGapPattern.flags
        );
        return line.replace(
          scopedSourceGapPattern,
          "本次候选输入未提供可核验的官方产品或原项目链接"
        );
      }

      const sourceLink = line.match(/\[[^\]]+\]\(https?:\/\/[^)]+\)/i)?.[0] || "该候选";
      return `${sourceLink}——本次候选输入未提供可核验的官方产品或原项目链接，也未提供可复现的交付证据，先不投入。`;
    })
    .join("\n");

  if (observationMode) {
    const sensitiveFactPattern =
      /(?:¥|￥|\$\s*\d|美元|元\s*\/(?:月|年)|价格|售价|额度|封号|下线|退役|正式上线|政策|授权|许可(?:证)?|license)/i;
    const boundaryPattern =
      /没有取得|没有|尚无|尚未|未获|未确认|待核验|仍缺|缺少官方|不承诺|不能确认|无法确认|不启动|不进入/;
    let inOpportunitySection = false;
    normalized = normalized
      .split("\n")
      .map((line) => {
        if (/^##\s+/.test(line)) {
          inOpportunitySection = /^##\s+(?:今日主推|本周小试)(?:\s|$)/.test(line);
          return line;
        }
        if (!inOpportunitySection) return line;

        return line
          .split(/([。；;])/)
          .map((clause, clauseIndex) => {
            if (
              clauseIndex % 2 === 1 ||
              !sensitiveFactPattern.test(clause) ||
              boundaryPattern.test(clause)
            ) {
              return clause;
            }
            if (/^\s*###\s+/.test(clause)) {
              return clause.replace(
                /^(\s*###\s+)(?:观察[:：]\s*)?/,
                "$1观察：待核验线索："
              );
            }
            if (/^(\s*(?:-\s+)?\*\*[^*]+[:：]\*\*\s*)/.test(clause)) {
              return clause.replace(
                /^(\s*(?:-\s+)?\*\*[^*]+[:：]\*\*\s*)/,
                "$1待核验线索："
              );
            }
            if (/^(\s*[-*+]\s+)/.test(clause)) {
              return clause.replace(/^(\s*[-*+]\s+)/, "$1待核验线索：");
            }
            return `待核验线索：${clause}`;
          })
          .join("");
      })
      .join("\n");
  }

  return normalized;
}

function collectOpportunityMarketHypothesisIssues(markdown) {
  const unsupportedPatterns = [
    /(?:市面上|市场上|国内|中文(?:市场|用户|生态|社区)?)[^。！？；\n]{0,48}(?:没有|缺少|缺乏|空白)/i,
    /目前(?:没有|缺少|缺乏)[^。！？；\n]{0,20}(?:针对|面向)[^。！？；\n]{0,30}(?:方案|产品|服务|工具|教程|结果包|配置包)/i,
    /(?:用户|开发者|团队|商家|创作者|从业者)[^。！？；\n]{0,36}(?:反复|经常|普遍|只能|不得不)[^。！？；\n]{0,48}(?:手动|复制|重配|配置|处理|整理|切换|拼凑)/i,
    /(?:反复|经常|普遍|只能|不得不)[^。！？；\n]{0,36}(?:用户|开发者|团队|商家|创作者|从业者)/i,
  ];
  const uncertaintyPattern = /(?:待验证假设|仍待验证|尚待验证|需要验证|有待验证|可能|如果|若)/i;
  const clauses = String(markdown || "")
    .split(/\n|(?<=[。！？；])/u)
    .map((clause) => clause.trim())
    .filter(Boolean);

  const unsupportedClause = clauses.find(
    (clause) =>
      unsupportedPatterns.some((pattern) => pattern.test(clause)) &&
      !uncertaintyPattern.test(clause)
  );

  return unsupportedClause
    ? [`AI 商机把未经需求证据支持的市场缺口或群体痛点写成事实，必须改为待验证假设（触发句：${normalizeText(unsupportedClause).slice(0, 140)}）`]
    : [];
}

function collectOpportunityObservationIssues(markdown) {
  const issues = [];
  const directConclusion = getSectionBody(
    extractSection(markdown, /^##\s+直接结论(?:\s|$).*$/im)
  );
  const mainSection = extractSection(markdown, /^##\s+今日主推(?:\s|$).*$/im);

  if (!directConclusion.includes("今天没有新的差异化商机，不凑数。")) {
    issues.push("AI 商机观察稿必须明确今天没有新的差异化商机，不得伪装成新机会");
  }
  if (!/^###\s+观察[:：]/m.test(mainSection)) {
    issues.push("AI 商机观察稿的主推标题必须以“观察：”开头");
  }
  if (!/第一单与复购[:：]\*{0,2}[^\n]*尚不进入成交阶段/m.test(mainSection)) {
    issues.push("AI 商机观察稿必须明确尚不进入成交阶段");
  }

  return issues;
}

export function validateOpportunityPublication({
  markdown,
  bannedPublicPhrases = [],
  allowedSourceUrls = null,
  allowedRejectedSourceUrls = null,
  sourceEvidence = [],
  aivoraLinkPolicy = { allowedUrls: [] },
  minimumOpportunityCount = 1,
  maximumOpportunityCount = 4,
  observationMode = false,
}) {
  const visibleMarkdown = stripOpportunityReplayMetadata(markdown);
  const issues = collectMarkdownIssues(visibleMarkdown, {
    label: "商机页面",
    minChars: 260,
    requiredPhrases: [
      "## 直接结论",
      "## 今日主推",
      "## 本周小试",
      "## 今天别碰",
      "## 今日三步",
      "证据与可信度",
      "鱼塘与笨办法",
      "最小交付",
      "48小时验证",
      "第一单与复购",
      "风险与停止",
    ],
    forbiddenPhrases: bannedPublicPhrases,
    forbiddenPatterns: [
      ...MODEL_MANIPULATION_PATTERNS,
      /稳赚|保证赚钱|轻松月入|日入\s*\d|月入\s*\d|爆单/i,
      /先编商机|素材不够.*硬凑/i,
      /目标用户不缺|人人都(?:需要|会)|每个.{0,24}都(?:踩过|需要|愿意|会)/i,
      /普遍(?:遇到|存在|需要|面临)|(?:的人|用户|客户|买家)愿意(?:直接)?(?:付钱|花钱|买单|购买)/i,
      /共同(?:烦恼|痛点|问题|需求)|没人(?:帮|做|提供)|这就是可以卖的地方/i,
      /大多数.{0,30}(?:只会|都不会|根本)|一般.{0,24}根本|几乎没人/i,
      /预计\s*\d+(?:\s*[-–—至到]\s*\d+)?\s*(?:分钟|小时|天)/i,
      /跑(?:通|一遍).{0,20}(?:就|即可).{0,12}(?:能卖|可以卖|有东西可以卖)/i,
      /(?:原文|报道|文章)(?:\]\([^)]+\))?(?:没有|未)(?:指向|提供|附上|给出)?.{0,16}(?:官方|原项目)(?:链接|来源|仓库)?/i,
      ...OPPORTUNITY_UNSAFE_AVOID_PATTERNS,
      /(?:^|[。；]\s*)(?:目前|尚)?(?:无|没有|零)[^。！？；\n]{0,40}(?:用户(?:使用)?记录|用户原话|买家(?:痛点)?访谈|询价记录|issues?[^。！？；\n]{0,12}(?:讨论|反馈)|付费证据|付费意向|付费记录)/im,
      /(?:MIT|Apache|GPL|开源许可|license)[^。！？；\n]{0,28}(?:无授权风险|无合规风险|没有授权风险|没有合规风险)/i,
      /(?:无已知|未发现)[^。！？；\n]{0,24}(?:商标|内容|依赖|许可|授权)(?:限制|风险|问题)?/i,
    ],
  });

  if (/^#\s+\S/m.test(visibleMarkdown)) {
    issues.push("AI 商机正文不得输出一级标题，页面模板会提供唯一 H1");
  }

  const sourcePolicy = collectOpportunitySourcePolicyIssues(visibleMarkdown, {
    allowedSourceUrls,
    allowedRejectedSourceUrls,
    sourceEvidence,
    observationMode,
  });
  issues.push(...sourcePolicy.issues);
  issues.push(...collectOpportunityGroupedFieldIssues(visibleMarkdown));
  issues.push(...collectOpportunityLengthIssues(visibleMarkdown));
  issues.push(...collectOpportunityActionShapeIssues(visibleMarkdown));
  issues.push(...collectOpportunityMarketHypothesisIssues(visibleMarkdown));
  if (observationMode) {
    issues.push(...collectOpportunityObservationIssues(visibleMarkdown));
  }

  if (sourcePolicy.opportunityCount < minimumOpportunityCount) {
    issues.push(`AI 商机至少需要 ${minimumOpportunityCount} 个达到证据门槛的机会`);
  }
  if (sourcePolicy.opportunityCount > maximumOpportunityCount) {
    issues.push(`AI 商机最多只能发布 ${maximumOpportunityCount} 个机会`);
  }

  const aivoraValidation = validateOpportunityAivoraLinks(
    visibleMarkdown,
    aivoraLinkPolicy,
    { maxLinks: 1 }
  );
  issues.push(...aivoraValidation.issues);

  return {
    ok: issues.length === 0,
    issues,
    opportunityCount: sourcePolicy.opportunityCount,
    aivoraLinkCount: aivoraValidation.linkCount,
  };
}

const ACCOUNT_OPPORTUNITY_ACTION_FIELDS = [
  "证据与可信度",
  "供给形态",
  "适合买家与真实需求",
  "是否今天能挂闲鱼",
  "今天最小动作",
  "售后与合规",
  "不能承诺与停止",
];

function collectAccountOpportunitySummaryIssues(markdown) {
  const issues = [];
  const summary = extractSection(markdown, /^##\s+30\s*秒结论(?:\s|$).*$/im);
  const lines = getSectionBody(summary)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const requiredLabels = ["今天发生什么", "今天做什么", "最大风险"];

  if (lines.length !== 3 || lines.some((line) => !/^[-*+]\s+/.test(line))) {
    issues.push("账号商机“30 秒结论”必须恰好是 3 个一级列表项");
  }
  for (const label of requiredLabels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!lines.some((line) => new RegExp(`\\*{0,2}${escaped}[:：]\\*{0,2}`).test(line))) {
      issues.push(`账号商机“30 秒结论”缺少“${label}”`);
    }
  }
  if (normalizeText(getSectionBody(summary)).length > 360) {
    issues.push("账号商机“30 秒结论”过长，应让读者在 30 秒内完成判断");
  }
  return issues;
}

function collectAccountOpportunityFieldIssues(markdown) {
  const issues = [];
  const actionSection = extractSection(markdown, /^##\s+今日可执行(?:\s|$).*$/im);
  const blocks = extractLevel3Blocks(actionSection);

  for (const block of blocks) {
    if (/^###\s+\[[^\]]+\]\(https?:\/\//m.test(block)) {
      issues.push("账号商机行动标题必须是纯文本，证据链接应放在正文中");
    }
    if (!/^\*\*判断[:：]\*\*\s*\S/m.test(block)) {
      issues.push("账号商机每个行动必须先给出“判断”");
    }
    for (const field of ACCOUNT_OPPORTUNITY_ACTION_FIELDS) {
      const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`^-\\s*\\*\\*${escaped}[:：]\\*\\*`, "m").test(block)) {
        issues.push(`账号商机行动缺少“${field}”字段`);
      }
    }
    if (!hasOpportunityEvidenceLink(block)) {
      issues.push("账号商机每个行动必须在“证据与可信度”中提供候选来源链接");
    }
    if (!/可信度[:：]\s*(?:高|中|低)(?=$|[\s；;，。])/m.test(block)) {
      issues.push("账号商机可信度只能写高、中或低");
    }
    if (!/是否今天能挂闲鱼[:：]\*{0,2}\s*(?:是|否|观察)(?=$|[\s；;，。])/m.test(block)) {
      issues.push("账号商机“是否今天能挂闲鱼”只能写是、否或观察");
    }
    if (!/售后风险[:：]\s*(?:低|中|高)(?=$|[\s；;，。])/m.test(block)) {
      issues.push("账号商机售后风险只能写低、中或高");
    }
    if (normalizeText(block).length > 1000) {
      issues.push("账号商机单个行动过长，应压缩为证据、动作和边界");
    }
  }

  return { issues, opportunityCount: blocks.length, blocks };
}

function collectAccountOpportunitySourceIssues(
  markdown,
  {
    allowedSourceUrls = null,
    allowedRejectedSourceUrls = null,
    sourceEvidence = [],
    observationMode = false,
  } = {}
) {
  const issues = [];
  const allowedQualified = Array.isArray(allowedSourceUrls)
    ? new Set(allowedSourceUrls.map(canonicalizeUrl).filter(Boolean))
    : null;
  const allowedRejected = Array.isArray(allowedRejectedSourceUrls)
    ? new Set(allowedRejectedSourceUrls.map(canonicalizeUrl).filter(Boolean))
    : allowedQualified;
  const summary = extractSection(markdown, /^##\s+30\s*秒结论(?:\s|$).*$/im);
  const hardSignals = extractSection(markdown, /^##\s+今日硬信号(?:\s|$).*$/im);
  const actionSection = extractSection(markdown, /^##\s+今日可执行(?:\s|$).*$/im);
  const buyerSection = extractSection(markdown, /^##\s+买家避坑(?:\s|$).*$/im);
  const avoidSection = extractSection(markdown, /^##\s+今天别碰(?:\s|$).*$/im);
  const actionSteps = extractSection(markdown, /^##\s+今日三步(?:\s|$).*$/im);
  const actionBlocks = extractLevel3Blocks(actionSection);

  const hasOfficialLink = (links) =>
    links.some((link) => isOfficialAccountOpportunityUrl(link.url));
  const criticalAccountFactPattern =
    /(?:¥|￥|\$\s*\d|美元|元\s*\/(?:月|年)|价格|售价|额度|配额|套餐|支付|地区|登录|封号|封禁|下线|停用|退役|正式上线|服务状态|政策|条款|授权)/i;

  const hardSignalLines = getSectionBody(hardSignals)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^[-*+]\s+/.test(line));
  if (hardSignalLines.length === 0) {
    issues.push("账号商机“今日硬信号”至少需要 1 条可核验事实");
  }
  for (const line of hardSignalLines) {
    const isObservationConclusion =
      observationMode &&
      /今天没有取得可由官方页面确认的(?:海外 AI )?账号、价格、额度或政策新变化；不新增商品。/.test(
        line
      );
    if (isObservationConclusion) continue;
    const links = extractSectionLinks(line).filter((link) => !isNoiseSectionLink(link));
    if (links.length === 0) {
      issues.push("账号商机每条硬信号都必须引用对应候选来源");
    } else if (criticalAccountFactPattern.test(line) && !hasOfficialLink(links)) {
      issues.push("账号商机涉及价格、额度、支付、地区、登录、服务状态或政策的硬信号必须引用官方页面");
    }
  }

  for (const block of actionBlocks) {
    const links = extractSectionLinks(block).filter((link) => !isNoiseSectionLink(link));
    if (links.some((link) => /^(?:原文|来源|链接|详情|点击查看)$/i.test(link.title.trim()))) {
      issues.push("账号商机来源链接文字必须说明页面证明了什么");
    }
    if (new Set(links.map((link) => normalizeOpportunitySourceUrl(link.url))).size !== links.length) {
      issues.push("账号商机同一行动不得重复引用同一个来源链接");
    }

    const criticalFactClauses = block
      .split(/\r?\n|[。；;]/)
      .filter((clause) => criticalAccountFactPattern.test(clause));
    const unsupportedCriticalFactClause = criticalFactClauses.find(
      (clause) => !OPPORTUNITY_SENSITIVE_BOUNDARY_PATTERN.test(clause)
    );
    if (
      criticalFactClauses.length > 0 &&
      !hasOfficialLink(links) &&
      unsupportedCriticalFactClause
    ) {
      const clausePreview = normalizeText(unsupportedCriticalFactClause).slice(0, 140);
      issues.push(`账号商机涉及价格、额度、支付、地区、登录、服务状态或政策时必须引用对应官方页面（触发句：${clausePreview}）`);
    }
    if (/是否今天能挂闲鱼[:：]\*{0,2}\s*是(?=$|[\s；;，。])/m.test(block)) {
      if (/售后风险[:：]\s*高(?=$|[\s；;，。])/m.test(block)) {
        issues.push("账号商机售后风险为高时不得建议今天上架");
      }
    }
  }

  if (allowedQualified) {
    const qualifiedSections = [summary, hardSignals, actionSection, buyerSection, actionSteps].join("\n");
    for (const link of extractSectionLinks(qualifiedSections)) {
      if (isNoiseSectionLink(link)) continue;
      if (!allowedQualified.has(link.url)) {
        issues.push(`账号商机包含合格候选之外的来源链接: ${link.url}`);
      }
    }
  }

  if (allowedRejected) {
    const avoidLinks = extractSectionLinks(avoidSection).filter(
      (link) => !isNoiseSectionLink(link)
    );
    for (const link of avoidLinks) {
      if (!allowedRejected.has(link.url)) {
        issues.push(`账号商机“今天别碰”包含被拒候选之外的来源链接: ${link.url}`);
      }
    }
    const avoidBody = getSectionBody(avoidSection);
    const usesDefaultAvoid = /今天没有额外需要点名的高风险方向/.test(avoidBody);
    if (!usesDefaultAvoid && allowedRejected.size === 0) {
      issues.push("账号商机没有被拒候选时，“今天别碰”不得点名具体方向");
    } else if (!usesDefaultAvoid && avoidLinks.length === 0) {
      issues.push("账号商机“今天别碰”点名具体方向时必须引用被拒候选来源");
    }
  }

  return issues;
}

function collectAccountOpportunityObservationIssues(markdown) {
  const issues = [];
  const summary = getSectionBody(
    extractSection(markdown, /^##\s+30\s*秒结论(?:\s|$).*$/im)
  );
  const hardSignals = getSectionBody(
    extractSection(markdown, /^##\s+今日硬信号(?:\s|$).*$/im)
  );
  const actions = extractSection(markdown, /^##\s+今日可执行(?:\s|$).*$/im);

  if (!/今天做什么[:：]\*{0,2}[^\n]*不新增商品/m.test(summary)) {
    issues.push("账号商机观察稿必须在 30 秒结论中明确不新增商品");
  }
  if (
    !/今天没有取得可由官方页面确认的(?:海外 AI )?账号、价格、额度或政策新变化；不新增商品。/.test(
      hardSignals
    )
  ) {
    issues.push("账号商机观察稿必须明确没有可由官方页面确认的新变化");
  }
  if (!/^###\s+观察[:：]/m.test(actions)) {
    issues.push("账号商机观察稿的行动标题必须以“观察：”开头");
  }
  if (/是否今天能挂闲鱼[:：]\*{0,2}\s*是(?=$|[\s；;，。])/m.test(actions)) {
    issues.push("账号商机观察稿不得建议今天上架");
  }

  return issues;
}

function collectAccountOpportunityActionShapeIssues(markdown) {
  const issues = [];
  const section = extractSection(markdown, /^##\s+今日三步(?:\s|$).*$/im);
  const lines = getSectionBody(section)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const requiredLabels = ["今天确认", "今天修改", "今天记录"];

  if (lines.length !== 3 || lines.some((line) => !/^[-*+]\s+/.test(line))) {
    issues.push("账号商机“今日三步”必须恰好是 3 个一级列表项，不得附加段落或子列表");
  }
  for (const label of requiredLabels) {
    if (!lines.some((line) => line.includes(label))) {
      issues.push(`账号商机“今日三步”缺少“${label}”`);
    }
  }
  if (lines.some((line) => /\[[^\]]+\]\(https?:\/\//i.test(line))) {
    issues.push("账号商机“今日三步”不得重复来源链接");
  }
  if (lines.some((line) => normalizeText(line).length > 110)) {
    issues.push("账号商机“今日三步”每项最多 110 个字符");
  }
  return issues;
}

function collectAccountOpportunitySafetyIssues(markdown) {
  const issues = [];
  let section = "";
  const warningPattern = /不要|不得|禁止|避免|不能|不应|拒绝|别碰|风险|警惕|停止|不提供|不建议|无法承诺/;
  const unsafeAdvicePattern =
    /(?:共享账号|多人共用|合租账号|转卖凭据|售卖\s*API\s*key|购买\s*API\s*key|盗号|黑卡|接码|绕过(?:验证|风控|限制)|规避(?:检测|风控|限制)|破解激活|代过验证)/i;

  for (const rawLine of String(markdown || "").split(/\r?\n/)) {
    const heading = rawLine.match(/^##\s+(.+)$/);
    if (heading) section = heading[1].trim();
    if (!unsafeAdvicePattern.test(rawLine)) continue;
    const isWarningSection = section === "买家避坑" || section === "今天别碰";
    if (!isWarningSection && !warningPattern.test(rawLine)) {
      issues.push("账号商机不得提供共享滥用、凭据转卖、盗号、黑卡、接码、绕过验证或规避风控建议");
      break;
    }
  }

  if (/建议(?:售价|定价)|(?:挂价|卖价|售价)[:：]?\s*[¥￥$]?\s*\d|先挂\s*\d+(?:\.\d+)?\s*元/i.test(markdown)) {
    issues.push("账号商机不得编造或建议具体卖家售价");
  }
  const unsupportedMetricPattern =
    /闲鱼(?:实时)?销量|搜索热度(?:会|将|必然)|转化率(?:会|将)|保证(?:稳定|可用)|永不封号|无限续杯/i;
  for (const rawLine of String(markdown || "").split(/\r?\n/)) {
    if (!unsupportedMetricPattern.test(rawLine)) continue;
    if (warningPattern.test(rawLine) || /不证明|不可证明|没有证据/.test(rawLine)) continue;
    issues.push("账号商机不得编造销量、搜索热度、转化率或稳定性承诺");
    break;
  }
  return issues;
}

function collectAccountOpportunityMarketScopeIssues(markdown) {
  return containsDomesticAccountProduct(markdown)
    ? ["账号商机只处理海外 AI 产品，正文不得出现国内 AI 产品"]
    : [];
}

export function validateAccountOpportunityPublication({
  markdown,
  bannedPublicPhrases = [],
  allowedSourceUrls = null,
  allowedRejectedSourceUrls = null,
  sourceEvidence = [],
  aivoraLinkPolicy = { allowedUrls: [] },
  minimumOpportunityCount = 1,
  maximumOpportunityCount = 2,
  observationMode = false,
}) {
  const visibleMarkdown = stripOpportunityReplayMetadata(markdown);
  const issues = collectMarkdownIssues(visibleMarkdown, {
    label: "账号商机页面",
    minChars: 300,
    requiredPhrases: [
      "## 30 秒结论",
      "## 今日硬信号",
      "## 今日可执行",
      "## 买家避坑",
      "## 今天别碰",
      "## 今日三步",
      ...ACCOUNT_OPPORTUNITY_ACTION_FIELDS,
    ],
    forbiddenPhrases: bannedPublicPhrases,
    forbiddenPatterns: [
      ...MODEL_MANIPULATION_PATTERNS,
      /稳赚|保证赚钱|轻松月入|日入\s*\d|月入\s*\d|爆单/i,
      /买家(?:一定|都会|会马上)|用户(?:一定|都会|会马上)|(?:需求|销量|询问量)(?:必然|一定|马上)(?:上涨|增加|爆发)/i,
      /全球(?:停用|封号)|全面封号|大规模封号/i,
    ],
  });

  if (/^#\s+\S/m.test(visibleMarkdown)) {
    issues.push("账号商机正文不得输出一级标题，页面模板会提供唯一 H1");
  }

  issues.push(...collectAccountOpportunitySummaryIssues(visibleMarkdown));
  const actionFields = collectAccountOpportunityFieldIssues(visibleMarkdown);
  issues.push(...actionFields.issues);
  if (actionFields.opportunityCount < minimumOpportunityCount) {
    issues.push(`账号商机至少需要 ${minimumOpportunityCount} 个达到证据门槛的行动`);
  }
  if (actionFields.opportunityCount > maximumOpportunityCount) {
    issues.push(`账号商机最多只能发布 ${maximumOpportunityCount} 个行动`);
  }
  issues.push(...collectAccountOpportunitySourceIssues(visibleMarkdown, {
    allowedSourceUrls,
    allowedRejectedSourceUrls,
    sourceEvidence,
    observationMode,
  }));
  issues.push(...collectAccountOpportunityActionShapeIssues(visibleMarkdown));
  issues.push(...collectAccountOpportunitySafetyIssues(visibleMarkdown));
  issues.push(...collectAccountOpportunityMarketScopeIssues(visibleMarkdown));
  issues.push(...collectOpportunityMarketHypothesisIssues(visibleMarkdown));
  if (observationMode) {
    issues.push(...collectAccountOpportunityObservationIssues(visibleMarkdown));
  }

  const aivoraValidation = validateOpportunityAivoraLinks(
    visibleMarkdown,
    aivoraLinkPolicy,
    { maxLinks: 1 }
  );
  issues.push(...aivoraValidation.issues);

  return {
    ok: issues.length === 0,
    issues,
    opportunityCount: actionFields.opportunityCount,
    aivoraLinkCount: aivoraValidation.linkCount,
  };
}
