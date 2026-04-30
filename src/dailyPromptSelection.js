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

function parseNonNegativeInt(value, fallback) {
  const parsed = parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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

function scoreDailyPromptCandidate(candidate) {
  let score = 0;
  const sourceType = candidate?.sourceType || "";

  if (sourceType === "project") score += 30;
  if (sourceType === "news") score += 24;
  if (sourceType === "socialMedia") score += 16;
  if (sourceType === "paper") score += 12;

  if (candidate?.itemHasMedia) score += 6;

  const sourceText = `${candidate?.source || ""} ${candidate?.title || ""} ${candidate?.description || ""}`.toLowerCase();
  if (/github|open source|open-source|开源|project/i.test(sourceText)) score += 8;
  if (/release|launch|发布|更新|开源|上新|new/i.test(sourceText)) score += 4;

  const starsTodayMatch = String(candidate?.itemText || "").match(/Stars Today:\s*(\d+)/i);
  if (starsTodayMatch) {
    score += Math.min(parseInt(starsTodayMatch[1], 10) || 0, 20);
  }

  return score;
}

function isGithubProjectUrl(url) {
  if (!url) return false;

  try {
    const parsed = new URL(String(url).trim());
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const parts = parsed.pathname.split("/").filter(Boolean);
    return host === "github.com" && parts.length >= 2;
  } catch {
    return /github\.com\/[^/?#\s]+\/[^/?#\s]+/i.test(String(url || ""));
  }
}

function isGithubOpenSourceProjectCandidate(candidate) {
  if (!candidate) return false;
  if (candidate.sourceType === "project") return true;
  if (isGithubProjectUrl(candidate.url)) return true;

  const text = [
    candidate.source || "",
    candidate.title || "",
    candidate.description || "",
    candidate.plainText || "",
  ].join(" ");

  return /github\s+trending|open source|open-source|开源项目|开源工具|开源模型|开源框架|开源库|开源发布|开源更新/i.test(text);
}

function isRepeatedAgainstPreviousDaily(candidate, previousDailyItems = []) {
  if (!candidate || !Array.isArray(previousDailyItems) || previousDailyItems.length === 0) return false;

  const candidateUrlKey = normalizeReplayUrl(candidate.url);
  const candidateTitle = candidate.title || "";

  return previousDailyItems.some((previousItem) => {
    const previousUrlKey = previousItem?.urlKey || normalizeReplayUrl(previousItem?.url);
    if (candidateUrlKey && previousUrlKey && candidateUrlKey === previousUrlKey) return true;
    return candidateTitle && previousItem?.title && isSimilarReplayTitle(candidateTitle, previousItem.title);
  });
}

const COMPANY_TOPIC_PATTERNS = [
  { key: "openai", pattern: /\b(openai|chatgpt|gpt[-\s]?(?:[0-9]|image|oss|realtime)|sora|dall[-\s]?e|sam altman)\b|奥特曼|山姆/i },
  { key: "google", pattern: /\b(google|gemini|deepmind|alphafold|notebooklm|ai studio)\b|谷歌/i },
  { key: "anthropic", pattern: /\b(anthropic|claude)\b/i },
  { key: "meta", pattern: /\b(meta|llama|fair)\b/i },
  { key: "microsoft", pattern: /\b(microsoft|copilot|bing|azure ai)\b|微软/i },
  { key: "github", pattern: /\b(github copilot|github models|github spark)\b/i },
  { key: "xai", pattern: /\b(xai|grok)\b/i },
  { key: "perplexity", pattern: /\bperplexity\b/i },
  { key: "cursor", pattern: /\bcursor\b/i },
  { key: "windsurf", pattern: /\b(windsurf|codeium)\b/i },
  { key: "mistral", pattern: /\bmistral\b/i },
  { key: "nvidia", pattern: /\b(nvidia|cuda|dgx|blackwell)\b|英伟达/i },
  { key: "apple", pattern: /\b(apple intelligence|apple|wwdc)\b|苹果/i },
  { key: "amazon", pattern: /\b(amazon|aws|bedrock)\b/i },
  { key: "midjourney", pattern: /\bmidjourney\b/i },
  { key: "stability", pattern: /\b(stability ai|stable diffusion)\b/i },
  { key: "runway", pattern: /\brunway\b/i },
  { key: "alibaba", pattern: /\b(qwen|tongyi|alibaba|通义)\b|阿里/i },
  { key: "deepseek", pattern: /\bdeepseek\b/i },
  { key: "moonshot", pattern: /\b(kimi|moonshot)\b|月之暗面/i },
  { key: "zhipu", pattern: /\b(zhipu|glm)\b|智谱/i },
  { key: "tencent", pattern: /\b(tencent|hunyuan)\b|腾讯|混元/i },
  { key: "baidu", pattern: /\b(baidu|ernie)\b|百度|文心/i },
  { key: "bytedance", pattern: /\b(bytedance|doubao|seedance)\b|字节|豆包/i },
  { key: "minimax", pattern: /\b(minimax|hailuo)\b|海螺/i },
  { key: "kuaishou", pattern: /\b(kling|kuaishou)\b|可灵|快手/i },
  { key: "huggingface", pattern: /\b(hugging face|huggingface)\b/i },
];

function normalizeDiversityText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getCandidateTopicKey(candidate) {
  const sourceText = candidate?.sourceType === "project" ? "" : candidate?.source || "";
  const text = normalizeDiversityText([
    candidate?.title || "",
    candidate?.description || "",
    candidate?.plainText || "",
    candidate?.authors || "",
    sourceText,
  ].join(" "));

  if (!text) return "";

  for (const { key, pattern } of COMPANY_TOPIC_PATTERNS) {
    if (pattern.test(text)) return key;
  }

  return "";
}

function getCandidateSourceKey(candidate) {
  const source = normalizeDiversityText(candidate?.source || "");
  if (!source) return "";
  return source.replace(/\s+-\s+.+$/, "").replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim();
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
    authors: item.authors,
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

function isDuplicateDailyPromptCandidate(candidate, selectedCandidates, options = {}) {
  const candidateUrlKey = normalizeReplayUrl(candidate?.url);
  const candidateTitle = candidate?.title || "";

  return selectedCandidates.some((existingCandidate) => {
    const existingUrlKey = normalizeReplayUrl(existingCandidate?.url);
    if (candidateUrlKey && existingUrlKey && candidateUrlKey === existingUrlKey) {
      return true;
    }

    if (options.allowSimilarTitle || !candidateTitle || !existingCandidate?.title) {
      return false;
    }

    return isSimilarReplayTitle(candidateTitle, existingCandidate.title);
  });
}

export function buildDailyPromptSelection(allUnifiedData, env = {}, options = {}) {
  const maxItems = parsePositiveInt(env.DAILY_PROMPT_MAX_ITEMS, 28);
  const minimumPromptItems = Math.min(maxItems, parsePositiveInt(env.DAILY_PROMPT_MIN_ITEMS, 12));
  const maxTopicItems = parseNonNegativeInt(env.DAILY_PROMPT_TOPIC_MAX_ITEMS, 1);
  const maxSourceItems = parseNonNegativeInt(env.DAILY_PROMPT_SOURCE_MAX_ITEMS, 4);
  const maxProjectLikeItems = Math.min(
    maxItems,
    2,
    parseNonNegativeInt(env.DAILY_PROMPT_MAX_PROJECT_ITEMS, 2)
  );
  const targetProjectLikeItems = Math.min(
    maxProjectLikeItems,
    parseNonNegativeInt(env.DAILY_PROMPT_TARGET_PROJECT_ITEMS, 2)
  );
  const previousDailyItems = Array.isArray(options.previousDailyItems) ? options.previousDailyItems : [];
  const quotas = {
    news: parsePositiveInt(env.DAILY_PROMPT_NEWS_ITEMS, 10),
    project: parsePositiveInt(env.DAILY_PROMPT_PROJECT_ITEMS, 8),
    socialMedia: parsePositiveInt(env.DAILY_PROMPT_SOCIAL_ITEMS, 6),
    paper: parsePositiveInt(env.DAILY_PROMPT_PAPER_ITEMS, 4),
  };
  const preferredSourceOrder = ["news", "project", "socialMedia", "paper"];
  const buckets = new Map();
  const mediaCandidates = [];
  let itemsWithMedia = 0;
  let itemsWithoutMedia = 0;
  let previousProjectFiltered = 0;

  for (const [sourceType, items] of Object.entries(allUnifiedData || {})) {
    const bucket = [];
    for (const item of items || []) {
      const candidate = buildDailyPromptCandidate(item);
      if (!candidate) continue;
      candidate.score = scoreDailyPromptCandidate(candidate);
      candidate.isGithubOpenSourceProject = isGithubOpenSourceProjectCandidate(candidate);
      candidate.isGithubProject = isGithubProjectUrl(candidate.url);

      if (
        candidate.isGithubOpenSourceProject &&
        isRepeatedAgainstPreviousDaily(candidate, previousDailyItems)
      ) {
        previousProjectFiltered += 1;
        continue;
      }

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
  const topicCounts = new Map();
  const sourceCounts = new Map();
  let selectedProjectLikeCount = 0;
  let selectedGithubProjectCount = 0;

  const sortedBucketFor = (sourceType) => {
    const bucket = [...(buckets.get(sourceType) || [])].sort((left, right) => right.score - left.score);
    return [
      ...bucket.filter((candidate) => candidate.itemHasMedia),
      ...bucket.filter((candidate) => !candidate.itemHasMedia),
    ];
  };

  const tryAddCandidate = (candidate, options = {}) => {
    if (!candidate || selectedCandidates.length >= maxItems) return false;
    if (isDuplicateDailyPromptCandidate(candidate, selectedCandidates, options)) return false;
    if (candidate.isGithubOpenSourceProject && selectedProjectLikeCount >= maxProjectLikeItems) return false;

    const topicKey = getCandidateTopicKey(candidate);
    if (maxTopicItems > 0 && topicKey && (topicCounts.get(topicKey) || 0) >= maxTopicItems) {
      return false;
    }

    const sourceKey = getCandidateSourceKey(candidate);
    if (maxSourceItems > 0 && sourceKey && (sourceCounts.get(sourceKey) || 0) >= maxSourceItems) {
      return false;
    }

    selectedCandidates.push(candidate);
    if (candidate.isGithubOpenSourceProject) selectedProjectLikeCount += 1;
    if (candidate.isGithubProject) selectedGithubProjectCount += 1;
    if (topicKey) topicCounts.set(topicKey, (topicCounts.get(topicKey) || 0) + 1);
    if (sourceKey) sourceCounts.set(sourceKey, (sourceCounts.get(sourceKey) || 0) + 1);
    return true;
  };

  if (targetProjectLikeItems > 0) {
    let addedProjects = 0;
    const projectLikeCandidates = orderedSourceTypes
      .flatMap(sortedBucketFor)
      .filter((candidate) => candidate.isGithubOpenSourceProject)
      .sort((left, right) => right.score - left.score);

    for (const candidate of projectLikeCandidates) {
      if (addedProjects >= targetProjectLikeItems || selectedCandidates.length >= maxItems) break;
      if (tryAddCandidate(candidate)) addedProjects += 1;
    }
  }

  for (const sourceType of orderedSourceTypes) {
    const sortedBucket = sortedBucketFor(sourceType);
    const quota = quotas[sourceType] || 0;

    if (quota <= 0) continue;

    let added = selectedCandidates.filter((candidate) => candidate.sourceType === sourceType).length;
    for (const candidate of sortedBucket) {
      if (added >= quota || selectedCandidates.length >= maxItems) break;
      if (tryAddCandidate(candidate)) added += 1;
    }
  }

  if (selectedCandidates.length < maxItems) {
    const remainingCandidates = orderedSourceTypes.flatMap(sortedBucketFor);

    for (const candidate of remainingCandidates) {
      if (selectedCandidates.length >= maxItems) break;
      tryAddCandidate(candidate);
    }

    if (selectedCandidates.length < minimumPromptItems) {
      for (const candidate of remainingCandidates) {
        if (selectedCandidates.length >= minimumPromptItems || selectedCandidates.length >= maxItems) break;
        tryAddCandidate(candidate, { allowSimilarTitle: true });
      }
    }
  }

  let projectSlotIndex = 0;
  const selectedContentItems = selectedCandidates.map((candidate) => {
    if (!candidate.isGithubOpenSourceProject) return candidate.itemText;

    projectSlotIndex += 1;
    const slot =
      projectSlotIndex === 1
        ? "TOP10_PROJECT_ONLY - Use this as the only GitHub/open-source project in TOP 10."
        : "MORE_DYNAMICS_PROJECT_ONLY - Use this as the only GitHub/open-source project in 更多动态; do not place it in TOP 10.";

    return `Daily Project Slot: ${slot}\n${candidate.itemText}`;
  });

  return {
    selectedContentItems,
    mediaCandidates,
    itemsWithMedia,
    itemsWithoutMedia,
    selectedProjectLikeCount,
    selectedGithubProjectCount,
    previousProjectFiltered,
    totalCandidateCount: orderedSourceTypes.reduce(
      (count, sourceType) => count + (buckets.get(sourceType) || []).length,
      0
    ),
    selectedCounts: orderedSourceTypes.reduce((acc, sourceType) => {
      acc[sourceType] = selectedCandidates.filter((candidate) => candidate.sourceType === sourceType).length;
      return acc;
    }, {}),
  };
}
