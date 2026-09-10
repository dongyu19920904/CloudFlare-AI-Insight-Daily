import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCompiledTopics, compileMerchantFacts, compileTopicDraft, validateCompiledDraft, GOOGLE_PRO_URL, GOOGLE_FAMILY_URL, CHATGPT_PLUS_URL } from '../src/merchantFactCompiler.js';
import { buildMerchantEvidenceBundle, loadMerchantOfficialEvidence, fetchMerchantEvidence, MERCHANT_OFFICIAL_SOURCES } from '../src/merchantEvidenceBundle.js';
import { generateMerchantEditorial } from '../src/merchantEditorial.js';
import { validateMerchantEditorialPublication } from '../src/publishValidation.js';

const google = JSON.parse(readFileSync(new URL('./fixtures/merchant-google-20260910.json', import.meta.url))).official;
const chatgpt = JSON.parse(readFileSync(new URL('./fixtures/merchant-chatgpt-20260910.json', import.meta.url))).official;
const official = () => structuredClone([...google, ...chatgpt]);
const snapshot = () => ({ generatedAt: '2026-09-10T09:00:00Z', latestObservedAt: '2026-09-10T08:55:00Z', signals: [], products: [
  { categoryId: 'gemini', slug: 'gemini-pro-recharge', name: 'Gemini Pro 充值/开通', productUrl: 'https://supply.aivora.cn/card-products/gemini-pro-recharge', availableOfferCount: 0 },
  { categoryId: 'chatgpt', slug: 'chatgpt-plus-recharge', name: 'ChatGPT Plus 正价代充', productUrl: 'https://supply.aivora.cn/card-products/chatgpt-plus-recharge', availableOfferCount: 0 },
] });
const bundle = (sources = official(), memory = []) => buildMerchantEvidenceBundle({ dateStr: '2026-09-10', snapshot: snapshot(), official: sources, memory });

test('platform fixtures supply six Google facts and four ChatGPT facts with four qualified topics', async () => {
  const b = await bundle(); assert.equal(compileMerchantFacts(b).length, 10); assert.equal(buildCompiledTopics(b).length, 4);
  for (const topic of buildCompiledTopics(b)) {
    const draft = compileTopicDraft(topic);
    assert.equal(validateCompiledDraft(draft, topic, b).ok, true);
    assert.equal(draft.steps.length, 5); assert.ok(draft.merchantActions.length <= 3);
    assert.match(draft.copyAsset, /付款前再次确认库存/); assert.match(draft.summary, /今日不建议上新/);
    assert.ok(draft.steps.every(step => ['#merchant-record', ...b.products.flatMap(p => [p.url, p.calculatorUrl]), ...b.evidence.map(e => e.url)].includes(step.url)));
  }
});
test('Google storage alternatives are not flattened into per-member capacity', async () => {
  const facts = compileMerchantFacts(await bundle());
  assert.deepEqual(facts.find(f => f.id === 'google-pro-storage-options').values.storageTB, [5, 10]);
  assert.equal(facts.find(f => f.id === 'google-family-shared-storage').values.perMemberFullPlanQuota, false);
  assert.equal(facts.find(f => f.id === 'google-pro-select-sharing').values.allBenefits, false);
  assert.match(facts.find(f => f.id === 'google-family-country').text, /同一国家/);
});
test('changed official text withdraws the exact affected topic, not the other platforms', async () => {
  const sources = official(); sources[0].text = sources[0].text.replace('5 TB or 10 TB', '20 TB');
  const topics = buildCompiledTopics(await bundle(sources));
  assert.equal(topics.some(t => t.id === 'google-pro-storage-quotation'), false);
  assert.equal(topics.some(t => t.id === 'chatgpt-renewal-check'), true);
});
test('OpenAI failed fetch is excluded even if stale fixture text was supplied', async () => {
  const sources = official(); sources.filter(s => s.platform === 'chatgpt').forEach(s => { s.fetchStatus = 'unknown'; });
  assert.equal(buildCompiledTopics(await bundle(sources)).filter(t => t.id.startsWith('chatgpt')).length, 0);
});
test('USD monthly pricing cannot become CNY, annual official plan, or account eligibility', async () => {
  const b = await bundle(); const f = compileMerchantFacts(b).find(f => f.id === 'chatgpt-plus-price');
  assert.equal(f.values.currency, 'USD'); assert.equal(f.values.period, 'month'); assert.equal(f.values.region, 'unspecified');
  const sources = official(); const plus = sources.find(s => s.url === CHATGPT_PLUS_URL); plus.text = plus.text.replace('$20/month', '¥20/month');
  assert.equal(buildCompiledTopics(await bundle(sources)).some(t => t.id === 'chatgpt-plus-billing-boundaries'), false);
});
test('duplicate price declarations fail closed', async () => {
  const sources = official(); sources.find(s => s.url === CHATGPT_PLUS_URL).text += ' Price: $25/month (billed monthly).';
  assert.equal(compileMerchantFacts(await bundle(sources)).some(f => f.id === 'chatgpt-plus-price'), false);
});
test('one official URL cannot supply the two-source threshold with duplicated IDs', async () => {
  const b = await bundle(); b.evidence = b.evidence.filter(e => e.url === GOOGLE_PRO_URL);
  b.evidence.push({ ...b.evidence[0], id: 'duplicate' });
  assert.equal(buildCompiledTopics(b).length, 0);
});
test('copy mutation from selected benefits to all benefits fails publication checks', async () => {
  const b = await bundle(); const t = buildCompiledTopics(b).find(t => t.id === 'google-pro-family-delivery'); const d = compileTopicDraft(t);
  d.copyAsset = d.copyAsset.replace('可共享部分', '可共享所有');
  assert.equal(validateCompiledDraft(d, t, b).ok, false);
});
test('new platform actions differ by task and never assume a beginner owns an order', async () => {
  const drafts = buildCompiledTopics(await bundle()).map(compileTopicDraft);
  assert.equal(new Set(drafts.map(d => JSON.stringify(d.steps))).size, 4);
  drafts.forEach(d => assert.doesNotMatch(d.steps.map(s => s.action).join(' '), /你的待交付订单|保证赚钱|首日盈利/));
});
test('same facts on the next day produce no fresh topics', async () => {
  const b = await bundle(); const facts = compileMerchantFacts(b); b.usedFactKeys = facts.map(f => f.factKey); b.date = '2026-09-11';
  assert.equal(buildCompiledTopics(b).length, 0);
});
test('Google production renderer and publication validation work without model prose', async () => {
  let calls = 0; const debugInfo = {};
  const result = await generateMerchantEditorial({ env: { ACCOUNT_MERCHANT_FACT_COMPILER_ENABLED: 'true' }, dateStr: '2026-09-10', snapshot: snapshot(), officialEvidence: google, dryRun: true, debugInfo,
    callModel: async () => { calls++; return '{"topicId":"google-pro-family-delivery"}'; } });
  assert.equal(calls, 1); assert.equal(debugInfo.accountOpportunityEditorialAccepted, true);
  assert.equal(validateMerchantEditorialPublication({ markdown: result.markdown, bundle: result.bundle }).ok, true);
  assert.match(result.markdown, /同一国家/); assert.doesNotMatch(result.markdown, /每人独享|一定赚钱/);
});
test('all sources fail: zero model calls, readable brief and controlled diagnostics', async () => {
  let calls = 0; const debugInfo = {};
  const result = await generateMerchantEditorial({ env: { ACCOUNT_MERCHANT_FACT_COMPILER_ENABLED: 'true' }, dateStr: '2026-09-10', snapshot: snapshot(), dryRun: true, debugInfo,
    fetchImpl: async () => new Response('denied', { status: 403 }), callModel: async () => { calls++; } });
  assert.equal(calls, 0); assert.match(result.markdown, /今日不建议上新/);
  assert.equal(debugInfo.accountOpportunityOfficialSources.length, 8);
  assert.ok(debugInfo.accountOpportunityOfficialSources.every(s => s.failureReason === 'evidence_http_403'));
});
test('production rollout remains off until the preview is accepted', async () => {
  const debugInfo = {};
  const result = await generateMerchantEditorial({ env: { ACCOUNT_MERCHANT_FACT_COMPILER_ENABLED: 'true', DATA_KV: { get: async () => null } }, dateStr: '2026-09-10', snapshot: snapshot(), officialEvidence: google, debugInfo,
    callModel: async () => { throw new Error('rollout is off'); } });
  assert.equal(debugInfo.accountOpportunityEditorialAccepted, false); assert.equal(debugInfo.accountOpportunityModelCalls, 0); assert.equal(result.memoryEntry, null);
});
test('only exact Google help pages receive the bounded larger body allowance', async () => {
  const html = '<article>' + 'Source sentence. '.repeat(20) + '</article>' + ' '.repeat(850000);
  const fetchImpl = async () => new Response(html, { headers: { 'content-type': 'text/html' } });
  const r = await loadMerchantOfficialEvidence({ sources: [{ url: GOOGLE_PRO_URL }, { url: CHATGPT_PLUS_URL }, { url: 'https://support.google.com/other' }], fetchImpl });
  assert.equal(r[0].fetchStatus, 'ok'); assert.equal(r[1].failureReason, 'evidence_size'); assert.equal(r[2].failureReason, 'evidence_size');
});
test('even Google help cannot exceed 2 MB or follow redirects', async () => {
  const source = { url: GOOGLE_FAMILY_URL };
  const large = await loadMerchantOfficialEvidence({ sources: [source], fetchImpl: async () => new Response(' '.repeat(2000001), { headers: { 'content-type': 'text/html' } }) });
  assert.equal(large[0].failureReason, 'evidence_size');
  const redirect = await loadMerchantOfficialEvidence({ sources: [source], fetchImpl: async (_, options) => { assert.equal(options.redirect, 'manual'); return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } }); } });
  assert.equal(redirect[0].failureReason, 'evidence_http_302');
  await assert.rejects(fetchMerchantEvidence('http://127.0.0.1/'), /origin_not_allowed/);
});
test('source loader retains the bounded eight-request ceiling and sanitized errors', async () => {
  let calls = 0;
  const result = await loadMerchantOfficialEvidence({ sources: [...MERCHANT_OFFICIAL_SOURCES, ...MERCHANT_OFFICIAL_SOURCES], fetchImpl: async () => { calls++; throw new Error('private response must not enter logs'); } });
  assert.equal(calls, 8); assert.ok(result.every(s => s.failureReason === 'evidence_fetch_failed'));
  assert.doesNotMatch(JSON.stringify(result), /private response/);
});
