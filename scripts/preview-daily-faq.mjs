import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { withWorkerConfigDefaults } from '../src/workerConfig.js';
import { buildDailyPromptSelection } from '../src/dailyPromptSelection.js';
import { callChatAPI } from '../src/chatapi.js';
import { removeMarkdownCodeBlock } from '../src/helpers.js';
import {
  expandDailyFaqSourceItems, buildStandaloneDailyFaqPromptInput,
  normalizeStandaloneDailyFaqSection, insertStandaloneDailyFaq,
} from '../src/dailyStandaloneFaq.js';
import { loadDailyShopContext, finalizeDailyShopFaq } from '../src/dailyShopFaq.js';
import { getDailyReportContent } from '../src/github.js';
import { RECENT_GITHUB_TOP_PROJECTS_KEY, extractGithubTopProjectsFromMarkdown } from '../src/githubTopProjectDedupe.js';

// Wrangler resolves the project's historical extensionless imports; Node needs the same rule for this preview.
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(/^\.{1,2}\//.test(specifier) && !path.extname(specifier) ? `${specifier}.js` : specifier, context);
} });
const { handleScheduledDaily } = await import('../src/handlers/scheduled.js');
const { dataSources } = await import('../src/dataFetchers.js');

const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('Specify YYYY-MM-DD');
if (!process.env.AI_PROVIDER_API_KEY || !process.env.GITHUB_TOKEN) throw new Error('Preview credentials are missing');
const output = path.resolve(process.argv[3] || 'artifacts/daily-faq-preview');
await mkdir(output, { recursive: true });
const vars = Object.fromEntries([...((await readFile('wrangler.toml', 'utf8')).matchAll(
  /^([A-Z][A-Z0-9_]*)\s*=\s*"([^"]*)"/gm
))].map((match) => [match[1], match[2]]));
const env = withWorkerConfigDefaults({ ...vars,
  ANTHROPIC_API_KEY: process.env.AI_PROVIDER_API_KEY,
  ANTHROPIC_BACKUP_API_KEY: process.env.AI_PROVIDER_API_KEY,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
});
const emit = console.log.bind(console);
console.log = console.warn = console.error = () => {};
const response = await fetch(`https://cloudflare-ai-lnsight-daily.sabrinamisan090.workers.dev/getContent?date=${date}`, {
  signal: AbortSignal.timeout(45000),
});
if (!response.ok) throw new Error(`Cached sources returned ${response.status}`);
const payload = await response.json();
const data = Object.fromEntries(Object.keys(dataSources).map((key) => [key, payload[key] || []]));
if (!Object.values(data).some((items) => items.length)) throw new Error('No cached daily sources');
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
env.DATA_KV = {
  get: async (key) => memory.get(key) || null,
  put: async (key, value) => { memory.set(key, value); },
};
const baseline = await getDailyReportContent(env, `daily/${date}.md`);
if (!baseline) throw new Error('Published baseline is missing');
const withoutFaq = baseline.replace(/^##[^\r\n]*(?:相关问题|FAQ)[^\r\n]*\r?\n[\s\S]*?(?=^##\s+|(?![\s\S]))/im, '').trim();
const selection = buildDailyPromptSelection(data, env);
const sources = expandDailyFaqSourceItems(selection.selectedContentItems, data);
const context = await loadDailyShopContext(sources);
const input = buildStandaloneDailyFaqPromptInput(date, withoutFaq, context.sourceItems, context);
if (!input) throw new Error('No matching official buyer FAQ source');
await writeFile(path.join(output, 'faq-source.txt'), input.sourceText, 'utf8');
emit('Generating FAQ with the revised prompt and actual cached official source.');
const raw = await callChatAPI({ ...env, ANTHROPIC_MAX_TOKENS: '700' }, input.prompt,
  '你是 AI 日报的事实核查编辑。只根据给定的一手来源写一条简短相关问题，不编造价格、额度、可用性或商店承诺。');
const faq = normalizeStandaloneDailyFaqSection(removeMarkdownCodeBlock(raw), input.sourceUrl, input.sourceText, input.topic);
await writeFile(path.join(output, 'faq-raw.md'), raw, 'utf8');
if (!faq) throw new Error('Generated FAQ failed existing validation');
const pilot = finalizeDailyShopFaq(insertStandaloneDailyFaq(withoutFaq, faq), context);
await writeFile(path.join(output, 'faq-pilot.md'), pilot, 'utf8');
emit(faq);
emit('Generating a complete daily dry-run from this branch; KV writes stay in memory.');
const debug = await handleScheduledDaily({}, env, {}, date, { dryRun: true,
  onProgress: async (progress) => emit(JSON.stringify(progress)),
});
await writeFile(path.join(output, 'daily-preview.md'), debug.dailyPreviewMarkdown || '', 'utf8');
await writeFile(path.join(output, 'result.json'), JSON.stringify(debug, null, 2), 'utf8');
emit(JSON.stringify({ dailyWouldPublish: debug.dailyWouldPublish, dailyPublished: debug.dailyPublished,
  validationIssues: debug.dailyValidationIssues, catalogVerified: debug.dailyShopCatalogVerified,
  faqInserted: debug.dailyFaqSeparateGenerationInserted, model: env.DEFAULT_ANTHROPIC_MODEL,
  cloudflareKvWrites: 0, published: false }));
if (!debug.dailyWouldPublish) process.exitCode = 1;
