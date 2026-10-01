import { DAILY_AIVORA_FAQ_CTA } from './dailySectionSanitizer.js';
import { parseAivoraSitemapUrls, sanitizeOpportunityAivoraLinks } from './opportunityAivoraLinkPolicy.js';
import { loadDailyFaqPrimarySource, selectDailyFaqPrimarySource } from './dailyStandaloneFaq.js';

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
    catalogUrl: '', topics: [], sourceText, sourceItems: selectedItems,
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
    if (topics.length === 0) return empty;
    const sourceItems = await loadDailyFaqPrimarySource(selectedItems, topics, { fetchImpl, timeoutMs });
    return { ...empty, catalogUrl: CATALOG_URL, topics, sourceItems, sourceText: sourceItems.join('\n') };
  } catch (error) {
    return { ...empty, error: error?.message || String(error) };
  }
}

export function formatDailyShopPromptContext(context) {
  if (!context?.catalogUrl || !context.topics?.length) return '';
  const source = selectDailyFaqPrimarySource(context.sourceItems, context.topics);
  return [
    '【已核实的主站商品目录，仅供相关问题选题】',
    `今天的资讯与当前 sitemap 中的这些公开商品类别有交集：${context.topics.join('、')}。`,
    `已核实的商品目录：${context.catalogUrl}。只允许引用这个目录 URL，不得猜测具体商品 URL。`,
    '目录只证明店内公开展示这些商品类别，不证明库存或新闻中的新功能属于任一套餐，也不证明官方价格、额度、地区或政策。',
    '如果正文中有同一工具的新闻，且输入里的原始来源能回答真实买家问题，优先写 1 条相关问题；先给有来源的直接答案，再自然提供一次目录入口。否则省略 FAQ 和主站链接。',
    source ? `【FAQ 专用官方原文；只有正文采用同一来源时才用于问答】\n${source.item}\n先核对末尾的开放范围。区分当前可用、受邀试用与未来开放；来源已写明的套餐或开放顺序必须准确回答，不得泛化为“官方未说明”。` : '',
  ].join('\n');
}

export function finalizeDailyShopFaq(markdown, context = {}) {
  const cleaned = sanitizeOpportunityAivoraLinks(
    String(markdown || '').replace(DAILY_AIVORA_FAQ_CTA, ''),
    { allowedUrls: [] },
    { maxLinks: 0 }
  ).markdown
    .replace(/https?:\/\/(?:www\.)?aivora\.cn(?:\/[^\s)<]*)?/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!context.catalogUrl || !context.topics?.length) return cleaned;

  const faq = cleaned.match(/^##[^\r\n]*(?:相关问题|FAQ)[^\r\n]*\r?\n[\s\S]*?(?=^##\s+|(?![\s\S]))/im);
  if (!faq) return cleaned;
  const article = cleaned.slice(0, faq.index) + cleaned.slice(faq.index + faq[0].length);
  const sourceLinks = [...faq[0].matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)]
    .map((match) => match[1]);
  const inputUrls = new Set([...String(context.sourceText || '').matchAll(/https?:\/\/[^\s)]+/g)]
    .map((match) => match[0]));
  const hasInputSource = sourceLinks.some((url) => inputUrls.has(url) && article.includes(url));
  const visibleFaq = faq[0].replace(/\]\(https?:\/\/[^)]+\)/g, ']');
  const visibleArticle = article.replace(/\]\(https?:\/\/[^)]+\)/g, ']');
  const faqQuestion = visibleFaq.match(/^###\s+([^\r\n]+)/m)?.[1] || '';
  const buyerQuestion = /(?:购买|选购|订阅|充值|账号|额度|套餐|付费|支付|代配置|售后)/i.test(faqQuestion);
  const hasSameTopic = context.topics.some((name) => {
    const topic = TOPICS.find((item) => item.name === name);
    return topic && topic.pattern.test(visibleFaq) && topic.pattern.test(visibleArticle);
  });
  if (!hasInputSource || !hasSameTopic || !buyerQuestion) {
    return cleaned.replace(faq[0], '').replace(/\n{3,}/g, '\n\n').trim();
  }

  const cta = `准备比较当前公开的账号、订阅或额度服务时，可查看 [**爱窝啦·AI账号店**](${context.catalogUrl}) 的商品目录；是否支持新闻中的新功能，以产品官方说明和商品页为准。`;
  return cleaned.replace(faq[0], `${faq[0].trimEnd()}\n\n${cta}\n`);
}
