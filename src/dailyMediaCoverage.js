import { extractDailyMarkdownLinks } from "./dailyMarkdownItems.js";
import { isUsableDailyMediaUrl } from "./dailySectionSanitizer.js";
import {
  normalizeMarkdownImageSyntax,
  normalizeMarkdownMediaUrl,
} from "./helpers.js";

const MIN_SOCIAL_MEDIA_BLOCKS_WITH_MEDIA = 2;

function normalizeSourceUrl(url) {
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

function extractMediaUrls(text) {
  const content = String(text || "");
  const urls = [];

  for (const match of content.matchAll(/!\[[^\]]*\]\(\s*(https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\s*\)/g)) {
    urls.push(normalizeMarkdownMediaUrl(match[1]));
  }
  for (const match of content.matchAll(/<(?:img|video)\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/gi)) {
    urls.push(normalizeMarkdownMediaUrl(match[1]));
  }

  return urls.filter(isUsableDailyMediaUrl);
}

function buildCandidateMap(mediaCandidates) {
  const bySource = new Map();

  for (const candidate of mediaCandidates || []) {
    const sourceKey = normalizeSourceUrl(candidate?.url);
    if (!sourceKey) continue;

    const placeholders = (candidate?.placeholders || [])
      .map((placeholder) => normalizeMarkdownImageSyntax(placeholder))
      .filter(
      (placeholder) => extractMediaUrls(placeholder).length > 0,
      );
    if (placeholders.length === 0) continue;

    bySource.set(sourceKey, {
      ...candidate,
      placeholders,
    });
  }

  return bySource;
}

function getSectionHeading(markdown, offset) {
  const prefix = String(markdown || "").slice(0, offset);
  return prefix.match(/^##\s+([^\r\n]+)$/gm)?.at(-1) || "";
}

function getMatchingCandidate(block, candidatesBySource) {
  for (const link of extractDailyMarkdownLinks(block)) {
    const candidate = candidatesBySource.get(normalizeSourceUrl(link.url));
    if (candidate) return candidate;
  }
  return null;
}

function buildMediaCaption(candidate) {
  const caption = String(candidate?.title || "AI 资讯配图")
    .replace(/[\[\]"'\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (caption || "AI 资讯配图").slice(0, 48);
}

function normalizePlaceholderCaption(placeholder, candidate) {
  const content = String(placeholder || "").trim();
  const imageMatch = content.match(/^!\[[^\]]*\]\(\s*(https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\s*\)$/);
  if (!imageMatch) return content;

  const caption = buildMediaCaption(candidate);
  return `![${caption}](${imageMatch[1]} "${caption}")`;
}

function appendMediaToBlock(block, placeholder) {
  const content = String(block || "").trimEnd();
  const separatorMatch = content.match(/\n---\s*$/);
  if (!separatorMatch) return `${content}\n\n${placeholder}\n\n`;

  const body = content.slice(0, separatorMatch.index).trimEnd();
  return `${body}\n\n${placeholder}\n\n---\n\n`;
}

export function countUsableDailyMedia(markdown) {
  return new Set(extractMediaUrls(markdown).map(normalizeSourceUrl)).size;
}

export function repairDailyMediaReferences(markdown, mediaCandidates) {
  const content = String(markdown || "");
  const candidatesBySource = buildCandidateMap(mediaCandidates);
  if (!content || candidatesBySource.size === 0) {
    return { markdown: content, correctedCount: 0, removedCount: 0 };
  }

  const blockPattern = /^###\s+[^\r\n]+(?:\r?\n|$)[\s\S]*?(?=^###\s+|^##\s+|(?![\s\S]))/gm;
  let correctedCount = 0;
  let removedCount = 0;
  const updated = content.replace(blockPattern, (block) => {
    const candidate = getMatchingCandidate(block, candidatesBySource);
    if (!candidate) return block;

    const replacements = candidate.placeholders.map((placeholder) =>
      normalizePlaceholderCaption(placeholder, candidate)
    );
    const allowedUrls = new Set(
      replacements.flatMap(extractMediaUrls).map(normalizeSourceUrl)
    );
    let replacementIndex = 0;

    return block.replace(
      /!\[([^\]]*)\]\(\s*(https?:\/\/[^\s)"']+)(?:\s+(["'][^)\r\n]*["']))?\s*\)/g,
      (imageMarkdown, alt, imageUrl) => {
        const normalizedImageUrl = normalizeSourceUrl(normalizeMarkdownMediaUrl(imageUrl));
        if (allowedUrls.has(normalizedImageUrl)) {
          return normalizeMarkdownImageSyntax(imageMarkdown);
        }

        const replacement = replacements[replacementIndex++] || "";
        if (replacement) {
          correctedCount += 1;
          return replacement;
        }

        removedCount += 1;
        return "";
      }
    );
  });

  return { markdown: updated, correctedCount, removedCount };
}

export function ensureDailyMediaCoverage(markdown, mediaCandidates, maxImages = 6) {
  const content = String(markdown || "");
  const candidatesBySource = buildCandidateMap(mediaCandidates);
  if (!content || candidatesBySource.size === 0) {
    return {
      markdown: content,
      insertedCount: 0,
      targetCount: 0,
      usableMediaCount: countUsableDailyMedia(content),
    };
  }

  const blockPattern = /^###\s+[^\r\n]+(?:\r?\n|$)[\s\S]*?(?=^###\s+|^##\s+|(?![\s\S]))/gm;
  const eligibleSourceKeys = new Set();
  const eligibleSocialSourceKeys = new Set();
  let socialMediaBlockCount = 0;

  for (const match of content.matchAll(blockPattern)) {
    const sectionHeading = getSectionHeading(content, match.index || 0);
    if (/(?:相关问题|FAQ)/i.test(sectionHeading)) continue;
    const candidate = getMatchingCandidate(match[0], candidatesBySource);
    if (!candidate) continue;

    const sourceKey = normalizeSourceUrl(candidate.url);
    eligibleSourceKeys.add(sourceKey);
    if (/社媒精选/.test(sectionHeading)) {
      eligibleSocialSourceKeys.add(sourceKey);
      if (extractMediaUrls(match[0]).length > 0) socialMediaBlockCount += 1;
    }
  }

  const targetCount = Math.min(Math.max(0, Number(maxImages) || 0), eligibleSourceKeys.size);
  const socialTargetCount = Math.min(
    MIN_SOCIAL_MEDIA_BLOCKS_WITH_MEDIA,
    eligibleSocialSourceKeys.size,
  );
  const usedMediaUrls = new Set(extractMediaUrls(content).map(normalizeSourceUrl));
  let usableMediaCount = usedMediaUrls.size;
  let insertedCount = 0;

  if (usableMediaCount >= targetCount && socialMediaBlockCount >= socialTargetCount) {
    return { markdown: content, insertedCount, targetCount, usableMediaCount };
  }

  const updated = content.replace(blockPattern, (block, offset) => {
    const sectionHeading = getSectionHeading(content, offset);
    if (/(?:相关问题|FAQ)/i.test(sectionHeading)) return block;

    const isSocialBlock = /社媒精选/.test(sectionHeading);
    const needsGlobalCoverage = usableMediaCount < targetCount;
    const needsSocialCoverage = isSocialBlock && socialMediaBlockCount < socialTargetCount;
    if (!needsGlobalCoverage && !needsSocialCoverage) return block;
    if (extractMediaUrls(block).length > 0) return block;

    const candidate = getMatchingCandidate(block, candidatesBySource);
    if (!candidate) return block;

    const placeholder = candidate.placeholders.find((item) =>
      extractMediaUrls(item).some((url) => !usedMediaUrls.has(normalizeSourceUrl(url))),
    );
    if (!placeholder) return block;

    for (const url of extractMediaUrls(placeholder)) {
      usedMediaUrls.add(normalizeSourceUrl(url));
    }
    usableMediaCount = usedMediaUrls.size;
    if (isSocialBlock) socialMediaBlockCount += 1;
    insertedCount += 1;
    return appendMediaToBlock(block, normalizePlaceholderCaption(placeholder, candidate));
  });

  return {
    markdown: updated,
    insertedCount,
    targetCount,
    usableMediaCount,
  };
}
