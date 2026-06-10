export function extractCronMinute(schedule) {
  const firstField = String(schedule || "").trim().split(/\s+/)[0] || "";
  if (!/^\d+$/.test(firstField)) {
    return null;
  }

  const minute = Number.parseInt(firstField, 10);
  return Number.isFinite(minute) ? minute : null;
}

export function extractCronHour(schedule) {
  const hourField = String(schedule || "").trim().split(/\s+/)[1] || "";
  if (!/^\d+$/.test(hourField)) {
    return null;
  }

  const hour = Number.parseInt(hourField, 10);
  return Number.isFinite(hour) ? hour : null;
}

function extractScheduledUtcMinute(scheduledTime) {
  const timestamp = Number(scheduledTime);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).getUTCMinutes();
}

function extractScheduledUtcHour(scheduledTime) {
  const timestamp = Number(scheduledTime);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).getUTCHours();
}

function normalizeCron(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function resolveScheduledModeFromEvent(event, env, mode = "auto") {
  if (mode && mode !== "auto") {
    return mode;
  }

  const cron = normalizeCron(event?.cron);
  const exactCronModes = [
    ["daily-prefetch", env?.DAILY_PREFETCH_CRON_SCHEDULE],
    ["daily-backup", env?.DAILY_BACKUP_CRON_SCHEDULE],
    ["backup", env?.BACKUP_CRON_SCHEDULE],
    ["account-opportunity", env?.ACCOUNT_OPPORTUNITY_CRON_SCHEDULE],
    ["opportunity", env?.OPPORTUNITY_CRON_SCHEDULE],
    ["daily", env?.DAILY_CRON_SCHEDULE],
  ];

  for (const [candidateMode, candidateCron] of exactCronModes) {
    if (cron && cron === normalizeCron(candidateCron)) {
      return candidateMode;
    }
  }

  const utcMinute = extractScheduledUtcMinute(event?.scheduledTime);
  const utcHour = extractScheduledUtcHour(event?.scheduledTime);
  if (Number.isFinite(utcMinute) && Number.isFinite(utcHour)) {
    const modeByMinute = [
      ["daily-prefetch", extractCronMinute(env?.DAILY_PREFETCH_CRON_SCHEDULE)],
      ["daily", extractCronMinute(env?.DAILY_CRON_SCHEDULE)],
      ["daily-backup", extractCronMinute(env?.DAILY_BACKUP_CRON_SCHEDULE)],
      ["opportunity", extractCronMinute(env?.OPPORTUNITY_CRON_SCHEDULE)],
      [
        "account-opportunity",
        extractCronMinute(env?.ACCOUNT_OPPORTUNITY_CRON_SCHEDULE),
      ],
    ];

    for (const [candidateMode, candidateMinute] of modeByMinute) {
      const candidateCron = exactCronModes.find(([modeName]) => modeName === candidateMode)?.[1];
      const candidateHour = extractCronHour(candidateCron);
      if (
        Number.isFinite(candidateMinute) &&
        Number.isFinite(candidateHour) &&
        utcMinute === candidateMinute &&
        utcHour === candidateHour
      ) {
        return candidateMode;
      }
    }
  }

  return "daily";
}
