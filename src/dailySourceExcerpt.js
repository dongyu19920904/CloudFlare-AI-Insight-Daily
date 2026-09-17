export function excerptDailyNewsEvidence(text, maxChars = 500) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;

  const headLength = Math.floor(maxChars * 0.48);
  const condition = [...normalized.matchAll(/标准(?:测试)?框架|适配器|provider adapter|基线|对照(?:组|测试)?|测试条件|评测条件/gi)]
    .find((match) => match.index >= headLength);
  if (!condition) return `${normalized.slice(0, maxChars - 1)}…`;

  const separator = " …【后文条件】";
  const start = Math.max(headLength, condition.index - 30);
  const remaining = maxChars - headLength - separator.length - 1;
  const tail = normalized.slice(start, start + remaining);
  return `${normalized.slice(0, headLength)}${separator}${tail}${start + remaining < normalized.length ? "…" : ""}`;
}

export function getDailySourceProvenanceHint(source, url) {
  if (/^https?:\/\/(?:t\.me|telegram\.me)\//i.test(String(url || "")) &&
      /(?:Telegram|频道|Channel)/i.test(String(source || ""))) {
    return "Placement Hint: 此 URL 是 Telegram 频道帖；它提到的机构不等于当前链接发布方。没有机构原始 URL 时，只能称频道转述，不能写成该机构发布官方说明。";
  }
  return "";
}
