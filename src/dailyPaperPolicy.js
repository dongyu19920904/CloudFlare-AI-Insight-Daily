import { getFromKV, storeInKV } from './kv.js';

export const RECENT_DAILY_PAPERS_KEY = 'daily-papers:published:recent';

export function requiredDailyResearchItems(promptItems = [], reservedCount = 0) {
  const hasExistingPaperSource = promptItems.some(item => /^Papers Title:/m.test(item)
    && !/^Source: arXiv via papers\.cool$/m.test(item));
  return hasExistingPaperSource ? Math.min(reservedCount, 1) : 0;
}

export function getArxivPaperId(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let path = decodeURIComponent(url.pathname).replace(/\/$/, '');
    if (host === 'arxiv.org' || host === 'export.arxiv.org') path = path.replace(/^\/(?:abs|pdf|html)\//, '');
    else if (host === 'papers.cool') path = path.replace(/^\/arxiv\//, '');
    else if (host === 'huggingface.co') path = path.replace(/^\/papers\//, '');
    else return '';
    return path.match(/^(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?(?:\.pdf)?$/i)?.[1]?.toLowerCase() || '';
  } catch { return ''; }
}

export function dailyPaperTopic(item) {
  const text = `${item.title || ''} ${item.description || ''}`;
  if (/inference|quantiz|compression|latency|efficien|cache|推理成本|量化/i.test(text)) return 'efficiency';
  if (/coding|software|program|agent|编程|智能体/i.test(text)) return 'coding-agents';
  if (/multimodal|vision|video|audio|speech|多模态|视频|语音/i.test(text)) return 'multimodal';
  if (/benchmark|evaluat|hallucinat|reproduc|评测|幻觉|复现/i.test(text)) return 'evaluation';
  return 'other';
}

export function dailyPaperScore(item) {
  const text = `${item.title || ''} ${item.description || ''}`;
  return (dailyPaperTopic(item) !== 'other' ? 4 : 0)
    + (/benchmark|evaluat|experiment|baseline|dataset|实验|评测/i.test(text) ? 2 : 0)
    + (/code|reproduc|open.source|开源|复现/i.test(text) ? 1 : 0);
}

export function selectDailyPaperCandidates(items = [], limit = 8) {
  const seen = new Set();
  const ranked = [...items].sort((a, b) => dailyPaperScore(b) - dailyPaperScore(a)
    || Date.parse(b.published_date) - Date.parse(a.published_date));
  const unique = ranked.filter(item => {
    const id = getArxivPaperId(item.url);
    const key = id || String(item.title || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const topics = new Set();
  const diverse = [];
  for (const item of unique) {
    const topic = dailyPaperTopic(item);
    if (!topics.has(topic)) { topics.add(topic); diverse.push(item); }
  }
  return [...diverse, ...unique.filter(item => !diverse.includes(item))].slice(0, limit);
}

function recentRecords(records, date) {
  const today = Date.parse(`${date}T00:00:00Z`);
  return (Array.isArray(records) ? records : []).filter(row => {
    const age = (today - Date.parse(`${row.date}T00:00:00Z`)) / 86400000;
    return /^\d{4}\.\d{4,5}$/.test(row.paperId || '') && age >= 0 && age <= 7;
  });
}

export function filterRecentlyPublishedPapers(items, records, date) {
  const ids = new Set(recentRecords(records, date).filter(row => row.date !== date).map(row => row.paperId));
  return items.filter(item => !ids.has(getArxivPaperId(item.url)));
}

export async function loadPublishedDailyPapers(kv) {
  if (!kv) return [];
  try { return await getFromKV(kv, RECENT_DAILY_PAPERS_KEY) || []; }
  catch (error) { console.warn(`[DailyPapers] History read skipped: ${error.message}`); return []; }
}

export function extractPublishedDailyPapers(markdown, date) {
  const ids = new Set();
  for (const match of String(markdown || '').matchAll(/https?:\/\/[^\s<>"')]+/g)) {
    const id = getArxivPaperId(match[0]);
    if (id) ids.add(id);
  }
  return [...ids].map(paperId => ({ paperId, date }));
}

export async function rememberPublishedDailyPapers(kv, date, markdown) {
  if (!kv) return;
  const added = extractPublishedDailyPapers(markdown, date);
  if (!added.length) return;
  try {
    const records = recentRecords([...(await loadPublishedDailyPapers(kv)), ...added], date);
    const deduped = [...new Map(records.map(row => [`${row.date}:${row.paperId}`, row])).values()];
    await storeInKV(kv, RECENT_DAILY_PAPERS_KEY, deduped.slice(-100), 86400 * 8);
  } catch (error) { console.warn(`[DailyPapers] History write skipped: ${error.message}`); }
}
