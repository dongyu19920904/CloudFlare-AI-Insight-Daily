import { dailyInlineLinkRanges } from './dailyMarkdownItems.js';

const NEWS_SECTIONS = /^(?:今日焦点|产品与功能更新|前沿研究|行业(?:变化|展望)|开源\s*TOP|社媒精选|AI\s*趣闻)/iu;
const INLINE_MARKUP = /`+[^`\r\n]+`+|<[^>\r\n]+>|https?:\/\/[^\s<>]+/g;
const EMOJIS = /\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F)\uFE0F?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?)*/gu;
const TOPIC_ICONS = [
  [/签证|拘留|法院|监管|合规|法律|政策|版权/i, '📄'],
  [/数学|定理|猜想|黎曼|形式化证明/i, '📐'],
  [/元素周期表|化学|实验|基准|评测/i, '🧪'],
  [/听写|语音|音频|配音|转写|播客/i, '🎙️'],
  [/视频|剪辑|镜头|电影|动画/i, '🎬'],
  [/翻译|多语|译文|润色|写作|文案/i, '📝'],
  [/代码审查|审查代码|\breview\b/i, '🔍'],
  [/\bIPO\b|上市|融资|财报|定价|价格|成本/i, '📊'],
  [/评判标准|衡量|评分|指标/i, '📏'],
  [/核心决策|产品负责人|产品思路|路线图/i, '🧭'],
  [/开源|发布权重|GitHub 仓库/i, '📦'],
  [/开发|编程|代码|IDE\b/i, '💻'],
  [/用户(?:报告|反馈)|体验|讨论|社区/i, '💬'],
  [/论文|研究|报告|数据/i, '📄'],
  [/智能体|Agent\b|工作流|自动化/i, '⚙️'],
];

function maskInline(markdown) {
  let masked = markdown;
  for (const { start, end } of dailyInlineLinkRanges(markdown).reverse()) {
    masked = masked.slice(0, start) + masked.slice(start, end).replace(/[^\r\n]/g, ' ') + masked.slice(end);
  }
  return masked.replace(INLINE_MARKUP, match => ' '.repeat(match.length));
}

function markLead(line, visible, emoji) {
  const bold = line.match(/^[ \t]*\*\*[^*\r\n]+\*\*/)?.[0];
  if (bold) return `${bold} ${emoji}${line.slice(bold.length)}`;
  const unmarked = visible.replace(/\*\*[^*\r\n]+\*\*/g, match => ' '.repeat(match.length));
  const at = unmarked.search(/[。！？；]/u);
  if (at >= 0) return `${line.slice(0, at)}${emoji}${line.slice(at)}`;
  const end = visible.trimEnd().length;
  return `${line.slice(0, end)} ${emoji}${line.slice(end)}`;
}

export function ensureDailyNewsEmoji(markdown) {
  const content = String(markdown || '');
  const splitLines = text => text.match(/[^\n]*\n|[^\n]+$/g) || [];
  const lines = splitLines(content);
  const visible = splitLines(maskInline(content));
  let section = '';
  let item;
  let fence;
  function finish() {
    if (!item?.body.length) return;
    let kept = false;
    for (const index of item.body) {
      const extras = [];
      for (const match of visible[index].matchAll(EMOJIS)) {
        if (kept) extras.push(match);
        kept = true;
      }
      for (const match of extras.reverse()) {
        lines[index] = lines[index].slice(0, match.index) + lines[index].slice(match.index + match[0].length);
      }
    }
    if (kept || item.lead === undefined) return;
    const prose = item.body.map(index => visible[index]).join(' ');
    const icon = TOPIC_ICONS.find(([pattern]) => pattern.test(item.title))?.[1] ||
      TOPIC_ICONS.find(([pattern]) => pattern.test(prose))?.[1] ||
      (/前沿研究/.test(section) ? '📄' : /社媒精选/.test(section) ? '💬' : /趣闻/.test(section) ? '🧩' : '📌');
    lines[item.lead] = markLead(lines[item.lead], visible[item.lead], icon);
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const boundary = line.match(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)/);
    if (boundary) {
      const opener = boundary[1];
      if (!fence) fence = opener;
      else if (opener[0] === fence[0] && opener.length >= fence.length && !boundary[2].trim()) fence = null;
      continue;
    }
    if (fence) continue;
    const heading = line.match(/^(#{2,3})[ \t]+([^\r\n]+)/);
    if (heading) {
      finish();
      if (heading[1] === '##') section = heading[2].replace(/^[^\p{L}\p{N}]+/u, '');
      item = heading[1] === '###' && NEWS_SECTIONS.test(section) ? { title: heading[2], body: [] } : null;
    } else if (item && !/^[ \t]*(?:[!<>|#]|[-*+][ \t]|\d+[.)][ \t])/u.test(line)) {
      const prose = /[\p{L}\p{N}]/u.test(visible[index]);
      if (prose) item.lead ??= index;
      if (prose || [...visible[index].matchAll(EMOJIS)].length) item.body.push(index);
    }
  }
  finish();
  return lines.join('');
}
