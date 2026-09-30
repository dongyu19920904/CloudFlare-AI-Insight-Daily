const OFFICIAL_HOSTS = new Set([
  'openai.com', 'developers.openai.com', 'anthropic.com', 'docs.anthropic.com',
  'blog.google', 'ai.google.dev', 'deepmind.google', 'cursor.com',
  'microsoft.com', 'learn.microsoft.com', 'minimax.io', 'x.ai',
]);
const OFFICIAL_SOCIAL_HANDLES = new Set(['openai', 'anthropicai', 'geminiapp']);

function getSourceUrl(item) {
  return String(item || '').match(/^Url:\s*(https?:\/\/\S+)/im)?.[1] || '';
}

function isPrimarySource(item, url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const parts = parsed.pathname.split('/').filter(Boolean);
    return OFFICIAL_HOSTS.has(host) ||
      (host === 'x.com' && parts[1] === 'status' && OFFICIAL_SOCIAL_HANDLES.has(parts[0]?.toLowerCase()));
  } catch {
    return false;
  }
}

export function buildStandaloneDailyFaqPromptInput(dateStr, markdown, selectedItems, context = {}) {
  if (/^##[^\r\n]*(?:相关问题|FAQ)/im.test(markdown)) return null;

  const candidates = (selectedItems || [])
    .map((item) => ({ item: String(item || ''), url: getSourceUrl(item) }))
    .filter(({ item, url }) => url && markdown.includes(url) && isPrimarySource(item, url));
  const chosen = context.catalogUrl && context.topics?.length ? candidates.map((candidate) => ({
    ...candidate,
    topic: context.topics.find((topic) => new RegExp(topic, 'i').test(candidate.item)),
  })).find((candidate) => candidate.topic) : null;
  const project = !chosen ? (selectedItems || [])
    .map((item) => ({ item: String(item || ''), url: getSourceUrl(item) }))
    .filter(({ item, url }) => /^Project Name:/m.test(item) &&
      /^https:\/\/github\.com\/[^/\s]+\/[^/\s?#]+\/?$/i.test(url) && markdown.includes(url))
    .sort((left, right) => markdown.indexOf(left.url) - markdown.indexOf(right.url))[0] : null;
  const source = chosen || project;
  if (!source) return null;

  const sourceText = source.item.slice(0, 1400);
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
      `问句必须出现“${chosen.topic}”及“购买/选购/订阅/账号/额度/套餐/付费”之一，先回答来源能证明的事实，再说明不能推断所有套餐都支持新闻功能。`,
      '购买前问题可以只问官方演示了什么、哪些套餐差异尚未确认；来源没有价格或额度，并不妨碍回答这个有证据的功能边界问题。不要反过来补写价格、额度或购买承诺。',
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
