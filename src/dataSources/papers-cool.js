import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { escapeHtml, getFetchDate, stripHtml } from '../helpers.js';
import { getArxivPaperId, selectDailyPaperCandidates } from '../dailyPaperPolicy.js';

export const PAPERS_COOL_FEED = 'https://papers.cool/arxiv/cs.AI/feed';
const MAX_BYTES = 1024 * 1024;
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
const text = value => typeof value === 'string' ? value : value?.['#text'] || '';

export function parsePapersCoolAtom(xml, date = getFetchDate()) {
  if (new TextEncoder().encode(xml).length > MAX_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('unsafe-or-oversize-atom');
  if (XMLValidator.validate(xml) !== true) throw new Error('invalid-atom-xml');
  const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true,
    parseTagValue: false, parseAttributeValue: false }).parse(xml);
  if (!parsed.feed || !/http:\/\/www\.w3\.org\/2005\/Atom/.test(xml.slice(0, 1000))) throw new Error('not-atom-feed');
  const end = Math.min(Date.now(), Date.parse(`${date}T23:59:59+08:00`));
  const items = list(parsed.feed.entry).flatMap(entry => {
    const link = list(entry.link).find(link => !link['@_rel'] || link['@_rel'] === 'alternate');
    const id = getArxivPaperId(link?.['@_href']) || getArxivPaperId(text(entry.id));
    const title = stripHtml(text(entry.title)).trim();
    const description = stripHtml(text(entry.summary)).trim();
    const published = text(entry.published) || text(entry.updated);
    const time = Date.parse(published);
    if (!id || !title || description.length < 80 || !Number.isFinite(time) || time > end || end - time > 7 * 86400000) return [];
    return [{ id, type: 'paper', title, description, published_date: new Date(time).toISOString(),
      url: `https://arxiv.org/abs/${id}`, authors: list(entry.author).map(author => text(author.name)).filter(Boolean).join(', '),
      source: 'arXiv via papers.cool', details: {
        discoveryUrl: `https://papers.cool/arxiv/${id}`, sourceKind: 'papers-cool-atom',
        content_html: `<p>${escapeHtml(description)}</p>`,
      } }];
  });
  return selectDailyPaperCandidates(items, 8);
}

async function readBounded(response) {
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('oversize-atom');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, result = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return result + decoder.decode();
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('oversize-atom');
      result += decoder.decode(value, { stream: true });
    }
  } finally { await reader.cancel().catch(() => {}); }
}

const PapersCoolDataSource = {
  type: 'papers-cool',
  async fetch() {
    const date = getFetchDate();
    const controller = new AbortController();
    let timer;
    try {
      const items = await Promise.race([
        (async () => {
          const response = await fetch(PAPERS_COOL_FEED, { headers: { Accept: 'application/atom+xml',
            'User-Agent': 'Aivora-AI-Daily-Worker/1.0' }, signal: controller.signal, redirect: 'error' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return parsePapersCoolAtom(await readBounded(response), date);
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('papers-cool-timeout')); }, 5000); }),
      ]);
      return { items };
    } catch (error) {
      console.warn(`[papers-cool] Optional source skipped: ${error.message}`);
      return { items: [] };
    } finally { clearTimeout(timer); controller.abort(); }
  },
  transform(rawData) { return rawData?.items || []; },
  generateHtml(item) {
    return `<strong>${escapeHtml(item.title)}</strong><br>
      <small>${escapeHtml(item.source)} | ${escapeHtml(item.published_date)}</small>
      <div class="content-html">${escapeHtml(item.description)}</div>
      <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">阅读原论文</a>`;
  },
};

export default PapersCoolDataSource;
