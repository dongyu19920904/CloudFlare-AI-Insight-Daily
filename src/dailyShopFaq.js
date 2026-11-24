import { DAILY_AIVORA_FAQ_CTA } from './dailySectionSanitizer.js';
import { parseAivoraSitemapUrls } from './opportunityAivoraLinkPolicy.js';
import { stripHtml } from './helpers.js';
import { DAILY_FAQ_SECTION, getDailyFaqTheme, matchesDailyFaqTopic, isDailyFaqPrimarySource, isRepeatedDailyFaq, insertStandaloneDailyFaq } from './dailyStandaloneFaq.js';
import { extractDailyMarkdownLinks } from './dailyMarkdownItems.js';
import { dailyMediaSourceKey } from './dailySourceMedia.js';

const SITEMAP_URL = 'https://www.aivora.cn/sitemap.xml';
const CATALOG_URL = 'https://www.aivora.cn/products';
const PUBLIC_PRODUCTS_URL = 'https://www.aivora.cn/api/v1/public/products?page=1&page_size=50';
const DICTATION_HELP = 'https://help.openai.com/en/articles/12168547-voice-dictation-faq';
const FLOW_CREDITS_HELP = 'https://support.google.com/googleone/answer/16287445?hl=zh-Hans';
const MAX_OFFER_CHECKS = 3;
const ANTIGRAVITY = /antigravity|反重力/i;
const DICTATION_RENEWAL_PATH = /^https:\/\/www\.aivora\.cn\/products\/chatgpt-plus-[a-z0-9-]*renewal[a-z0-9-]*$/i;
const TOPICS = [
  { name: 'ChatGPT', pattern: /chatgpt/i, slug: /chatgpt/i },
  { name: 'Claude', pattern: /claude|anthropic/i, slug: /claude/i },
  { name: 'Cursor', pattern: /cursor/i, slug: /cursor/i },
  { name: 'Gemini', pattern: /gemini|antigravity|反重力/i, slug: /gemini/i },
  { name: 'Codex', pattern: /codex/i, slug: /codex/i },
  { name: 'MiniMax', pattern: /minimax/i, slug: /minimax/i },
  { name: 'Grok', pattern: /grok/i, slug: /grok/i },
  { name: 'Perplexity', pattern: /perplexity/i, slug: /perplexity/i },
];

const FAQ_OFFICIAL_PAGES = {
  Claude: 'https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan',
  ChatGPT: 'https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus',
  Codex: 'https://learn.chatgpt.com/docs/pricing',
  Cursor: 'https://cursor.com/docs/account/pricing',
  Gemini: 'https://one.google.com/about/google-ai-plans/',
  Grok: 'https://x.ai/grok',
  Perplexity: 'https://www.perplexity.ai/pro',
};

function readableText(html) {
  return stripHtml(String(html || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ''));
}

function sourceUrlKeys(text) {
  return [...String(text || '').matchAll(/https?:\/\/[^\s)]+/g)]
    .map(match => dailyMediaSourceKey(match[0])).filter(Boolean);
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

async function loadFaqReference(url, fetchImpl, timeoutMs) {
  if (!url) return null;
  try {
    const html = await fetchText(fetchImpl, url, timeoutMs);
    const body = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ||
      html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || html;
    const text = readableText(body.replace(/<(nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, ''));
    const start = Math.max(0, text.search(/Troubleshooting login issues|General Troubleshooting Steps|With Pro and Max plans|What is ChatGPT Plus\?|What is Claude Code\?|Choose your plan|Codex Pricing|ChatGPT Work and Codex are included|ChatGPT Plus includes Codex/i));
    return { url, text: text.slice(start, start + 2500) };
  } catch {
    return null;
  }
}

function matchesProductTopic(topic, name) {
  return topic.pattern.test(name) ||
    matchesDailyFaqTopic(name, topic.name, { name });
}

function positiveUseText(text) {
  return String(text || '').replace(/^(?:Url|Source|Published|Owner|Language|Stars Today|Total Stars|Placement Hint):.*$/gmi, '')
    .replace(/https?:\/\/[^\s)]+/gi, '').replace(
    /(?:并不是|不是|并非|而非|无需|不需要|不使用|不涉及|不用|不走|不含|不带|不支持|不提供|非)\s*(?:(?:通过|使用|编程|走|用|Google)\s*)?(?:API(?:\s*(?:Key|密钥|接口))?(?:\s*中转)?|密钥|接口|中转|Antigravity|反重力)(?:\s*(?:账号|会员|服务|界面|接口))?/gi, ''
  ).replace(/\b(?:not(?:\s+an?)?|without)\s+(?:API(?:\s*Key)?(?:\s+relay)?|Antigravity)\b/gi, '')
    .replace(/\bAntigravity\s+(?:is\s+)?(?:not\s+(?:used|required|supported|available|included)|excluded|unavailable)\b/gi, '');
}

function eligibleProduct(topic, name, sourceText) {
  sourceText = positiveUseText(sourceText);
  if (!matchesProductTopic(topic, name) || /激活|换号|Free|接码|邀请|镜像/i.test(name)) return false;
  const edition = sourceText.match(/\b(?:Enterprise|Business|Team)\b|企业(?:版|套餐)|团队(?:版|套餐)/i)?.[0];
  if (edition && !new RegExp(edition, 'i').test(name)) return false;
  const apiUse = !/antigravity|反重力/i.test(sourceText) && /\bAPI\b|中转|接口|密钥|Coding\s*Plan/i.test(sourceText);
  if (/中转|\bAPI\b/i.test(name)) return apiUse;
  return !apiUse && !/额度/.test(name) &&
    (!/教育|学生/.test(name) || /学生认证|教育(?:版|资格)|校园(?:认证|资格)/.test(sourceText));
}

function needsCodexPlanEvidence(topic, product) {
  return topic.name === 'Codex' && product && !topic.pattern.test(product.name);
}

function hasSubscriptionEvidence(topic, product, official) {
  if (!needsCodexPlanEvidence(topic, product)) return true;
  if (official?.url !== FAQ_OFFICIAL_PAGES.Codex) return false;
  const plan = product.name.match(/\b(Plus|Pro)\b/i)?.[1]?.toLowerCase();
  const text = String(official?.text || '').replace(/\s+/g, ' ').trim();
  const unavailable = tier => new RegExp(
    `\\b${tier}(?: plan)? (?:does not include|doesn't include|excludes) Codex\\b|` +
    `\\bnot (?:all|every) (?:ChatGPT )?${tier}(?: plans?)? includes? Codex\\b|` +
    `\\bCodex (?:is )?(?:not (?:available|included)|unavailable) (?:in|on|for|with|to) (?:the |your )?(?:ChatGPT )?${tier}\\b`, 'i'
  ).test(text);
  if (!plan || unavailable(plan)) return false;
  const explicit = new RegExp(
    `(?:^|[.!?] )(?:ChatGPT ${plan}(?: plan)? includes Codex|` +
    `(?:ChatGPT Work and )?Codex (?:is|are) included in (?:your |the )?ChatGPT ${plan}(?: plan)?)(?=[.!?](?: |$)|$)`, 'i'
  ).test(text);
  // The official Pro card inherits the Codex access listed on the Plus card.
  const plusCard = /\bGet Plus Codex on the web, in the CLI, in the IDE extension, and on iOS(?:[.!?](?=\s|$)| Cloud-based integrations\b)/i.test(text) &&
    !unavailable('plus');
  return explicit || (plusCard && (plan === 'plus' || /\bGet Pro Everything in Plus and:/i.test(text)));
}

function withoutFaqDraftOffer(block) {
  let mixed = false;
  const markdown = block.replace(/(?:\[[^\]\r\n]+\]\(https?:\/\/[^\s)]+\)|[^。！？\r\n])+[。！？]?(?:\*\*)?/gu, sentence => {
    const unlinked = sentence.replace(/\[([^\]]+)\]\(https?:\/\/(?:www\.)?aivora\.cn(?:[/?#][^\s)]*)?\)/gi, '$1');
    if (unlinked === sentence) return sentence;
    const sources = extractDailyMarkdownLinks(unlinked);
    if (!sources.length) return '';
    // Preserve citations, not unverified claims that are mixed into the draft offer.
    mixed = true;
    const direct = sentence.match(/^[ \t]*(\*\*[^*\r\n]+\*\*)/)?.[1];
    const answer = direct && !/\]\(|购买|买号|续费|充值|开通|订阅/.test(direct) ? `${direct}。` : '';
    return `${answer} 可查${sources.map(({ title, url }) => `[${title}](${url})`).join('、')}。`;
  });
  return { markdown, mixed };
}

function isChatGptDictation(title) {
  return String(title || '').split(/[；;]/u).some(part =>
    /\bChatGPT\b/i.test(part) && /听写|语音输入|\bvoice dictation\b/i.test(part) &&
    !/\bAPI\b|录音文件|语音(?:对话|通话)|voice mode/i.test(part));
}

function isNativeRenewal(name) {
  return /\bChatGPT\s+(?:Plus|Go)\b.*(?:续费|充值)/i.test(name) && !/中转|镜像|接码|额度|团队|\bAPI\b/i.test(name);
}

function hasAvailableShopOffer(html, url) {
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      if ([data].flat().concat(data?.['@graph'] || []).some(item =>
        item?.['@type'] === 'Product' && item.url === url && [item.offers].flat().some(offer =>
          offer?.url === url && offer.availability === 'https://schema.org/InStock'))) return true;
    } catch { /* Only a positive current inventory signal can support this recommendation. */ }
  }
  return false;
}

async function verifyAvailableShopProduct(product, topic, sourceText, fetchImpl, timeoutMs) {
  try {
    const html = await fetchText(fetchImpl, product.url, timeoutMs);
    const name = readableText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
    if (extractCanonical(html) !== product.url || !eligibleProduct(topic, name, sourceText) ||
        (/半价/.test(name) && !/半价资格/.test(readableText(html)))) return null;
    const slug = new URL(product.url).pathname.split('/').pop();
    const detail = JSON.parse(await fetchText(fetchImpl,
      new URL('/api/v1/public/products/' + encodeURIComponent(slug), CATALOG_URL).href, timeoutMs)).data;
    if (detail?.slug !== slug || readableText(detail.title?.['zh-CN']) !== name || detail.is_sold_out !== false ||
        !detail.skus?.some(sku => sku.is_active === true && sku.is_sold_out === false && sku.stock_status === 'in_stock')) return null;
    return { url: product.url, name };
  } catch {
    return null;
  }
}

async function addPublicCatalogProducts(context, fetchImpl, timeoutMs) {
  const candidates = new Map((context.products || []).map(product => [product.url, product]));
  try {
    const allowed = new Set(context.productUrls);
    const rows = JSON.parse(await fetchText(fetchImpl, PUBLIC_PRODUCTS_URL, timeoutMs)).data;
    for (const item of (Array.isArray(rows) ? rows.slice(0, 50) : [])) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug || '') || item.is_sold_out !== false) continue;
      const url = `${CATALOG_URL}/${item.slug}`;
      const name = readableText(item.title?.['zh-CN']);
      if (name && allowed.has(url)) candidates.set(url, { url, name });
    }
  } catch { /* The already-verified listing remains available as a discovery input. */ }
  return [...candidates.values()];
}

function rankProducts(topic, sourceText, products = [], recentFaqs = []) {
  sourceText = positiveUseText(sourceText);
  const used = new Set(recentFaqs.flatMap(item => item.productUrls || []));
  return products.filter(({ name, url }) => eligibleProduct(topic, name, sourceText) && !used.has(url))
    .sort((a, b) => {
      const rank = ({ name }) => (/^(?:ChatGPT|Codex)$/.test(topic.name) && /\bPlus\b/i.test(name) ? 20 : 0) +
        (topic.name === 'Gemini' && /antigravity|反重力/i.test(sourceText) && /antigravity|反重力/i.test(name) ? 30 : 0) +
        (/续费|到期|充值/.test(sourceText)
          ? Number(/续费|充值/.test(name)) * 5
          : Number(/成品|独享/.test(name)) * 5);
      return rank(b) - rank(a);
    });
}

function selectProduct(topic, sourceText, products, recentFaqs) {
  return rankProducts(topic, sourceText, products, recentFaqs)[0];
}

export async function loadDailyShopContext(selectedItems, { fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  const sourceText = (selectedItems || []).join('\n');
  const visibleSourceText = sourceText.replace(/^Url:.*$/gmi, '');
  const candidateTopics = TOPICS.filter((topic) => topic.pattern.test(visibleSourceText));
  const empty = {
    catalogUrl: '', topics: [], sourceText, sourceItems: selectedItems || [],
    candidateTopics: candidateTopics.map((topic) => topic.name),
  };
  if (candidateTopics.length === 0) return empty;

  try {
    const [sitemapXml, catalogHtml] = await Promise.all([
      fetchText(fetchImpl, SITEMAP_URL, timeoutMs),
      fetchText(fetchImpl, CATALOG_URL, timeoutMs).catch(() => ''),
    ]);
    const urls = parseAivoraSitemapUrls(sitemapXml);
    if (!urls.includes(CATALOG_URL)) return empty;

    const listingAvailable = extractCanonical(catalogHtml) === CATALOG_URL;
    const productPaths = urls
      .filter((url) => url.startsWith(`${CATALOG_URL}/`))
      .map((url) => new URL(url).pathname);
    const products = listingAvailable ? catalogProducts(catalogHtml, urls) : [];
    const topics = candidateTopics
      .filter((topic) => productPaths.some((path) => topic.slug.test(path)) ||
        products.some(({ name }) => matchesProductTopic(topic, name)))
      .map((topic) => topic.name);
    return {
      ...(listingAvailable && topics.length > 0 ? { ...empty, catalogUrl: CATALOG_URL, topics } : empty),
      catalogVerified: true,
      products,
      productUrls: urls.filter(url => url.startsWith(`${CATALOG_URL}/`)),
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
    `目录中的相关交付名称：${(context.products || []).filter(({name}) =>
      TOPICS.some(topic => context.topics.includes(topic.name) &&
        (context.sourceItems || [context.sourceText || '']).some(source =>
          topic.pattern.test(String(source).replace(/^Url:.*$/gmi, '')) && eligibleProduct(topic, name, source))))
      .slice(0, 8).map(({name}) => name).join('；') || context.topics.join('、')}。`,
    '目录只证明店内公开展示这些商品类别，不证明库存或新闻中的新功能属于任一套餐，也不证明官方价格、额度、地区或政策。',
    '官网/App 账号、已有账号续费与 API 中转是不同交付。Antigravity 用途优先看含反重力的账号；明确 API/接口接入才推荐中转，不把中转写成官网会员，不承诺新闻中的新型号已在商品中开放。',
    '正文有同一工具的新闻且原始来源能回答问题时，写 1 条相关问题：先用短句解决当天的具体困扰，再按使用需求推荐一个上面列出的相关交付。每条相关问题自然带一次爱窝啦·AI账号店的相关商品入口，使用已核实的目录 URL。不要只写功能说明而漏掉推荐，不要求问句包含购买或会员。',
    '相关问题必须引用正文已使用、能证明同一条功能或政策的来源 URL，不用同品牌其他新闻代替。没有官方说明，就不说升级会员能更早收到新功能。',
    'ChatGPT 场景优先；普通个人使用优先考虑 Plus，不把最贵套餐当默认选择。免费也有的功能必须照实说，不暗示购买才能解锁，不把新功能推送等同于地区限制取消。没有相关交付或可靠来源时不硬塞商品；不要添加固定广告尾巴。',
  ].join('\n');
}

function formatDictationFaq(block, source, official = false, offer = '') {
  const eol = block.includes('\r\n') ? '\r\n' : '\n';
  const trailing = block.match(/\s*$/)?.[0] || '';
  const article = source ? ` 具体变化看[当天的听写报道](${source.url})。` : '';
  const details = official ? ` 按[OpenAI 的听写说明](${DICTATION_HELP})，转出的文字可以改完再发。`
    : ' 能不能用，以账号实际显示和官方说明为准。';
  return `### ChatGPT 实时听写，要买 Plus 才能用吗？${eol}${eol}**先看输入框里的麦克风。**${article}${details} 开会员不等于能提前收到推送。${offer}${trailing}`;
}

function dictationEvidence(official) {
  const text = official?.text || '';
  return /microphone icon/i.test(text) && /transcri\w+/i.test(text) && /edit before sending/i.test(text);
}

async function completeDictationFaq(source, block, context, result, fetchImpl, timeoutMs) {
  const used = new Set((context.recentFaqs || []).flatMap(item => item.productUrls || []));
  for (const { url } of result.links) used.add(url);
  const listed = selectProduct(TOPICS.find(topic => topic.name === 'ChatGPT'), '续费',
    (context.products || []).filter(({ name }) => isNativeRenewal(name)), context.recentFaqs);
  const url = (listed && !used.has(listed.url) ? listed.url : null) ||
    context.productUrls?.find(value => !used.has(value) && DICTATION_RENEWAL_PATH.test(value));
  result.requests += url ? 2 : 1;
  const [official, html] = await Promise.all([
    loadFaqReference(DICTATION_HELP, fetchImpl, timeoutMs),
    url ? fetchText(fetchImpl, url, timeoutMs).catch(() => '') : '',
  ]);
  if (!dictationEvidence(official)) {
    result.skipped.push({ topic: 'ChatGPT', reason: 'missing-dictation-evidence' });
    return formatDictationFaq(block, source);
  }
  const name = readableText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
  let offer = '';
  if (url && extractCanonical(html) === url && isNativeRenewal(name) && hasAvailableShopOffer(html, url)) {
    const halfPrice = /半价/.test(name);
    if (!halfPrice || /半价资格/.test(readableText(html))) {
      const label = halfPrice ? 'ChatGPT Plus 半价月卡' : name.replace(/[\[\]【】|｜]/g, ' ').replace(/\s+/g, ' ').trim();
      const requirement = halfPrice ? '先查半价资格，符合再看' : '可以先看';
      offer = ` 本来就准备给自己的账号续费，${requirement}[爱窝啦·AI账号店的 ${label}](${url})。`;
      result.links.push({ topic: 'ChatGPT', url, name });
    }
  }
  if (!offer) result.skipped.push({ topic: 'ChatGPT', reason: url ? 'product-check-failed' : 'no-matching-product' });
  return formatDictationFaq(block, source, true, offer);
}

export function finalizeDailyShopFaq(markdown, context = {}) {
  const content = String(markdown || '');
  const faq = content.match(DAILY_FAQ_SECTION);
  if (!faq) return content;
  const article = content.slice(0, faq.index) + content.slice(faq.index + faq[0].length);
  const sourceLinks = extractDailyMarkdownLinks(faq[0]).map(link => dailyMediaSourceKey(link.url));
  const inputUrls = new Set(sourceUrlKeys(context.sourceText));
  const articleUrls = new Set(extractDailyMarkdownLinks(article).map(link => dailyMediaSourceKey(link.url)));
  const hasInputSource = sourceLinks.some((url) => inputUrls.has(url) && articleUrls.has(url));
  const visibleFaq = faq[0].replace(/\]\(https?:\/\/[^)]+\)/g, ']');
  const visibleArticle = article.replace(/\]\(https?:\/\/[^)]+\)/g, ']');
  const hasSameTopic = (context.topics || []).some((name) => {
    const topic = TOPICS.find((item) => item.name === name);
    return topic && matchesDailyFaqTopic(visibleFaq, name, context.scene?.product) && topic.pattern.test(visibleArticle);
  });
  const allowShop = context.catalogUrl && hasInputSource && hasSameTopic;
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

// Product delivery is a final FAQ field, not a second model's optional writing task.
export async function ensureDailyFaqProductLinks(markdown, context = {}, { fetchImpl = fetch, timeoutMs = 1500 } = {}) {
  const content = String(markdown || '');
  const result = { markdown: content, links: [], requests: 0, skipped: [] };
  const section = content.match(DAILY_FAQ_SECTION);
  if (context.delivery) {
    const { fallback, reason } = context.delivery;
    if (!fallback) {
      if (section && context.recentFaqs?.length) {
        const question = section[0].match(/^###\s+([^\r\n]+)/m)?.[1] ||
          section[0].match(/^\*\*([^*\r\n]+[?？])\*\*\r?$/m)?.[1] || '';
        const topic = TOPICS.find(item => matchesDailyFaqTopic(question, item.name))?.name;
        const used = new Set(context.recentFaqs.flatMap(item => item.sourceUrls || []).map(dailyMediaSourceKey));
        if (isRepeatedDailyFaq(question, topic, context.recentFaqs) ||
            extractDailyMarkdownLinks(section[0]).some(({ url }) => used.has(dailyMediaSourceKey(url)))) {
          return { ...result, markdown: content.slice(0, section.index) + content.slice(section.index + section[0].length),
            skipped: [{ reason: 'repeated-faq', offerReason: reason }] };
        }
      }
      const safe = await ensureDailyFaqProductLinks(content, { ...context, delivery: null, faqHistoryUnavailable: true }, { fetchImpl, timeoutMs });
      return { ...safe, markdown: finalizeDailyShopFaq(safe.markdown), skipped: [{ reason }] };
    }
    const { product, topic, sourceUrl } = context.scene;
    const links = extractDailyMarkdownLinks(section?.[0] || '');
    const shopLinks = links.filter(({ url }) => /^https?:\/\/(?:www\.)?aivora\.cn(?:\/|$)/i.test(url));
    const hasApprovedDraft = !context.scene.useVerifiedCopy && context.acceptedSceneDraft && shopLinks.length === 1 &&
      shopLinks[0].url === product.url && links.some(({ url }) => url === sourceUrl);
    return {
      ...result,
      markdown: hasApprovedDraft ? content : insertStandaloneDailyFaq(content, fallback),
      links: [{ topic, ...product }],
      usedFallback: !hasApprovedDraft,
    };
  }
  if (!section) return result;
  const canRecommend = !context.faqHistoryUnavailable && context.catalogUrl === CATALOG_URL &&
    Boolean(context.products?.length || context.productUrls?.length);
  if (context.faqHistoryUnavailable) {
    result.skipped.push({ reason: 'published-faq-history-unavailable' });
  }
  const article = content.slice(0, section.index) + content.slice(section.index + section[0].length);
  const inputUrls = new Set(sourceUrlKeys(context.sourceText));
  const articleUrls = new Set(extractDailyMarkdownLinks(article).map(link => dailyMediaSourceKey(link.url)));
  const publishedSources = new Map();
  for (const item of context.sourceItems || []) {
    const text = String(item);
    const url = text.match(/^Url:\s*(https?:\/\/\S+)/im)?.[1];
    const key = dailyMediaSourceKey(url);
    if (key && inputUrls.has(key) && articleUrls.has(key)) publishedSources.set(key, {
      url, key, title: text.match(/^(?:News Title|Project Name):\s*(.+)$/im)?.[1] || '', text,
    });
  }
  const questions = [...section[0].matchAll(/^(?:###\s+([^\r\n]+)|\*\*([^*\r\n]+[?？])\*\*)\r?$/gm)];
  const plainQuestion = section[0].match(/^(##[^\r\n]*\r?\n[ \t\r\n]*)([^#*\[\]\r\n]+[?？])\r?$/m);
  if (plainQuestion) questions.unshift({ index: plainQuestion[1].length, 3: plainQuestion[2] });
  const verified = new Map();
  let codexPlanEvidence = context.scene?.official?.url === FAQ_OFFICIAL_PAGES.Codex ? context.scene.official : undefined;
  let output = section[0].slice(0, questions[0]?.index ?? section[0].length);
  if (context.faqHistoryUnavailable) output = withoutFaqDraftOffer(output).markdown;
  let dictationChecked = false;
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    const block = section[0].slice(question.index, questions[index + 1]?.index ?? section[0].length);
    const title = (question[1] || question[2] || question[3]).trim();
    const sources = [...block.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map(m => m[1]);
    let grounded = sources.map(dailyMediaSourceKey).filter(url => inputUrls.has(url) && articleUrls.has(url));
    if (isChatGptDictation(title)) {
      const knownLinksOnly = sources.every(url => url === DICTATION_HELP || /^https:\/\/(?:www\.)?aivora\.cn(?:\/|$)/i.test(url));
      const matches = [...publishedSources.values()].filter(source => isChatGptDictation(source.title) &&
        (grounded.length ? grounded.includes(source.key) : knownLinksOnly));
      const source = matches.length === 1 ? matches[0] : null;
      if (source && canRecommend && !dictationChecked && result.links.length < 2) {
        output += await completeDictationFaq(source, block, context, result, fetchImpl, timeoutMs);
        dictationChecked = true;
      } else if (source || /优先|抢先|更早|提前|第一时间/u.test(block)) {
        output += formatDictationFaq(block, source);
      } else {
        output += withoutFaqDraftOffer(block).markdown;
      }
      continue;
    }
    if (!canRecommend) {
      output += context.faqHistoryUnavailable ? withoutFaqDraftOffer(block).markdown : block;
      continue;
    }
    let recoveredSource;
    if (!grounded.length && sources.every(url => /^https:\/\/(?:www\.)?aivora\.cn(?:\/|$)/i.test(url))) {
      const subjectKey = text => text.match(/\b(?:Gemini|ChatGPT|Claude|Codex|Cursor|MiniMax|Grok|Perplexity)(?:[ \t-]+[a-z]+)?[ \t-]*\d+(?:\.\d+)*(?:[ \t-]+[a-z][a-z0-9.-]*)*\b/i)?.[0].replace(/[\s-]/g, '').toLowerCase();
      const subject = subjectKey(title);
      const matching = [...publishedSources.values()].filter(source => subject && subjectKey(source.title) === subject &&
        isDailyFaqPrimarySource(source.text, source.url) && TOPICS.some(topic =>
        context.topics?.includes(topic.name) && matchesDailyFaqTopic(title, topic.name, context.scene?.product) &&
        topic.pattern.test(source.title)));
      // Only a unique official post for the same versioned subject can restore a missing citation.
      if (matching.length === 1) {
        recoveredSource = matching[0];
        grounded = [recoveredSource.key];
      }
    }
    const topic = [TOPICS.find(item => item.name === context.scene?.topic), ...TOPICS].filter(Boolean)
      .find(item => context.topics?.includes(item.name) && matchesDailyFaqTopic(title, item.name, context.scene?.product) &&
      (context.sourceItems || [context.sourceText || '']).some(source =>
        sourceUrlKeys(source).some(url => grounded.includes(url)) && item.pattern.test(String(source).replace(/^Url:.*$/gmi, ''))));
    if (!topic || result.links.length >= 2) {
      output += block;
      continue;
    }
    const evidenceUse = grounded.map(key => publishedSources.get(key)?.text).filter(Boolean).join('\n');
    const productUse = positiveUseText(evidenceUse || `${title}\n${block.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}`);
    const sceneProduct = context.scene?.topic === topic.name && context.scene.product;
    const candidate = (sceneProduct && eligibleProduct(topic, sceneProduct.name, productUse) &&
      !(context.recentFaqs || []).some(item => item.productUrls?.includes(sceneProduct.url)) &&
      context.products.find(({ url }) => url === sceneProduct.url)) ||
      selectProduct(topic, productUse, context.products, context.recentFaqs);
    let product = candidate && verified.get(candidate.url);
    if (candidate && !product) {
      if (context.scene?.topic === topic.name && context.scene.product?.url === candidate.url) {
        product = context.scene.product;
      } else {
        try {
          result.requests++;
          const html = await fetchText(fetchImpl, candidate.url, timeoutMs);
          const name = readableText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
          if (extractCanonical(html) === candidate.url && eligibleProduct(topic, name, productUse)) product = { url: candidate.url, name };
        } catch { /* Catalog/product failures leave the already-written news publishable. */ }
      }
      if (product) verified.set(product.url, product);
    }
    if (!product) {
      result.skipped.push({ topic: topic.name, reason: candidate ? 'product-check-failed' : 'no-matching-product' });
      if (!candidate || needsCodexPlanEvidence(topic, candidate)) {
        output += topic.name === 'Codex' ? withoutFaqDraftOffer(block).markdown : block;
        continue;
      }
      product = { name: candidate.name, url: CATALOG_URL };
    }
    const needsPlan = needsCodexPlanEvidence(topic, product);
    if (needsPlan && codexPlanEvidence === undefined) {
      result.requests++;
      codexPlanEvidence = await loadFaqReference(FAQ_OFFICIAL_PAGES.Codex, fetchImpl, timeoutMs);
    }
    if (needsPlan && !hasSubscriptionEvidence(topic, product, codexPlanEvidence)) {
      result.skipped.push({ topic: topic.name, reason: 'missing-subscription-evidence' });
      output += withoutFaqDraftOffer(block).markdown;
      continue;
    }
    const renewal = /续费|充值/.test(product.name);
    const codexDraft = needsPlan && renewal ? withoutFaqDraftOffer(block) : null;
    if (codexDraft?.mixed) {
      result.skipped.push({ topic: topic.name, reason: 'offer-mixed-with-source' });
      output += codexDraft.markdown;
      continue;
    }
    const antigravity = topic.name === 'Gemini' && /antigravity|反重力/i.test(productUse) && /antigravity|反重力/i.test(product.name);
    const shortName = antigravity && /成品|独享/.test(product.name) ? product.name.replace(/【[^】]*】/g, ' ') : product.name;
    const label = `爱窝啦·AI账号店的 ${shortName.replace(/[\[\]\\\r\n|｜]/g, ' ').replace(/[【】]/g, '').replace(/\s+/g, ' ').trim()}`;
    const link = `[${label}](${product.url})`;
    let replaced = false;
    const trailing = block.match(/\s*$/)?.[0] || '';
    let updated = (codexDraft?.markdown ?? block).replace(/^[^\r\n]+/, `### ${title}`)
      .replace(/^[ \t]*(?:相关商品|商品推荐)[：:][^\r\n]*\]\(https?:\/\/(?:www\.)?aivora\.cn[^)\r\n]*\)[^\r\n]*(?:\r?\n|$)/gm, '')
      .replace(/([，,。！？.!?])\s*暂不推荐(?:额外)?购买入口[。.!！]?(?=\s*$)/u, (_match, mark) => /[，,]/.test(mark) ? '。' : mark)
      .replace(/\[([^\]]+)\]\(https?:\/\/(?:www\.)?aivora\.cn(?:[/?#][^\s)]*)?\)/gi, (_match, oldLabel) => {
        if (replaced) return oldLabel;
        replaced = true;
        return link;
      });
    if (recoveredSource) {
      const attribution = /(?:Google\s*AI\s*)?官方(?:推文|公告|说明)|原文(?:介绍|说明)?/;
      const headingEnd = updated.indexOf('\n') + 1;
      const answer = updated.slice(headingEnd);
      updated = updated.slice(0, headingEnd) + (attribution.test(answer)
        ? answer.replace(attribution, label => `[${label}](${recoveredSource.url})`)
        : `${answer.trimEnd()} 可核对[本次更新的原始说明](${recoveredSource.url})。${trailing}`);
    }
    if (!replaced) {
      const login = /登录|登入|Apple\s*ID|验证|打不开/i.test(title);
      const relay = /中转|\bAPI\b/i.test(product.name);
      const need = renewal ? '已有账号可以正常使用、只是会员快到期' : `原本就想另开一个 ${topic.name} 账号`;
      const suggestion = relay
        ? `要接到自己的工具里，可看 ${link} 的当前模型列表；这是 API 中转，不是官网会员。`
        : antigravity
        ? `想用反重力写代码，可看 ${link}，具体模型以账号内显示为准。`
        : login
        ? `如果你${need}，可以再看 ${link} 的交付说明；购买不能代替登录排查。`
        : needsPlan && renewal
        ? `平时常用 Codex、已有账号快到期，可以看${link}的续费说明。`
        : `如果你${need}，可以对照 ${link} 的交付说明，看看是否适合自己的用法。`;
      updated = `${updated.trimEnd()} ${suggestion}${trailing}`;
    }
    result.links.push({ topic: topic.name, url: product.url, name: product.name });
    output += updated;
  }
  result.markdown = content.slice(0, section.index) + output + content.slice(section.index + section[0].length);
  return result;
}

function sceneFallback(scene, originalFaq) {
  const { topic, sourceUrl, product, official } = scene;
  const sourceText = scene.useText || scene.sourceText;
  const label = product.name.replace(/【[^】]*】/g, ' ').replace(/[\[\]\\\r\n|｜]/g, ' ').replace(/\s+/g, ' ').trim();
  const link = '[爱窝啦·AI账号店的 ' + label + '](' + product.url + ')';
  const source = '[当天的使用案例](' + sourceUrl + ')';
  const header = '## **❓ 相关问题**\n\n';
  if (scene.dictation) {
    const check = /半价/.test(product.name) ? '先查半价资格，符合再看' : '可以看';
    return header + formatDictationFaq('', { url: sourceUrl }, true,
      ' 已有可用账号、会员快到期，' + check + link + '。');
  }
  if (scene.flow) {
    const credits = official?.url === FLOW_CREDITS_HELP && /\bFlow\b/i.test(official.text) && /点数|credits/i.test(official.text)
      ? '按[Google 的点数说明](' + FLOW_CREDITS_HELP + ')核对用量。' : '生成前以 Flow 内显示的用量为准。';
    return header + '### 用 Gemini 的 Antigravity 拍视频，Flow 点数算在哪？\n\n' +
      '**先看 Flow 余额，不用换账号试。** ' + source + '用反重力操作 Flow，' + credits +
      '缺的是编辑器入口，可以看' + link + '，别把它当 Flow 点数包买。';
  }
  const relay = /中转|\bAPI\b/i.test(product.name);
  const use = relay ? '接进自己的工具' : /代码|编程|coding|code\b|IDE\b/i.test(sourceText) ? '写代码'
    : /图片|绘图|图表|image|diagram/i.test(sourceText) ? '做图' : /语音|听写|voice/i.test(sourceText) ? '处理语音' : '试这项更新';
  const requirement = relay ? '要用 API 接入，可对照' + link + '的模型列表；中转不是官网会员。'
    : /半价/.test(product.name) ? '原账号快到期，先查半价资格，符合再看' + link + '。'
    : /续费|充值/.test(product.name) ? '原账号能用、会员快到期，再看' + link + '的续费说明。'
    : '本来就需要单独一个账号，再看' + link + '的交付说明。';
  const existingQuestion = originalFaq?.match(/^###\s+([^\r\n]+)/m)?.[1] ||
    originalFaq?.match(/^\*\*([^*\r\n]+[?？])\*\*\r?$/m)?.[1] || '';
  if (!scene.useVerifiedCopy && originalFaq && matchesDailyFaqTopic(existingQuestion, topic, product) &&
      extractDailyMarkdownLinks(originalFaq).some(({ url }) => dailyMediaSourceKey(url) === dailyMediaSourceKey(sourceUrl)) &&
      !/买了就|保证可用|包解锁|稳定账号|提前收到|付费即可解锁/.test(originalFaq)) {
    const ending = /免费|开放|地区|推送/.test(originalFaq) ? ' 购买不改变地区限制或开放进度。' : '';
    return withoutFaqDraftOffer(originalFaq).markdown.trimEnd() + '\n\n' + requirement + ending;
  }
  const usage = use === '试这项更新' ? '这项更新' : `用来${use}`;
  return header + '### ' + topic + ' ' + usage + '，手上的账号能先试吗？\n\n' +
    '**先用原账号试一个小任务。** 想知道从哪开始，参考' + source + '；能否用，要看自己的账号界面。' + requirement;
}

function matchesDelivery(scene, name) {
  if (scene.dictation) return isNativeRenewal(name);
  if (scene.topic === 'Gemini' && ANTIGRAVITY.test(positiveUseText(scene.useText || scene.sourceText))) {
    // Require the storefront's complete affirmative delivery label, not a mention of the feature.
    return /^Gemini\s+(?:Pro|Ultra(?:\s+\d+x)?)\s*(?:[|｜]\s*)?(?:成品号|独享号)(?:【\d+(?:-\d+)?个?月(?:\s+随机发)?】)?\s*含反重力$/i.test(name.trim());
  }
  return true;
}

// Enrich only the optional FAQ, after the news body has passed publication checks.
export async function loadDailyFaqSceneContext(markdown, selectedItems, context = {}, {
  fetchImpl = fetch, timeoutMs = 5000, verifyDelivery = false,
} = {}) {
  if (verifyDelivery && !context.faqHistoryUnavailable && context.productUrls?.length &&
      (context.catalogVerified === true || context.catalogUrl === CATALOG_URL)) {
    context = { ...context, products: await addPublicCatalogProducts(context, fetchImpl, timeoutMs) };
  }
  const namedTopics = TOPICS.filter((topic) =>
    context.candidateTopics?.includes(topic.name) &&
    (context.products || []).some(({ name }) => matchesProductTopic(topic, name)))
    .map((topic) => topic.name);
  if (namedTopics.length) context = {
    ...context, catalogUrl: context.catalogUrl || CATALOG_URL,
    topics: [...new Set([...(context.topics || []), ...namedTopics])],
  };
  const withoutOffer = (reason) => verifyDelivery ? { ...context, delivery: { reason } } : context;
  if (context.faqHistoryUnavailable) return withoutOffer('published-faq-history-unavailable');
  if (!context.catalogUrl || !context.topics?.length) return withoutOffer('verified-catalog-unavailable');
  const draft = String(markdown || '');
  const originalFaq = draft.match(DAILY_FAQ_SECTION)?.[0];
  const faqQuestion = originalFaq?.match(/^###\s+([^\r\n]+)/m)?.[1] ||
    originalFaq?.match(/^\*\*([^*\r\n]+[?？])\*\*\r?$/m)?.[1] || '';
  const faqSources = new Set(extractDailyMarkdownLinks(originalFaq || '').map(({ url }) => dailyMediaSourceKey(url)));
  const article = draft.replace(DAILY_FAQ_SECTION, '');
  const publishedUrls = new Map(extractDailyMarkdownLinks(article).map(link => [dailyMediaSourceKey(link.url), link.url]));
  const candidates = (selectedItems || []).flatMap((item) => {
    const text = String(item);
    const sourceUrl = text.match(/^Url:\s*(https?:\/\/\S+)/im)?.[1];
    const url = publishedUrls.get(dailyMediaSourceKey(sourceUrl));
    if (!url) return [];
    const visible = text.replace(/^Url:.*$/gmi, '');
    const title = visible.match(/^(?:News Title|Project Name):\s*(.+)$/im)?.[1] || '';
    const exactFaq = topic => faqSources.has(dailyMediaSourceKey(url)) && matchesDailyFaqTopic(faqQuestion, topic.name);
    return TOPICS.filter((topic) => context.topics.includes(topic.name) && topic.pattern.test(visible) &&
      (!verifyDelivery || (title && !/IPO|融资|市值|估值|股价|黑洞|论文|诉讼|财报|裁员|收购|泄露|传闻/i.test(title) &&
        (topic.pattern.test(title) || /^Project Name:/im.test(text)))))
      .map((topic) => {
        const faqMatch = exactFaq(topic);
        return { topic: topic.name, sourceUrl: url, sourceText: text, faqMatch,
          useText: faqMatch ? withoutFaqDraftOffer(originalFaq).markdown : text,
          dictation: verifyDelivery && topic.name === 'ChatGPT' && isChatGptDictation(title),
          flow: verifyDelivery && topic.name === 'Gemini' && /\bGoogle Flow\b/i.test(visible) && ANTIGRAVITY.test(positiveUseText(visible)),
          score: (faqMatch ? 70 : faqSources.has(dailyMediaSourceKey(url)) ? 50 : 0) + (/^(?:ChatGPT|Codex)$/.test(topic.name) ? 20 : 0) +
            (/skill|技能|工作流|编程|写代码/i.test(visible) ? 10 : 0) -
            (/登录|登入|OAuth|打不开|无法访问|封号/i.test(visible) ? 30 : 0),
        };
      });
  });
  const recent = context.recentFaqs || [];
  const fresh = candidates.filter((candidate) => !recent.some((item) =>
    item.sourceUrls?.some(url => dailyMediaSourceKey(url) === dailyMediaSourceKey(candidate.sourceUrl)) ||
    (item.topic?.toLowerCase() === candidate.topic.toLowerCase() && item.theme &&
      item.theme === getDailyFaqTheme(candidate.useText)))).sort((a, b) => b.score - a.score);
  if (!fresh.length) return withoutOffer('no-fresh-published-source');
  const offersFor = (candidate) => {
    const rule = TOPICS.find(topic => topic.name === candidate.topic);
    let products = context.products || [];
    if (verifyDelivery && candidate.dictation) {
      const named = new Set(products.map(({ url }) => url));
      products = products.concat((context.productUrls || []).filter(url => DICTATION_RENEWAL_PATH.test(url) && !named.has(url))
        .map(url => ({ url, name: 'ChatGPT Plus 续费' })));
    }
    if (verifyDelivery) products = products.filter(({ url, name }) =>
      context.productUrls?.includes(url) && matchesDelivery(candidate, name));
    else if (candidate.topic === 'ChatGPT' && isChatGptDictation(candidate.sourceText.split('\n')[0])) return [];
    return rankProducts(rule, candidate.dictation ? '续费' : candidate.useText, products, recent);
  };
  async function verifyScene({ product, ...scene }) {
    const rule = TOPICS.find((topic) => topic.name === scene.topic);
    const sourceUrl = new URL(scene.sourceUrl);
    const useText = scene.useText;
    const repository = sourceUrl.pathname.split('/').filter(Boolean);
    // A repository can document its integration, not the ChatGPT plan that runs Codex.
    const officialUrl = scene.dictation ? DICTATION_HELP : scene.flow ? FLOW_CREDITS_HELP
      : needsCodexPlanEvidence(rule, product) ? FAQ_OFFICIAL_PAGES.Codex
      : sourceUrl.hostname === 'github.com' && repository.length === 2
      ? 'https://raw.githubusercontent.com/' + repository.map(encodeURIComponent).join('/') + '/HEAD/README.md'
      : scene.topic === 'ChatGPT' && /登录|登入|OAuth|Apple\s*ID|sign.?in/i.test(scene.sourceText)
      ? 'https://help.openai.com/en/articles/7426629-why-cant-i-log-in-to-chatgpt'
      : scene.topic === 'Gemini' && ANTIGRAVITY.test(positiveUseText(useText))
      ? 'https://antigravity.google/pricing' : FAQ_OFFICIAL_PAGES[scene.topic];
    const [official, verified] = await Promise.all([
      loadFaqReference(officialUrl, fetchImpl, timeoutMs),
      product ? verifyDelivery ? verifyAvailableShopProduct(product, rule, useText, fetchImpl, timeoutMs)
        : fetchText(fetchImpl, product.url, timeoutMs).then(html => {
          const name = readableText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
          return extractCanonical(html) === product.url && eligibleProduct(rule, name, useText) ? { ...product, name } : null;
        }).catch(() => null) : null,
    ]);
    return { ...scene, official, product: verified && (!verifyDelivery || matchesDelivery(scene, verified.name)) && hasSubscriptionEvidence(rule, verified, official) &&
      (!scene.dictation || dictationEvidence(official)) ? verified : null };
  }
  const ranked = fresh.map(candidate => ({ candidate, offers: offersFor(candidate) }));
  if (!verifyDelivery) {
    const { candidate, offers } = ranked.find(entry => entry.offers.length) || ranked[0];
    return { ...context, scene: await verifyScene({ ...candidate, product: offers[0] }) };
  }
  const picks = [];
  const usedSources = new Set();
  const usedOffers = new Set();
  for (const { candidate, offers } of ranked) {
    const key = dailyMediaSourceKey(candidate.sourceUrl);
    const product = offers.find(offer => !usedOffers.has(offer.url));
    if (!product || usedSources.has(key)) continue;
    picks.push({ ...candidate, product });
    usedSources.add(key);
    usedOffers.add(product.url);
    if (picks.length === 1 && candidate.faqMatch) {
      const alternate = offers.find(offer => !usedOffers.has(offer.url));
      if (alternate) {
        picks.push({ ...candidate, product: alternate });
        usedOffers.add(alternate.url);
      }
    }
    if (picks.length >= MAX_OFFER_CHECKS) break;
  }
  for (const { candidate, offers } of ranked) {
    if (picks.length >= MAX_OFFER_CHECKS) break;
    for (const product of offers) {
      if (picks.length >= MAX_OFFER_CHECKS) break;
      if (!picks.some(pick => pick.sourceUrl === candidate.sourceUrl && pick.topic === candidate.topic && pick.product.url === product.url)) {
        picks.push({ ...candidate, product });
      }
    }
  }
  let checkedOffers = 0;
  async function check(pick) {
    checkedOffers++;
    const scene = await verifyScene(pick);
    if (!scene.product) return null;
    // For deliveries that are easily confused, do not let prose change the verified terms.
    scene.useVerifiedCopy = scene.dictation || scene.flow || /中转|\bAPI\b/i.test(scene.product.name) ||
      (scene.topic === 'Gemini' && ANTIGRAVITY.test(positiveUseText(scene.useText)));
    const fallback = sceneFallback(scene, originalFaq);
    const question = fallback.match(/^###\s+([^\r\n]+)/m)?.[1] || fallback.match(/^\*\*([^*\r\n]+[?？])\*\*\r?$/m)?.[1];
    if (isRepeatedDailyFaq(question, scene.topic, recent)) return null;
    return { ...context, scene, delivery: { fallback } };
  }
  if (!picks.length) return withoutOffer('no-matching-unused-product');
  const completed = await check(picks[0]) || (await Promise.all(picks.slice(1).map(check))).find(Boolean) ||
    withoutOffer('no-candidate-passed-offer-checks');
  return { ...completed, delivery: { ...completed.delivery, checkedOffers } };
}
