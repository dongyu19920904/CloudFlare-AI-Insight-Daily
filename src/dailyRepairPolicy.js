export function shouldAdoptDailyRepair({
  initialPassed,
  repairedPassed,
  initialQualityWarningCount = 0,
  repairedQualityWarningCount = 0,
  initialTopItemCount = 0,
  repairedTopItemCount = 0,
  targetTopItemCount = 0,
}) {
  if (!repairedPassed) return false;
  if (!initialPassed) return true;
  if (
    targetTopItemCount > 0 &&
    repairedTopItemCount > initialTopItemCount &&
    repairedTopItemCount <= targetTopItemCount
  ) {
    return true;
  }
  return repairedQualityWarningCount < initialQualityWarningCount;
}
