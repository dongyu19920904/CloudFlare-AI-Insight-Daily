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
  const watchHeadingPattern = /^##\s*\*\*.*关注.*\*\*/im;
  const funHeadingPattern = /^##\s*\*\*.*AI.*趣闻.*\*\*/im;
  const topSection = extractSection(pageMarkdown, /^##\s*\*\*.*TOP.*\*\*/im);

  if (!faqHeadingPattern.test(String(pageMarkdown || ""))) {
    issues.push("日报页面缺少必需片段: ## **❓ 相关问题**");
  }

  if (!watchHeadingPattern.test(String(pageMarkdown || ""))) {
    issues.push("日报页面缺少必需片段: ## **📌 值得关注**");
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

  const watchSection = extractSection(pageMarkdown, watchHeadingPattern);
  const funSection = extractSection(pageMarkdown, funHeadingPattern);
  const duplicateUrls = collectDuplicateUrlsBySection({
    top: extractSectionUrls(topSection),
    watch: extractSectionUrls(watchSection),
    fun: extractSectionUrls(funSection),
  });

  if (duplicateUrls.length > 0) {
    issues.push("Daily sections reuse the same source URL");
  }

  const duplicateTopics = collectDuplicateTopicsBySection({
    top: extractSectionLinks(topSection),
    watch: extractSectionLinks(watchSection),
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
    ...collectDailyStructureIssues(pageMarkdown, { minimumTopItems }),
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
      "今天先挂什么",
      "今天先测什么",
      "售后风险",
    ],
    forbiddenPhrases: bannedPublicPhrases,
  });

  return {
    ok: issues.length === 0,
    issues,
  };
}
