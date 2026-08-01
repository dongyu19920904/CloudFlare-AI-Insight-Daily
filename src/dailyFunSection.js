function normalizeCandidateText(item) {
  return String(item || "").trim();
}

export function selectStandaloneDailyFunCandidates(
  selectedContentItems = [],
  dailyFunContentItems = [],
  limit = 5,
) {
  const selectedKeys = new Set(
    (selectedContentItems || [])
      .map(normalizeCandidateText)
      .filter(Boolean),
  );
  const seen = new Set();
  const candidates = [];

  for (const item of dailyFunContentItems || []) {
    const normalized = normalizeCandidateText(item);
    if (!normalized || selectedKeys.has(normalized) || seen.has(normalized)) continue;

    seen.add(normalized);
    candidates.push(normalized);
    if (candidates.length >= limit) break;
  }

  return candidates;
}

export function buildStandaloneDailyFunPromptInput(dateStr, candidateItems = []) {
  const candidates = (candidateItems || []).map(normalizeCandidateText).filter(Boolean);
  if (candidates.length === 0) return "";

  return [
    `你只负责为 ${dateStr} 的 AI日报生成一个栏目：\`## **😄 AI趣闻**\`。`,
    "这是一次独立生成，不要输出日报其它栏目，不要输出解释。",
    "必须从下面候选里选 1 条。标题要二次创作并使用纯文本，不能照搬来源标题，也不能加入链接；原始来源链接必须放在正文的真实细节附近。",
    "正文写 100-180 个中文字符，按 Hook -> What -> Punchline 写：先给具体场景，再交代真实细节，最后一句轻轻一抖。",
    "正文用 `**...**` 标出 2-4 个产品名、真实动作、关键数字或反常结果；每处 2-12 个字符，不能整句加粗。",
    "语境要像 2026 年中文互联网，面向 90 后、00 后 AI 爱好者和程序员；可以借鉴马三立相声的铺垫、错位和冷面包袱结构，但不要模仿口音、台词或固定段子。",
    "不要编造来源没有的事实，不要写成行业分析，不要写“这说明了”“值得关注”“未来可期”。",
    "如果所有候选都写不出完整、有来源链接的趣闻，就输出空字符串，不要解释。",
    "",
    "输出格式必须是：",
    "## **😄 AI趣闻**",
    "",
    "### 二次创作短标题",
    "正文中用 [能说明来源内容的核心短句](原始URL) 自然承接真实细节...",
    "",
    "候选素材：",
    candidates
      .map((item, index) => [`候选 ${index + 1}:`, item].join("\n"))
      .join("\n\n------\n\n"),
  ].join("\n");
}

export function normalizeStandaloneDailyFunSection(markdown) {
  const content = String(markdown || "").trim();
  if (!content) return "";

  const sectionMatch = content.match(
    /^##\s*\*\*.*(?:😄|😆|AI\s*趣闻|趣闻).*\*\*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im,
  );
  let section = sectionMatch?.[0]?.trim() || "";

  if (!section && /^###\s+[^\r\n]+/im.test(content)) {
    section = `## **😄 AI趣闻**\n\n${content}`;
  }

  if (!section) return "";

  const sourceLinks = [...section.matchAll(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g)]
    .filter((match) => match.index == null || section[match.index - 1] !== "!");
  if (sourceLinks.length === 0) return "";

  return section.replace(/\n{3,}/g, "\n\n").trim();
}

export function insertDailyFunSection(markdown, funSection) {
  const content = String(markdown || "").trimEnd();
  const section = normalizeStandaloneDailyFunSection(funSection);
  if (!content || !section) return content;

  if (/^##\s*\*\*.*(?:😄|😆|AI\s*趣闻|趣闻).*\*\*/im.test(content)) {
    return content;
  }

  const insertBeforePatterns = [
    /\n##\s*\*\*.*(?:🔮|AI\s*趋势预测|趋势预测).*\*\*/im,
    /\n##\s*\*\*.*(?:❓|相关问题).*\*\*/im,
    /\n##\s+.*(?:相关问题).*/im,
  ];

  for (const pattern of insertBeforePatterns) {
    const match = content.match(pattern);
    if (match && match.index != null) {
      return [
        content.slice(0, match.index).trimEnd(),
        "",
        section,
        "",
        content.slice(match.index).trimStart(),
      ].join("\n");
    }
  }

  return `${content}\n\n${section}`;
}
