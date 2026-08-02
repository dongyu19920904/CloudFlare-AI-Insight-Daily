export function shouldAdoptDailyRepair({
  initialPassed,
  repairedPassed,
  initialQualityWarningCount = 0,
  repairedQualityWarningCount = 0,
}) {
  if (!repairedPassed) return false;
  if (!initialPassed) return true;
  return repairedQualityWarningCount < initialQualityWarningCount;
}
