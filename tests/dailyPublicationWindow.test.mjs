import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { getDailyPublicationPolicy } from '../src/dailyPublicationWindow.js';
import { resolveScheduledModeFromEvent } from '../src/scheduleRouting.js';

test('09:00 waits without generation when TOP material is insufficient', () => {
  assert.deepEqual(getDailyPublicationPolicy({ scheduledTime: Date.parse('2026-10-03T01:00:00Z'), topEligibleItems: 7 }),
    { lateAttempt: false, waitForTen: true, minimumTopItems: 10 });
  assert.equal(getDailyPublicationPolicy({ scheduledTime: Date.parse('2026-10-03T01:00:00Z'), topEligibleItems: 10 }).waitForTen, false);
});

test('10:00 accepts fewer real TOP items, including a manual late recovery', () => {
  for (const time of ['2026-10-03T02:00:00Z', '2026-10-03T03:17:00Z']) {
    const policy = getDailyPublicationPolicy({ now: Date.parse(time), topEligibleItems: 6 });
    assert.deepEqual(policy, { lateAttempt: true, waitForTen: false, minimumTopItems: 1 });
  }
});

const source = readFileSync(new URL('../src/handlers/scheduled.js', import.meta.url), 'utf8');
test('10:00 backup refreshes only missing daily output and never runs opportunities', async () => {
  const body = source.slice(source.indexOf('async function handleScheduledDailyBackup('), source.indexOf('async function handleScheduledOpportunityBackup('));
  for (const healthy of [true, false]) {
    const calls = [];
    const run = vm.runInNewContext(`(${body.trim()})`, {
      getYearMonth: () => '2026-10', reportScheduledProgress: async () => {},
      checkScheduledOutputHealth: async () => ({ healthy }),
      buildSkippedScheduledResult: () => ({ skipped: true }),
      prefetchDailySourceCategories: async () => { calls.push('refresh'); },
      handleScheduledDaily: async () => { calls.push('daily'); return {}; },
    });
    await run({}, {}, {}, '2026-10-03');
    assert.deepEqual(calls, healthy ? [] : ['refresh', 'daily']);
  }
});

test('deployed configuration routes 09:00 and 10:00 independently', () => {
  const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const env = Object.fromEntries([...config.matchAll(/^(\w+_CRON_SCHEDULE) = "([^"]+)"/gm)].map((match) => [match[1], match[2]]));
  assert.equal(env.DAILY_BACKUP_CRON_SCHEDULE, '0 2 * * *');
  assert.match(config, /"0,20,50 1,2 \* \* \*"\s*\]/);
  assert.equal(resolveScheduledModeFromEvent({ cron: '0,20,50 1 * * *', scheduledTime: Date.parse('2026-10-03T01:00:00Z') }, env), 'daily');
  assert.equal(resolveScheduledModeFromEvent({ cron: '0,20,50 1,2 * * *', scheduledTime: Date.parse('2026-10-03T02:00:00Z') }, env), 'daily-backup');
  assert.equal(resolveScheduledModeFromEvent({ cron: '0,20,50 1 * * *', scheduledTime: Date.parse('2026-10-03T01:20:00Z') }, env), 'opportunity');
  for (const minute of ['20', '50']) {
    assert.equal(resolveScheduledModeFromEvent({ cron: '0,20,50 1,2 * * *', scheduledTime: Date.parse(`2026-10-03T02:${minute}:00Z`) }, env), 'noop');
  }
});

test('unused grouped slots exit before status writes or downstream calls', async () => {
  const index = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = index.indexOf('async function runScheduledEventWithStatus(');
  const end = index.indexOf('\nasync function ', start + 1);
  const run = vm.runInNewContext(`(${index.slice(start, end).trim()})`, {
    resolveScheduledModeFromEvent: () => 'noop',
  });
  await run({}, {}, {});
});

test('only general opportunity initial and repair calls receive the full output budget', () => {
  const opportunity = source.slice(source.indexOf('async function generateOpportunityMarkdown('), source.indexOf('async function generateAccountOpportunityMarkdown('));
  assert.match(opportunity, /ANTHROPIC_MAX_TOKENS: String\(Math.max\(6144,/);
  assert.match(opportunity, /generateContentWithTransportFallback\(\s*opportunityGenerationEnv,\s*opportunityPromptInput/);
  assert.match(opportunity, /generateContentWithTransportFallback\(\s*opportunityGenerationEnv,\s*buildOpportunityRepairPrompt/);
  const rest = source.slice(source.indexOf('async function generateAccountOpportunityMarkdown('));
  assert.doesNotMatch(rest, /opportunityGenerationEnv/);
  const prompt = readFileSync(new URL('../src/prompt/aiOpportunityPrompt.js', import.meta.url), 'utf8');
  assert.match(prompt, /主推不超过 900 字符，每条小试不超过 500 字符/);
  assert.match(source, /今日主推单条 900、本周小试单条 500/);
});
