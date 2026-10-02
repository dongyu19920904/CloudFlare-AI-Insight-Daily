export function getDailyPublicationPolicy({ scheduledTime, now = Date.now(), topEligibleItems }) {
  const timestamp = Number(scheduledTime ?? now);
  const shanghaiHour = (new Date(timestamp).getUTCHours() + 8) % 24;
  const lateAttempt = shanghaiHour >= 10;
  return {
    lateAttempt,
    waitForTen: !lateAttempt && topEligibleItems < 10,
    minimumTopItems: lateAttempt ? 1 : 10,
  };
}
