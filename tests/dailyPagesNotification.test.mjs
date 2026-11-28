import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { normalizeDailyPagesVideos, notifyDailyPages } from '../src/dailyPagesNotification.js';
import { convertPlaceholdersToMarkdownImages } from '../src/helpers.js';
import { resolveScheduledModeFromEvent } from '../src/scheduleRouting.js';

const approved = {
  GITHUB_REPO_OWNER: 'dongyu19920904', GITHUB_REPO_NAME: 'Hextra-AI-Insight-Daily',
  GITHUB_BRANCH: 'main', GITHUB_TOKEN: 'fixture',
};

test('sends a single publication notification to the configured AI Daily frontend', async () => {
  let called = 0;
  const result = await notifyDailyPages(approved, '2026-11-24', async (url, request) => {
    called++;
    assert.equal(url, 'https://api.github.com/repos/dongyu19920904/Hextra-AI-Insight-Daily/dispatches');
    assert.equal(request.method, 'POST');
    assert.equal(request.redirect, 'manual');
    assert.deepEqual(JSON.parse(request.body), { event_type: 'ai-daily-report-ready', client_payload: { date: '2026-11-24' } });
    return new Response(null, { status: 204 });
  });
  assert.equal(called, 1);
  assert.deepEqual(result, { sent: true });
});

test('notification failure leaves publication to the regular Pages schedule, with no second call', async () => {
  let called = 0;
  const blocked = await notifyDailyPages(approved, '2026-11-24', async () => { called++; return new Response(null, { status: 403 }); });
  assert.deepEqual(blocked, { sent: false, reason: 'http-error', status: 403 });
  const unavailable = await notifyDailyPages(approved, '2026-11-24', async () => { called++; throw new Error('network'); });
  assert.deepEqual(unavailable, { sent: false, reason: 'notification-unavailable' });
  assert.equal(called, 2);
});

test('a redirected notification is rejected without sending credentials to a second URL', async () => {
  const urls = [];
  const result = await notifyDailyPages(approved, '2026-11-26', async (url, options) => {
    urls.push(url);
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'https://other.example/' } });
  });
  assert.deepEqual(urls, ['https://api.github.com/repos/dongyu19920904/Hextra-AI-Insight-Daily/dispatches']);
  assert.deepEqual(result, { sent: false, reason: 'http-error', status: 302 });
});

test('cannot notify another project, branch or invalid date', async () => {
  const noRequest = () => { assert.fail('No request expected'); };
  for (const env of [{ ...approved, GITHUB_REPO_NAME: 'CloudFlare-BioAI-Daily' }, { ...approved, GITHUB_BRANCH: 'other' }]) {
    assert.equal((await notifyDailyPages(env, '2026-11-24', noRequest)).reason, 'not-configured');
  }
  assert.equal((await notifyDailyPages(approved, 'invalid', noRequest)).reason, 'not-configured');
});

const date = '2026-11-28';
const groupedCron = '0,12,20,50 1 * * *';
const cron = minute => ({ cron: groupedCron, scheduledTime: Date.parse(`${date}T01:${minute}:12Z`) });

function publicationFixture({ healthy = false, failedWrite = false } = {}) {
  const schedule = readFileSync(new URL('../src/handlers/scheduled.js', import.meta.url), 'utf8');
  // Exercise the actual router, backup and publish tail without a model, network or Git write.
  const backup = schedule.slice(schedule.indexOf('async function handleScheduledDailyBackup('),
    schedule.indexOf('async function handleScheduledOpportunityBackup('));
  const router = schedule.slice(schedule.indexOf('export async function handleScheduled(')).replace(/^export /, '');
  const dailyStart = schedule.search(/    if \(dryRun\) \{\s+await reportScheduledProgress\(options, 'daily', 'dry-run-complete'/);
  assert.ok(dailyStart > 0);
  const dailyTail = schedule.slice(dailyStart, schedule.indexOf('export async function handleScheduledOpportunity('));
  const actions = [];
  const handlers = runInNewContext(`${backup}\n${router}\n
    async function handleScheduledDaily(event, env, ctx, specifiedDate, options) {
      const dateStr = specifiedDate || getISODate();
      const dryRun = Boolean(options.dryRun);
      const debugInfo = {};
      ${dailyTail}
    ({ scheduled: handleScheduled, daily: handleScheduledDaily })`, {
    resolveScheduledModeFromEvent,
    getISODate: () => date,
    getYearMonth: value => value.slice(0, 7),
    reportScheduledProgress: async () => {},
    checkScheduledOutputHealth: async () => ({ healthy }),
    buildSkippedScheduledResult: (_date, _mode, skipReason) => ({ skipReason }),
    dailySummaryMarkdownContent: 'Fixture daily', outputOfCall3: 'Fixture summary',
    archiveDailyTelegramImages: async () => ({ archivedCount: 0 }),
    telegramImageCandidates: [], allUnifiedData: {}, extractTelegramDailyImageCandidate: () => null,
    normalizeDailyPagesVideos,
    commitDailyOutputs: async (_env, day, markdown) => {
      assert.equal(markdown, 'Fixture daily');
      if (failedWrite) throw new Error('Fixture homepage write failed');
      actions.push(`write:${day}`);
    },
    notifyDailyPages: (env, day) => notifyDailyPages(env, day, async (_url, request) => {
      assert.equal(JSON.parse(request.body).client_payload.date, day);
      actions.push(`notify:${day}`);
      return new Response(null, { status: 204 });
    }),
    rememberPublishedDailyFaq: async () => {}, storePublishedDailyGithubTopProjects: async () => {},
    console: { log() {}, warn(message) { assert.fail(message); } },
  });
  const env = { ...approved, DAILY_CRON_SCHEDULE: '0 1 * * *', DAILY_BACKUP_CRON_SCHEDULE: '12 1 * * *' };
  return { actions, scheduled: (event, options = {}) => handlers.scheduled(event, env, {}, null, 'auto', options),
    manual: specifiedDate => handlers.daily({ cron: '' }, env, {}, specifiedDate, {}) };
}

test('the grouped primary and recovering backup crons both notify after writing the full edition', async () => {
  for (const minute of ['00', '12']) {
    const fixture = publicationFixture();
    const result = await fixture.scheduled(cron(minute));
    assert.equal(result.dailyPublished, true);
    assert.deepEqual(fixture.actions, [`write:${date}`, `notify:${date}`], `cron at minute ${minute}`);
    assert.equal(result.dailyPagesNotification?.sent, true);
  }
});

test('a healthy backup, a preview or a failed write cannot notify Pages', async () => {
  const healthy = publicationFixture({ healthy: true });
  assert.equal((await healthy.scheduled(cron('12'))).skipReason, 'daily-output-healthy');
  assert.deepEqual(healthy.actions, []);
  const preview = publicationFixture();
  assert.equal((await preview.scheduled(cron('12'), { dryRun: true })).dailyWouldPublish, true);
  assert.deepEqual(preview.actions, []);
  const failed = publicationFixture({ failedWrite: true });
  await assert.rejects(failed.scheduled(cron('12')), /Fixture homepage write failed/);
  assert.deepEqual(failed.actions, []);
});

test('manual publication retains its distinction between a pinned date and the current edition', async () => {
  const pinned = publicationFixture();
  assert.equal((await pinned.manual(date)).dailyPagesNotification, undefined);
  assert.deepEqual(pinned.actions, [`write:${date}`]);
  const current = publicationFixture();
  assert.equal((await current.manual(null)).dailyPagesNotification?.sent, true);
  assert.deepEqual(current.actions, [`write:${date}`, `notify:${date}`]);
});

test('legacy HTTP videos emitted by the Worker become links before the Pages import', () => {
  const markdown = convertPlaceholdersToMarkdownImages(`Headline\n\n[\u89c6\u9891: http://media.example.test/old.mp4]\n\n[\u56fe\u7247: https://media.example.test/new.mp4]\n\n[\u89c6\u9891: https://user:password@media.example.test/invalid.mp4]`);
  const safe = normalizeDailyPagesVideos(markdown);
  assert.match(safe, /^Headline/);
  assert.match(safe, /\]\(<http:\/\/media\.example\.test\/old\.mp4>\)/);
  assert.match(safe, /<video controls[^>]* src="https:\/\/media\.example\.test\/new\.mp4"><\/video>/);
  assert.doesNotMatch(safe, /src="http:\/\/|user:password/);
  const schedule = readFileSync(new URL('../src/handlers/scheduled.js', import.meta.url), 'utf8');
  assert.match(schedule, /normalizeDailyPagesVideos\(publicationMarkdown\);\s+await commitDailyOutputs\(env, dateStr, publicationMarkdown\)/);
});
