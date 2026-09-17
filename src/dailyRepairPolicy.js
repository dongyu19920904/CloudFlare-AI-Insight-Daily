export function scoreDailyQualityWarnings(warnings = []) {
  return warnings.reduce((score, warning) => {
    const text = String(warning || "");
    const readabilityMatch = text.match(/dense long sentences:\s*(\d+)\/\d+ over 55 chars, p90 \d+, max (\d+)/i);
    if (readabilityMatch) {
      const overlong = Number.parseInt(readabilityMatch[1], 10);
      const longest = Number.parseInt(readabilityMatch[2], 10);
      return score + overlong + Math.ceil(Math.max(0, longest - 75) / 20);
    }
    const targetMatch = text.match(/expected\s+(\d+),\s*got\s+(\d+)/i);
    if (targetMatch) {
      const expected = Number.parseInt(targetMatch[1], 10);
      const actual = Number.parseInt(targetMatch[2], 10);
      return score + Math.max(1, expected - actual);
    }

    const countMatch = text.match(/:\s*(\d+)\s*$/);
    if (countMatch) {
      return score + Math.max(1, Number.parseInt(countMatch[1], 10));
    }

    return score + 1;
  }, 0);
}

function getSectionDeficits(warnings = []) {
  const deficits = new Map();
  for (const warning of warnings) {
    const match = String(warning || "").match(/^Daily (.+?) (?:is|are) below target: expected (\d+), got (\d+)/i);
    if (match) deficits.set(match[1], Math.max(0, Number(match[2]) - Number(match[3])));
  }
  return deficits;
}

function getLongSentenceRatio(warnings = []) {
  const warning = warnings.find((value) => /dense long sentences:/i.test(String(value)));
  const match = String(warning || "").match(/dense long sentences:\s*(\d+)\/(\d+) over 55 chars/i);
  return match ? Number(match[1]) / Math.max(1, Number(match[2])) : 0;
}

export function shouldAdoptDailyRepair({
  initialPassed,
  repairedPassed,
  initialQualityWarningCount = 0,
  repairedQualityWarningCount = 0,
  initialQualityWarnings = [],
  repairedQualityWarnings = [],
  initialTopItemCount = 0,
  repairedTopItemCount = 0,
  targetTopItemCount = 0,
}) {
  if (!repairedPassed) return false;
  if (!initialPassed) return true;

  if (getLongSentenceRatio(repairedQualityWarnings) > getLongSentenceRatio(initialQualityWarnings)) return false;

  const initialDeficits = getSectionDeficits(initialQualityWarnings);
  for (const [section, deficit] of getSectionDeficits(repairedQualityWarnings)) {
    if (deficit > (initialDeficits.get(section) || 0)) return false;
  }
  if (
    repairedQualityWarnings.some((warning) => /Daily TOP must contain at most one GitHub\/open-source project item/i.test(warning)) &&
    !initialQualityWarnings.some((warning) => /Daily TOP must contain at most one GitHub\/open-source project item/i.test(warning))
  ) return false;

  const initialQualityScore = initialQualityWarnings.length > 0
    ? scoreDailyQualityWarnings(initialQualityWarnings)
    : initialQualityWarningCount;
  const repairedQualityScore = repairedQualityWarnings.length > 0
    ? scoreDailyQualityWarnings(repairedQualityWarnings)
    : repairedQualityWarningCount;

  if (
    targetTopItemCount > 0 &&
    repairedTopItemCount > initialTopItemCount &&
    repairedTopItemCount <= targetTopItemCount &&
    repairedQualityScore <= initialQualityScore
  ) {
    return true;
  }
  return repairedQualityScore < initialQualityScore;
}
