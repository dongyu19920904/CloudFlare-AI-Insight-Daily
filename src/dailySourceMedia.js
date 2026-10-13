import { normalizeMarkdownMediaUrl } from './helpers.js';
import { extractDailyMarkdownLinks } from './dailyMarkdownItems.js';
import { countUsableDailyMedia, ensureDailyMediaCoverage } from './dailyMediaCoverage.js';
import { isUsableDailyMediaUrl } from './dailySectionSanitizer.js';

const BLOCKS = /^###\s+[^\r\n]+(?:\r?\n|$)[\s\S]*?(?=^###\s+|^##\s+|(?![\s\S]))/gm;

export function dailyMediaSourceKey(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^twitter\.com$/, 'x.com');
    for (const key of [...url.searchParams.keys()]) if (/^(?:utm_|entry$|fbclid$)/i.test(key)) url.searchParams.delete(key);
    url.pathname = url.pathname.replace(/\/$/, '');
    return url.href;
  } catch { return ''; }
}

function publicUrl(value, base) {
  try {
    const url = new URL(normalizeMarkdownMediaUrl(value), base);
    url.hostname = url.hostname.replace(/\.$/, '');
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
        !url.hostname.includes('.') || /(?:^|\.)(?:localhost|local|internal|invalid|test)$/.test(url.hostname) ||
        /^\d+(?:\.\d+){3}$|:/.test(url.hostname)) return '';
    return url.href;
  } catch { return ''; }
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
    .map((match) => [match[1].toLowerCase(), normalizeMarkdownMediaUrl(match[2] ?? match[3] ?? match[4])]));
}

function usefulImage(value, base, alt = '') {
  let url = publicUrl(value, base);
  if (!url || !isUsableDailyMediaUrl(url) || /badge|shield|sponsor|avatar|favicon|tracking|pixel|loading|default[-_]og|site[-_]logo/i.test(`${url} ${alt}`) ||
      /(?:^|\/)(?:logo|icon)[^/]*\.(?:svg|png|webp)/i.test(new URL(url).pathname)) return '';
  const github = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)$/);
  if (github) url = `https://raw.githubusercontent.com/${github[1]}/${github[2]}`;
  return url;
}

export function extractSourcePageImages(html, pageUrl, { readme = false } = {}) {
  const original = String(html || '');
  const clean = original.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const result = [];
  const add = (raw, origin, alt = '') => {
    const url = usefulImage(raw, pageUrl, alt);
    if (url && !result.some((item) => item.url === url)) result.push({ url, origin });
  };
  const region = readme ? clean : clean.match(/<article\b[^>]*>[\s\S]*?<\/article>/i)?.[0] ||
    clean.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] || '';
  // Only article/README media: never take the first image from an arbitrary page sidebar.
  for (const match of region.matchAll(readme
    ? /<img\b[^>]*>|<video\b[^>]*>|!\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/gi
    : /<img\b[^>]*>|<video\b[^>]*>/gi)) {
    if (match[2]) { add(match[2], 'readme', match[1]); continue; }
    const attrs = attributes(match[0]);
    if ((attrs.width && Number(attrs.width) < 160) || (attrs.height && Number(attrs.height) < 90)) continue;
    if (/avatar|logo|sponsor|related|recommend|most.read/i.test(`${attrs.class || ''} ${attrs.alt || ''}`)) continue;
    const srcset = attrs['data-srcset'] || attrs.srcset || '';
    const srcsetUrl = srcset.split(',').map((item) => item.trim().split(/\s+/))
      .filter((item) => /^(?:[6-9]\d\d|1[0-4]\d\d)w$/.test(item[1] || ''))[0]?.[0];
    add(attrs['data-src'] || attrs['data-original'] || attrs.poster || srcsetUrl || attrs.src,
      readme ? 'readme' : attrs.poster ? 'video-poster' : 'article', attrs.alt);
  }
  if (!readme) {
    for (const match of clean.matchAll(/<meta\b[^>]*>/gi)) {
      const attrs = attributes(match[0]);
      if (/^(?:og:image(?::secure_url)?|twitter:image(?::src)?)$/i.test(attrs.property || attrs.name || '')) add(attrs.content, 'article-cover');
    }
  }
  return result.sort((a, b) => Number(a.origin === 'video-poster') - Number(b.origin === 'video-poster')).slice(0, 5);
}

async function boundedText(response, maxBytes = 768000) {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('source-response-too-large');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw new Error('source-response-too-large');
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function enrichDailySourceMedia(markdown, allUnifiedData, env = {}, dependencies = {}) {
  const content = String(markdown || '');
  const fetchImpl = dependencies.fetchImpl || fetch;
  const deadlineMs = dependencies.deadlineMs ?? 20000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  let requestCount = 0;
  const rows = [];
  const candidates = [];
  const bySource = new Map(Object.values(allUnifiedData || {}).flat().filter(Boolean)
    .map((item) => [dailyMediaSourceKey(item.url), item]));
  const targets = [];
  for (const match of content.matchAll(BLOCKS)) {
    const section = content.slice(0, match.index).match(/^##\s+[^\r\n]+$/gm)?.at(-1) || '';
    if (/(?:相关问题|FAQ)/i.test(section) || /!\[|<(?:img|video)\b/i.test(match[0])) continue;
    const links = extractDailyMarkdownLinks(match[0]);
    const link = links.find((item) => bySource.has(dailyMediaSourceKey(item.url))) ||
      links.find((item) => /^https:\/\/github\.com\/[^/]+\/[^/?#]+\/?$/.test(item.url));
    if (!link) continue;
    targets.push({ link, item: bySource.get(dailyMediaSourceKey(link.url)),
      title: match[0].match(/^###\s+(?:\d+\.\s*)?([^\r\n]+)/)?.[1] || '原文配图' });
  }
  async function request(value, headers = {}) {
    let url = publicUrl(value);
    if (!url) throw new Error('non-public-source-url');
    for (let redirects = 0; redirects <= 2; redirects += 1) {
      if (controller.signal.aborted) throw new Error('media-deadline');
      if (requestCount >= 18) throw new Error('media-request-budget');
      requestCount += 1;
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]);
      const response = await fetchImpl(url, { signal, redirect: 'manual', headers: {
        'User-Agent': 'AivoraDaily/1.0 (+https://news.aivora.cn/)', ...headers,
      } });
      if (response.status >= 300 && response.status < 400) {
        const next = publicUrl(response.headers.get('location'), url);
        await response.body?.cancel();
        if (!next) throw new Error('unsafe-media-redirect');
        // A read-only GitHub token must never be forwarded to another origin.
        if (new URL(next).origin !== new URL(url).origin) delete headers.Authorization;
        url = next;
        continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new Error(`media-http-${response.status}`); }
      return response;
    }
    throw new Error('too-many-media-redirects');
  }
  async function imageWorks(url) {
    const response = await request(url, { Range: 'bytes=0-255' });
    try {
      if (!/^image\/(?:jpeg|png|webp|gif|avif)(?:;|$)/i.test(response.headers.get('content-type') || '')) return false;
      const reader = response.body?.getReader();
      if (!reader) return false;
      try {
        const { value } = await reader.read();
        return Boolean(value?.length >= 4 && (
          value[0] === 0xff && value[1] === 0xd8 ||
          value[0] === 0x89 && value[1] === 0x50 ||
          String.fromCharCode(...value.slice(0, 4)) === 'RIFF' ||
          String.fromCharCode(...value.slice(0, 3)) === 'GIF' ||
          String.fromCharCode(...value.slice(4, 8)) === 'ftyp'));
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    } finally { if (!response.body?.locked) await response.body?.cancel().catch(() => {}); }
  }
  let cursor = 0;
  let pageCount = 0;
  async function processTarget(target) {
    const { link, item, title } = target;
    const row = { sourceUrl: link.url, title, status: 'no-verified-image' };
    rows.push(row);
    try {
      let images = extractSourcePageImages(item?.details?.content_html || '', link.url, { readme: true })
        .map((image) => ({ ...image, origin: 'cached-post' }));
      if (!images.length) {
        if (/^https:\/\/(?:x\.com|twitter\.com|t\.me)\//i.test(link.url)) { row.status = 'no-cached-stable-media'; return; }
        if (pageCount >= 8) { row.status = 'media-page-budget'; return; }
        pageCount += 1;
        const repo = link.url.match(/^https:\/\/github\.com\/([^/]+\/[^/?#]+)\/?$/);
        if (repo) {
          const headers = { Accept: 'application/vnd.github+json' };
          if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
          const response = await request(`https://api.github.com/repos/${repo[1]}/readme`, headers);
          const readme = JSON.parse(await boundedText(response));
          const text = new TextDecoder().decode(Uint8Array.from(atob(String(readme.content || '').replace(/\s/g, '')), (char) => char.charCodeAt(0)));
          if (!readme.download_url?.startsWith(`https://raw.githubusercontent.com/${repo[1]}/`)) throw new Error('unverified-readme-base');
          images = extractSourcePageImages(text, readme.download_url, { readme: true });
        } else {
          const response = await request(link.url);
          if (!/text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('source-not-html');
          const html = await boundedText(response);
          const canonical = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => attributes(match[0]))
            .find((attrs) => /\bcanonical\b/i.test(attrs.rel || ''))?.href;
          if (canonical && dailyMediaSourceKey(new URL(canonical, link.url).href) !== dailyMediaSourceKey(link.url)) throw new Error('source-canonical-mismatch');
          images = extractSourcePageImages(html, link.url);
        }
      }
      for (const image of images.slice(0, 2)) {
        try {
          if (!await imageWorks(image.url)) continue;
          const caption = `${title.replace(/[\[\]"'\r\n]+/g, ' ').slice(0, 45)} · ${image.origin === 'readme' ? 'README 展示图' : image.origin === 'article-cover' ? '原文封面' : '原文配图'}`;
          candidates.push({ url: link.url, title: caption, placeholders: [`![${caption}](${image.url} "${caption}")`] });
          row.status = 'verified'; row.imageUrl = image.url; row.origin = image.origin;
          return;
        } catch (error) { row.reason = error.message; }
      }
    } catch (error) { row.status = 'skipped'; row.reason = error.message; }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(3, targets.length) }, async () => {
      while (cursor < targets.length && !controller.signal.aborted) await processTarget(targets[cursor++]);
    }));
    const covered = ensureDailyMediaCoverage(content, candidates, Number.MAX_SAFE_INTEGER, { coverEverySource: true });
    return { ...covered, requestCount, pageCount, rows, candidates };
  } finally { clearTimeout(timer); }
}
