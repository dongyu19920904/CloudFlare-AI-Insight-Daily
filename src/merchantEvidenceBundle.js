// Only these known public origins may be fetched. Never follow source redirects.
export const MERCHANT_OFFICIAL_SOURCES = [
  { platform: 'chatgpt', url: 'https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus', title: 'ChatGPT Plus 套餐与限制' },
  { platform: 'chatgpt', url: 'https://help.openai.com/en/articles/9039756', title: 'ChatGPT 与 API 的计费区别' },
  { platform: 'claude', url: 'https://support.claude.com/en/articles/8325606-what-is-the-pro-plan', title: 'Claude Pro 套餐说明' },
  { platform: 'ai-coding', url: 'https://cursor.com/pricing', title: 'Cursor 套餐与购买边界' },
  { platform: 'claude', url: 'https://support.claude.com/en/articles/11049741-what-is-the-max-plan', title: 'Claude Max 套餐说明' },
  { platform: 'claude', url: 'https://support.claude.com/en/articles/12138966-release-notes', title: 'Claude 官方更新记录' },
];
const PUBLIC_HOSTS = new Set(['help.openai.com', 'support.claude.com', 'cursor.com', 'supply.aivora.cn', 'www.aivora.cn', 'wzyp.cn']);
export const EDITORIAL_VERSION = 'merchant-evidence-editor-v1';
export const EDITORIAL_MEMORY_KEY = 'merchant-editorial-memory-v1';

export async function evidenceHash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function fetchMerchantEvidence(url, { fetchImpl = fetch, maxBytes = 800_000, timeoutMs = 8000 } = {}) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.username || target.password || target.port || !PUBLIC_HOSTS.has(target.hostname)) throw new Error('evidence_origin_not_allowed');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(target.href, { redirect: 'manual', signal: controller.signal, headers: { Accept: 'text/html,application/json', 'User-Agent': 'Aivora-Merchant-Evidence/1.0' } });
    if (!response.ok) throw new Error(`evidence_http_${response.status}`);
    if (!/text\/html|application\/(?:json|ld\+json)/i.test(response.headers.get('content-type') || '')) throw new Error('evidence_content_type');
    if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('evidence_size');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('evidence_body_missing');
    const chunks = []; let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        total += value.byteLength;
        if (total > maxBytes) throw new Error('evidence_size');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return new TextDecoder().decode(bytes);
  } finally { clearTimeout(timer); }
}

export function articleText(html) {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  return article.replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#(?:39|x27);/gi, "'").replace(/\s+/g, ' ').replace(/Updated:\s*(?:today|yesterday|\d+\s+(?:hours?|days?|weeks?|months?)\s+ago)/gi, '').trim().slice(0, 9000);
}

// A 200 page is not stock evidence. Only matching structured merchant statements qualify.
export function originalOfferEvidence(html, offer) {
  const products = [];
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    if ([node['@type']].flat().includes('Product')) products.push(node);
    if (node['@graph']) visit(node['@graph']);
  };
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* Invalid structured data stays unknown. */ }
  }
  for (const product of products) {
    if (String(product.name || '').normalize('NFKC').trim() !== String(offer.originalName).normalize('NFKC').trim()) continue;
    for (const item of [product.offers].flat().filter(Boolean)) {
      if (!/^https?:\/\/schema\.org\/InStock$/.test(item.availability || '')) continue;
      if (!(Number(item.price) > 0) || Number(item.price) !== Number(offer.price) || item.priceCurrency !== offer.currency) continue;
      return { status: 'merchant_statement_matched', price: Number(item.price), currency: item.priceCurrency, name: product.name };
    }
  }
  return null;
}

export async function loadMerchantOfficialEvidence({ fetchImpl = fetch, now = new Date(), sources = MERCHANT_OFFICIAL_SOURCES } = {}) {
  return Promise.all(sources.slice(0, 6).map(async (source) => {
    try {
      const text = articleText(await fetchMerchantEvidence(source.url, { fetchImpl }));
      if (text.length < 160 || /just a moment|verify you are human|access denied/i.test(text.slice(0, 300))) throw new Error('evidence_unreadable');
      return { ...source, kind: 'official', text, observedAt: now.toISOString(), occurredAt: null, contentHash: await evidenceHash([source.url, text]), fetchStatus: 'ok' };
    } catch { return { ...source, fetchStatus: 'unknown', text: '', observedAt: now.toISOString() }; }
  }));
}

export async function buildMerchantEvidenceBundle({ dateStr, snapshot, official = [], memory = [] }) {
  const products = (snapshot.products || []).filter((product) => ['chatgpt', 'claude', 'gemini', 'grok', 'ai-coding', 'ai-creative'].includes(product.categoryId));
  const evidence = [];
  for (const record of official.filter((item) => item.fetchStatus === 'ok' && products.some((product) => product.categoryId === item.platform))) {
    evidence.push({ ...record, id: `E${evidence.length + 1}` });
  }
  for (const product of products.filter((item) => item.sourceOffers?.length).slice(0, 6)) {
    const offers = product.sourceOffers.slice(0, 6);
    const fact = { name: product.name, offers, coverage: product.sourceCoverage, originalPagesVerified: offers.filter((item) => item.originalPageStatus === 'merchant_statement_matched').length };
    evidence.push({ id: `E${evidence.length + 1}`, kind: 'aggregate', platform: product.categoryId, title: `${product.name} 报价观察`, url: product.productUrl, observedAt: snapshot.generatedAt, occurredAt: null, text: JSON.stringify(fact), contentHash: await evidenceHash([product.slug, offers.map(({ sourceObservedAt, originalPageCheckedAt, ...offer }) => offer)]) });
  }
  const recent = memory.filter((item) => item.date < dateStr && Date.parse(`${dateStr}T00:00:00Z`) - Date.parse(`${item.date}T00:00:00Z`) <= 30 * 86400000);
  const used = new Set(recent.flatMap((item) => item.evidenceHashes || []));
  const newEvidenceIds = evidence.filter((item) => !used.has(item.contentHash)).map((item) => item.id);
  const evidenceKey = await evidenceHash([EDITORIAL_VERSION, evidence.map((item) => [item.url, item.contentHash])]);
  return { version: EDITORIAL_VERSION, date: dateStr, evidenceKey, evidence, newEvidenceIds,
    historyAvailable: Boolean(snapshot.signals?.some((item) => ['price_drop', 'price_rise', 'stockout', 'restock'].includes(item.kind))),
    sourceGeneratedAt: snapshot.generatedAt, sourceObservedAt: snapshot.latestObservedAt,
    demandEvidence: [], customerRecords: null,
    products: products.slice(0, 40).map((p) => ({ slug: p.slug, name: p.name, platform: p.categoryId, url: p.productUrl, calculatorUrl: `https://supply.aivora.cn/profit-calculator?product=${encodeURIComponent(p.name)}` })),
    usedFactKeys: recent.flatMap((item) => item.factKeys || []),
    recentTopics: recent.map((item) => ({ date: item.date, title: item.title, summary: item.summary })).slice(-30) };
}

// A focused issue needs related evidence, not unrelated pages padded to meet a count.
export function focusMerchantEvidence(bundle) {
  const platforms = ['chatgpt', 'claude', 'gemini', 'grok', 'ai-coding', 'ai-creative'];
  const eligible = platforms.filter((key) => {
    const items = bundle.evidence.filter((item) => item.platform === key);
    return items.length >= 2 && items.some((item) => item.kind === 'official') && items.some((item) => bundle.newEvidenceIds.includes(item.id));
  });
  const platform = eligible.find((key) => bundle.evidence.filter((item) => item.platform === key && item.kind === 'official').length >= 2) || eligible[0];
  if (!platform) return { ...bundle, evidence: [], newEvidenceIds: [] };
  const evidence = bundle.evidence.filter((item) => item.platform === platform);
  return { ...bundle, evidence, newEvidenceIds: bundle.newEvidenceIds.filter((id) => evidence.some((item) => item.id === id)), products: bundle.products.filter((item) => item.platform === platform) };
}
