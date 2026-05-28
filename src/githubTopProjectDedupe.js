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
  const recentKeys = new Set(
    pruneRecentGithubTopProjects(recentRecords, currentDate, lookbackDays)
      .filter((record) => record.date !== currentDate)
      .map((record) => record.urlKey)
  );

  const filteredItems = [];
  let filteredCount = 0;

  for (const item of projects || []) {
    const urlKey = normalizeGithubProjectUrl(item?.url);
    if (urlKey && recentKeys.has(urlKey)) {
      filteredCount += 1;
      continue;
    }
    filteredItems.push(item);
  }

  return { filteredItems, filteredCount };
}

function extractTopSection(markdown) {
  const content = String(markdown || "");
  const headingMatch = content.match(/^##\s*\*\*.*TOP.*\*\*/im);
  if (!headingMatch || headingMatch.index == null) return "";

  const startIndex = headingMatch.index;
  const remaining = content.slice(startIndex + headingMatch[0].length);
  const nextHeadingMatch = remaining.match(/\n##\s+/);
  const endIndex = nextHeadingMatch
    ? startIndex + headingMatch[0].length + nextHeadingMatch.index
    : content.length;

  return content.slice(startIndex, endIndex);
}

export function extractGithubTopProjectsFromMarkdown(markdown, dateStr) {
  const topSection = extractTopSection(markdown);
  if (!topSection) return [];

  const items = [];
  const seen = new Set();
  const itemRegex = /^###\s+\d+\.\s+\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gm;

  for (const match of topSection.matchAll(itemRegex)) {
    const title = match[1]?.trim() || "";
    const url = match[2]?.trim() || "";
    const urlKey = normalizeGithubProjectUrl(url);
    if (!urlKey || seen.has(urlKey)) continue;
    seen.add(urlKey);
    items.push({ date: dateStr, title, url, urlKey });
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
