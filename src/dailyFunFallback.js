const DAILY_FUN_HEADING_PATTERN = /^##\s*\*\*.*(?:\uD83D\uDE04|\uD83D\uDE06|AI\s*趣闻|趣闻).*\*\*/im;

function canonicalizeUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(String(url).trim());
    parsed.hash = "";
    return parsed.href;
  } catch {
    return String(url).trim();
  }
}

function normalizeUrlKey(url) {
  if (!url) return "";

  try {
    const parsed = new URL(String(url).trim());
    parsed.hash = "";
    parsed.search = "";
    return `${parsed.hostname.toLowerCase().replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return String(url).trim().toLowerCase().replace(/\/+$/, "");
  }
}

function isNoiseUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return hostname === "aivora.cn" || hostname === "news.aivora.cn";
  } catch {
    return true;
  }
}

function hasDirectAiSignal(text) {
  return (
    /\b(ai|agi|llm|gpt|chatgpt|claude|gemini|openai|anthropic|deepmind|xai|grok|copilot|sora|llama|mistral|deepseek|qwen|kimi|cursor|codex|mcp|rag|agent|agentic)\b/i.test(String(text || "")) ||
    /人工智能|大模型|生成式|智能体|多模态|机器学习|深度学习|神经网络|算力|推理|训练|提示词|开源模型|本地模型|AI原生|AI化|AI产品|AI工具|AI生图|AI芯片|具身智能|机器人|Vibe Coding/i.test(String(text || ""))
  );
}

function hasKnownNonAiFallbackNoise(text) {
  return /跟\s*AI\s*圈关系不大|AI\s*圈关系不大|锻炼|周练计划|健身|身体还是要练|任天堂|nintendo|switch\s*\d?|grapheneos|android\s+vpn|vpn\s+leak/i.test(
    String(text || "")
  );
}

function extractMarkdownUrls(markdown) {
  return [...String(markdown || "").matchAll(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g)]
    .map((match) => canonicalizeUrl(match[1]))
    .filter(Boolean);
}

function extractFunSection(markdown) {
  const content = String(markdown || "");
  const match = content.match(DAILY_FUN_HEADING_PATTERN);
  if (!match || match.index == null) return null;

  const startIndex = match.index;
  const bodyStartIndex = startIndex + match[0].length;
  const remaining = content.slice(bodyStartIndex);
  const nextSectionMatch = remaining.match(/\n##\s+/);
  const endIndex = nextSectionMatch ? bodyStartIndex + nextSectionMatch.index : content.length;

  return {
    heading: match[0],
    startIndex,
    bodyStartIndex,
    endIndex,
    section: content.slice(startIndex, endIndex),
    body: content.slice(bodyStartIndex, endIndex),
  };
}

function funSectionHasSourceItem(markdown) {
  const funSection = extractFunSection(markdown);
  if (!funSection) return true;
  return extractMarkdownUrls(funSection.section).some((url) => !isNoiseUrl(url));
}

function sanitizeMarkdownLinkTitle(title) {
  return String(title || "")
    .replace(/[\[\]\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function sanitizeFallbackSummary(summary) {
  return String(summary || "")
    .replace(/这条(?:小观察|内容|动态|新闻)?[^。！？.!?]{0,24}适合[^。！？.!?]*(?:AI\s*)?趣闻[^。！？.!?]*[。！？.!?]?/gi, "")
    .replace(/(?:适合|可以|用来|值得)[^。！？.!?]{0,24}(?:写成|补成|放在)[^。！？.!?]*(?:AI\s*)?趣闻[^。！？.!?]*[。！？.!?]?/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function parsePromptSourceItem(itemText) {
  const text = String(itemText || "");
  const url = canonicalizeUrl((text.match(/^(?:Url|URL):\s*(https?:\/\/[^\s]+)/im) || [])[1]);
  if (!url || isNoiseUrl(url)) return null;

  const sourceType = text.match(/^Papers Title:/im)
    ? "paper"
    : text.match(/^Project Name:/im)
      ? "project"
      : text.match(/^socialMedia Post/im)
        ? "socialMedia"
        : text.match(/^News Title:/im)
          ? "news"
          : "unknown";

  const title =
    (text.match(/^News Title:\s*(.+)$/im) || [])[1] ||
    (text.match(/^Project Name:\s*(.+)$/im) || [])[1] ||
    (text.match(/^Papers Title:\s*(.+)$/im) || [])[1] ||
    (text.match(/^Title:\s*(.+)$/im) || [])[1] ||
    (text.match(/^Content:\s*(.+)$/im) || [])[1] ||
    "";

  const cleanTitle = sanitizeMarkdownLinkTitle(title);
  if (!cleanTitle) return null;

  const summary =
    (text.match(/^(?:Content Summary|Abstract\/Content Summary|Description|Content):\s*(.+)$/im) || [])[1] ||
    "";

  return {
    title: cleanTitle,
    url,
    sourceText: text,
    sourceType,
    summary: sanitizeFallbackSummary(summary),
  };
}

function scoreFallbackFunCandidate(candidate) {
  const text = `${candidate.title}\n${candidate.summary}\n${candidate.url}\n${candidate.sourceText}`;
  let score = 0;

  if (candidate.sourceType === "socialMedia") score += 36;
  if (candidate.sourceType === "news") score += 32;
  if (candidate.sourceType === "project") score += 18;
  if (candidate.sourceType === "paper") score -= 24;
  if (hasDirectAiSignal(candidate.title)) score += 12;
  if (hasDirectAiSignal(text)) score += 8;
  if (/用户|开发者|网友|团队|作者|朋友|同事|打工人|产品经理|设计师|创始人|发布|上线|演示|体验|浏览器|微信|飞书|Kimi|Codex|Cursor|Claude|ChatGPT|Agent/i.test(text)) {
    score += 20;
  }
  if (/图片|截图|视频|动图|Media References|x\.com|twitter\.com|okjike\.com|jike|即刻/i.test(text)) {
    score += 10;
  }
  if (/Abstract\/Content Summary|zero-shot|framework|benchmark|dataset|causal|stereo|segmentation|arxiv\.org/i.test(text)) {
    score -= 12;
  }

  return score;
}

function buildFallbackFunItem(candidate) {
  const title = hasDirectAiSignal(candidate.title)
    ? candidate.title
    : sanitizeMarkdownLinkTitle(`AI小观察：${candidate.title}`);
  const summaryPrefix = candidate.summary ? `${candidate.summary} ` : "";
  const observation =
    candidate.sourceType === "paper"
      ? "它听起来离普通用户很远，但背后对应的是 AI 看世界、理解空间或执行任务时少一点犯迷糊。AI 的进步有时不热闹，就藏在这种底层小补丁里。"
      : "有意思的不是它声量多大，而是 AI 又往具体动作里钻了一点：少切一个窗口、少写一段重复流程，或者少等一次人工处理。工具真正变成日用品时，通常就是先从这种小省事开始的。";

  return [
    `### [${title}](${candidate.url})`,
    "",
    `${summaryPrefix}${observation}`,
  ].join("\n");
}

export function ensureDailyFunSectionHasSourceItem(markdown, selectedContentItems = []) {
  const content = String(markdown || "");
  const funSection = extractFunSection(content);
  if (!funSection || funSectionHasSourceItem(content)) {
    return { markdown: content, inserted: false };
  }

  const usedUrlKeys = new Set(
    extractMarkdownUrls(content)
      .filter((url) => !isNoiseUrl(url))
      .map((url) => normalizeUrlKey(url))
      .filter(Boolean),
  );

  const candidates = (selectedContentItems || [])
    .map((itemText) => parsePromptSourceItem(itemText))
    .filter((item) => {
      if (!item) return false;
      const relevanceText = `${item.title}\n${item.url}\n${item.sourceText}`;
      return !hasKnownNonAiFallbackNoise(relevanceText);
    });

  const unusedCandidates = candidates.filter((item) => !usedUrlKeys.has(normalizeUrlKey(item.url)));
  const candidate = [...unusedCandidates].sort(
    (left, right) => scoreFallbackFunCandidate(right) - scoreFallbackFunCandidate(left)
  )[0];

  if (!candidate) return { markdown: content, inserted: false };

  const fallbackItem = buildFallbackFunItem(candidate);
  const existingBody = funSection.body.trim();
  const nextSection = content.slice(funSection.endIndex);
  const replacementBody = `${existingBody ? `${existingBody}\n\n` : "\n\n"}${fallbackItem}\n`;
  const updated =
    content.slice(0, funSection.bodyStartIndex) +
    replacementBody +
    nextSection;

  return { markdown: updated, inserted: true };
}
