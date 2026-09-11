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
      if (!conflict) return block;
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
  return { markdown: output, quarantined, removedCount: quarantined.length };
}
