import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { loadDailyShopContext, loadDailyFaqSceneContext, finalizeDailyShopFaq } from '../src/dailyShopFaq.js';
import { buildStandaloneDailyFaqPromptInput, normalizeStandaloneDailyFaqSection,
  insertStandaloneDailyFaq, withDailyFaqDeadline, getStandaloneDailyFaqSystemPrompt } from '../src/dailyStandaloneFaq.js';
import { callChatAPI, callChatAPIStream } from '../src/chatapi.js';
import { validateDailyPublication } from '../src/publishValidation.js';
import { removeMarkdownCodeBlock } from '../src/helpers.js';

const date = process.env.TARGET_DATE;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('TARGET_DATE must be YYYY-MM-DD');
if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required');
const outputDir = process.env.FAQ_OUTPUT_DIR || 'artifacts/faq-only';
await mkdir(outputDir, { recursive: true });
const response = await fetch(`https://raw.githubusercontent.com/dongyu19920904/Hextra-AI-Insight-Daily/main/content/cn/${date.slice(0, 7)}/${date}.md`, {
  signal: AbortSignal.timeout(15000),
});
if (!response.ok) throw new Error(`Published article unavailable (${response.status})`);
const published = await response.text();
const faqPattern = /^##[^\r\n]*(?:相关问题|FAQ)[^\r\n]*\r?\n[\s\S]*?(?=^##\s+|(?![\s\S]))/im;
const withoutFaq = (text) => text.replace(faqPattern, '');
const news = withoutFaq(published);
const sourceItems = [...news.matchAll(/^###\s+([^\r\n]+)\r?\n([\s\S]*?)(?=^#{1,3}\s+|(?![\s\S]))/gm)]
  .flatMap((match) => {
    const url = [...match[2].matchAll(/(?<!!)\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g)]
      .map((link) => link[1]).find((link) => !/aivora\.cn|img\.|pbs\.twimg/.test(link));
    return url ? [`${url.startsWith('https://github.com/') ? 'Project Name' : 'News Title'}: ${match[1]}\nUrl: ${url}\nPublished daily context: ${match[2]}`] : [];
  });
// The preview uses already-reviewed published news, not newly invented source records.
const dailyShopContext = await loadDailyShopContext(sourceItems);
const config = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
const env = Object.fromEntries([...config.matchAll(/^([A-Z][A-Z0-9_]+)\s*=\s*"([^"\r\n]*)"/gm)].map((match) => [match[1], match[2]]));
env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
env.ANTHROPIC_BACKUP_API_KEY = process.env.ANTHROPIC_API_KEY;
const summary = news.match(/^##[^\r\n]*今日摘要[^\r\n]*\r?\n([\s\S]*?)(?=^##\s+)/m)?.[1]?.trim();
if (!summary) throw new Error('Published summary missing');
const validateGeneratedDaily = (summaryText, pageMarkdown) => validateDailyPublication({ summaryText, pageMarkdown });
const originalValidation = validateGeneratedDaily(summary, published);
if (!originalValidation.ok) throw new Error(`Published baseline failed validation: ${originalValidation.issues.join('; ')}`);
const scheduled = await readFile(new URL('../src/handlers/scheduled.js', import.meta.url), 'utf8');
const transportStart = scheduled.indexOf('async function generateContentWithTransportFallback(');
const transportEnd = scheduled.indexOf('\nfunction getStandaloneDailyFunSystemPrompt', transportStart);
const start = scheduled.indexOf('    if (validation.ok) {', scheduled.indexOf('const funStatsBeforeStandaloneGeneration'));
const end = scheduled.indexOf('    dailySummaryMarkdownContent = normalizeMarkdownImageSyntax', start);
if (transportStart < 0 || transportEnd < 0 || start < 0 || end < 0) throw new Error('Optional runtime boundary changed; update preview explicitly');
let modelCalls = 0;
let promptInput;
let sceneEvidence;
let rawDraft;
const run = vm.runInNewContext(`(async function(markdown, env, dateStr, faqSourceItems, dailyShopContext, outputOfCall3) {
  let dailySummaryMarkdownContent = markdown; let validation = {ok:true}; const debugInfo = {}; const options = {dryRun:true};
  ${scheduled.slice(transportStart, transportEnd)}
  ${scheduled.slice(start, end)}
  return {markdown:dailySummaryMarkdownContent, debug:debugInfo, validation};
})`, {
  console, callChatAPI,
  loadDailyFaqSceneContext: async (...args) => {
    sceneEvidence = await loadDailyFaqSceneContext(...args);
    return sceneEvidence;
  },
  buildStandaloneDailyFaqPromptInput: (...args) => {
    promptInput = buildStandaloneDailyFaqPromptInput(...args);
    return promptInput;
  },
  normalizeStandaloneDailyFaqSection: (...args) => {
    rawDraft = args[0];
    return normalizeStandaloneDailyFaqSection(...args);
  },
  withDailyFaqDeadline, getStandaloneDailyFaqSystemPrompt, removeMarkdownCodeBlock,
  insertStandaloneDailyFaq, finalizeDailyShopFaq, validateGeneratedDaily,
  callChatAPIStream: async function* (...args) {
    modelCalls += 1;
    yield* callChatAPIStream(...args);
  },
});
const result = await run(published, env, date, sourceItems, dailyShopContext, summary);
const section = result.markdown.match(faqPattern)?.[0]?.trim() || '';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const report = {
  date, mode: 'faq-only', baseline: response.url, published: false,
  inserted: Boolean(result.debug.dailyFaqSeparateGenerationInserted),
  newsByteIdentical: withoutFaq(published) === withoutFaq(result.markdown),
  newsHashBefore: hash(withoutFaq(published)), newsHashAfter: hash(withoutFaq(result.markdown)),
  modelCalls, sourceCount: sourceItems.length,
  scene: sceneEvidence?.scene, debug: result.debug, validation: result.validation,
  mainSiteLinks: (section.match(/\]\(https:\/\/www\.aivora\.cn[^)]+\)/g) || []).length,
};
await writeFile(`${outputDir}/faq-preview.md`, section + '\n');
await writeFile(`${outputDir}/daily-with-faq-preview.md`, result.markdown);
await writeFile(`${outputDir}/report.json`, JSON.stringify(report, null, 2));
await writeFile(`${outputDir}/prompt.txt`, promptInput?.prompt || '');
await writeFile(`${outputDir}/raw-draft.md`, rawDraft || result.debug.dailyFaqRejectedDraft || '');
console.log(JSON.stringify({ ...report, scene: report.scene ? {
  topic: report.scene.topic, sourceUrl: report.scene.sourceUrl,
  product: report.scene.product, officialUrl: report.scene.official?.url,
} : null }, null, 2));
console.log('--- FAQ-ONLY PREVIEW ---\n' + section);
if (!report.inserted || !report.newsByteIdentical || report.mainSiteLinks !== 1 || !report.validation.ok) {
  throw new Error('FAQ preview did not satisfy the acceptance checks; publication was not attempted');
}
