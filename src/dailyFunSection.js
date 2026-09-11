import { extractDailyMarkdownLinks } from "./dailyMarkdownItems.js";

function normalizeCandidateText(item) {
  return String(item || "").trim();
}

function normalizeCandidateUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(String(url).trim());
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    if (parsed.hostname === "twitter.com") parsed.hostname = "x.com";
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return parsed.href.toLowerCase();
  } catch {
    return String(url).trim().toLowerCase().replace(/\/+$/, "");
  }
}

function getCandidateUrl(item) {
  return String(item || "").match(/^(?:Url|URL):\s*(https?:\/\/\S+)/im)?.[1]?.trim() || "";
}

export function isDailyFunSolicitation(value) {
  const text = String(value || "")
    .replace(/!\[[^\]]*\]\([^\n]*?\)/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`]/g, "");
  const benefit = /额度|积分|邀请码|邀请名额|优惠券|代金券|\bcredits?\b/i.test(text);
  const offer = /邀请|领取|兑换|发放|送出|赠送|领完|\binvit(?:e|ation)\b|\bclaim\b/i.test(text);
  const contact = /(?:留(?:下)?|提供|提交|发我|私信|评论|发送|回复)[^。！？\n]{0,20}(?:邮箱|邮件|email|邀请码)|(?:邮箱|email)[^。！？\n]{0,12}(?:私信|发我)|先到先得|送完即止/i.test(text);
  return benefit && offer && contact;
}

function funVisibleText(value) {
  return String(value || "")
    .replace(/!\[[^\]]*\]\([^\n]*?\)/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`]/g, "");
}

export function hasDailyFunStorySignal(value) {
  const text = funVisibleText(value);
  return /写|生成|回复|拒绝|调用|修改|删除|执行|提交|报错|下单|点击/.test(text) &&
    /却|反而|结果|没想到|竟然|本来|居然/.test(text);
}

export function isDailyFunPreferenceOnly(value) {
  const text = funVisibleText(value);
  return /偏好|最爱|更喜欢|推荐榜|工具推荐|最好用|常用工具/.test(text) &&
    /工具|模型|搜索|DeepResearch|GPT|Gemini|Claude|Codex|Cursor/i.test(text) &&
    !hasDailyFunStorySignal(text);
}

export function removeSolicitationDailyFun(markdown) {
  let removedCount = 0;
  const output = String(markdown || "").replace(
    /^##\s*\*{0,2}[^\r\n]*AI\s*趣闻[^\r\n]*(?:\r?\n|$)[\s\S]*?(?=^##\s+|(?![\s\S]))/gim,
    (section) => {
      if (!isDailyFunSolicitation(section) && !isDailyFunPreferenceOnly(section)) return section;
      removedCount += 1;
      return "";
    },
  );
  return { markdown: output, removedCount };
}

export function selectStandaloneDailyFunCandidates(
  publishedDailyMarkdown = "",
  dailyFunContentItems = [],
  limit = 5,
) {
  const publishedSourceUrls = new Set(
    extractDailyMarkdownLinks(publishedDailyMarkdown)
      .map((link) => normalizeCandidateUrl(link.url))
      .filter(Boolean),
  );
  const seen = new Set();
  const candidates = [];

  for (const item of dailyFunContentItems || []) {
    const normalized = normalizeCandidateText(item);
    const candidateUrl = normalizeCandidateUrl(getCandidateUrl(normalized));
    if (
      !normalized ||
      isDailyFunSolicitation(normalized) ||
      isDailyFunPreferenceOnly(normalized) ||
      seen.has(normalized) ||
      (candidateUrl && publishedSourceUrls.has(candidateUrl))
    ) continue;

    seen.add(normalized);
    candidates.push(normalized);
    if (candidates.length >= limit) break;
  }

  return candidates;
}

export function buildStandaloneDailyFunPromptInput(dateStr, candidateItems = []) {
  const candidates = (candidateItems || []).map(normalizeCandidateText)
    .filter((item) => item && !isDailyFunSolicitation(item) && !isDailyFunPreferenceOnly(item));
  if (candidates.length === 0) return "";

  return [
    `你只负责为 ${dateStr} 的 AI日报生成一个栏目：\`## **😄 AI趣闻**\`。`,
    "这是一次独立生成，不要输出日报其它栏目，不要输出解释。",
    "从下面候选里最多选 1 条有真实反常结果的素材。标题要二次创作并使用纯文本，不能照搬来源标题，也不能加入链接；原始来源链接必须放在正文的真实细节附近。",
    "链接文字必须是句子里自然成立的事实短语，说明这个原帖具体展示了什么；不要只写‘实测推文’‘原帖’‘来源’或‘详情’。",
    "正文写 100-180 个中文字符，按 Hook -> What -> Punchline 写：先给具体场景，再交代真实细节，最后一句轻轻一抖。",
    "正文用 `**...**` 标出 2-4 个产品名、真实动作、关键数字或反常结果；每处 2-12 个字符，不能整句加粗。",
    "语境要像 2026 年中文互联网，面向 90 后、00 后 AI 爱好者和程序员；可以借鉴马三立相声的铺垫、错位和冷面包袱结构，但不要模仿口音、台词或固定段子。",
    "不要编造来源没有的事实，不要写成行业分析，不要写“这说明了”“值得关注”“未来可期”。来源作者的体验用有归属的第三人称，不冒充编辑亲测；只有工具偏好而没有具体动作和反常结果时不要选用。产品、人物身份、研究进展不得改写成另一对象或未经确认的最终成果。",
    "先确认素材里确实有预期与结果的反差，再写铺垫。额度邀请、留邮箱领名额、优惠招领或只有功能介绍的帖子不是趣闻；有截图也不算笑点。收尾点出素材已有的错位，不补写评论区热度、领完速度或旁观者反应。",
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

  if (!section || isDailyFunSolicitation(section) || isDailyFunPreferenceOnly(section)) return "";

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
