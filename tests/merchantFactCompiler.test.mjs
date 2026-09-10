import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCompiledTopics, compileMerchantFacts, compileTopicDraft, selectCompiledTopic, validateCompiledDraft } from '../src/merchantFactCompiler.js';
import { generateMerchantEditorial } from '../src/merchantEditorial.js';
import { validateMerchantEditorialPublication } from '../src/publishValidation.js';

const frozen = JSON.parse(readFileSync(new URL('./fixtures/merchant-facts-20260910.json', import.meta.url), 'utf8')).bundle;
const fresh = () => structuredClone(frozen);
const official = (bundle) => bundle.evidence.filter((item) => item.kind === 'official');
const snapshot = (bundle) => ({ generatedAt: bundle.sourceGeneratedAt, latestObservedAt: bundle.sourceObservedAt, products: bundle.products.map((item) => ({ categoryId: item.platform, slug: item.slug, name: item.name, productUrl: item.url, availableOfferCount: 0 })), signals: [] });
const env = { ACCOUNT_MERCHANT_FACT_COMPILER_ENABLED: 'true' };

test('frozen 01: a complete observed source yields typed facts and two bounded topics', () => {
  assert.equal(compileMerchantFacts(fresh()).length, 6);
  assert.equal(buildCompiledTopics(fresh()).length, 2);
});
test('frozen 02: 20x is compiled as twenty times, never ten', () => {
  const fact = compileMerchantFacts(fresh()).find((item) => item.id === 'claude-max-20-usage');
  assert.equal(fact.values.multiplier, 20); assert.match(fact.text, /二十倍/);
});
test('frozen 03: US price carries its own currency, period and region', () => {
  assert.deepEqual(compileMerchantFacts(fresh()).find((item) => item.id === 'claude-pro-price').values, { plan: 'Claude Pro', amount: 20, currency: 'USD', period: 'month', region: 'US' });
});
test('frozen 04: Max price is bound to the correct tier and web surface', () => {
  const facts = compileMerchantFacts(fresh());
  assert.equal(facts.find((item) => item.id === 'claude-max-5-price').values.amount, 100);
  assert.equal(facts.find((item) => item.id === 'claude-max-20-price').values.amount, 200);
  assert.equal(facts.find((item) => item.id === 'claude-max-20-price').values.surface, 'web');
});
test('frozen 05: API fee exclusion does not invent eligibility or user exclusion', () => {
  const topic = buildCompiledTopics(fresh())[0]; const draft = compileTopicDraft(topic);
  assert.match(draft.copyAsset, /不包含.*API/);
  assert.doesNotMatch(draft.copyAsset, /不适用|不能开通|互不冲突|仅覆盖网页/);
});
test('frozen 06: mirror offers are skipped and merchant quotes are not verified procurement costs', () => {
  const fact = compileMerchantFacts(fresh()).find((item) => item.kind === 'merchant-quote');
  assert.equal(fact.values.amount, 128); assert.equal(fact.values.verifiedCost, false);
  assert.doesNotMatch(fact.values.name, /镜像/);
});
test('frozen 07: stale quotes disappear without modifying observed times', () => {
  const b = fresh(); b.sourceGeneratedAt = '2026-09-12T00:00:00Z';
  assert.equal(compileMerchantFacts(b).some((fact) => fact.kind === 'merchant-quote'), false);
});
test('frozen 08: unknown currency cannot become CNY', () => {
  const b = fresh(); const aggregate = b.evidence.find((item) => item.kind === 'aggregate');
  const value = JSON.parse(aggregate.text); value.offers.forEach((item) => { item.currency = 'unknown'; }); aggregate.text = JSON.stringify(value);
  assert.equal(compileMerchantFacts(b).some((fact) => fact.kind === 'merchant-quote'), false);
});
test('frozen 09: non-positive prices never enter facts', () => {
  const b = fresh(); const aggregate = b.evidence.find((item) => item.kind === 'aggregate');
  const value = JSON.parse(aggregate.text); value.offers.forEach((item) => { item.price = 0; }); aggregate.text = JSON.stringify(value);
  assert.equal(compileMerchantFacts(b).some((fact) => fact.kind === 'merchant-quote'), false);
});
test('frozen 10: changed official wording fails closed instead of using a memorized fact', () => {
  const b = fresh(); b.evidence[0].text = b.evidence[0].text.replace('does not include API', 'includes API');
  assert.equal(compileMerchantFacts(b).some((item) => item.id === 'claude-pro-api'), false);
  assert.equal(buildCompiledTopics(b).some((item) => item.id === 'claude-pro-billing'), false);
});
test('frozen 11: model cannot supply extra prose, numbers, unknown IDs or injected HTML', () => {
  const topics = buildCompiledTopics(fresh());
  for (const value of ['{"topicId":"missing"}', '{"topicId":"claude-pro-billing","headline":"必赚"}', '<script>evil</script>', '{"topicId":12}']) assert.equal(selectCompiledTopic(value, topics), null);
  assert.equal(selectCompiledTopic('{"topicId":"claude-pro-billing"}', topics).id, 'claude-pro-billing');
});
test('frozen 12: copy and facts cannot diverge, even if the wrong number exists elsewhere', () => {
  const b = fresh(); const topic = buildCompiledTopics(b)[1]; const draft = compileTopicDraft(topic);
  assert.equal(validateCompiledDraft(draft, topic, b).ok, true);
  draft.copyAsset = draft.copyAsset.replace('二十倍', '十倍');
  assert.equal(validateCompiledDraft(draft, topic, b).ok, false);
});
test('frozen 13: identical facts and changed fetch times do not create fresh topics', () => {
  const b = fresh(); b.usedFactKeys = compileMerchantFacts(b).map((item) => item.factKey);
  assert.equal(buildCompiledTopics(b).length, 0);
  b.sourceGeneratedAt = '2026-09-10T07:00:00Z'; assert.equal(buildCompiledTopics(b).length, 0);
});
test('frozen 14: new quote prices do not recycle yesterday\'s tutorial', () => {
  const b = fresh(); b.usedFactKeys = compileMerchantFacts(b).map((item) => item.factKey);
  b.recentTopics = buildCompiledTopics(fresh()).map((topic) => ({ topicKey: `merchant-facts-v1:${topic.id}` }));
  const aggregate = b.evidence.find((item) => item.kind === 'aggregate'); const value = JSON.parse(aggregate.text); value.offers[1].price = 130; aggregate.text = JSON.stringify(value);
  assert.equal(buildCompiledTopics(b).length, 0);
});
test('frozen 15: no stock, no history and no customer data do not create launch advice or profit', () => {
  const b = fresh(); const draft = compileTopicDraft(buildCompiledTopics(b)[0]);
  assert.match(draft.summary, /今日不建议上新/); assert.match(draft.unknowns.join(' '), /真实售价|没有真实咨询/);
  assert.ok(draft.steps.length <= 6); assert.ok(draft.merchantActions.length <= 3);
  assert.doesNotMatch(draft.summary, /涨价|恢复有货/);
});
test('frozen 16: no source or one source is not padded with unrelated news', () => {
  const b = fresh(); b.evidence = [b.evidence[0]]; assert.equal(buildCompiledTopics(b).length, 0);
  b.evidence.push({ ...b.evidence[0], id: 'unrelated', url: 'https://unknown.example/', text: 'Unrelated model launch' });
  assert.equal(buildCompiledTopics(b).length, 0);
});
test('compiled production path reuses the renderer and dry-run performs zero writes', async () => {
  const b = fresh(); let calls = 0, writes = 0; const debugInfo = {};
  const result = await generateMerchantEditorial({ env: { ...env, DATA_KV: { get: async () => null, put: async () => writes++ } }, dateStr: b.date, snapshot: snapshot(b), officialEvidence: official(b), dryRun: true, debugInfo, callModel: async () => { calls++; return '{}'; } });
  assert.equal(debugInfo.accountOpportunityEditorialAccepted, true);
  assert.equal(calls, 0); assert.equal(writes, 0);
  assert.equal(validateMerchantEditorialPublication({ markdown: result.markdown, bundle: result.bundle }).ok, true);
  assert.match(result.markdown, /二十倍/); assert.match(result.markdown, /今天没有可比较的历史快照/);
});
test('missing sources produce a readable isolated brief without model calls', async () => {
  let calls = 0; const debugInfo = {};
  const result = await generateMerchantEditorial({ env, dateStr: frozen.date, snapshot: { products: [] }, officialEvidence: [], dryRun: true, debugInfo, callModel: async () => { calls++; throw new Error('must not call'); } });
  assert.equal(calls, 0); assert.equal(debugInfo.accountOpportunityEditorialAccepted, false);
  assert.match(result.markdown, /今日不建议上新/);
});

test('invalid model output only falls back to a verified topic, never to its prose', async () => {
  const b = fresh(); const s = snapshot(b); const aggregate = JSON.parse(b.evidence.find((item) => item.kind === 'aggregate').text);
  s.products.find((item) => item.slug === 'claude-pro-month').sourceOffers = aggregate.offers;
  let calls = 0; const debugInfo = {};
  const result = await generateMerchantEditorial({ env, dateStr: b.date, snapshot: s, officialEvidence: official(b), dryRun: true, debugInfo, callModel: async (config) => {
    calls++; assert.equal(config.ANTHROPIC_MAX_TOKENS, '256');
    return '{"topicId":"claude-pro-billing","copyAsset":"20x是十倍，今天一定赚钱"}';
  } });
  assert.equal(calls, 1); assert.equal(debugInfo.accountOpportunitySelectorFallback, true);
  assert.equal(debugInfo.accountOpportunityEditorialAccepted, true);
  assert.doesNotMatch(result.markdown, /今天一定赚钱|20x是十倍/);
  assert.equal(validateMerchantEditorialPublication({ markdown: result.markdown, bundle: result.bundle }).ok, true);
});
test('failed memory reads stop new-topic publication and never block the main daily', async () => {
  const b = fresh(); let calls = 0; const debugInfo = {};
  const result = await generateMerchantEditorial({ env: { ...env, DATA_KV: { get: async () => { throw new Error('offline'); } } }, dateStr: b.date, snapshot: snapshot(b), officialEvidence: official(b), debugInfo, callModel: async () => calls++ });
  assert.equal(calls, 0); assert.equal(result.memoryEntry, null);
  assert.deepEqual(debugInfo.accountOpportunityEditorialIssues, ['compiled_memory_unavailable']);
});

test('corrupt persisted memory is not treated as an empty new publication history', async () => {
  const b = fresh(); const debugInfo = {};
  await generateMerchantEditorial({ env: { ...env, DATA_KV: { get: async () => '{bad json' } }, dateStr: b.date, snapshot: snapshot(b), officialEvidence: official(b), dryRun: true, debugInfo, callModel: async () => { throw new Error('must not call'); } });
  assert.equal(debugInfo.accountOpportunityModelCalls, 0);
  assert.deepEqual(debugInfo.accountOpportunityEditorialIssues, ['compiled_memory_unavailable']);
});
