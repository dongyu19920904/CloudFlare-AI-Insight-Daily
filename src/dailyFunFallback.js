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

function parsePromptSourceItem(itemText) {
  const text = String(itemText || "");
  const url = canonicalizeUrl((text.match(/^(?:Url|URL):\s*(https?:\/\/[^\s]+)/im) || [])[1]);
  if (!url || isNoiseUrl(url)) return null;

  const title =
    (text.match(/^News Title:\s*(.+)$/im) || [])[1] ||
    (text.match(/^Project Name:\s*(.+)$/im) || [])[1] ||
    (text.match(/^Papers Title:\s*(.+)$/im) || [])[1] ||
    (text.match(/^Title:\s*(.+)$/im) || [])[1] ||
    (text.match(/^Content:\s*(.+)$/im) || [])[1] ||
    "";

  const cleanTitle = sanitizeMarkdownLinkTitle(title);
  if (!cleanTitle) return null;

  return { title: cleanTitle, url, sourceText: text };
}

function buildFallbackFunItem(candidate) {
  return [
    `### [${candidate.title}](${candidate.url})`,
    "",
    "这条小观察适合放在 AI趣闻里：它未必是今天最大的发布，却把 AI 变化落到了普通人的使用习惯里。真正有意思的不是热闹本身，而是新工具扩散时，常常先表现为一个小动作、一种省事方式，或者一次工作流里的偷懒成功。",
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
  const candidate =
    unusedCandidates.find((item) => hasDirectAiSignal(`${item.title}\n${item.url}\n${item.sourceText}`)) ||
    unusedCandidates[0];

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
