import { extractDailyMarkdownLinks } from "./dailyMarkdownItems.js";

export const RECENT_GITHUB_TOP_PROJECTS_KEY = "daily-top-github-projects:recent";
export const DEFAULT_GITHUB_TOP_PROJECT_LOOKBACK_DAYS = 7;

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

export function normalizeGithubProjectUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(String(url).trim());
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname !== "github.com") return "";

    const parts = parsed.pathname
      .replace(/\.git$/i, "")
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length < 2) return "";

    return `github.com/${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
  } catch {
    return "";
  }
}

export function isGithubProjectUrl(url) {
  return Boolean(normalizeGithubProjectUrl(url));
}

const GITHUB_PROJECT_FAMILY_STOP_WORDS = new Set([
  "ai",
  "artificial",
  "intelligence",
  "generative",
  "genai",
  "llm",
  "gpt",
  "mcp",
  "agent",
  "agents",
  "tool",
  "tools",
  "project",
  "projects",
  "framework",
  "for",
  "with",
  "the",
  "of",
  "and",
]);

function getGithubProjectFamily(urlOrKey) {
  const urlKey = String(urlOrKey || "").startsWith("github.com/")
    ? String(urlOrKey).toLowerCase()
    : normalizeGithubProjectUrl(urlOrKey);
  const [, owner = "", repo = ""] = urlKey.split("/");
  if (!owner || !repo) return "";

  const tokens = repo
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((token) => (token === "beginner" ? "beginners" : token))
    .filter((token) => !GITHUB_PROJECT_FAMILY_STOP_WORDS.has(token));

  return tokens.length > 0 ? `${owner}/${tokens.join("-")}` : "";
}

export function pruneRecentGithubTopProjects(
  records = [],
  currentDate,
  lookbackDays = DEFAULT_GITHUB_TOP_PROJECT_LOOKBACK_DAYS
) {
  const days = Math.max(1, Number.parseInt(lookbackDays, 10) || DEFAULT_GITHUB_TOP_PROJECT_LOOKBACK_DAYS);
  return (Array.isArray(records) ? records : [])
    .map((record) => ({
      ...record,
      urlKey: record?.urlKey || normalizeGithubProjectUrl(record?.url),
    }))
    .filter((record) => {
      if (!record?.date || !record?.urlKey) return false;
      const diff = dayDiff(currentDate, record.date);
      return diff >= 0 && diff <= days;
    });
}

export function filterGithubProjectsAgainstRecentTop(projects = [], recentRecords = [], currentDate, lookbackDays = DEFAULT_GITHUB_TOP_PROJECT_LOOKBACK_DAYS) {
  const previousRecords = pruneRecentGithubTopProjects(recentRecords, currentDate, lookbackDays)
    .filter((record) => record.date !== currentDate);
  const recentKeys = new Set(previousRecords.map((record) => record.urlKey));
  const recentFamilies = new Set(
    previousRecords.map((record) => getGithubProjectFamily(record.urlKey)).filter(Boolean)
  );

  const filteredItems = [];
  let filteredCount = 0;
  let filteredExactCount = 0;
  let filteredFamilyCount = 0;

  for (const item of projects || []) {
    const urlKey = normalizeGithubProjectUrl(item?.url);
    if (urlKey && recentKeys.has(urlKey)) {
      filteredCount += 1;
      filteredExactCount += 1;
      continue;
    }
    const family = getGithubProjectFamily(urlKey);
    if (family && recentFamilies.has(family)) {
      filteredCount += 1;
      filteredFamilyCount += 1;
      continue;
    }
    filteredItems.push(item);
  }

  return { filteredItems, filteredCount, filteredExactCount, filteredFamilyCount };
}

function extractGithubRankingSections(markdown) {
  const content = String(markdown || "");
  const headings = [...content.matchAll(/^##\s+([^\r\n]+)$/gm)];

  return headings
    .map((heading, index) => {
      const startIndex = heading.index ?? 0;
      const endIndex = headings[index + 1]?.index ?? content.length;
      const headingText = String(heading[1] || "").replace(/\*/g, "");
      return { headingText, section: content.slice(startIndex, endIndex) };
    })
    .filter(({ headingText }) => /(?:今日焦点|重磅\s*TOP|开源\s*TOP)/i.test(headingText))
    .map(({ section }) => section);
}

export function extractGithubTopProjectsFromMarkdown(markdown, dateStr) {
  const rankingSections = extractGithubRankingSections(markdown);
  if (rankingSections.length === 0) return [];

  const items = [];
  const seen = new Set();

  for (const section of rankingSections) {
    for (const link of extractDailyMarkdownLinks(section)) {
      const urlKey = normalizeGithubProjectUrl(link.url);
      if (!urlKey || seen.has(urlKey)) continue;
      seen.add(urlKey);
      items.push({ date: dateStr, title: link.title?.trim() || "", url: link.url, urlKey });
    }
  }

  return items;
}

export function mergeRecentGithubTopProjects(existingRecords = [], newRecords = [], currentDate, lookbackDays = DEFAULT_GITHUB_TOP_PROJECT_LOOKBACK_DAYS) {
  const mergedByKey = new Map();
  for (const record of [
    ...pruneRecentGithubTopProjects(existingRecords, currentDate, lookbackDays),
    ...pruneRecentGithubTopProjects(newRecords, currentDate, lookbackDays),
  ]) {
    if (!record?.urlKey) continue;
    mergedByKey.set(`${record.date}:${record.urlKey}`, record);
  }
  return [...mergedByKey.values()].sort((left, right) =>
    String(right.date || "").localeCompare(String(left.date || ""))
  );
}

export async function loadRecentGithubTopProjects(kvNamespace) {
  if (!kvNamespace) return [];
  try {
    const raw = await kvNamespace.get(RECENT_GITHUB_TOP_PROJECTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`[GitHubTopDedupe] Failed to load recent projects: ${error.message}`);
    return [];
  }
}

export async function storeRecentGithubTopProjects(kvNamespace, records, ttlSeconds = 86400 * 9) {
  if (!kvNamespace) return;
  await kvNamespace.put(RECENT_GITHUB_TOP_PROJECTS_KEY, JSON.stringify(records || []), {
    expirationTtl: ttlSeconds,
  });
}
