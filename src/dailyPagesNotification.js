const FRONTEND_REPO = 'dongyu19920904/Hextra-AI-Insight-Daily';
const DISPATCH_TYPE = 'ai-daily-report-ready';
const WORKER_VIDEO = /<video controls preload="metadata" playsinline style="max-width:100%; height:auto;" src="([^"<>\s\\]+)"><\/video>/g;

export function normalizeDailyPagesVideos(markdown) {
  return markdown.replace(WORKER_VIDEO, (tag, source) => {
    try {
      const url = new URL(source);
      if (!url.hostname || url.username || url.password) return '';
      if (url.protocol === 'https:') return tag;
      if (url.protocol === 'http:') return `[\u89c2\u770b\u539f\u89c6\u9891](<${url.href}>)`;
    } catch { /* An invalid URL is neither a video nor a link. */ }
    return '';
  });
}

export async function notifyDailyPages(env, date, fetchImpl = fetch) {
  const target = `${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}`;
  if (target !== FRONTEND_REPO || env.GITHUB_BRANCH !== 'main' || !env.GITHUB_TOKEN ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { sent: false, reason: 'not-configured' };
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date) {
    return { sent: false, reason: 'invalid-date' };
  }

  try {
    const response = await fetchImpl(`https://api.github.com/repos/${FRONTEND_REPO}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'AivoraDailyPublication/1.0',
      },
      body: JSON.stringify({ event_type: DISPATCH_TYPE, client_payload: { date } }),
      redirect: 'error',
      signal: AbortSignal.timeout(2200),
    });
    return response.status === 204 ? { sent: true } : { sent: false, reason: 'http-error', status: response.status };
  } catch {
    // Do not repeat an ambiguous dispatch or retry the already-written edition.
    return { sent: false, reason: 'notification-unavailable' };
  }
}
