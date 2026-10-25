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

function selectProduct(topic, sourceText, products = []) {
  return products.filter(({ name }) => topic.pattern.test(name) &&
    !/中转|额度|激活|换号|Free|接码|邀请|API|镜像/i.test(name) &&
    (!/教育|学生/.test(name) || /学生认证|教育(?:版|资格)|校园(?:认证|资格)/.test(sourceText)))
    .sort((a, b) => {
      const rank = ({ name }) => (topic.name === 'ChatGPT' && /\bPlus\b/i.test(name) ? 20 : 0) +
        (/续费|到期|充值/.test(sourceText)
          ? Number(/续费|充值/.test(name)) * 5
          : Number(/成品|独享/.test(name)) * 5);
      return rank(b) - rank(a);
    })[0];
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
      fetchText(fetchImpl, CATALOG_URL, timeoutMs),
    ]);
    const urls = parseAivoraSitemapUrls(sitemapXml);
    if (!urls.includes(CATALOG_URL) || extractCanonical(catalogHtml) !== CATALOG_URL) return empty;

    const productPaths = urls
      .filter((url) => url.startsWith(`${CATALOG_URL}/`))
      .map((url) => new URL(url).pathname);
    const products = catalogProducts(catalogHtml, urls);
    const topics = candidateTopics
      .filter((topic) => productPaths.some((path) => topic.slug.test(path)) ||
        products.some(({ name }) => topic.pattern.test(name)))
      .map((topic) => topic.name);
    return {
      ...(topics.length > 0 ? { ...empty, catalogUrl: CATALOG_URL, topics } : empty),
      products,
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
      TOPICS.some(topic => context.topics.includes(topic.name) && topic.pattern.test(name)) &&
      !/中转|额度|激活|换号|Free|接码|邀请|API|镜像/i.test(name)).slice(0, 8).map(({name}) => name).join('；') || context.topics.join('、')}。`,
    '目录只证明店内公开展示这些商品类别，不证明库存或新闻中的新功能属于任一套餐，也不证明官方价格、额度、地区或政策。',
    '正文有同一工具的新闻且原始来源能回答问题时，写 1 条相关问题：先用短句解决当天的具体困扰，再按使用需求推荐一个上面列出的相关交付。每条相关问题自然带一次爱窝啦·AI账号店的相关商品入口，使用已核实的目录 URL。不要只写功能说明而漏掉推荐，不要求问句包含购买或会员。',
    'ChatGPT 场景优先；普通个人使用优先考虑 Plus，不把最贵套餐当默认选择。免费也有的功能必须照实说，不暗示购买才能解锁，不把新功能推送等同于地区限制取消。没有相关交付或可靠来源时不硬塞商品；不要添加固定广告尾巴。',
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
  const hasSameTopic = (context.topics || []).some((name) => {
    const topic = TOPICS.find((item) => item.name === name);
    return topic && topic.pattern.test(visibleFaq) && topic.pattern.test(visibleArticle);
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
  if (context.catalogUrl !== CATALOG_URL || !context.products?.length) return result;
  const section = content.match(/^##[^\r\n]*(?:相关问题|FAQ)[^\r\n]*\r?\n[\s\S]*?(?=^##\s+|(?![\s\S]))/im);
  if (!section) return result;
  const article = content.slice(0, section.index) + content.slice(section.index + section[0].length);
  const inputUrls = new Set([...String(context.sourceText || '').matchAll(/https?:\/\/[^\s)]+/g)].map(m => m[0]));
  const questions = [...section[0].matchAll(/^(?:###\s+([^\r\n]+)|\*\*([^*\r\n]+[?？])\*\*)\r?$/gm)];
  const verified = new Map();
  let output = section[0].slice(0, questions[0]?.index ?? section[0].length);
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    const block = section[0].slice(question.index, questions[index + 1]?.index ?? section[0].length);
    const title = (question[1] || question[2]).trim();
    const sources = [...block.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map(m => m[1]);
    const grounded = sources.filter(url => inputUrls.has(url) && article.includes(url));
    const topic = TOPICS.find(item => context.topics?.includes(item.name) && item.pattern.test(title) &&
      (context.sourceItems || [context.sourceText || '']).some(source =>
        grounded.some(url => String(source).includes(url)) && item.pattern.test(String(source).replace(/^Url:.*$/gmi, ''))));
    if (!topic || result.links.length >= 2) {
      output += block;
      continue;
    }
    const candidate = selectProduct(topic, title, context.products);
    let product = candidate && verified.get(candidate.url);
    if (candidate && !product) {
      if (context.scene?.topic === topic.name && context.scene.product?.url === candidate.url) {
        product = context.scene.product;
      } else {
        try {
          result.requests++;
          const html = await fetchText(fetchImpl, candidate.url, timeoutMs);
          const name = readableText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
          if (extractCanonical(html) === candidate.url && topic.pattern.test(name)) product = { url: candidate.url, name };
        } catch { /* Catalog/product failures leave the already-written news publishable. */ }
      }
      if (product) verified.set(product.url, product);
    }
    if (!product) {
      result.skipped.push({ topic: topic.name, reason: candidate ? 'product-check-failed' : 'no-matching-product' });
      if (!candidate) {
        output += block;
        continue;
      }
      product = { name: candidate.name, url: CATALOG_URL };
    }
    const label = `爱窝啦·AI账号店的 ${product.name.replace(/[\[\]\\\r\n|｜]/g, ' ').replace(/[【】]/g, '').replace(/\s+/g, ' ').trim()}`;
    const link = `[${label}](${product.url})`;
    let replaced = false;
    const trailing = block.match(/\s*$/)?.[0] || '';
    let updated = block.replace(/^\*\*([^*\r\n]+[?？])\*\*(\r?\n|$)/, '### $1$2')
      .replace(/^[ \t]*(?:相关商品|商品推荐)[：:][^\r\n]*\]\(https?:\/\/(?:www\.)?aivora\.cn[^)\r\n]*\)[^\r\n]*(?:\r?\n|$)/gm, '')
      .replace(/\[([^\]]+)\]\(https?:\/\/(?:www\.)?aivora\.cn(?:[/?#][^\s)]*)?\)/gi, (_match, oldLabel) => {
        if (replaced) return oldLabel;
        replaced = true;
        return link;
      });
    if (!replaced) {
      const renewal = /续费|充值/.test(product.name);
      const login = /登录|登入|Apple\s*ID|验证|打不开/i.test(title);
      const need = renewal ? '已有账号可以正常使用、只是会员快到期' : `原本就想另开一个 ${topic.name} 账号`;
      const suggestion = login
        ? `如果你${need}，可以再看 ${link} 的交付说明；购买不能代替登录排查。`
        : `如果你${need}，可以对照 ${link} 的交付说明，看看是否适合自己的用法。`;
      updated = `${updated.trimEnd()} ${suggestion}${trailing}`;
    }
    result.links.push({ topic: topic.name, url: product.url, name: product.name });
    output += updated;
  }
  result.markdown = content.slice(0, section.index) + output + content.slice(section.index + section[0].length);
  return result;
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
        score: (topic.name === 'ChatGPT' ? 20 : 0) + (/skill|技能|工作流|编程|写代码/i.test(visible) ? 10 : 0),
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
  const product = selectProduct(topicRule, chosen.sourceText, context.products);
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
