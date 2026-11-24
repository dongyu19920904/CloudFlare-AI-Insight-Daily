import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { normalizeDailyPagesVideos, notifyDailyPages } from '../src/dailyPagesNotification.js';
import { convertPlaceholdersToMarkdownImages } from '../src/helpers.js';

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
    assert.equal(request.redirect, 'error');
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

test('cannot notify another project, branch or invalid date', async () => {
  const noRequest = () => { assert.fail('No request expected'); };
  for (const env of [{ ...approved, GITHUB_REPO_NAME: 'CloudFlare-BioAI-Daily' }, { ...approved, GITHUB_BRANCH: 'other' }]) {
    assert.equal((await notifyDailyPages(env, '2026-11-24', noRequest)).reason, 'not-configured');
  }
  assert.equal((await notifyDailyPages(approved, 'invalid', noRequest)).reason, 'not-configured');
});

test('the scheduler sends only after the full raw, dated and homepage write step and outside previews', () => {
  const schedule = readFileSync(new URL('../src/handlers/scheduled.js', import.meta.url), 'utf8');
  assert.match(schedule, /if \(dryRun\) \{[\s\S]*?return debugInfo;[\s\S]*?await commitDailyOutputs\(env, dateStr, publicationMarkdown\);\s+if \(!specifiedDate\) \{\s+debugInfo\.dailyPagesNotification = await notifyDailyPages\(env, dateStr\)/);
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
