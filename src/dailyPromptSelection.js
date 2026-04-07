import { hasMedia, stripHtml } from "./helpers.js";

function extractMediaPlaceholdersFromHtml(html, limit = 3) {
  if (!html) return [];

  const placeholders = [];
  const seen = new Set();
  const str = String(html);

  const addPlaceholder = (placeholder) => {
    if (!placeholder || seen.has(placeholder)) return;
    seen.add(placeholder);
    placeholders.push(placeholder);
  };

  for (const match of str.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi)) {
    const src = match[1]?.trim();
    const alt = match[2]?.trim();
    if (src) addPlaceholder(`![${alt || "image"}](${src})`);
    if (placeholders.length >= limit) return placeholders;
  }

  for (const match of str.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*>/gi)) {
    const src = match[1]?.trim();
    if (src) addPlaceholder(`![image](${src})`);
    if (placeholders.length >= limit) return placeholders;
  }

  for (const match of str.matchAll(/<video\b[^>]*src="([^"]+)"[^>]*>/gi)) {
    const src = match[1]?.trim();
    if (src) {
      addPlaceholder(
        `<video controls preload="metadata" playsinline style="max-width:100%; height:auto;" src="${src}"></video>`
      );
    }
    if (placeholders.length >= limit) return placeholders;
  }

  return placeholders;
}

function truncatePromptText(text, maxChars = 500) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}…`;
}

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeReplayUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(String(url).trim());
    let hostname = parsed.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    if (hostname === "twitter.com") hostname = "x.com";
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${hostname}${pathname}`.toLowerCase();
  } catch {
    return String(url).trim().toLowerCase().replace(/\/+$/, "");
  }
}

function normalizeReplayTitle(title) {
  return String(title || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_+=[\]{};:'",.<>/?\\|，。！？、；：“”‘’（）【】《》·—…-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getReplayTitleTokens(title) {
  const normalized = String(title || "").normalize("NFKC").toLowerCase();
  const tokens = new Set();

  for (const match of normalized.match(/[a-z0-9][a-z0-9.+_-]{1,}/g) || []) {
    if (match.length >= 2) tokens.add(match);
  }

  const cjkOnly = normalized.replace(/[^\u4e00-\u9fff]/g, "");
  for (let index = 0; index <= cjkOnly.length - 3; index += 1) {
    tokens.add(cjkOnly.slice(index, index + 3));
  }

  return tokens;
}

function isSimilarReplayTitle(currentTitle, previousTitle) {
  const normalizedCurrent = normalizeReplayTitle(currentTitle);
  const normalizedPrevious = normalizeReplayTitle(previousTitle);

  if (!normalizedCurrent || !normalizedPrevious) return false;
  if (normalizedCurrent === normalizedPrevious) return true;

  if (
    normalizedCurrent.length >= 12 &&
    normalizedPrevious.length >= 12 &&
    (normalizedCurrent.includes(normalizedPrevious) || normalizedPrevious.includes(normalizedCurrent))
  ) {
    return true;
  }

  const currentTokens = getReplayTitleTokens(currentTitle);
  const previousTokens = getReplayTitleTokens(previousTitle);
  if (currentTokens.size === 0 || previousTokens.size === 0) return false;

  const overlap = [...currentTokens].filter((token) => previousTokens.has(token));
  const strongOverlap = overlap.filter((token) => (/[a-z]/.test(token) ? token.length >= 4 : token.length >= 3));
  const minTokenCount = Math.min(currentTokens.size, previousTokens.size);

  return strongOverlap.length >= 2 || (overlap.length >= 3 && overlap.length / minTokenCount >= 0.6);
}

function extractMatchTokens(item) {
  const text = [
    item?.title || "",
    item?.description || "",
    item?.source || "",
    item?.plainText || "",
  ].join(" ");
  const tokens = new Set();

  for (const match of text.match(/[A-Za-z][A-Za-z0-9.+_-]{2,}/g) || []) {
    tokens.add(match.toLowerCase());
  }

  const curated = [
    "openai", "karpathy", "metanovas", "workbuddy", "agenthub",
    "autoclaw", "openclaw", "kimi", "skillhub", "songgeneration",
    "jeff", "dean", "yann", "lecun", "tencent", "zhipu", "netease",
  ];

  const lowerText = text.toLowerCase();
  for (const token of curated) {
    if (lowerText.includes(token)) {
      tokens.add(token);
    }
  }

  return [...tokens];
}

function buildDailyPromptCandidate(item) {
  if (!item || typeof item !== "object") return null;

  const itemHasMedia = item.details?.content_html && hasMedia(item.details.content_html);
  const mediaPlaceholders = extractMediaPlaceholdersFromHtml(item.details?.content_html);
  const plainTextContent = truncatePromptText(stripHtml(item.details?.content_html));
  let itemText = "";

  switch (item.type) {
    case "news":
      itemText = `News Title: ${item.title}\nPublished: ${item.published_date}\nUrl: ${item.url}\nContent Summary: ${plainTextContent}`;
      break;
    case "project":
      itemText = `Project Name: ${item.title}\nPublished: ${item.published_date}\nUrl: ${item.url}\nOwner: ${item.details?.owner || "Unknown"}\nLanguage: ${item.details?.language || "Unknown"}\nStars Today: ${item.details?.starsToday || "Unknown"}\nTotal Stars: ${item.details?.totalStars || "Unknown"}\nDescription: ${truncatePromptText(item.description)}`;
      break;
    case "paper":
      itemText = `Papers Title: ${item.title}\nPublished: ${item.published_date}\nUrl: ${item.url}\nAbstract/Content Summary: ${plainTextContent}`;
      break;
    case "socialMedia":
      itemText = `socialMedia Post by ${item.authors}\nPublished: ${item.published_date}\nUrl: ${item.url}\nContent: ${truncatePromptText(stripHtml(item.details?.content_html))}`;
      break;
    default:
      itemText = `Type: ${item.type}\nTitle: ${item.title || "N/A"}\nDescription: ${truncatePromptText(item.description || "N/A")}\nURL: ${item.url || "N/A"}`;
      if (item.published_date) itemText += `\nPublished: ${item.published_date}`;
      if (item.source) itemText += `\nSource: ${item.source}`;
      if (item.details?.content_html) itemText += `\nContent: ${plainTextContent}`;
      break;
  }

  if (!itemText) return null;

  if (mediaPlaceholders.length > 0) {
    itemText += `\nMedia References: ${mediaPlaceholders.join(" ")}`;
  }

  return {
    sourceType: item.type,
    itemText,
    itemHasMedia,
    title: item.title,
    description: item.description,
    source: item.source,
    url: item.url,
    plainText: plainTextContent,
    placeholders: mediaPlaceholders,
    searchText: [item.title, item.description, item.source, plainTextContent].filter(Boolean).join(" "),
    matchTokens: extractMatchTokens({
      title: item.title,
      description: item.description,
      source: item.source,
      plainText: plainTextContent,
    }),
  };
}

function isDuplicateDailyPromptCandidate(candidate, selectedCandidates) {
  const candidateUrlKey = normalizeReplayUrl(candidate?.url);
  const candidateTitle = candidate?.title || "";

  return selectedCandidates.some((existingCandidate) => {
    const existingUrlKey = normalizeReplayUrl(existingCandidate?.url);
    if (candidateUrlKey && existingUrlKey && candidateUrlKey === existingUrlKey) {
      return true;
    }

    if (!candidateTitle || !existingCandidate?.title) {
      return false;
    }

    return isSimilarReplayTitle(candidateTitle, existingCandidate.title);
  });
}

export function buildDailyPromptSelection(allUnifiedData, env = {}) {
  const maxItems = parsePositiveInt(env.DAILY_PROMPT_MAX_ITEMS, 24);
  const quotas = {
    news: parsePositiveInt(env.DAILY_PROMPT_NEWS_ITEMS, 10),
    project: parsePositiveInt(env.DAILY_PROMPT_PROJECT_ITEMS, 6),
    socialMedia: parsePositiveInt(env.DAILY_PROMPT_SOCIAL_ITEMS, 5),
    paper: parsePositiveInt(env.DAILY_PROMPT_PAPER_ITEMS, 3),
  };
  const preferredSourceOrder = ["news", "project", "socialMedia", "paper"];
  const buckets = new Map();
  const mediaCandidates = [];
  let itemsWithMedia = 0;
  let itemsWithoutMedia = 0;

  for (const [sourceType, items] of Object.entries(allUnifiedData || {})) {
    const bucket = [];
    for (const item of items || []) {
      const candidate = buildDailyPromptCandidate(item);
      if (!candidate) continue;

      bucket.push(candidate);

      if (candidate.itemHasMedia) {
        itemsWithMedia += 1;
        mediaCandidates.push({
          title: candidate.title,
          description: candidate.description,
          source: candidate.source,
          url: candidate.url,
          plainText: candidate.plainText,
          placeholders: candidate.placeholders,
          searchText: candidate.searchText,
          matchTokens: candidate.matchTokens,
        });
      } else {
        itemsWithoutMedia += 1;
      }
    }
    buckets.set(sourceType, bucket);
  }

  const orderedSourceTypes = [
    ...preferredSourceOrder,
    ...[...buckets.keys()].filter((sourceType) => !preferredSourceOrder.includes(sourceType)),
  ];
  const selectedCandidates = [];

  const tryAddCandidate = (candidate) => {
    if (!candidate || selectedCandidates.length >= maxItems) return false;
    if (isDuplicateDailyPromptCandidate(candidate, selectedCandidates)) return false;
    selectedCandidates.push(candidate);
    return true;
  };

  for (const sourceType of orderedSourceTypes) {
    const bucket = buckets.get(sourceType) || [];
    const withMedia = bucket.filter((candidate) => candidate.itemHasMedia);
    const withoutMedia = bucket.filter((candidate) => !candidate.itemHasMedia);
    const quota = quotas[sourceType] || 0;

    if (quota <= 0) continue;

    let added = 0;
    for (const candidate of [...withMedia, ...withoutMedia]) {
      if (added >= quota || selectedCandidates.length >= maxItems) break;
      if (tryAddCandidate(candidate)) added += 1;
    }
  }

  if (selectedCandidates.length < maxItems) {
    const remainingCandidates = orderedSourceTypes.flatMap((sourceType) => {
      const bucket = buckets.get(sourceType) || [];
      return [
        ...bucket.filter((candidate) => candidate.itemHasMedia),
        ...bucket.filter((candidate) => !candidate.itemHasMedia),
      ];
    });

    for (const candidate of remainingCandidates) {
      if (selectedCandidates.length >= maxItems) break;
      tryAddCandidate(candidate);
    }
  }

  return {
    selectedContentItems: selectedCandidates.map((candidate) => candidate.itemText),
    mediaCandidates,
    itemsWithMedia,
    itemsWithoutMedia,
    selectedCounts: orderedSourceTypes.reduce((acc, sourceType) => {
      acc[sourceType] = selectedCandidates.filter((candidate) => candidate.sourceType === sourceType).length;
      return acc;
    }, {}),
  };
}
