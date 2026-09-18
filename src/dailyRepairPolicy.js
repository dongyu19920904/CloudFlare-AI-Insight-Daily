export function scoreDailyQualityWarnings(warnings = []) {
  return warnings.reduce((score, warning) => {
    const text = String(warning || "");
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
