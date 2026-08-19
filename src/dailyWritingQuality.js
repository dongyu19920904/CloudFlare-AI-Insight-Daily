import { extractNumberedDailyItems } from "./dailyMarkdownItems.js";

const GENERIC_JUDGMENT_PHRASES = [
  "这意味着",
  "值得关注",
  "值得注意的是",
  "意义重大",
  "未来可期",
  "可以看出",
  "不难发现",
];

const MODEL_JARGON_PHRASES = [
  "赋能",
  "商业闭环",
  "价值闭环",
  "底层逻辑",
  "降本增效",
  "全链路",
  "结构性机会",
  "打开想象空间",
];

function maskNonProse(markdown) {
  return String(markdown || "")
    .replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<(?:video|audio|iframe)\b[\s\S]*?<\/(?:video|audio|iframe)>/gi, "")
    .replace(/!\[[^\]]*\]\([^\n)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^\n)]*\)/g, "$1")
    .replace(/https?:\/\/[^\s)>]+/g, "")
    .replace(/^#{1,6}\s+.*\r?$/gm, "")
    .replace(/^---\s*\r?$/gm, "");
}

function countPhrases(text, phrases) {
  return phrases.reduce((total, phrase) => total + text.split(phrase).length - 1, 0);
}

function countVisibleCharacters(text) {
  return (String(text || "").match(/[A-Za-z0-9\u4e00-\u9fff]/g) || []).length;
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index];
}

function countBodySentences(text) {
  return (maskNonProse(text).match(/[^。！？!?]+[。！？!?]?/g) || [])
    .map((sentence) => countVisibleCharacters(sentence))
    .filter((length) => length >= 3).length;
}

function isGenericSourceOnlyLinkLabel(label) {
  const compact = String(label || "")
    .normalize("NFKC")
    .replace(/[\s·：:，,。.!！?？、“”‘’（）()【】\[\]]+/g, "")
    .toLowerCase();
  if (!compact) return true;

  return (
    /^(?:(?:aibase|36氪|机器之心|量子位|新智元|晚点|官方|作者|开发者|媒体|频道)?(?:的)?(?:对这项消息的)?(?:(?:整理|转发)(?:的)?|独家|实测)?(?:原文|来源|详情|报道|公告|通知|推文|原帖|分析帖|频道消息|日报|项目主页|项目仓库|价格表|官方文档|官方页面)(?:显示|称|指出)?|点击查看|了解更多)$/i.test(compact) ||
    /^[\u3400-\u9fffA-Za-z0-9._-]{1,20}(?:官方)?(?:推文|帖子|公告|页面|文档|报道)(?:显示|宣布|介绍|说明|称|指出)$/i.test(compact) ||
    /^[\u3400-\u9fffA-Za-z0-9._-]{1,16}(?:整理|分享|发布|转发|实测|展示)(?:的)?(?:技术细节|实测记录|截图推文|截图|视频|推文|帖子|内容|介绍|消息|分析|演示)$/i.test(compact) ||
    /^[\u3400-\u9fffA-Za-z0-9._-]{1,16}(?:的)?(?:技术细节|实测记录|截图推文|频道消息|报道详情)$/i.test(compact)
  );
}

function isAwkwardDailyFactLinkLabel(label) {
  const text = String(label || "").normalize("NFKC").trim();
  const sourceLed = /^(?:AIBase|36氪|机器之心|量子位|新智元|晚点|Telegram|推特|X\s*平台|GitHub|Hugging\s*Face|官方|作者|开发者|媒体|频道)[^，。；:：]{0,24}(?:报道|整理|公告|介绍|显示|称|指出|说明|发布|原帖|页面|文档|项目页)/i.test(text);
  return countVisibleCharacters(text) > 24 || sourceLed;
}

export function analyzeDailyPresentationQuality(pageMarkdown) {
  const topItems = extractNumberedDailyItems(pageMarkdown);
  let genericSourceLinkCount = 0;
  let awkwardFactLinkCount = 0;
  let underHighlightedItemCount = 0;
  let overHighlightedItemCount = 0;
  let sparseItemCount = 0;

  for (const item of topItems) {
    const boldSpans = [...item.body.matchAll(/\*\*([^*\r\n]+)\*\*/g)]
      .map((match) => match[1].trim())
      .filter(Boolean);
    const visibleBodyLength = countVisibleCharacters(maskNonProse(item.body));
    const highlightedLength = boldSpans.reduce(
      (total, span) => total + countVisibleCharacters(span),
      0,
    );

    if (item.bodyLinks.some((link) => isGenericSourceOnlyLinkLabel(link.title))) {
      genericSourceLinkCount += 1;
    }
    if (item.bodyLinks.some((link) => isAwkwardDailyFactLinkLabel(link.title))) {
      awkwardFactLinkCount += 1;
    }
    if (boldSpans.length < 3) underHighlightedItemCount += 1;
    if (
      boldSpans.length > 4 ||
      (visibleBodyLength > 0 && highlightedLength / visibleBodyLength > 0.34)
    ) {
      overHighlightedItemCount += 1;
    }
    if (visibleBodyLength < 85 || countBodySentences(item.body) < 3) {
      sparseItemCount += 1;
    }
  }

  return {
    topItemCount: topItems.length,
    genericSourceLinkCount,
    awkwardFactLinkCount,
    underHighlightedItemCount,
    overHighlightedItemCount,
    sparseItemCount,
  };
}

export function analyzeDailyReadability(pageMarkdown) {
  const prose = maskNonProse(pageMarkdown);
  const sentenceLengths = (prose.match(/[^。！？!?]+[。！？!?]?/g) || [])
    .map((sentence) => countVisibleCharacters(sentence))
    .filter((length) => length >= 3);

  return {
    sentenceCount: sentenceLengths.length,
    overlongSentenceCount: sentenceLengths.filter((length) => length > 55).length,
    veryLongSentenceCount: sentenceLengths.filter((length) => length > 75).length,
    p90SentenceLength: percentile(sentenceLengths, 0.9),
    maxSentenceLength: sentenceLengths.length ? Math.max(...sentenceLengths) : 0,
    semicolonCount: (prose.match(/[；;]/g) || []).length,
  };
}

export function collectDailyWritingStyleWarnings(pageMarkdown) {
  const prose = maskNonProse(pageMarkdown);
  const warnings = [];
  const readability = analyzeDailyReadability(pageMarkdown);
  const presentation = analyzeDailyPresentationQuality(pageMarkdown);
  const genericJudgmentCount = countPhrases(prose, GENERIC_JUDGMENT_PHRASES);
  const jargonCount = countPhrases(prose, MODEL_JARGON_PHRASES);
  const repeatedWorthTemplateCount = (prose.match(/这是一个值得[^。！？\n]{0,24}(?:信号|时机|机会|窗口)/g) || []).length;
  const audienceTemplateCount = (prose.match(/对于[^。！？\n]{2,48}来说/g) || []).length;

  if (genericJudgmentCount >= 3) {
    warnings.push(
      `Daily writing style repeats generic judgment phrases: ${genericJudgmentCount}`
    );
  }
  if (jargonCount >= 2) {
    warnings.push(`Daily writing style uses dense model/business jargon: ${jargonCount}`);
  }
  if (repeatedWorthTemplateCount >= 2) {
    warnings.push(
      `Daily writing style repeats the "这是一个值得..." template: ${repeatedWorthTemplateCount}`
    );
  }
  if (audienceTemplateCount >= 3) {
    warnings.push(
      `Daily writing style repeats the "对于...来说" template: ${audienceTemplateCount}`
    );
  }
  if (
    readability.veryLongSentenceCount >= 2 ||
    readability.overlongSentenceCount >= 4
  ) {
    warnings.push(
      `Daily writing has dense long sentences: ${readability.overlongSentenceCount}/${readability.sentenceCount} over 55 chars, p90 ${readability.p90SentenceLength}, max ${readability.maxSentenceLength}`
    );
  }
  if (readability.semicolonCount >= 4) {
    warnings.push(
      `Daily writing overuses semicolons instead of full stops: ${readability.semicolonCount}`
    );
  }
  if (presentation.genericSourceLinkCount > 0) {
    warnings.push(
      `Daily TOP uses generic source-only link labels: ${presentation.genericSourceLinkCount}`
    );
  }
  if (presentation.awkwardFactLinkCount >= 2) {
    warnings.push(
      `Daily TOP uses awkward source-led or overlong link anchors: ${presentation.awkwardFactLinkCount}`
    );
  }
  if (presentation.underHighlightedItemCount >= 2) {
    warnings.push(
      `Daily TOP items have too few short highlights: ${presentation.underHighlightedItemCount}`
    );
  }
  if (presentation.overHighlightedItemCount > 0) {
    warnings.push(
      `Daily TOP items overuse highlighted text: ${presentation.overHighlightedItemCount}`
    );
  }
  if (presentation.sparseItemCount >= 2) {
    warnings.push(
      `Daily TOP items are too sparse for quick reading: ${presentation.sparseItemCount}`
    );
  }

  return warnings;
}
