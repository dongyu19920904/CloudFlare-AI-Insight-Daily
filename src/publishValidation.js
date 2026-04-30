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

const OPPORTUNITY_BRAND_FAMILIES = [
  {
    label: "OpenAI/GPT",
    pattern: /\b(?:openai|chatgpt|gpt(?:[-\s]?(?:[0-9]+(?:\.[0-9]+)?|image|oss|realtime))?|sora|sam altman)\b|奥特曼|山姆/i,
  },
  {
    label: "Claude",
    pattern: /\b(?:claude|anthropic|sonnet|opus)\b/i,
  },
  {
    label: "Gemini",
    pattern: /\b(?:gemini|google ai studio|google gemini)\b/i,
  },
  {
    label: "Cursor",
    pattern: /\bcursor\b/i,
  },
  {
    label: "DeepSeek",
    pattern: /\bdeepseek\b/i,
  },
  {
    label: "Kimi",
    pattern: /\b(?:kimi|moonshot)\b|月之暗面/i,
  },
];

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

function countPatternMatches(text, pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  return [...String(text || "").matchAll(regex)].length;
}

function collectDominantBrandIssues(markdown, options = {}) {
  const {
    label = "内容",
    maxMentions = 10,
    maxShare = 0.55,
    minTotalBrandMentions = 8,
  } = options;
  const text = String(markdown || "");
  const counts = OPPORTUNITY_BRAND_FAMILIES
    .map((family) => ({
      label: family.label,
      count: countPatternMatches(text, family.pattern),
    }))
    .filter((family) => family.count > 0)
    .sort((left, right) => right.count - left.count);
  const total = counts.reduce((sum, family) => sum + family.count, 0);

  if (total < minTotalBrandMentions || counts.length === 0) return [];

  const dominant = counts[0];
  if (dominant.count <= maxMentions || dominant.count / total < maxShare) {
    return [];
  }

  return [
    `${label}品牌露出过密: ${dominant.label} 出现 ${dominant.count} 次，请保留主推必要名称，其余栏目改写成场景、品类、买家痛点或交付形式`,
  ];
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
  return [...String(markdown || "").matchAll(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g)]
    .map((match) => canonicalizeUrl(match[1]))
    .filter(Boolean);
}

function extractSectionLinks(markdown) {
  return [...String(markdown || "").matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)]
    .map((match) => ({
      title: match[1],
      url: canonicalizeUrl(match[2]),
    }))
    .filter((item) => item.url);
}

function isGithubProjectUrl(url) {
  if (!url) return false;

  try {
    const parsed = new URL(String(url).trim());
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const parts = parsed.pathname.split("/").filter(Boolean);
    return host === "github.com" && parts.length >= 2;
  } catch {
    return /github\.com\/[^/?#\s]+\/[^/?#\s]+/i.test(String(url || ""));
  }
}

function countGithubProjectLinks(sectionMarkdown) {
  const seen = new Set();
  let count = 0;

  for (const link of extractSectionLinks(sectionMarkdown)) {
    if (!isGithubProjectUrl(link.url) || seen.has(link.url)) continue;
    seen.add(link.url);
    count += 1;
  }

  return count;
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
  const requireGithubProjectInTop = Boolean(options.requireGithubProjectInTop);
  const requireGithubProjectInMore = Boolean(options.requireGithubProjectInMore);
  const faqHeadingPattern = /^##\s*\*\*❓\s*相关问题(?:（仅1条）)?\*\*/im;
  const moreHeadingPattern = /^##\s*\*\*.*更多动态.*\*\*/im;
  const funHeadingPattern = /^##\s*\*\*.*AI.*趣闻.*\*\*/im;
  const topSection = extractSection(pageMarkdown, /^##\s*\*\*.*TOP.*\*\*/im);

  if (!faqHeadingPattern.test(String(pageMarkdown || ""))) {
    issues.push("日报页面缺少必需片段: ## **❓ 相关问题**");
  }

  if (!moreHeadingPattern.test(String(pageMarkdown || ""))) {
    issues.push("日报页面缺少必需片段: ## **📊 更多动态**");
  }

  if (!funHeadingPattern.test(String(pageMarkdown || ""))) {
    issues.push("日报页面缺少必需片段: ## **😄 AI趣闻**");
  }

  if (!topSection) {
    issues.push("日报页面缺少 TOP 栏目");
    return issues;
  }

  const numberedTopItems = [
    ...topSection.matchAll(/^###\s+\d+\.\s+\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/gm),
  ];

  if (numberedTopItems.length === 0) {
    issues.push("Daily top items must use numbered headings");
  }

  if (minimumTopItems > 0 && numberedTopItems.length < minimumTopItems) {
    issues.push(`Daily top items are insufficient: expected at least ${minimumTopItems}`);
  }

  const moreSection = extractSection(pageMarkdown, moreHeadingPattern);
  const funSection = extractSection(pageMarkdown, funHeadingPattern);
  const topGithubProjectCount = countGithubProjectLinks(topSection);
  const moreGithubProjectCount = countGithubProjectLinks(moreSection);

  if (topGithubProjectCount > 1) {
    issues.push("TOP 10 GitHub/开源项目最多只能 1 条");
  }

  if (moreGithubProjectCount > 1) {
    issues.push("更多动态 GitHub/开源项目最多只能 1 条");
  }

  if (requireGithubProjectInTop && topGithubProjectCount !== 1) {
    issues.push("TOP 10 GitHub/开源项目必须正好 1 条");
  }

  if (requireGithubProjectInMore && moreGithubProjectCount !== 1) {
    issues.push("更多动态 GitHub/开源项目必须正好 1 条");
  }

  const funHasStoryLink = /^###\s+\[[^\]]+\]\(https?:\/\/[^\s)]+\)/m.test(funSection);
  if (funHeadingPattern.test(String(pageMarkdown || "")) && !funHasStoryLink) {
    issues.push("AI趣闻必须使用一条真实素材 Markdown 链接");
  }
  if (/轻观察|今日观察|AI轻观察|不带链接/.test(funSection)) {
    issues.push("AI趣闻不能写成无链接轻观察");
  }

  const duplicateUrls = collectDuplicateUrlsBySection({
    top: extractSectionUrls(topSection),
    more: extractSectionUrls(moreSection),
    fun: extractSectionUrls(funSection),
  });

  if (duplicateUrls.length > 0) {
    issues.push("Daily sections reuse the same source URL");
  }

  const duplicateTopics = collectDuplicateTopicsBySection({
    top: extractSectionLinks(topSection),
    more: extractSectionLinks(moreSection),
    fun: extractSectionLinks(funSection),
  });

  if (duplicateTopics.length > 0) {
    issues.push("Daily sections reuse the same story across sections");
  }

  return issues;
}

export function validateDailyPublication({
  summaryText,
  pageMarkdown,
  minimumTopItems = 0,
  requireGithubProjectInTop = false,
  requireGithubProjectInMore = false,
}) {
  const issues = [
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
    ...collectDailyStructureIssues(pageMarkdown, {
      minimumTopItems,
      requireGithubProjectInTop,
      requireGithubProjectInMore,
    }),
  ];

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function validateOpportunityPublication({
  markdown,
  bannedPublicPhrases = [],
}) {
  const issues = [
    ...collectMarkdownIssues(markdown, {
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
    }),
    ...collectDominantBrandIssues(markdown, {
      label: "商机页面",
      maxMentions: 10,
    }),
  ];

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function validateAccountOpportunityPublication({
  markdown,
  bannedPublicPhrases = [],
}) {
  const issues = [
    ...collectMarkdownIssues(markdown, {
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
        "今天先挂什么",
        "今天先测什么",
        "售后风险",
      ],
      forbiddenPhrases: bannedPublicPhrases,
    }),
    ...collectDominantBrandIssues(markdown, {
      label: "账号商机页面",
      maxMentions: 12,
    }),
  ];

  return {
    ok: issues.length === 0,
    issues,
  };
}
