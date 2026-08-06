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

  return warnings;
}
