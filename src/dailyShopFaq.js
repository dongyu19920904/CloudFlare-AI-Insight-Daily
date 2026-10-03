import { DAILY_AIVORA_FAQ_CTA } from './dailySectionSanitizer.js';
import { parseAivoraSitemapUrls } from './opportunityAivoraLinkPolicy.js';
import { stripHtml } from './helpers.js';
import { getDailyFaqTheme } from './dailyStandaloneFaq.js';

const SITEMAP_URL = 'https://www.aivora.cn/sitemap.xml';
const CATALOG_URL = 'https://www.aivora.cn/products';
const TOPICS = [
  { name: 'ChatGPT', pattern: /chatgpt/i, slug: /chatgpt/i },
  { name: 'Claude', pattern: /claude|anthropic/i, slug: /claude/i },
  { name: 'Cursor', pattern: /cursor/i, slug: /cursor/i },
  { name: 'Gemini', pattern: /gemini/i, slug: /gemini/i },
  { name: 'Codex', pattern: /codex/i, slug: /codex/i },
  { name: 'MiniMax', pattern: /minimax/i, slug: /minimax/i },
  { name: 'Grok', pattern: /grok/i, slug: /grok/i },
  { name: 'Perplexity', pattern: /perplexity/i, slug: /perplexity/i },
];

const FAQ_OFFICIAL_PAGES = {
  Claude: 'https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan',
  ChatGPT: 'https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus',
  Codex: 'https://developers.openai.com/codex/pricing/',
  Cursor: 'https://cursor.com/docs/account/pricing',
  Gemini: 'https://one.google.com/about/google-ai-plans/',
  Grok: 'https://x.ai/grok',
  Perplexity: 'https://www.perplexity.ai/pro',
};

function readableText(html) {
  return stripHtml(String(html || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ''));
}

function catalogProducts(html, urls) {
  const allowed = new Set(urls);
  return [...String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      try { return { url: new URL(match[1], CATALOG_URL).href, name: readableText(match[2]) }; }
      catch { return { url: '', name: '' }; }
    })
    .filter(({ url, name }) => name && url.startsWith(`${CATALOG_URL}/`) && allowed.has(url));
}

function extractCanonical(html) {
  const match = String(html || '').match(
    /<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>|<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i
  );
  return match?.[1] || match?.[2] || '';
}

async function fetchText(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function loadDailyShopContext(selectedItems, { fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  const sourceText = (selectedItems || []).join('\n');
  const visibleSourceText = sourceText.replace(/^Url:.*$/gmi, '');
  const candidateTopics = TOPICS.filter((topic) => topic.pattern.test(visibleSourceText));
  const empty = {
    catalogUrl: '', topics: [], sourceText,
    candidateTopics: candidateTopics.map((topic) => topic.name),
  };
  if (candidateTopics.length === 0) return empty;

  try {
    const [sitemapXml, catalogHtml] = await Promise.all([
      fetchText(fetchImpl, SITEMAP_URL, timeoutMs),
      fetchText(fetchImpl, CATALOG_URL, timeoutMs),
    ]);
    const urls = parseAivoraSitemapUrls(sitemapXml);
    if (!urls.includes(CATALOG_URL) || extractCanonical(catalogHtml) !== CATALOG_URL) return empty;

    const productPaths = urls
      .filter((url) => url.startsWith(`${CATALOG_URL}/`))
      .map((url) => new URL(url).pathname);
    const topics = candidateTopics
      .filter((topic) => productPaths.some((path) => topic.slug.test(path)))
      .map((topic) => topic.name);
    return {
      ...(topics.length > 0 ? { ...empty, catalogUrl: CATALOG_URL, topics } : empty),
      products: catalogProducts(catalogHtml, urls),
    };
  } catch (error) {
    return { ...empty, error: error?.message || String(error) };
  }
}

export function formatDailyShopPromptContext(context) {
  if (!context?.catalogUrl || !context.topics?.length) return '';
  return [
    '【已核实的主站商品目录，仅供相关问题选题】',
    `今天的资讯与当前 sitemap 中的这些公开商品类别有交集：${context.topics.join('、')}。`,
    `已核实的商品目录：${context.catalogUrl}。只允许引用这个目录 URL，不得猜测具体商品 URL。`,
    '目录只证明店内公开展示这些商品类别，不证明库存或新闻中的新功能属于任一套餐，也不证明官方价格、额度、地区或政策。',
    '如果正文中有同一工具的新闻，且输入里的原始来源能回答真实买家问题，优先写 1 条相关问题；先给有来源的直接答案，再自然提供一次目录入口。否则省略 FAQ 和主站链接。',
  ].join('\n');
}

export function finalizeDailyShopFaq(markdown, context = {}) {
  const content = String(markdown || '');
  const faq = content.match(/^##[^\r\n]*(?:相关问题|FAQ)[^\r\n]*\r?\n[\s\S]*?(?=^##\s+|(?![\s\S]))/im);
  if (!faq) return content;
  const article = content.slice(0, faq.index) + content.slice(faq.index + faq[0].length);
  const sourceLinks = [...faq[0].matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)]
    .map((match) => match[1]);
  const inputUrls = new Set([...String(context.sourceText || '').matchAll(/https?:\/\/[^\s)]+/g)]
    .map((match) => match[0]));
  const hasInputSource = sourceLinks.some((url) => inputUrls.has(url) && article.includes(url));
  const visibleFaq = faq[0].replace(/\]\(https?:\/\/[^)]+\)/g, ']');
  const visibleArticle = article.replace(/\]\(https?:\/\/[^)]+\)/g, ']');
  const faqQuestion = visibleFaq.match(/^###\s+([^\r\n]+)/m)?.[1] || '';
  const buyerQuestion = /(?:买|选购|会员|订阅|充值|账号|额度|套餐|付费|支付|代配置|售后)/i.test(faqQuestion);
  const hasSameTopic = (context.topics || []).some((name) => {
    const topic = TOPICS.find((item) => item.name === name);
    return topic && topic.pattern.test(visibleFaq) && topic.pattern.test(visibleArticle);
  });
  const allowShop = context.catalogUrl && hasInputSource && hasSameTopic && buyerQuestion;
  const allowedUrls = new Set(allowShop ? [context.catalogUrl, context.scene?.product?.url].filter(Boolean) : []);
  let kept = 0;
  const cleanedFaq = faq[0].replace(DAILY_AIVORA_FAQ_CTA, '')
    .replace(/准备比较当前公开的账号、订阅或额度服务时[^\n]*/g, '')
    .replace(/\[([^\]]+)\]\((https?:\/\/(?:www\.)?aivora\.cn[^\s)]*)\)/gi, (_full, label, url) => {
      if (!allowedUrls.has(url) || kept >= 1) return label.replace(/爱窝啦\s*Aivora/g, '爱窝啦·AI账号店');
      kept += 1;
      const normalizedLabel = label.replace(/\*\*/g, '').replace(/爱窝啦\s*Aivora/g, '爱窝啦·AI账号店');
      return `[${normalizedLabel.includes('爱窝啦·AI账号店') ? normalizedLabel : '爱窝啦·AI账号店'}](${url})`;
    })
    .replace(/(?<!\]\()https?:\/\/(?:www\.)?aivora\.cn[^\s)<]*/gi, '')
    .replace(/\n{3,}/g, '\n\n');
  return content.slice(0, faq.index) + cleanedFaq + content.slice(faq.index + faq[0].length);
}

// Enrich only the optional FAQ, after the news body has passed publication checks.
export async function loadDailyFaqSceneContext(markdown, selectedItems, context = {}, { fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  const namedTopics = TOPICS.filter((topic) =>
    context.candidateTopics?.includes(topic.name) &&
    (context.products || []).some(({ name }) => topic.pattern.test(name)))
    .map((topic) => topic.name);
  if (namedTopics.length) context = {
    ...context, catalogUrl: context.catalogUrl || CATALOG_URL,
    topics: [...new Set([...(context.topics || []), ...namedTopics])],
  };
  if (!context.catalogUrl || !context.topics?.length) return context;
  const candidates = (selectedItems || []).flatMap((item) => {
    const text = String(item);
    const url = text.match(/^Url:\s*(https?:\/\/\S+)/im)?.[1];
    if (!url || !markdown.includes(url)) return [];
    const visible = text.replace(/^Url:.*$/gmi, '');
    return TOPICS.filter((topic) => context.topics.includes(topic.name) && topic.pattern.test(visible))
      .map((topic) => ({ topic: topic.name, sourceUrl: url, sourceText: text,
        score: (/skill|技能|工作流|编程|写代码/i.test(visible) ? 10 : 0) + (/Claude Code/i.test(visible) ? 5 : 0),
      }));
  });
  const recent = context.recentFaqs || [];
  const chosen = candidates.filter((candidate) => !recent.some((item) =>
    item.sourceUrls?.includes(candidate.sourceUrl) ||
    (item.topic?.toLowerCase() === candidate.topic.toLowerCase() && item.theme &&
      item.theme === getDailyFaqTheme(candidate.sourceText))))
    .sort((a, b) => b.score - a.score)[0];
  if (!chosen) return context;
  const topicRule = TOPICS.find((topic) => topic.name === chosen.topic);
  const product = (context.products || [])
    .filter(({ name }) => topicRule.pattern.test(name) && !/中转|额度|激活|换号|Free|接码|邀请|API|镜像/i.test(name))
    .sort((a, b) => Number(/Pro.*充值|Plus.*充值|续费/.test(b.name)) - Number(/Pro.*充值|Plus.*充值|续费/.test(a.name)))[0];
  let verifiedProduct = null;
  let official = null;
  if (product) {
    try {
      const html = await fetchText(fetchImpl, product.url, timeoutMs);
      const title = readableText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
      if (extractCanonical(html) === product.url && topicRule.pattern.test(title)) verifiedProduct = { ...product, name: title };
    } catch { /* A failed product check must not block the news or invent a SKU. */ }
  }
  const officialUrl = FAQ_OFFICIAL_PAGES[chosen.topic];
  if (officialUrl) {
    try {
      const html = await fetchText(fetchImpl, officialUrl, timeoutMs);
      const text = readableText(html);
      const start = text.search(/With Pro and Max plans|What is ChatGPT Plus\?|What is Claude Code\?|Choose your plan|Codex Pricing/i);
      official = { url: officialUrl, text: text.slice(Math.max(0, start), Math.max(0, start) + 2500) };
    } catch { /* Without official evidence the FAQ cannot assert plan entitlements. */ }
  }
  return { ...context, scene: { ...chosen, product: verifiedProduct, official } };
}
