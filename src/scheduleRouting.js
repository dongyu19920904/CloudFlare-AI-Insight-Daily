export function extractCronMinute(schedule) {
  const firstField = String(schedule || "").trim().split(/\s+/)[0] || "";
  const firstMinute = firstField.split(",")[0] || "";
  if (!/^\d+$/.test(firstMinute)) {
    return null;
  }

  const minute = Number.parseInt(firstMinute, 10);
  return Number.isFinite(minute) ? minute : null;
}

function cronIncludesMinute(schedule, targetMinute) {
  const firstField = String(schedule || "").trim().split(/\s+/)[0] || "";
  if (!Number.isFinite(targetMinute)) {
    return false;
  }

  return firstField
    .split(",")
    .map((minute) => Number.parseInt(minute, 10))
    .some((minute) => Number.isFinite(minute) && minute === targetMinute);
}

function extractScheduledUtcMinute(scheduledTime) {
  const timestamp = Number(scheduledTime);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).getUTCMinutes();
}

export function resolveScheduledModeFromEvent(event, env, mode = "auto") {
  if (mode && mode !== "auto") {
    return mode;
  }

  const utcMinute = extractScheduledUtcMinute(event?.scheduledTime);
  if (Number.isFinite(utcMinute)) {
    const modeByMinute = [
      ["daily", extractCronMinute(env?.DAILY_CRON_SCHEDULE)],
      ["daily-backup", extractCronMinute(env?.DAILY_BACKUP_CRON_SCHEDULE)],
      ["daily", env?.DAILY_RESCUE_CRON_SCHEDULE],
      ["opportunity", extractCronMinute(env?.OPPORTUNITY_CRON_SCHEDULE)],
      [
        "account-opportunity",
        extractCronMinute(env?.ACCOUNT_OPPORTUNITY_CRON_SCHEDULE),
      ],
    ];

    for (const [candidateMode, candidateMinute] of modeByMinute) {
      if (
        typeof candidateMinute === "string"
          ? cronIncludesMinute(candidateMinute, utcMinute)
          : Number.isFinite(candidateMinute) && utcMinute === candidateMinute
      ) {
        return candidateMode;
      }
    }
  }

  const cron = String(event?.cron || "").trim();
  if (cron && cron === String(env?.DAILY_BACKUP_CRON_SCHEDULE || "").trim()) {
    return "daily-backup";
  }
  if (cron && cron === String(env?.DAILY_RESCUE_CRON_SCHEDULE || "").trim()) {
    return "daily";
  }
  if (cron && cron === String(env?.BACKUP_CRON_SCHEDULE || "").trim()) {
    return "backup";
  }
  if (cron && cron === String(env?.ACCOUNT_OPPORTUNITY_CRON_SCHEDULE || "").trim()) {
    return "account-opportunity";
  }
  if (cron && cron === String(env?.OPPORTUNITY_CRON_SCHEDULE || "").trim()) {
    return "opportunity";
  }
  if (cron && cron === String(env?.DAILY_CRON_SCHEDULE || "").trim()) {
    return "daily";
  }

  return "daily";
}
