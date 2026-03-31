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
  /AI思考[:：]?/i,
  /我看了一下(今天|这批)?素材/,
  /(按照|根据).{0,12}(日期过滤规则|容错机制|评分系统)/,
  /素材(质量)?参差不齐/,
  /我会按照.{0,12}筛选/,
];

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
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

function extractSection(markdown, heading) {
  const source = String(markdown || "");
  const start = source.indexOf(heading);
  if (start < 0) return "";

  const rest = source.slice(start + heading.length);
  const nextSectionIndex = rest.search(/\n##\s+/);
  return nextSectionIndex >= 0 ? rest.slice(0, nextSectionIndex) : rest;
}

function countDailyTopItems(markdown) {
  const section = extractSection(markdown, "## **🔥 重磅 TOP");
  return (section.match(/^###\s+\d+\./gm) || []).length;
}

function countWorthWatchingItems(markdown) {
  const section = extractSection(markdown, "## **📌 值得关注**");
  return (section.match(/^- /gm) || []).length;
}

function countPredictionItems(markdown) {
  const section = extractSection(markdown, "## **🔮 AI趋势预测**");
  return (section.match(/^###\s+/gm) || []).length;
}

export function validateDailyPublication({ summaryText, pageMarkdown }) {
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
        "## **📌 值得关注**",
        "## **🔮 AI趋势预测**",
        "## **❓ 相关问题**",
        "aivora.cn",
      ],
      forbiddenPatterns: DAILY_META_PATTERNS,
    }),
  ];

  const topItemCount = countDailyTopItems(pageMarkdown);
  if (topItemCount > 0 && topItemCount < 8) {
    issues.push(`鏃ユ姤TOP条数不足: ${topItemCount}`);
  }

  const worthWatchingCount = countWorthWatchingItems(pageMarkdown);
  if (worthWatchingCount > 0 && worthWatchingCount < 2) {
    issues.push(`鏃ユ姤“值得关注”条数不足: ${worthWatchingCount}`);
  }

  const predictionCount = countPredictionItems(pageMarkdown);
  if (predictionCount > 0 && predictionCount < 2) {
    issues.push(`鏃ユ姤“AI趋势预测”条数不足: ${predictionCount}`);
  }

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
