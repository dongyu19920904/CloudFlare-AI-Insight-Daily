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

function scoreDailyPromptCandidate(candidate) {
  let score = 0;
  const sourceType = candidate?.sourceType || "";

  if (sourceType === "project") score += 30;
  if (sourceType === "news") score += 24;
  if (sourceType === "socialMedia") score += 16;
  if (sourceType === "paper") score += 12;

  if (candidate?.itemHasMedia) score += 14;
  if (candidate?.isWelfare) score += 10;

  const sourceText = `${candidate?.source || ""} ${candidate?.title || ""} ${candidate?.description || ""}`.toLowerCase();
  if (/github|open source|open-source|开源|project/i.test(sourceText)) score += 8;
  if (/release|launch|发布|更新|开源|上新|new/i.test(sourceText)) score += 4;

  const starsTodayMatch = String(candidate?.itemText || "").match(/Stars Today:\s*(\d+)/i);
  if (starsTodayMatch) {
    score += Math.min(parseInt(starsTodayMatch[1], 10) || 0, 20);
  }

  return score;
}

function scoreDailyPromptPresentation(candidate) {
  let score = Number(candidate?.score || 0);

  if (candidate?.itemHasMedia) score += 10;
  if (candidate?.isWelfare) score -= 30;

  return score;
}

function scoreDailyFunCandidate(candidate) {
  const sourceType = candidate?.sourceType || "";
  const text = [
    candidate?.title || "",
    candidate?.description || "",
    candidate?.source || "",
    candidate?.url || "",
    candidate?.plainText || "",
  ].join(" ");
  let score = 0;

  if (sourceType === "socialMedia") score += 60;
  if (sourceType === "news") score += 42;
  if (sourceType === "project") score += 10;
  if (sourceType === "paper") score -= 80;
  if (candidate?.itemHasMedia) score += 18;

  if (/用户|开发者|网友|作者|朋友|同事|打工人|产品经理|设计师|创始人|有人|自己|我|我们|体验|演示|截图|视频|下单|填表|自动|浏览器|微信|飞书|Kimi|Codex|Cursor|Claude|ChatGPT|Agent/i.test(text)) {
    score += 35;
  }
  if (/x\.com|twitter\.com|okjike\.com|jike|即刻|tweet|post|原帖|评论|转发/i.test(text)) {
    score += 25;
  }
  if (/论文|研究|benchmark|dataset|framework|zero-shot|arxiv\.org|abstract|causal|stereo|segmentation/i.test(text)) {
    score -= 40;
  }
  if (/降智|变笨|离谱|不行了|只能\s*Claude|Gemini\s*水平|关闭续费|取消续费|耗半小时|Pro\s*20x/i.test(text)) {
    score -= 60;
  }
  if (candidate?.isWelfare) score -= 20;

  return score;
}

function orderSelectedDailyPromptCandidates(selectedCandidates) {
  return [...selectedCandidates].sort((left, right) => {
    const scoreDelta = scoreDailyPromptPresentation(right) - scoreDailyPromptPresentation(left);
    if (scoreDelta !== 0) return scoreDelta;

    if (left.itemHasMedia !== right.itemHasMedia) {
      return left.itemHasMedia ? -1 : 1;
    }

    return 0;
  });
}

function selectDailyFunCandidates(buckets, orderedSourceTypes, limit) {
  if (limit <= 0) return [];

  return orderedSourceTypes
    .flatMap((sourceType) => buckets.get(sourceType) || [])
    .map((candidate) => ({
      candidate,
      funScore: scoreDailyFunCandidate(candidate),
    }))
    .filter(({ candidate, funScore }) => candidate.sourceType !== "paper" && funScore >= 55)
    .sort((left, right) => right.funScore - left.funScore)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

function hasAiRelevanceSignal(text) {
  return (
    /\b(ai|agi|llm|gpt|chatgpt|claude|gemini|openai|anthropic|deepmind|xai|grok|copilot|sora|llama|mistral|deepseek|qwen|kimi|cursor|codex|mcp|rag|agent|agentic)\b/i.test(text) ||
    /人工智能|大模型|生成式|智能体|多模态|机器学习|深度学习|神经网络|算力|推理|训练|提示词|开源模型|本地模型|AI原生|AI化|AI产品|AI工具|AI生图|AI芯片|寒武纪|Vibe Coding/i.test(text)
  );
}

function hasStrongAiRelevanceSignal(text) {
  return (
    /\b(ai|agi|llm|gpt|chatgpt|claude|gemini|openai|anthropic|deepmind|xai|grok|copilot|sora|llama|mistral|deepseek|qwen|kimi|cursor|codex|mcp|rag|agent|agentic)\b/i.test(text) ||
    /人工智能|大模型|生成式|智能体|多模态|机器学习|深度学习|神经网络|算力|提示词|开源模型|本地模型|AI原生|AI化|AI产品|AI工具|AI生图|AI芯片|寒武纪|Vibe Coding/i.test(text)
  );
}

function hasNonAiHeadlineNoise(text) {
  return /grapheneos|android\s+vpn|vpn\s+leak|任天堂|nintendo|switch\s*\d?|游戏主机|console\s+price|锻炼|健身|周练计划|训练计划|身体还是要练|workout|fitness|exercise\s+plan|training\s+plan/i.test(
    String(text || "")
  );
}

function hasNonAiTopicNoise(text) {
  const normalized = String(text || "");
  return (
    /grapheneos|android\s+vpn|vpn\s+leak/i.test(normalized) ||
    /(任天堂|nintendo|switch\s*\d?|游戏主机).{0,30}(涨价|价格|price|日本|美国|跟进)/i.test(normalized) ||
    /(涨价|价格|price|日本|美国|跟进).{0,30}(任天堂|nintendo|switch\s*\d?|游戏主机)/i.test(normalized) ||
    /(锻炼|健身|周练计划|训练计划|workout|fitness|exercise\s+plan|training\s+plan).{0,40}(照做|新手|中级|高级|身体|肌肉|减脂|routine|weekly|beginner|intermediate|advanced)/i.test(normalized) ||
    /(照做|新手|中级|高级|身体|肌肉|减脂|routine|weekly|beginner|intermediate|advanced).{0,40}(锻炼|健身|周练计划|训练计划|workout|fitness|exercise\s+plan|training\s+plan)/i.test(normalized)
  );
}

function isAiRelevantDailyPromptCandidate(candidate) {
  if (candidate?.sourceType === "project" || candidate?.sourceType === "paper") {
    return true;
  }

  const titleAndDescription = [
    candidate?.title || "",
    candidate?.description || "",
  ].join(" ");

  if (hasNonAiHeadlineNoise(titleAndDescription) && !hasStrongAiRelevanceSignal(titleAndDescription)) {
    return false;
  }

  const topicText = [
    candidate?.title || "",
    candidate?.description || "",
    candidate?.plainText || "",
  ].join(" ");

  if (hasNonAiTopicNoise(topicText) && !hasStrongAiRelevanceSignal(titleAndDescription)) {
    return false;
  }

  const text = [
    candidate?.title || "",
    candidate?.description || "",
    candidate?.plainText || "",
    candidate?.url || "",
  ].join(" ");

  return hasAiRelevanceSignal(text);
}

function isWelfareCandidateText(text) {
  return /每日薅羊毛|薅羊毛|羊毛|福利|优惠|限免|白嫖|折扣|兑换|代金券|coupon|promo|discount|free|credit/i.test(
    String(text || "")
  );
}

function getDailyPromptEntityKey(candidate) {
  const text = [
    candidate?.title || "",
    candidate?.description || "",
    candidate?.source || "",
    candidate?.url || "",
    candidate?.plainText || "",
  ].join(" ").toLowerCase();

  const majorEntities = [
    ["anthropic", /\b(anthropic|claude)\b/i],
    ["openai", /\b(openai|chatgpt|gpt[-\s]?\d|sora)\b/i],
    ["google", /\b(google|gemini|deepmind)\b/i],
    ["deepseek", /\bdeepseek\b/i],
    ["microsoft", /\b(microsoft|copilot|azure ai)\b/i],
    ["meta", /\b(meta ai|llama)\b/i],
    ["xai", /\b(xai|grok)\b/i],
    ["apple", /\b(apple|siri|airpods)\b/i],
  ];

  return majorEntities.find(([, pattern]) => pattern.test(text))?.[0] || "";
}

function isProjectLikeDailyPromptCandidate(candidate) {
  const text = [
    candidate?.sourceType || "",
    candidate?.title || "",
    candidate?.description || "",
    candidate?.source || "",
    candidate?.url || "",
    candidate?.plainText || "",
  ].join(" ");

  if (candidate?.sourceType === "project") return true;
  if (/github\.com\/(?!features\/|topics\/|marketplace\/|blog\/)[^/\s)#?]+\/[^/\s)#?]+/i.test(text)) {
    return true;
  }
  return /寮€婧?椤圭洰|GitHub\s*(椤圭洰|浠撳簱)|浠撳簱|repo(?:sitory)?|open[-\s]?source\s+project/i.test(text);
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
    itemText += "\nPlacement Hint: This item has usable media. If it is relevant and similarly important, prefer it in TOP 1-5.";
  }

  const welfareText = [
    item.title,
    item.description,
    item.source,
    item.url,
    plainTextContent,
  ].join(" ");
  const isWelfare = isWelfareCandidateText(welfareText);
  if (isWelfare) {
    itemText += "\nPlacement Hint: This is a welfare/freebie item. Put at most one such item in 值得关注, not TOP.";
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
    isWelfare,
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
  const maxItems = parsePositiveInt(env.DAILY_PROMPT_MAX_ITEMS, 18);
  const entityHardCap = parsePositiveInt(env.DAILY_PROMPT_ENTITY_HARD_CAP, 1);
  const quotas = {
    news: parsePositiveInt(env.DAILY_PROMPT_NEWS_ITEMS, 12),
    project: parsePositiveInt(env.DAILY_PROMPT_PROJECT_ITEMS, 1),
    socialMedia: parsePositiveInt(env.DAILY_PROMPT_SOCIAL_ITEMS, 3),
    paper: parsePositiveInt(env.DAILY_PROMPT_PAPER_ITEMS, 2),
  };
  const hardCaps = {
    project: parsePositiveInt(env.DAILY_PROMPT_PROJECT_HARD_CAP, 1),
  };
  const projectLikeHardCap = parsePositiveInt(
    env.DAILY_PROMPT_PROJECT_LIKE_HARD_CAP,
    hardCaps.project || 1
  );
  const preferredSourceOrder = ["project", "news", "socialMedia", "paper"];
  const buckets = new Map();
  const mediaCandidates = [];
  let itemsWithMedia = 0;
  let itemsWithoutMedia = 0;
  let rejectedNonAiCount = 0;

  for (const [sourceType, items] of Object.entries(allUnifiedData || {})) {
    const bucket = [];
    for (const item of items || []) {
      const candidate = buildDailyPromptCandidate(item);
      if (!candidate) continue;
      if (!isAiRelevantDailyPromptCandidate(candidate)) {
        rejectedNonAiCount += 1;
        continue;
      }
      candidate.score = scoreDailyPromptCandidate(candidate);

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
  const selectedEntityCounts = new Map();
  let selectedProjectLikeCount = 0;

  const updateSelectedEntityCount = (candidate, delta) => {
    const entityKey = getDailyPromptEntityKey(candidate);
    if (!entityKey) return;
    selectedEntityCounts.set(entityKey, Math.max(0, (selectedEntityCounts.get(entityKey) || 0) + delta));
  };

  const removeSelectedCandidateAt = (index) => {
    const [removedCandidate] = selectedCandidates.splice(index, 1);
    updateSelectedEntityCount(removedCandidate, -1);
    if (isProjectLikeDailyPromptCandidate(removedCandidate)) {
      selectedProjectLikeCount = Math.max(0, selectedProjectLikeCount - 1);
    }
  };

  const tryAddCandidate = (candidate) => {
    if (!candidate || selectedCandidates.length >= maxItems) return false;
    const hardCap = hardCaps[candidate.sourceType];
    if (
      hardCap > 0 &&
      selectedCandidates.filter((selected) => selected.sourceType === candidate.sourceType).length >= hardCap
    ) {
      return false;
    }
    const entityKey = getDailyPromptEntityKey(candidate);
    if (entityHardCap > 0 && entityKey && (selectedEntityCounts.get(entityKey) || 0) >= entityHardCap) {
      return false;
    }
    const isProjectLike = isProjectLikeDailyPromptCandidate(candidate);
    if (projectLikeHardCap > 0 && isProjectLike && selectedProjectLikeCount >= projectLikeHardCap) {
      return false;
    }
    if (isDuplicateDailyPromptCandidate(candidate, selectedCandidates)) return false;
    selectedCandidates.push(candidate);
    updateSelectedEntityCount(candidate, 1);
    if (isProjectLike) selectedProjectLikeCount += 1;
    return true;
  };

  for (const sourceType of orderedSourceTypes) {
    const bucket = buckets.get(sourceType) || [];
    const sortedBucket = [...bucket].sort((left, right) => right.score - left.score);
    const withMedia = sortedBucket.filter((candidate) => candidate.itemHasMedia);
    const withoutMedia = sortedBucket.filter((candidate) => !candidate.itemHasMedia);
    const quota = quotas[sourceType] || 0;

    if (quota <= 0) continue;

    let added = 0;
    for (const candidate of [...withMedia, ...withoutMedia]) {
      if (added >= quota || selectedCandidates.length >= maxItems) break;
      if (tryAddCandidate(candidate)) added += 1;
    }
  }

  const welfareCandidate = orderedSourceTypes
    .flatMap((sourceType) => buckets.get(sourceType) || [])
    .filter((candidate) => candidate.isWelfare)
    .sort((left, right) => right.score - left.score)[0];

  if (welfareCandidate && !isDuplicateDailyPromptCandidate(welfareCandidate, selectedCandidates)) {
    if (selectedCandidates.length >= maxItems) {
      const replacementIndex = selectedCandidates.findIndex(
        (candidate) => !candidate.isWelfare && candidate.sourceType !== "project"
      );
      if (replacementIndex >= 0) {
        removeSelectedCandidateAt(replacementIndex);
      }
    }
    tryAddCandidate(welfareCandidate);
  }

  if (selectedCandidates.length < maxItems) {
    const remainingCandidates = orderedSourceTypes.flatMap((sourceType) => {
      const bucket = [...(buckets.get(sourceType) || [])].sort((left, right) => right.score - left.score);
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

  const candidateCounts = orderedSourceTypes.reduce((acc, sourceType) => {
    acc[sourceType] = (buckets.get(sourceType) || []).length;
    return acc;
  }, {});
  const selectedCounts = orderedSourceTypes.reduce((acc, sourceType) => {
    acc[sourceType] = selectedCandidates.filter((candidate) => candidate.sourceType === sourceType).length;
    return acc;
  }, {});
  const totalCandidateCount = Object.values(candidateCounts).reduce((count, sourceCount) => count + sourceCount, 0);
  const orderedSelectedCandidates = orderSelectedDailyPromptCandidates(selectedCandidates);
  const selectedMediaCount = orderedSelectedCandidates.filter((candidate) => candidate.itemHasMedia).length;
  const dailyFunCandidateLimit = parsePositiveInt(env.DAILY_FUN_FALLBACK_CANDIDATES, 12);
  const dailyFunCandidates = selectDailyFunCandidates(buckets, orderedSourceTypes, dailyFunCandidateLimit);

  return {
    selectedContentItems: orderedSelectedCandidates.map((candidate) => candidate.itemText),
    dailyFunContentItems: dailyFunCandidates.map((candidate) => candidate.itemText),
    mediaCandidates,
    itemsWithMedia,
    itemsWithoutMedia,
    totalCandidateCount,
    selectedCounts,
    selectionDiagnostics: {
      maxItems,
      quotas,
      hardCaps: {
        ...hardCaps,
        entity: entityHardCap,
        projectLike: projectLikeHardCap,
      },
      candidateCounts,
      selectedCounts,
      itemsWithMedia,
      itemsWithoutMedia,
      selectedMediaCount,
      selectedMediaInFirstFive: orderedSelectedCandidates.slice(0, 5).filter((candidate) => candidate.itemHasMedia).length,
      dailyFunCandidateCount: dailyFunCandidates.length,
      rejectedNonAiCount,
      selectedProjectLikeCount,
    },
  };
}
