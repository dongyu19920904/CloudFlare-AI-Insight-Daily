const COMMON_REPO_NAME_TOKENS = new Set([
  "github",
  "openai",
  "anthropic",
  "claude",
  "chatgpt",
  "google",
  "microsoft",
  "cursor",
  "model",
  "models",
  "agent",
  "agents",
  "tool",
  "tools",
  "server",
  "client",
  "demo",
  "docs",
  "daily",
  "news",
  "release",
  "launch",
  "coding",
  "project",
  "projects",
]);

function stripRepoPart(value) {
  return String(value || "")
    .trim()
    .replace(/^["'`<([{]+/, "")
    .replace(/[>"'`)\]}.,;:!?]+$/, "")
    .replace(/\.git$/i, "");
}

function normalizeOwnerRepo(owner, repo) {
  const ownerToken = stripRepoPart(owner).toLowerCase();
  const repoToken = stripRepoPart(repo).toLowerCase();

  if (!ownerToken || !repoToken) return "";
  if (!/^[a-z0-9-]{1,80}$/.test(ownerToken)) return "";
  if (!/^[a-z0-9._-]{1,120}$/.test(repoToken)) return "";

  return `${ownerToken}/${repoToken}`;
}

export function collectGithubRepoKeysFromText(text) {
  const value = String(text || "");
  const repoKeys = new Set();

  const githubUrlRegex = /https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]{1,80})\/([A-Za-z0-9._-]{1,120})/gi;
  for (const match of value.matchAll(githubUrlRegex)) {
    const repoKey = normalizeOwnerRepo(match[1], match[2]);
    if (repoKey) repoKeys.add(repoKey);
  }

  const withoutUrls = value.replace(/https?:\/\/\S+/g, " ");
  const bareRepoRegex = /\b([A-Za-z0-9-]{1,80})\/([A-Za-z0-9._-]{1,120})\b/g;
  for (const match of withoutUrls.matchAll(bareRepoRegex)) {
    const repoKey = normalizeOwnerRepo(match[1], match[2]);
    if (repoKey) repoKeys.add(repoKey);
  }

  return repoKeys;
}

function normalizeRepoNameToken(value) {
  const token = stripRepoPart(value).toLowerCase();
  if (!token || token.length < 4 || token.length > 120) return "";
  if (!/[a-z]/.test(token)) return "";
  if (!/^[a-z0-9._-]+$/.test(token)) return "";
  if (COMMON_REPO_NAME_TOKENS.has(token)) return "";
  return token;
}

function repoNameFromKey(repoKey) {
  const [, repoName] = String(repoKey || "").split("/");
  return normalizeRepoNameToken(repoName);
}

function collectStrongTitleRepoTokens(title) {
  const tokens = new Set();
  const value = String(title || "").toLowerCase();
  const prefixMatch = value.match(/^\s*([a-z0-9][a-z0-9._-]{3,119})\s*[:\uFF1A|/-]/);

  if (prefixMatch) {
    const prefixToken = normalizeRepoNameToken(prefixMatch[1]);
    if (prefixToken) tokens.add(prefixToken);
  }

  for (const match of value.match(/[a-z0-9][a-z0-9._-]{3,119}/g) || []) {
    if (!/[._-]/.test(match)) continue;
    const token = normalizeRepoNameToken(match);
    if (token) tokens.add(token);
  }

  return tokens;
}

export function collectProjectReplaySignals(previousTopItems = []) {
  const repoKeys = new Set();
  const repoNames = new Set();

  for (const item of previousTopItems || []) {
    const text = `${item?.url || ""}\n${item?.title || ""}`;

    for (const repoKey of collectGithubRepoKeysFromText(text)) {
      repoKeys.add(repoKey);
      const repoName = repoNameFromKey(repoKey);
      if (repoName) repoNames.add(repoName);
    }

    for (const token of collectStrongTitleRepoTokens(item?.title)) {
      repoNames.add(token);
    }
  }

  return { repoKeys, repoNames };
}

export function getGithubRepoKeyFromProjectItem(item) {
  const details = item?.details || {};
  const text = [
    item?.url,
    item?.title,
    item?.description,
    details.url,
    details.repo,
    details.repository,
    details.repositoryUrl,
    details.full_name,
    details.html_url,
  ]
    .filter(Boolean)
    .join("\n");

  const repoKeys = collectGithubRepoKeysFromText(text);
  return repoKeys.values().next().value || "";
}

export function filterGithubProjectsAgainstPreviousTop(projectItems = [], previousTopItems = []) {
  const items = Array.isArray(projectItems) ? projectItems : [];
  const { repoKeys, repoNames } = collectProjectReplaySignals(previousTopItems);

  if (items.length === 0 || (repoKeys.size === 0 && repoNames.size === 0)) {
    return {
      filteredItems: items,
      filteredCount: 0,
      filteredRepos: [],
      replayRepoCount: repoKeys.size,
      replayRepoNameCount: repoNames.size,
    };
  }

  const filteredItems = [];
  const filteredRepos = [];

  for (const item of items) {
    const repoKey = getGithubRepoKeyFromProjectItem(item);
    const repoName = repoNameFromKey(repoKey);
    const duplicateByRepo = repoKey && repoKeys.has(repoKey);
    const duplicateByRepoName = repoName && repoNames.has(repoName);

    if (duplicateByRepo || duplicateByRepoName) {
      filteredRepos.push(repoKey || repoName);
      continue;
    }

    filteredItems.push(item);
  }

  return {
    filteredItems,
    filteredCount: filteredRepos.length,
    filteredRepos,
    replayRepoCount: repoKeys.size,
    replayRepoNameCount: repoNames.size,
  };
}
