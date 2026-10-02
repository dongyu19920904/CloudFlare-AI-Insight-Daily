import { stripHtml } from './helpers.js';

const OFFICIAL_HOSTS = new Set([
  'openai.com', 'developers.openai.com', 'anthropic.com', 'docs.anthropic.com',
  'blog.google', 'ai.google.dev', 'deepmind.google', 'cursor.com',
  'microsoft.com', 'learn.microsoft.com', 'minimax.io', 'x.ai',
]);
const OFFICIAL_SOCIAL_HANDLES = new Set(['openai', 'anthropicai', 'geminiapp', 'googleai']);

function getSourceUrl(item) {
  return String(item || '').match(/^Url:\s*(https?:\/\/\S+)/im)?.[1] || '';
}

function isPrimarySource(item, url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const parts = parsed.pathname.split('/').filter(Boolean);
    return OFFICIAL_HOSTS.has(host) ||
      (host === 'github.com' && parts[0]?.toLowerCase() === 'cursor' && parts[1] === 'plugins') ||
      (host === 'x.com' && parts[1] === 'status' && OFFICIAL_SOCIAL_HANDLES.has(parts[0]?.toLowerCase()));
  } catch {
    return false;
  }
}

function boundedFaqSource(text) {
  if (text.length <= 6000) return text;
  return `${text.slice(0, 4500)}\n[来源中间已省略；不能据此断言官方未说明]\n${text.slice(-1400)}`;
}

export function expandDailyFaqSourceItems(selectedItems, unifiedData = {}) {
  const originals = new Map(Object.values(unifiedData || {}).flat()
    .filter((item) => item?.url && item.details?.content_html)
    .map((item) => [item.url, item]));
  return (selectedItems || []).map((item) => {
    const url = getSourceUrl(item);
    const original = originals.get(url);
    if (!original || !isPrimarySource(item, url)) return item;
    const content = stripHtml(String(original.details.content_html)).replace(/\s+/g, ' ').trim();
    if (!content) return item;
    return boundedFaqSource(`Title: ${original.title || ''}\nUrl: ${url}\nFAQ 原始来源正文：${content}`);
  });
}

export function selectDailyFaqPrimarySource(items, topics, markdown = '') {
  return (items || [])
    .map((item) => ({ item: String(item || ''), url: getSourceUrl(item) }))
    .filter(({ item, url }) => url && (!markdown || markdown.includes(url)) && isPrimarySource(item, url))
    .map((candidate) => ({
      ...candidate,
      topic: (topics || []).find((topic) => new RegExp(topic, 'i').test(candidate.item)),
    }))
    .find((candidate) => candidate.topic) || null;
}

export async function loadDailyFaqPrimarySource(items, topics, { fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  const source = selectDailyFaqPrimarySource(items, topics);
  if (!source || ['x.com', 'github.com'].includes(new URL(source.url).hostname)) return items;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(source.url, { signal: controller.signal, redirect: 'error' });
    if (!response.ok) throw new Error(`Official FAQ source returned ${response.status}`);
    const html = await response.text();
    if (html.length > 1000000) throw new Error('Official FAQ source is too large');
    const body = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
      || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
    if (!body) throw new Error('Official FAQ article body is missing');
    const text = stripHtml(body.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ''))
      .replace(/\s+/g, ' ').trim();
    if (text.length < 100 || !new RegExp(source.topic, 'i').test(text)) throw new Error('Official FAQ body does not match the topic');
    const enriched = boundedFaqSource(`Title: ${source.topic}\nUrl: ${source.url}\n已读取官方正文：${text}`);
    return items.map((item) => item === source.item ? enriched : item);
  } catch {
    // A feed's discussion metadata is not the article at its linked official URL.
    return /Comments URL:|# Comments:/i.test(source.item) ? items.filter((item) => item !== source.item) : items;
  } finally {
    clearTimeout(timer);
  }
}

export function buildStandaloneDailyFaqPromptInput(dateStr, markdown, selectedItems, context = {}) {
  if (/^##[^\r\n]*(?:相关问题|FAQ)/im.test(markdown)) return null;

  const chosen = context.catalogUrl && context.topics?.length
    ? selectDailyFaqPrimarySource(selectedItems, context.topics, markdown) : null;
  const project = !chosen ? (selectedItems || [])
    .map((item) => ({ item: String(item || ''), url: getSourceUrl(item) }))
    .filter(({ item, url }) => /^Project Name:/m.test(item) &&
      /^https:\/\/github\.com\/[^/\s]+\/[^/\s?#]+\/?$/i.test(url) && markdown.includes(url))
    .sort((left, right) => markdown.indexOf(left.url) - markdown.indexOf(right.url))[0] : null;
  const source = chosen || project;
  if (!source) return null;

  const sourceText = chosen ? boundedFaqSource(source.item) : source.item.slice(0, 1400);
  if (!chosen) return {
    sourceUrl: source.url,
    sourceText,
    topic: '',
    prompt: [
      `日期：${dateStr}。只根据下面这个正文已引用的原项目仓库，回答一个读者真会问的技术问题。`,
      `唯一可引用的原始链接：${source.url}`,
      sourceText,
      '只输出 `## **❓ 相关问题**`、一个包含项目名的 `###` 问句和 2-3 句直接答案；答案中自然链接一次上述仓库。',
      '优先问“这个项目属于什么、解决什么明确问题”，首句直接回答，再说与读者容易混淆的另一类工具有何不同。只能使用仓库描述明确提供的能力，不推断兼容框架、API、安全保证、性能、收费或新功能。',
      '不要复述今日星标数，不要用“具体细节请看仓库”替代答案；如果输入描述不足以说清区别，就输出空字符串。',
      '这是技术问题，不要写购买建议或主站链接。',
    ].join('\n\n'),
  };
  return {
    sourceUrl: source.url,
    sourceText,
    topic: chosen.topic,
    prompt: [
      `日期：${dateStr}。只根据下面这条已经进入正文的一手来源，写一个关于 ${chosen.topic} 的真实购买前问题。`,
      `唯一可引用的原始链接：${source.url}`,
      sourceText,
      '只输出 `## **❓ 相关问题**`、一个 `###` 问句和 2-3 句直接答案；答案中自然链接一次上述原始来源。',
      ...(source.url === 'https://github.com/cursor/plugins' ? [
        '这条来源只证明 Cursor 官方插件仓库和规范的用途，不包含会员权限。优先问“选购 Cursor 前，官方插件库能帮我做什么？”；直接解释编辑器扩展，不要问购买后能否立即使用，不得从仓库公开推导付费用户权限或安装兼容性。',
      ] : []),
      `问句必须出现“${chosen.topic}”及“购买/选购/订阅/账号/额度/套餐/付费”之一。首句直接回答；若来源写明套餐、试用人群或开放顺序，准确说出，不要统一写成“官方未说明”。`,
      '明确区分“当前可用”“受邀试用”“未来开放”；计划从某套餐开始开放，不等于今天买它就能用。只有输入确实没有细节时，才说“当前素材无法确认”，不要断言完整公告未提及。',
      '2-3 个短句，尽量每句不超过 45 字；具体说谁现在能用、买家今天该怎么判断。自然嵌入证据链接，不重复新闻，不用“建议向官方确认”代替已知答案。',
      '来源没有价格或额度，并不妨碍回答有证据的功能边界问题；不主动添加价格、额度或购买承诺。',
      '不编造价格、额度、地区、购买承诺或未提供的功能；不写主站链接，后处理会决定是否加入。没有可直接回答的问题就输出空字符串。',
    ].join('\n\n'),
  };
}

export function normalizeStandaloneDailyFaqSection(markdown, sourceUrl, sourceText, topic = '') {
  const text = String(markdown || '').trim();
  if (!/^## \*\*❓ 相关问题\*\*\s*\n\s*### [^\n?？]+[?？]/u.test(text)) return '';
  if ((text.match(/^## /gm) || []).length !== 1 || (text.match(/^### /gm) || []).length !== 1) return '';
  const links = [...text.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map((match) => match[1]);
  if (links.length !== 1 || links[0] !== sourceUrl || /aivora\.cn/i.test(text)) return '';
  const question = text.match(/^###\s+([^\r\n]+)/m)?.[1] || '';
  if (topic && (!new RegExp(topic, 'i').test(question) ||
      !/(?:购买|选购|订阅|充值|账号|额度|套餐|付费|支付)/i.test(question))) return '';
  const answer = text.split(/^### [^\n]+$/m)[1]?.trim() || '';
  if (answer.length < 40 || answer.length > 420) return '';
  if (/价格(?:为|是|降|涨|低于|高于)|售价|库存|无限(?:使用|额度)|质保|官方订阅|保证可用/.test(answer)) return '';
  for (const number of answer.match(/\d+(?:\.\d+)?/g) || []) {
    if (!String(sourceText || '').includes(number)) return '';
  }
  return text;
}

export function insertStandaloneDailyFaq(markdown, section) {
  const content = String(markdown || '').trimEnd();
  const footer = content.match(/\n---\s*\n\s*## \*\*(?:关于爱窝啦·AI账号店|AI资讯日报语音版)\*\*/);
  if (!footer) return `${content}\n\n${section.trim()}\n`;
  return `${content.slice(0, footer.index).trimEnd()}\n\n${section.trim()}\n${content.slice(footer.index)}`;
}

export async function withDailyFaqDeadline(task, timeoutMs = 20000) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Optional FAQ generation timed out')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
