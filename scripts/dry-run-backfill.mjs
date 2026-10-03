import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { withWorkerConfigDefaults } from '../src/workerConfig.js';
import { getDailyReportContent } from '../src/github.js';
import { RECENT_GITHUB_TOP_PROJECTS_KEY, extractGithubTopProjectsFromMarkdown } from '../src/githubTopProjectDedupe.js';

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(/^\.{1,2}\//.test(specifier) && !path.extname(specifier) ? `${specifier}.js` : specifier, context);
} });
const { handleScheduledDaily } = await import('../src/handlers/scheduled.js');
const { dataSources } = await import('../src/dataFetchers.js');
const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('Specify YYYY-MM-DD');
if (!process.env.AI_PROVIDER_API_KEY || !process.env.GITHUB_TOKEN) throw new Error('Credentials missing');
const output = path.resolve(process.argv[3]);
await mkdir(output, { recursive: true });
const vars = Object.fromEntries([...((await readFile('wrangler.toml', 'utf8')).matchAll(
  /^([A-Z][A-Z0-9_]*)\s*=\s*"([^"]*)"/gm
))].map((m) => [m[1], m[2]]));
const env = withWorkerConfigDefaults({ ...vars,
  ANTHROPIC_API_KEY: process.env.AI_PROVIDER_API_KEY,
  ANTHROPIC_BACKUP_API_KEY: process.env.AI_PROVIDER_API_KEY,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  DAILY_ANTHROPIC_MAX_TOKENS: '8192',
});
const emit = console.log.bind(console);
console.log = console.warn = console.error = () => {};
const response = await fetch(`https://cloudflare-ai-lnsight-daily.sabrinamisan090.workers.dev/getContent?date=${date}`, {
  signal: AbortSignal.timeout(45000),
});
if (!response.ok) throw new Error(`Source cache returned ${response.status}`);
const payload = await response.json();
const data = Object.fromEntries(Object.keys(dataSources).map((key) => [key, payload[key] || []]));
if (!Object.values(data).some((items) => items.length)) throw new Error('Source cache empty');
await writeFile(path.join(output, 'source-payload.json'), JSON.stringify(data), 'utf8');
const memory = new Map(Object.entries(data).map(([key, value]) => [`${date}-${key}`, JSON.stringify(value)]));
const projects = [];
for (let offset = 1; offset <= 7; offset++) {
  const previous = new Date(`${date}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - offset);
  const previousDate = previous.toISOString().slice(0, 10);
  const markdown = await getDailyReportContent(env, `daily/${previousDate}.md`);
  if (markdown) projects.push(...extractGithubTopProjectsFromMarkdown(markdown, previousDate));
}
memory.set(RECENT_GITHUB_TOP_PROJECTS_KEY, JSON.stringify(projects));
env.DATA_KV = { get: async (key) => memory.get(key) || null, put: async (key, value) => { memory.set(key, value); } };
emit('Dry-run: restored September 30 runtime, current cached sources, per-run 8192 budget; no Worker deploy or publication.');
const debug = await handleScheduledDaily({}, env, {}, date, {
  dryRun: true, onProgress: async (progress) => emit(JSON.stringify(progress)),
});
await writeFile(path.join(output, 'daily-preview.md'), debug.dailyPreviewMarkdown || '', 'utf8');
await writeFile(path.join(output, 'result.json'), JSON.stringify(debug, null, 2), 'utf8');
emit(JSON.stringify({ dailyWouldPublish: debug.dailyWouldPublish, dailyPublished: debug.dailyPublished,
  issues: debug.dailyValidationIssues, allocation: debug.dailyPromptAllocation, fun: debug.dailyFunSectionPresent,
  perRunBudget: debug.dailyBodyAnthropicMaxTokens, cloudflareKvWrites: 0 }));
if (!debug.dailyWouldPublish) process.exitCode = 1;
