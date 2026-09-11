import { extractDailyMarkdownLinks } from "./dailyMarkdownItems.js";

const GENERIC_TOKENS = new Set([
  "agent", "agents", "api", "artificial", "code", "coding", "data", "deep",
  "flash", "free", "github", "intelligence", "language", "large", "learning",
  "lite", "llm", "max", "mini", "model", "models", "news", "open", "preview",
  "pro", "release", "research", "source", "system", "test", "the", "tool",
  "tools", "video", "with",
]);

function sourceKey(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^(www|mobile|m)\./, "");
    if (url.hostname === "twitter.com") url.hostname = "x.com";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.href;
  } catch {
    return "";
  }
}

function visibleText(value) {
  return String(value || "")
    .replace(/!\[[^\]]*\]\([^\n]*?\)/g, "")
    .replace(/\[([^\]]+)\]\([^\n]*?\)/g, "$1")
    .replace(/https?:\/\/[^\s<>]+/g, "")
    .replace(/<[^>]+>/g, "")
    .normalize("NFKC");
}

function tokens(value) {
  return new Set((visibleText(value).toLowerCase().match(/[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*/g) || []));
}

function specificTokens(value) {
  return [...tokens(value)].filter((token) => !GENERIC_TOKENS.has(token) &&
    (/^[a-z]{4,}$/.test(token) || /^[a-z]+\d[\w.-]*$/.test(token)));
}

function subscriptionProductFamilies(value) {
  const text = visibleText(value);
  return [
    /\b(?:codex|chatgpt)\b/i.test(text) ? "openai-subscription" : null,
    /\bcursor\b/i.test(text) ? "cursor" : null,
  ].filter(Boolean);
}

// Only reject a positively identified product substitution, not a missing keyword.
// Keep comparisons, integrations, ambiguous sources and unknown products intact.
function findExplicitProductConflict(title, block, records) {
  const headlineFamilies = subscriptionProductFamilies(title);
  if (headlineFamilies.length !== 1) return null;
  const family = headlineFamilies[0];
  if (subscriptionProductFamilies(block).some((value) => value !== family)) return null;
  for (const link of extractDailyMarkdownLinks(block)) {
    const linked = records.filter((record) => record.key === sourceKey(link.url));
    if (!linked.length || linked.some((record) => record.productFamilies.includes(family))) continue;
    if (!linked.every((record) => record.titleFamilies.length === 1 && record.titleFamilies[0] !== family)) continue;
    return { title, sourceUrl: link.url, matchingSourceUrls: [], reason: "explicit-product-substitution" };
  }
  return null;
}

function isSocialRelayUrl(value) {
  try {
    return /^(?:www\.)?(?:t\.me|telegram\.me|x\.com|twitter\.com|v2ex\.com|mp\.weixin\.qq\.com|m\.okjike\.com)$/.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

function sanitizeUnsupportedClaims(block) {
  const changes = [];
  let input = block;
  const heading = block.split(/\r?\n/, 1)[0];
  const body = visibleText(block.slice(heading.length));
  if (/(?:成本|费用|价格).*低一半/.test(heading) && /每美元性能[^。\n]{0,24}50[%％]/.test(body)) {
    // Neutralize the unsupported cost headline; do not calculate a new percentage.
    const corrected = heading.replace(/(?:推理)?(?:成本|费用|价格)比?/, '每美元性能对比').replace(/低一半/, '').trimEnd();
    input = corrected + block.slice(heading.length);
    changes.push('cost-performance-headline');
  }
  // Remove actionable quota bypass instructions, but keep warnings against them.
  let markdown = input.replace(/[^。！？\n]*(?:清\s*Cookie|换浏览器)[^。！？\n]*(?:[。！？]|$)/gi, (sentence) => {
    if (!/(?:免费|额度|更多|继续|绕过)/.test(sentence) || /(?:不要|不得|不能|禁止|不应|请勿)/.test(sentence)) return sentence;
    if (/!\[|<video|```/.test(sentence)) return sentence;
    changes.push('quota-bypass-instruction');
    return extractDailyMarkdownLinks(sentence).map((link) => `[来源中的使用说明](${link.url})。`).join('');
  });
  const links = extractDailyMarkdownLinks(markdown);
  const title = visibleText(markdown.split(/\r?\n/, 1)[0]);
  if (/(?:收购|并购|融资)/.test(title) && links.length > 0 && links.every((link) => isSocialRelayUrl(link.url))) {
    const beforeDealCleanup = markdown;
    const amount = '(?:\\*\\*)?(?:\\d+(?:[.,]\\d+)*|[零〇一二两三四五六七八九十百千万亿]+)\\s*(?:万|亿|百万|千万)?\\s*(?:美元|美金|人民币|欧元)(?:\\*\\*)?';
    // Keep destinations and media untouched; only remove unsupported display claims.
    const parts = markdown.split(/(!?\[[^\]]*\]\([^\n]*?\)|<video[^\n]*<\/video>)/g);
    const cleanText = (text) => text
      .replace(new RegExp('(?:交易价(?:格)?|交易金额|收购价(?:格)?|融资金额|估值)(?:为|达|约|高达|：|:)?\\s*' + amount + '[，。]?', 'g'), '')
      .replace(new RegExp('以\\s*' + amount, 'g'), '')
      .replace(new RegExp(amount, 'g'), '');
    markdown = parts.map((part) => {
      if (/^!\[|^<video/.test(part)) return part;
      if (part.startsWith('[')) return part.replace(/^\[([^\]]*)\]/, (_, text) => `[${cleanText(text)}]`);
      return cleanText(part);
    }).join('');
    if (markdown !== beforeDealCleanup) changes.push('social-only-deal-amount');
  }
  return { markdown, changes };
}

// A negative lexical match alone is not evidence of a wrong source. Require a
// competing selected record AND an unrelated named entity in the linked source.
function findConflict(block, records) {
  const title = block.split(/\r?\n/, 1)[0].replace(/^###\s+(?:\d+[.、]\s*)?/, "");
  const productConflict = findExplicitProductConflict(title, block, records);
  if (productConflict) return productConflict;
  const markers = specificTokens(title);
  if (markers.length < 2 || !markers.some((token) => /^[a-z]{4,}$/.test(token))) return null;
  const bodyTokens = tokens(block);
  const eventMarkers = [...new Set([...markers, ...[...bodyTokens].filter((token) => /^[a-z]+\d[\w.-]*$/.test(token))])];

  for (const link of extractDailyMarkdownLinks(block)) {
    const key = sourceKey(link.url);
    const linked = records.filter((record) => record.key === key);
    if (!linked.length || linked.some((record) => markers.some((token) => record.tokens.has(token)))) continue;
    const otherSources = records.filter((record) => record.key !== key &&
      markers.some((token) => record.tokens.has(token)) &&
      eventMarkers.filter((token) => record.tokens.has(token)).length >= 2);
    if (!otherSources.length) continue;
    if (!linked.every((record) => record.entities.some((token) => !bodyTokens.has(token)))) continue;
    return { title, sourceUrl: link.url, matchingSourceUrls: [...new Set(otherSources.map((record) => record.url))] };
  }
  return null;
}

export function quarantineDailySourceConflicts(markdown, candidates = []) {
  const quarantined = [];
  const sanitized = [];
  const records = (candidates || []).filter((candidate) => sourceKey(candidate?.url)).map((candidate) => ({
    url: candidate.url,
    key: sourceKey(candidate.url),
    tokens: tokens([candidate.title, candidate.description, candidate.plainText].filter(Boolean).join(" ")),
    entities: specificTokens(candidate.title).filter((token) => /^[a-z]{4,}$/.test(token)),
    titleFamilies: subscriptionProductFamilies(candidate.title),
    productFamilies: subscriptionProductFamilies([candidate.title, candidate.description, candidate.plainText].filter(Boolean).join(" ")),
  }));
  const output = String(markdown || "").split(/(?=^##(?!#)\s+)/m).map((section) => {
    if (/^##[^\r\n]*(?:FAQ|相关问题|常见问题)/i.test(section)) return section;
    const beforeCount = quarantined.length;
    let cleaned = section.replace(/^###\s+[^\r\n]+(?:\r?\n|$)[\s\S]*?(?=^###\s+|(?![\s\S]))/gm, (block) => {
      if (/```|~~~/.test(block)) return block;
      const conflict = findConflict(block, records);
      if (!conflict) {
        const result = sanitizeUnsupportedClaims(block);
        if (result.changes.length) sanitized.push({ title: block.split(/\r?\n/, 1)[0], changes: result.changes });
        return result.markdown;
      }
      quarantined.push(conflict);
      return "";
    });
    if (quarantined.length > beforeCount && /^##[^\r\n]*今日焦点[^\r\n]*TOP/i.test(section)) {
      let count = 0;
      cleaned = cleaned.replace(/^###\s+\d+[.、]\s*/gm, () => `### ${++count}. `);
      cleaned = cleaned.replace(/^(##[^\r\n]*?\bTOP)\s*\d+/i, `$1 ${count}`);
    }
    return cleaned;
  }).join("");
  return { markdown: output, quarantined, removedCount: quarantined.length, sanitized };
}
