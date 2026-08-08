import { normalizeGithubProjectUrl } from "./githubTopProjectDedupe.js";
import { deriveOpportunityOfferFamily } from "./opportunityEvidence.js";

export const DEFAULT_OPPORTUNITY_REPLAY_LOOKBACK_DAYS = 7;
export const OPPORTUNITY_REPLAY_MEMORY_KEY = "opportunity-replay-memory:recent";

const FRONT_MATTER_REGEX = /^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/;
const INTERNAL_HOSTS = new Set(["aivora.cn", "news.aivora.cn"]);

function cleanText(text, maxChars = 120) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}...`;
}

function dedupeRecords(records = [], keyField = "key") {
  const seen = new Set();
  const deduped = [];

  for (const record of records || []) {
    const key = record?.[keyField];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(record);
  }

  return deduped;
}

function dedupeDimensionRecords(records = [], keyField = "key") {
  const seen = new Set();
  const deduped = [];

  for (const record of records || []) {
    const key = record?.[keyField];
    if (!key) continue;
    const occurrenceKey = `${record?.date || ""}:${record?.section || ""}:${key}`;
    if (seen.has(occurrenceKey)) continue;
    seen.add(occurrenceKey);
    deduped.push(record);
  }

  return deduped;
}

function parseDateOnly(dateStr) {
  const date = new Date(`${String(dateStr || "").slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayDiff(leftDateStr, rightDateStr) {
  const left = parseDateOnly(leftDateStr);
  const right = parseDateOnly(rightDateStr);
  if (!left || !right) return Number.POSITIVE_INFINITY;
  return Math.round((left.getTime() - right.getTime()) / 86400000);
}

function pruneRecordsByDate(records = [], currentDate, lookbackDays) {
  const days = Math.max(1, Number.parseInt(lookbackDays, 10) || DEFAULT_OPPORTUNITY_REPLAY_LOOKBACK_DAYS);
  return (Array.isArray(records) ? records : []).filter((record) => {
    if (!record?.date) return false;
    const diff = dayDiff(currentDate, record.date);
    return diff >= 0 && diff <= days;
  });
}

export function createEmptyOpportunityReplayMemory() {
  return {
    sourceUrls: [],
    githubProjects: [],
    ruleIds: [],
    terms: [],
    lanes: [],
    titles: [],
    entities: [],
    businessModels: [],
    deliveryTypes: [],
    commercialSignatures: [],
    offerFamilies: [],
  };
}

export function normalizeOpportunitySourceUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(String(url).trim());
    let hostname = parsed.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    if (hostname === "twitter.com") hostname = "x.com";
    if (INTERNAL_HOSTS.has(hostname)) return "";

    const blockedParams = new Set([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "ref",
      "ref_src",
      "fbclid",
      "gclid",
    ]);
    for (const key of [...parsed.searchParams.keys()]) {
      if (blockedParams.has(key.toLowerCase())) parsed.searchParams.delete(key);
    }

    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    const search = parsed.searchParams.toString();
    return `${hostname}${pathname}${search ? `?${search}` : ""}`.toLowerCase();
  } catch {
    return String(url).trim().toLowerCase().replace(/\/+$/, "");
  }
}

export function mergeOpportunityReplayMemories(...memories) {
  const merged = createEmptyOpportunityReplayMemory();

  for (const memory of memories || []) {
    if (!memory) continue;
    merged.sourceUrls.push(...(memory.sourceUrls || []));
    merged.githubProjects.push(...(memory.githubProjects || []));
    merged.ruleIds.push(...(memory.ruleIds || []));
    merged.terms.push(...(memory.terms || []));
    merged.lanes.push(...(memory.lanes || []));
    merged.titles.push(...(memory.titles || []));
    merged.entities.push(...(memory.entities || []));
    merged.businessModels.push(...(memory.businessModels || []));
    merged.deliveryTypes.push(...(memory.deliveryTypes || []));
    merged.commercialSignatures.push(...(memory.commercialSignatures || []));
    merged.offerFamilies.push(...(memory.offerFamilies || []));
  }

  return {
    sourceUrls: dedupeRecords(merged.sourceUrls, "key"),
    githubProjects: dedupeRecords(merged.githubProjects, "key"),
    ruleIds: dedupeRecords(merged.ruleIds, "key"),
    terms: dedupeRecords(merged.terms, "key"),
    lanes: dedupeRecords(merged.lanes, "key"),
    titles: dedupeRecords(merged.titles, "key"),
    entities: dedupeRecords(merged.entities, "key"),
    businessModels: dedupeDimensionRecords(merged.businessModels, "key"),
    deliveryTypes: dedupeDimensionRecords(merged.deliveryTypes, "key"),
    commercialSignatures: dedupeDimensionRecords(merged.commercialSignatures, "key"),
    offerFamilies: dedupeDimensionRecords(merged.offerFamilies, "key"),
  };
}

export function pruneOpportunityReplayMemory(
  memory,
  currentDate,
  lookbackDays = DEFAULT_OPPORTUNITY_REPLAY_LOOKBACK_DAYS
) {
  return mergeOpportunityReplayMemories({
    sourceUrls: pruneRecordsByDate(memory?.sourceUrls, currentDate, lookbackDays),
    githubProjects: pruneRecordsByDate(memory?.githubProjects, currentDate, lookbackDays),
    ruleIds: pruneRecordsByDate(memory?.ruleIds, currentDate, lookbackDays),
    terms: pruneRecordsByDate(memory?.terms, currentDate, lookbackDays),
    lanes: pruneRecordsByDate(memory?.lanes, currentDate, lookbackDays),
    titles: pruneRecordsByDate(memory?.titles, currentDate, lookbackDays),
    entities: pruneRecordsByDate(memory?.entities, currentDate, lookbackDays),
    businessModels: pruneRecordsByDate(memory?.businessModels, currentDate, lookbackDays),
    deliveryTypes: pruneRecordsByDate(memory?.deliveryTypes, currentDate, lookbackDays),
    commercialSignatures: pruneRecordsByDate(
      memory?.commercialSignatures,
      currentDate,
      lookbackDays
    ),
    offerFamilies: pruneRecordsByDate(
      memory?.offerFamilies,
      currentDate,
      lookbackDays
    ),
  });
}

export function hasOpportunityReplaySectionDate(
  memory,
  section,
  dateStr,
  { requireOfferFamily = false } = {}
) {
  const collections = [
    memory?.sourceUrls,
    memory?.githubProjects,
    memory?.ruleIds,
    memory?.lanes,
    memory?.terms,
    memory?.titles,
    memory?.entities,
    memory?.businessModels,
    memory?.deliveryTypes,
    memory?.commercialSignatures,
  ];
  const hasAnyRecord = collections.some((records) =>
    (records || []).some(
      (record) => record?.section === section && record?.date === dateStr
    )
  );
  if (!hasAnyRecord || !requireOfferFamily) return hasAnyRecord;
  return (memory?.offerFamilies || []).some(
    (record) => record?.section === section && record?.date === dateStr
  );
}

export function getMissingOpportunityReplaySections(
  memory,
  dates = [],
  { includeAccountOpportunity = true } = {}
) {
  const missing = [];
  for (const date of dates || []) {
    if (
      !hasOpportunityReplaySectionDate(memory, "opportunity", date, {
        requireOfferFamily: true,
      })
    ) {
      missing.push({ date, section: "opportunity" });
    }
    if (
      includeAccountOpportunity &&
      !hasOpportunityReplaySectionDate(memory, "account-opportunity", date)
    ) {
      missing.push({ date, section: "account-opportunity" });
    }
  }
  return missing;
}

export function extractOpportunityReplayMemoryFromMarkdown(
  markdown,
  { date = "", section = "opportunity", playbook = null } = {}
) {
  const memory = createEmptyOpportunityReplayMemory();
  const content = String(markdown || "").replace(FRONT_MATTER_REGEX, "");
  if (!content.trim()) return memory;

  const addRecord = (collection, key, extra = {}) => {
    if (!key) return;
    collection.push({
      key,
      date,
      section,
      ...extra,
    });
  };

  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  for (const match of content.matchAll(linkRegex)) {
    if (match.index > 0 && content[match.index - 1] === "!") continue;

    const title = cleanText(match[1]);
    const url = String(match[2] || "").trim();
    const sourceKey = normalizeOpportunitySourceUrl(url);
    const githubKey = normalizeGithubProjectUrl(url);

    if (sourceKey) {
      addRecord(memory.sourceUrls, sourceKey, { title, url });
    }
    if (githubKey) {
      addRecord(memory.githubProjects, githubKey, { title, url });
    }
  }

  const headingRegex = /^#{2,4}\s+(?:\d+[.)]\s*)?(?:\[([^\]]+)\]\([^)]+\)|(.+))\s*$/gm;
  for (const match of content.matchAll(headingRegex)) {
    const title = cleanText(match[1] || match[2]);
    if (!title || /^快速导航$/.test(title)) continue;
    addRecord(memory.titles, `${section}:${date}:${title.toLowerCase()}`, { title });
  }

  const normalized = content.toLowerCase();

  for (const match of content.matchAll(/<!--\s*opportunity-replay:\s*(\{[^\n]*\})\s*-->/g)) {
    try {
      const metadata = JSON.parse(match[1]);
      const entity = String(metadata.entity || "").trim().toLowerCase();
      const businessModel = String(metadata.businessModel || "").trim().toLowerCase();
      const deliveryType = String(metadata.deliveryType || "").trim().toLowerCase();
      const commercialSignature = String(
        metadata.commercialSignature ||
          (businessModel && deliveryType ? `${businessModel}:${deliveryType}` : "")
      )
        .trim()
        .toLowerCase();
      const offerFamily = String(
        metadata.offerFamily ||
          deriveOpportunityOfferFamily({
            businessModel,
            deliveryType,
            preferredLane: metadata.preferredLane || "",
          })
      )
        .trim()
        .toLowerCase();

      addRecord(memory.entities, entity, { entity });
      addRecord(memory.businessModels, businessModel, { businessModel });
      addRecord(memory.deliveryTypes, deliveryType, { deliveryType });
      addRecord(memory.commercialSignatures, commercialSignature, {
        commercialSignature,
      });
      addRecord(memory.offerFamilies, offerFamily, { offerFamily });
    } catch {
      // Invalid hidden metadata is ignored; visible source URL replay still applies.
    }
  }

  const matchedRules = (playbook?.topicRules || [])
    .map((rule) => {
      const matchedTerms = (rule.match || []).filter((term) =>
        normalized.includes(String(term).toLowerCase())
      );

      return { rule, matchedTerms };
    })
    .filter((item) => item.matchedTerms.length > 0)
    .sort((left, right) => right.matchedTerms.length - left.matchedTerms.length)
    .slice(0, 4);

  for (const { rule, matchedTerms } of matchedRules) {
    addRecord(memory.ruleIds, `${section}:${date}:${rule.id}`, {
      id: rule.id,
      label: rule.label || rule.id,
    });
    if (rule.preferredLane) {
      addRecord(memory.lanes, `${section}:${date}:${rule.preferredLane}`, {
        id: rule.preferredLane,
        label: rule.preferredLane,
      });
    }
    for (const term of matchedTerms.slice(0, 5)) {
      const normalizedTerm = String(term).toLowerCase();
      addRecord(memory.terms, `${section}:${date}:${normalizedTerm}`, { term });
    }
  }

  return mergeOpportunityReplayMemories(memory);
}

export function getOpportunityReplayMemoryStats(memory) {
  return {
    sourceUrlCount: memory?.sourceUrls?.length || 0,
    githubProjectCount: memory?.githubProjects?.length || 0,
    ruleIdCount: memory?.ruleIds?.length || 0,
    laneCount: memory?.lanes?.length || 0,
    titleCount: memory?.titles?.length || 0,
    entityCount: memory?.entities?.length || 0,
    businessModelCount: memory?.businessModels?.length || 0,
    deliveryTypeCount: memory?.deliveryTypes?.length || 0,
    commercialSignatureCount: memory?.commercialSignatures?.length || 0,
    offerFamilyCount: memory?.offerFamilies?.length || 0,
  };
}

export function formatOpportunityReplayMemoryForPrompt(memory, limit = 10) {
  const sourceUrls = (memory?.sourceUrls || []).slice(0, limit);
  const githubProjects = (memory?.githubProjects || []).slice(0, limit);
  const ruleIds = (memory?.ruleIds || []).slice(0, 8);
  const lanes = (memory?.lanes || []).slice(0, 6);
  const entities = (memory?.entities || []).slice(0, 12);
  const commercialSignatures = (memory?.commercialSignatures || []).slice(0, 12);
  const offerFamilies = (memory?.offerFamilies || []).slice(0, 12);

  if (
    sourceUrls.length === 0 &&
    githubProjects.length === 0 &&
    ruleIds.length === 0 &&
    lanes.length === 0 &&
    entities.length === 0 &&
    commercialSignatures.length === 0 &&
    offerFamilies.length === 0
  ) {
    return "";
  }

  const sourceLines = sourceUrls.map((item) =>
    `- ${item.title || item.key}: ${item.url || item.key} (${item.date}, ${item.section})`
  );
  const projectLines = githubProjects.map((item) =>
    `- ${item.key}${item.title ? ` - ${item.title}` : ""} (${item.date}, ${item.section})`
  );
  const ruleLines = ruleIds.map((item) =>
    `- ${item.label || item.id || item.key} (${item.date}, ${item.section})`
  );
  const laneLines = lanes.map((item) =>
    `- ${item.label || item.id || item.key} (${item.date}, ${item.section})`
  );
  const entityLines = entities.map((item) =>
    `- ${item.entity || item.key} (${item.date}, ${item.section})`
  );
  const commercialLines = commercialSignatures.map((item) =>
    `- ${item.commercialSignature || item.key} (${item.date}, ${item.section})`
  );
  const offerFamilyLines = offerFamilies.map((item) =>
    `- ${item.offerFamily || item.key} (${item.date}, ${item.section})`
  );

  return [
    "以下是过去 7 天已经用过的 AI 商机信号。本次不要复用同一来源链接或同一 GitHub 项目；同一商机类型如果刚出现过，必须换成新的证据、新项目和新卖法。",
    sourceLines.length ? `\n已用来源链接：\n${sourceLines.join("\n")}` : "",
    projectLines.length ? `\n已用 GitHub 项目：\n${projectLines.join("\n")}` : "",
    ruleLines.length ? `\n近期商机规则：\n${ruleLines.join("\n")}` : "",
    laneLines.length ? `\n近期卖法类型：\n${laneLines.join("\n")}` : "",
    entityLines.length ? `\n近期项目或产品实体：\n${entityLines.join("\n")}` : "",
    commercialLines.length
      ? `\n近期商业模式与交付组合：\n${commercialLines.join("\n")}`
      : "",
    offerFamilyLines.length
      ? `\n近期读者可购买的交付家族（7 天内不得换项目重做同类）：\n${offerFamilyLines.join("\n")}`
      : "",
  ].filter(Boolean).join("\n");
}

export function appendOpportunityReplayMetadata(markdown, candidates = []) {
  const content = String(markdown || "").trimEnd();
  if (!content) return content;

  const usedSourceKeys = new Set(
    [...content.matchAll(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g)]
      .map((match) => normalizeOpportunitySourceUrl(match[1]))
      .filter(Boolean)
  );
  const metadata = [];
  const seen = new Set();

  for (const candidate of candidates || []) {
    if (candidate.observationOnly) continue;
    const isUsed = (candidate.supportingItems || []).some((item) =>
      usedSourceKeys.has(normalizeOpportunitySourceUrl(item.url))
    );
    if (!isUsed) continue;

    const payload = {
      entity: candidate.entityKey || "",
      businessModel: candidate.businessModel || "",
      deliveryType: candidate.deliveryType || "",
      commercialSignature: candidate.commercialSignature || "",
      offerFamily: candidate.offerFamily || "",
      preferredLane: candidate.preferredLane || "",
    };
    const key = JSON.stringify(payload);
    if (!payload.entity || seen.has(key)) continue;
    seen.add(key);
    metadata.push(`<!-- opportunity-replay: ${key} -->`);
  }

  return metadata.length > 0 ? `${content}\n\n${metadata.join("\n")}\n` : `${content}\n`;
}
