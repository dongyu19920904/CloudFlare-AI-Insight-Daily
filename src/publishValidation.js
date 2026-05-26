const COMMON_FAILURE_PATTERNS = [
  /i can't discuss that/i,
  /i cannot discuss that/i,
  /i can't help/i,
  /would you like help/i,
  /set up an api integration/i,
  /素材不足/i,
  /无法生成/i,
];

const DAILY_META_PATTERNS = [
  /AI思考:?/i,
  /我看了一下(今天|这批)?素材/,
  /(按照|根据).{0,12}(日期过滤规则|容错机制|评分系统)/,
  /素材(质量)?参差不齐/,
  /我会按照.{0,12}筛选/,
];

const DAILY_WATCH_HEADING_PATTERN = /^##\s*\*\*.*(?:\uD83D\uDCCC|\uD83C\uDFAF|值得关注|关注).*\*\*/im;
const DAILY_FUN_HEADING_PATTERN = /^##\s*\*\*.*(?:\uD83D\uDE04|\uD83D\uDE06|AI\s*趣闻|趣闻).*\*\*/im;

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
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
  const content = String(markdown || "");
  const items = [];
  const itemRegex = /^###\s+(\d+)\.\s+\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)([\s\S]*?)(?=^###\s+\d+\.|\n##\s+|(?![\s\S]))/gm;

  for (const match of content.matchAll(itemRegex)) {
    items.push({
      number: Number.parseInt(match[1], 10),
      title: match[2],
      url: canonicalizeUrl(match[3]),
      body: match[4] || "",
      context: `${match[2] || ""}\n${match[4] || ""}`,
    });
  }

  return items;
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
  const faqHeadingPattern = /^##\s*\*\*❓\s*相关问题(?:（仅1条）)?\*\*/im;
  const topSection = extractSection(pageMarkdown, /^##\s*\*\*.*TOP.*\*\*/im);

  if (!faqHeadingPattern.test(String(pageMarkdown || ""))) {
    issues.push("日报页面缺少必需片段: ## **❓ 相关问题**");
  }

  if (!topSection) {
    issues.push("日报页面缺少 TOP 栏目");
    return issues;
  }

  const numberedTopItems = [
    ...topSection.matchAll(/^###\s+\d+\.\s+\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/gm),
  ];
  const topItems = extractNumberedTopItems(topSection);

  if (numberedTopItems.length === 0) {
    issues.push("Daily top items must use numbered headings");
  }

  topItems.forEach((item, index) => {
    if (item.number !== index + 1) {
      issues.push("Daily top item numbers must be unique and sequential");
    }
  });

  if (minimumTopItems > 0 && numberedTopItems.length < minimumTopItems) {
    issues.push(`Daily top items are insufficient: expected at least ${minimumTopItems}`);
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

  if (topItems.some((item) => isKnownNonAiTopTopic(item))) {
    issues.push("Daily TOP contains a known non-AI topic");
  }

  const watchSection = extractSection(pageMarkdown, DAILY_WATCH_HEADING_PATTERN);
  const funSection = extractSection(pageMarkdown, DAILY_FUN_HEADING_PATTERN);
  if (!watchSection) {
    issues.push("Daily page must contain a watch section heading");
  } else if (countContentSourceLinks(watchSection) === 0) {
    issues.push("Daily watch section must contain at least one source item");
  }
  if (funSection && countContentSourceLinks(funSection) === 0) {
    issues.push("Daily AI fun section must contain at least one source item");
  }

  const primarySectionLinks = {
    TOP: extractSectionLinks(topSection).filter((link) => !isNoiseSectionLink(link)),
    watch: extractSectionLinks(watchSection).filter((link) => !isNoiseSectionLink(link)),
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

function isSoftDailyPublicationIssue(issue) {
  return (
    issue === "Daily TOP reuses the same source URL" ||
    issue === "Daily TOP must contain at most one GitHub/open-source project item" ||
    issue === "Daily AI fun section must contain at least one source item" ||
    issue === "Daily AI fun section contains a known non-AI topic" ||
    issue === "Daily AI fun section uses a paper/arXiv source"
  );
}

export function validateDailyPublication({
  summaryText,
  pageMarkdown,
  minimumTopItems = 0,
}) {
  const collectedIssues = [
    ...collectMarkdownIssues(summaryText, {
      label: "日报摘要",
      minChars: 30,
    }),
    ...collectMarkdownIssues(pageMarkdown, {
      label: "日报页面",
      minChars: 300,
      requiredPhrases: [
        "## **今日摘要**",
        "## ⚡ 快速导航",
        "## **今日AI资讯**",
        "aivora.cn",
      ],
      forbiddenPatterns: DAILY_META_PATTERNS,
    }),
    ...collectDailyStructureIssues(pageMarkdown, { minimumTopItems }),
  ];

  const issues = collectedIssues.filter((issue) => !isSoftDailyPublicationIssue(issue));
  const warnings = collectedIssues.filter(isSoftDailyPublicationIssue);

  return {
    ok: issues.length === 0,
    issues,
    warnings,
  };
}

export function validateOpportunityPublication({
  markdown,
  bannedPublicPhrases = [],
}) {
  const issues = collectMarkdownIssues(markdown, {
    label: "商机页面",
    minChars: 260,
    requiredPhrases: [
      "# 今日AI商机",
      "## 先说结论",
      "## 今日主推",
      "## 本周可试",
      "## 今天别碰",
      "## 地图感",
      "## 今日动作",
      "这钱从哪来",
      "最简单卖法",
      "今天先做哪一步",
      "今天就能发的文案",
      "配图建议",
      "先怎么试",
      "为什么先别冲太猛",
    ],
    forbiddenPhrases: bannedPublicPhrases,
  });

  issues.push(
    ...collectMissingLinkedHeadingIssues(
      markdown,
      [
        { name: "今日主推", pattern: /^##\s+今日主推(?:\s|$).*$/im },
        { name: "本周可试", pattern: /^##\s+本周可试(?:\s|$).*$/im },
        { name: "今天别碰", pattern: /^##\s+今天别碰(?:\s|$).*$/im },
        { name: "地图感", pattern: /^##\s+地图感(?:\s|$).*$/im },
      ],
      "商机页面"
    )
  );

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function validateAccountOpportunityPublication({
  markdown,
  bannedPublicPhrases = [],
}) {
  const issues = collectMarkdownIssues(markdown, {
    label: "账号商机页面",
    minChars: 180,
    requiredPhrases: [
      "# 今日AI账号商机",
      "## 先看信号",
      "## 今日主推",
      "## 平替机会",
      "## 闲鱼新品",
      "## 今天别碰",
      "## 今日动作",
      "发生了什么",
      "证据来源",
      "可信度",
      "是否今天能挂闲鱼",
      "今天先挂什么",
      "今天先测什么",
      "售后风险",
      "今天最小动作",
    ],
    forbiddenPhrases: bannedPublicPhrases,
  });

  issues.push(
    ...collectMissingLinkedHeadingIssues(
      markdown,
      [{ name: "今日主推", pattern: /^##\s+今日主推(?:\s|$).*$/im }],
      "账号商机页面"
    )
  );

  if (!sourceEvidenceLineHasMarkdownLink(markdown)) {
    issues.push("账号商机页面证据来源必须使用原始信息源链接");
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
