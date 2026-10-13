import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { enrichDailySourceMedia } from '../src/dailySourceMedia.js';
import { archiveDailyTelegramImages, extractTelegramDailyImageCandidate } from '../src/dailyTelegramImageArchive.js';
import { validateDailyPublication } from '../src/publishValidation.js';

const date = process.env.TARGET_DATE;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('TARGET_DATE required');
const out = 'artifacts/media-only';
await mkdir(out, {recursive:true});
async function get(url) {
  const response = await fetch(url, {signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response;
}
const original = await (await get(`https://raw.githubusercontent.com/dongyu19920904/Hextra-AI-Insight-Daily/main/content/cn/${date.slice(0,7)}/${date}.md`)).text();
const data = await (await get(`https://cloudflare-ai-lnsight-daily.sabrinamisan090.workers.dev/getContent?date=${date}`)).json();
const media = await enrichDailySourceMedia(original, data, {GITHUB_TOKEN:process.env.GITHUB_TOKEN});
const uploads = [];
const archived = await archiveDailyTelegramImages(media.markdown, Object.values(data).filter(Array.isArray).flat().map(extractTelegramDailyImageCandidate).filter(Boolean), date, {}, {
  getFileSha: async () => null,
  putFile: async (_env,path,_method,payload) => {
    const relative = path.replace(/^\/contents\//,'');
    if (!relative.startsWith(`static/images/daily/${date}/`)) throw new Error('Unexpected image output');
    await mkdir(`${out}/${relative.slice(0,relative.lastIndexOf('/'))}`,{recursive:true});
    await writeFile(`${out}/${relative}`,Buffer.from(payload.content,'base64'));
    uploads.push(relative);
  },
});
const stripMedia = (text) => text.replace(/!\[[^\]]*\]\([^\n]+\)\s*/g,'').replace(/\r\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
const sameProse = stripMedia(original) === stripMedia(archived.markdown);
const summary = original.match(/^##[^\r\n]*今日摘要[^\r\n]*\r?\n([\s\S]*?)(?=^##\s+)/m)?.[1]?.trim();
const validation = validateDailyPublication({summaryText:summary,pageMarkdown:archived.markdown});
const report = {date, published:false, modelCalls:0, sameProse,
  beforeHash:createHash('sha256').update(stripMedia(original)).digest('hex'),
  afterHash:createHash('sha256').update(stripMedia(archived.markdown)).digest('hex'),
  inserted:media.insertedCount, requestCount:media.requestCount, rows:media.rows,
  telegramImages:archived.archivedCount, uploads, validation};
await writeFile(`${out}/preview.md`,archived.markdown);
await writeFile(`${out}/before.md`,original);
await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if (!sameProse || !validation.ok || !media.insertedCount) throw new Error('Media-only preview failed');
