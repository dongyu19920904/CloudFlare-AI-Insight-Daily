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
  return /写|生成|回复|拒绝|调用|修改|删除|执行|提交|报错|下单|点击|\b(?:write|wrote|generate[ds]?|replied|refused|deleted|executed|ordered|clicked)\b/i.test(text) &&
    /却|反而|结果|没想到|竟然|本来|居然|\b(?:instead|unexpectedly|but|surprisingly)\b/i.test(text);
}

export function getDailyFunWritingRules() {
  return [
    "AI趣闻是必写栏目，每期写 1 条完整趣闻，不能因为原文没有‘结果、反而’等词就省略。先从未使用的真实素材选出最值得会心一笑的一件事。",
    "优先真实反常结果，也可以选有具体细节的开发过程、工具体验或产品设计，用准确的生活化比喻和一句轻巧评论写出趣味；普通偏好榜不能照搬成稿，要围绕已提供的具体区别组织铺垫。",
    "正文 100-160 字，使用 5-7 个完整短句。先点出场景，再写至少两个来源支持的细节，最后一句收住包袱。笑点来自表达和真实细节，不靠‘笑死、离谱’、空泛行业结论或泛泛俏皮结尾。",
    "比喻、设问和评论必须一眼看出是编辑表达，不能伪装成发生过的事故、快捷键冲突、对话、用户反应或亲测。不能把预想的风险写成已有用户遭遇；不编造笑点事实，也不冒充来源作者。",
    "不要为制造反差补充素材以外的技术背景、其他系统或竞品行为。例如原帖只说 Windows 和 Alt + Space，就只能围绕桌面唤起这个动作写趣味，不能自行引入 Linux、Spotlight、快捷键被占或危险之类的情节。包袱是对已知细节的轻巧比喻，不是一条新增新闻。",
    "标题二次创作、不加链接；正文用一个原始链接自然挂在具体事实上。不要输出通用兜底段子、空标题或生成过程。",
  ].join("\n");
}

export function removeSolicitationDailyFun(markdown) {
  let removedCount = 0;
  const output = String(markdown || "").replace(
    /^##\s*\*{0,2}[^\r\n]*AI\s*趣闻[^\r\n]*(?:\r?\n|$)[\s\S]*?(?=^##\s+|(?![\s\S]))/gim,
    (section) => {
      if (!isDailyFunSolicitation(section)) return section;
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
    .filter((item) => item && !isDailyFunSolicitation(item));
  if (candidates.length === 0) return "";

  return [
    `你只负责为 ${dateStr} 的 AI日报生成一个栏目：\`## **😄 AI趣闻**\`。`,
    "这是一次独立生成，不要输出日报其它栏目，不要输出解释。",
    "从下面候选里选 1 条真实素材。标题要二次创作并使用纯文本，不能照搬来源标题，也不能加入链接；原始来源链接必须放在正文的真实细节附近。",
    "链接文字必须是句子里自然成立的事实短语，说明这个原帖具体展示了什么；不要只写‘实测推文’‘原帖’‘来源’或‘详情’。",
    "按 Hook -> What -> Punchline 写：先给具体场景，再交代真实细节，最后一句轻轻一抖。",
    "正文用 `**...**` 标出 2-4 个产品名、真实动作、关键数字或反常结果；每处 2-12 个字符，不能整句加粗。",
    "语境要像 2026 年中文互联网，面向 90 后、00 后 AI 爱好者和程序员；可以借鉴马三立相声的铺垫、错位和冷面包袱结构，但不要模仿口音、台词或固定段子。",
    "不要编造来源没有的事实，不要写成行业分析，不要写“这说明了”“值得关注”“未来可期”。来源作者的体验用有归属的第三人称，不冒充编辑亲测。产品、人物身份、研究进展不得改写成另一对象或未经确认的最终成果。",
    "额度邀请、留邮箱领名额、优惠招领不是趣闻；有截图也不算笑点。不补写评论区热度、领完速度或旁观者反应。",
    getDailyFunWritingRules(),
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

  if (!section || isDailyFunSolicitation(section)) return "";

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
