import { stripHtml } from './helpers.js';
import { dailyMediaSourceKey } from './dailySourceMedia.js';

function plain(value) {
  return stripHtml(String(value || '').replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, ''))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
}

export function isDiscussionMetadataOnly(item) {
  const text = plain(item?.details?.content_html || item?.description);
  return /^Article URL:\s*https?:\/\/\S+\s+Comments URL:\s*https?:\/\/\S+\s+Points:\s*[\d,]+\s+# Comments:\s*[\d,]+\s*$/i.test(text);
}

function attrs(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map(m => [m[1].toLowerCase(), plain(m[2] ?? m[3])]));
}

export function extractDailyArticleEvidence(html, url) {
  const clean = String(html || '').replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const tags = [...clean.matchAll(/<(?:meta|link)\b[^>]*>/gi)].map(m => attrs(m[0]));
  const canonical = tags.find(t => /\bcanonical\b/i.test(t.rel || ''))?.href;
  if (canonical && dailyMediaSourceKey(new URL(canonical, url).href) !== dailyMediaSourceKey(url)) return null;
  const title = plain(clean.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    || tags.find(t => t.property === 'og:title')?.content || clean.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const region = clean.match(/<article\b[^>]*>[\s\S]*?<\/article>/i)?.[0]
    || clean.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] || '';
  const paragraphs = [...region.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => plain(m[1])).filter(p => p.length >= 45 && !/^(?:cookie|all rights reserved|sign up|subscribe)/i.test(p));
  const description = tags.find(t => t.name?.toLowerCase() === 'description')?.content
    || tags.find(t => t.property === 'og:description')?.content || '';
  const excerpt = (paragraphs.length ? paragraphs.slice(0, 6).join('\n') : plain(description)).slice(0, 3000);
  if (!title || excerpt.length < 80) return null;
  return { url, title: title.slice(0, 240), excerpt, kind: paragraphs.length ? 'article-excerpt' : 'page-description' };
}

function publicHttps(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')
    || !host.includes('.') || /(?:^|\.)(?:localhost|local|internal|invalid|test)$/.test(host)
    || /^\d+(?:\.\d+){3}$|:/.test(host)) throw new Error('non-public-article-url');
  return url.href;
}

async function readArticle(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('empty-article-response');
  let size = 0;
  let text = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.length;
      if (size > 512000) throw new Error('article-response-too-large');
      text += decoder.decode(value, { stream: true });
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function groundDailyNewsSources(data, preferredPromptItems = [], dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), dependencies.deadlineMs ?? 12000);
  const preferred = new Set(preferredPromptItems.map(p => /^Url:\s*(\S+)/im.exec(p)?.[1]));
  const thin = (data.news || []).filter(isDiscussionMetadataOnly);
  const targets = [...thin].sort((a, b) => Number(preferred.has(b.url)) - Number(preferred.has(a.url))).slice(0, 6);
  const verified = new Map();
  const rows = [];
  let requests = 0;
  let cursor = 0;
  async function process(item) {
    const row = { url: item.url, status: 'unavailable' };
    rows.push(row);
    try {
      let url = publicHttps(item.url);
      for (let hop = 0; hop <= 2; hop++) {
        if (requests >= 10 || controller.signal.aborted) throw new Error('article-budget');
        requests++;
        const response = await fetchImpl(url, { redirect: 'manual',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(4000)]),
          headers: { Accept: 'text/html', 'User-Agent': 'AivoraDaily/1.0 (+https://news.aivora.cn/)' } });
        if (response.status >= 300 && response.status < 400) {
          const next = new URL(response.headers.get('location'), url).href;
          await response.body?.cancel();
          // Tracking removal and www changes are fine; another article is not evidence.
          if (dailyMediaSourceKey(next) !== dailyMediaSourceKey(item.url)) throw new Error('article-redirect-mismatch');
          url = publicHttps(next);
          continue;
        }
        if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) {
          await response.body?.cancel();
          throw new Error(`article-http-${response.status}`);
        }
        const evidence = extractDailyArticleEvidence(await readArticle(response), item.url);
        if (!evidence) throw new Error('no-article-evidence');
        verified.set(item, { ...item, details: { ...item.details, articleEvidence: evidence } });
        row.status = 'grounded'; row.title = evidence.title; row.kind = evidence.kind;
        return;
      }
      throw new Error('article-redirect-limit');
    } catch (error) { row.reason = error.message; }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(3, targets.length) }, async () => {
      while (cursor < targets.length && !controller.signal.aborted) await process(targets[cursor++]);
    }));
    const news = (data.news || []).filter(item => !isDiscussionMetadataOnly(item) || verified.has(item))
      .map(item => verified.get(item) || item);
    return { data: { ...data, news }, rows, requests, grounded: verified.size, replaced: thin.length - verified.size };
  } finally { clearTimeout(timer); }
}
