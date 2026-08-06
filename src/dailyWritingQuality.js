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
    .replace(/\]\([^\n)]*\)/g, "]")
    .replace(/https?:\/\/[^\s)>]+/g, "")
    .replace(/^#{1,6}\s+.*$/gm, "");
}

function countPhrases(text, phrases) {
  return phrases.reduce((total, phrase) => total + text.split(phrase).length - 1, 0);
}

export function collectDailyWritingStyleWarnings(pageMarkdown) {
  const prose = maskNonProse(pageMarkdown);
  const warnings = [];
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

  return warnings;
}
