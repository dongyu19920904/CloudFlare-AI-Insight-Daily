const COMMON_FAILURE_PATTERNS = [
  /i can't discuss that/i,
  /i cannot discuss that/i,
  /i can't help/i,
  /would you like help/i,
  /set up an api integration/i,
  /请提供完整/i,
  /请补充素材/i,
  /素材不足/i,
  /无法生成/i,
];

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function collectMarkdownIssues(markdown, options = {}) {
  const {
    label = "内容",
    requiredPhrases = [],
    forbiddenPhrases = [],
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

  return issues;
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
      requiredPhrases: ["## **今日摘要**", "## ⚡ 快速导航", "## **今日AI资讯**"],
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
  const issues = collectMarkdownIssues(markdown, {
    label: "商机页面",
    minChars: 320,
    requiredPhrases: [
      "## 今日AI商机",
      "## 今日可卖",
      "## 本周可试",
      "## 今日动作",
      "可直接发布的商品标题",
      "买家现在最在意什么",
      "你实际交付什么",
      "更适合发到哪里",
      "低价引流款",
      "标准成交款",
      "搭售利润款",
      "如果要试，先包装成什么商品",
      "今天就能发的 1 句话术",
    ],
    forbiddenPhrases: bannedPublicPhrases,
  });

  return {
    ok: issues.length === 0,
    issues,
  };
}
