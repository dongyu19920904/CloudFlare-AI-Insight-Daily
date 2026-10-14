import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { handleScheduledDaily } from '../artifacts/scheduled-dry-run.mjs';
import { withWorkerConfigDefaults } from '../src/workerConfig.js';
import { extractGithubTopProjectsFromMarkdown, RECENT_GITHUB_TOP_PROJECTS_KEY } from '../src/githubTopProjectDedupe.js';

const date = process.env.TARGET_DATE;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('TARGET_DATE required');
const dir = 'artifacts/grounding-preview';
await mkdir(dir, { recursive: true });
const originalFetch = globalThis.fetch;
const response = await originalFetch(`https://cloudflare-ai-lnsight-daily.sabrinamisan090.workers.dev/getContent?date=${date}`, { signal: AbortSignal.timeout(45000) });
if (!response.ok) throw new Error(`Source cache: HTTP ${response.status}`);
const data = await response.json();
const vars = withWorkerConfigDefaults(JSON.parse(await readFile('artifacts/worker-vars.json', 'utf8')));
// Reproduce production's recent-project exclusions instead of previewing with an empty KV.
const recentProjects = [];
for (let offset = 1; offset <= 7; offset++) {
  const previous = new Date(`${date}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - offset);
  const day = previous.toISOString().slice(0, 10);
  const history = await originalFetch(`https://raw.githubusercontent.com/dongyu19920904/Hextra-AI-Insight-Daily/main/daily/${day}.md`, { signal: AbortSignal.timeout(15000) });
  if (history.status === 404) continue;
  if (!history.ok) throw new Error(`Recent project history ${day}: HTTP ${history.status}`);
  recentProjects.push(...extractGithubTopProjectsFromMarkdown(await history.text(), day));
}
let modelCalls = 0;
globalThis.fetch = async (url, options = {}) => {
  const method = String(options.method || 'GET').toUpperCase();
  const target = new URL(typeof url === 'string' ? url : url.url || url.href);
  if (method !== 'GET' && method !== 'HEAD') {
    if (method !== 'POST' || target.origin !== new URL(vars.ANTHROPIC_API_URL).origin) throw new Error(`Dry-run blocked write: ${method} ${target.hostname}`);
    modelCalls++;
    const body = JSON.parse(options.body);
    // Model request content is public source data; never save request headers or keys.
    await writeFile(`${dir}/model-input-${modelCalls}.json`, JSON.stringify(body, null, 2));
  }
  return originalFetch(url, options);
};
const env = { ...vars, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, ANTHROPIC_BACKUP_API_KEY: process.env.ANTHROPIC_API_KEY,
  DATA_KV: {
    async get(key) {
      if (key === RECENT_GITHUB_TOP_PROJECTS_KEY) return JSON.stringify(recentProjects);
      if (key.startsWith(`${date}-`)) {
        const category = key.slice(date.length + 1);
        if (Array.isArray(data[category])) return JSON.stringify(data[category]);
      }
      return null;
    },
    async put() { throw new Error('Dry-run blocked KV write'); },
  },
};
let debug;
try {
  debug = await handleScheduledDaily({}, env, { waitUntil() {} }, date, { dryRun: true, preferCachedData: true });
} finally { globalThis.fetch = originalFetch; }
await writeFile(`${dir}/preview.md`, debug.dailyPreviewMarkdown || '');
await writeFile(`${dir}/report.json`, JSON.stringify({ published: false, modelCalls, debug }, null, 2));
console.log(JSON.stringify({ published: false, modelCalls, wouldPublish: debug.dailyWouldPublish,
  grounding: debug.dailyArticleGrounding, issues: debug.dailyValidationIssues }, null, 2));
if (!debug.dailyWouldPublish) throw new Error('Full daily dry-run did not pass existing validation');
if (/Meta.{0,30}音乐|Muse.{0,30}音乐生成/.test(debug.dailyPreviewMarkdown || '')) throw new Error('Meta category regression');
if (/HN[^。\n]{0,50}(?:点赞|评论|点数|热度)|Hacker News[^。\n]{0,50}(?:点赞|评论|点数|热度)/i.test(debug.dailyPreviewMarkdown || '')) throw new Error('Discussion metadata leaked into the news');
