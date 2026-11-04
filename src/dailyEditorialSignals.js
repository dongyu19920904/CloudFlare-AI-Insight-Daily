import { stripHtml } from './helpers.js';

const MAJOR_PRODUCT = /\b(?:openai|chatgpt|gpt[\s-]?\d|codex|anthropic|claude|opus|sonnet|fable|google|gemini|deepmind|deepseek|qwen|kimi|grok|nvidia|hyra|sensenova|longcat)\b|混元|讯飞|星火|商汤|智谱|豆包|通义|英伟达/i;
const UPDATE = /发布|推出|上线|开放|开源|更新|新增|支持|现在可以|已经可以|已可|停用|下线|关闭|禁用|降价|涨价|introduc|announc|launch|release|roll(?:ing)? out|now (?:available|support)/i;

function titleOf(item) {
  return String(item?.title || '').replace(/^发布了[:：]\s*/, '').replace(/\s+/g, ' ').trim();
}

export function focusDailyDigestItem(item) {
  if (!/^AI\s*日报[:：]/i.test(titleOf(item))) return item;
  const html = String(item?.details?.content_html || '');
  const first = /<p\b[^>]*>\s*<strong\b[^>]*>\s*1[、.．][\s\S]*?<\/strong>\s*<\/p>/i.exec(html);
  if (!first) return item;
  const following = html.slice(first.index + first[0].length);
  const next = /<p\b[^>]*>\s*<strong\b[^>]*>\s*2[、.．]/i.exec(following);
  if (!next) return item;
  const focusedHtml = first[0] + following.slice(0, next.index);
  return { ...item, title: stripHtml(first[0]).replace(/^1[、.．]\s*/, ''),
    description: stripHtml(focusedHtml), details: { ...item.details, content_html: focusedHtml } };
}

export function dailyItemBody(item) {
  return stripHtml(String(item?.details?.articleEvidence?.excerpt || item?.plainText || item?.details?.content_html || item?.description || '')
    .replace(/<img\b[^>]*>|<video\b[^>]*>[\s\S]*?<\/video>/gi, ''))
    .replace(/\[图片:[^\]]*\]/g, '')
    .replace(/Article URL:\s*https?:\/\/\S+|Comments URL:\s*https?:\/\/\S+|Points:\s*\d+|#\s*Comments:\s*\d+/gi, '')
    .replace(/AI探索\s*\|[\s\S]*$/i, '')
    .replace(/\s+/g, ' ').trim();
}

export function dailySocialContentFingerprint(item) {
  if (!/^https?:\/\/(?:www\.|m\.)?(?:x\.com|twitter\.com|t\.me|okjike\.com)\//i.test(item?.url || '')) return '';
  const body = dailyItemBody(item).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return body.length >= 80 ? body.slice(0, 80) : '';
}

export function isTitleOnlyDailyItem(item) {
  const compact = (value) => String(value).replace(/&#(?:x[\da-f]+|\d+);/gi, '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const title = compact(titleOf(item));
  const body = compact(dailyItemBody(item));
  return Boolean(title && (!body || (body.startsWith(title) && body.slice(title.length).length < 3)));
}

export function isUnconfirmedDailyModelRumor(item) {
  const title = titleOf(item);
  return /(?:模型|fable\s*\d|gpt[\s-]?\d|opus\s*\d|sonnet\s*\d|gemini\s*\d)/i.test(title)
    && /泄露|传闻|猜测|据传|疑似|leak|rumou?r|尚未.{0,8}发布|还没有正式|未正式发布/i.test(`${title} ${dailyItemBody(item).slice(0, 300)}`)
    && !isOfficialDailyPublisher(item?.url);
}

export function isOfficialDailyPublisher(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (['openai.com', 'developers.openai.com', 'anthropic.com', 'docs.anthropic.com',
      'claude.com', 'blog.google', 'deepmind.google', 'ai.google.dev', 'developers.googleblog.com',
      'deepseek.com', 'api-docs.deepseek.com', 'nvidia.com', 'research.nvidia.com'].includes(host)) return true;
    return ['x.com', 'twitter.com'].includes(host)
      && /^\/(?:openai|anthropicai|claudeai|geminiapp|googleai|googledeepmind|deepseek_ai|nvidia)\//i.test(url.pathname);
  } catch { return false; }
}

export function isMajorDailyProductUpdate(item) {
  const title = titleOf(item);
  const lead = `${title} ${dailyItemBody(item).slice(0, 220)}`;
  const productSubject = MAJOR_PRODUCT.test(title) || (/模型|model|官方|团队版|企业版/i.test(title) && MAJOR_PRODUCT.test(lead));
  return productSubject && UPDATE.test(lead) && !isUnconfirmedDailyModelRumor(item);
}

// Editorial influence comes before illustration availability; missing popularity is not zero popularity.
export function getDailyEditorialPriority(item, referenceTime = NaN) {
  if (isTitleOnlyDailyItem(item)) return -80;
  if (isUnconfirmedDailyModelRumor(item)) return -60;
  let priority = 0;
  if (isMajorDailyProductUpdate(item)) priority += isOfficialDailyPublisher(item?.url) ? 90 : 45;
  const text = `${titleOf(item)} ${dailyItemBody(item).slice(0, 240)}`;
  if (/(?:收购|并购|吞下|买下).{0,35}(?:亿|world\s+labs|AI|模型)|(?:亿|world\s+labs|AI|模型).{0,35}(?:收购|并购|吞下|买下)/i.test(text)) priority += 65;
  if (/微信交流群|加我小号|扫码进群|私信领取|年入百万|全网最大信誉台|U投首选/.test(text)) priority -= 40;
  if (/实测|教程|工具|小工具|编辑器|writing|editor|tool/i.test(text) && Number.isFinite(referenceTime)) {
    const age = referenceTime - Date.parse(item?.published_date || '');
    if (age > 24 * 3600000) priority -= 12;
    if (age > 36 * 3600000) priority -= 12;
  }
  return priority;
}

export function promptItemEditorialData(item) {
  const raw = String(item || '');
  return {
    title: raw.match(/^(?:News Title|Title|Project Name|Papers Title):\s*(.+)$/im)?.[1] || '',
    url: raw.match(/^Url:\s*(https?:\/\/\S+)/im)?.[1] || '',
    plainText: raw.match(/^(?:Content Summary|Content|Abstract\/Content Summary):\s*(.+)$/im)?.[1] || '',
  };
}
