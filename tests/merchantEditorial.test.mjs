import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMerchantEvidenceBundle, focusMerchantEvidence, fetchMerchantEvidence, originalOfferEvidence } from '../src/merchantEvidenceBundle.js';
import { editorialQuoteOptions, resolveEditorialDraft, editorialFactKey, hasUnverifiedTrialRecommendation, parseEditorialJson, editorialRepairDetails, generateMerchantEditorial, renderMerchantEditorial, validateMerchantEditorial } from '../src/merchantEditorial.js';
import { validateMerchantEditorialPublication } from '../src/publishValidation.js';
import { runIsolatedAccountOpportunity } from '../src/accountOpportunityIsolation.js';

const snapshot = { generatedAt: '2026-09-10T04:00:00Z', latestObservedAt: '2026-09-10T03:00:00Z', signals: [], products: [{ categoryId: 'chatgpt', slug: 'chatgpt-plus', name: 'ChatGPT Plus', productUrl: 'https://supply.aivora.cn/card-products/chatgpt-plus', profitCalculatorUrl: 'https://supply.aivora.cn/profit-calculator', availableOfferCount: 2 }] };
const official = [
  { platform: 'chatgpt', kind: 'official', url: 'https://help.openai.com/en/articles/6950777', title: '套餐', text: 'API usage is separate. Message caps may vary. Billing is monthly.', contentHash: 'a', observedAt: snapshot.generatedAt, fetchStatus: 'ok' },
  { platform: 'chatgpt', kind: 'official', url: 'https://help.openai.com/en/articles/9039756', title: '计费', text: 'Separate billing systems. Manage charges in settings.', contentHash: 'b', observedAt: snapshot.generatedAt, fetchStatus: 'ok' },
];
const draft = () => ({ headline: '先问客户用网页还是接口，避免买错套餐', summary: '先做一份套餐答疑，再验证客户到底需要什么。', topicKey: 'chatgpt:billing:faq', facts: [
  { evidenceId: 'E1', quote: 'API usage is separate.', text: '接口用量不包括在订阅内。' },
  { evidenceId: 'E1', quote: 'Message caps may vary.', text: '消息上限可能变化，不把套餐写成无限使用。' },
  { evidenceId: 'E2', quote: 'Separate billing systems.', text: '计费系统分开，应先核对客户要用哪一项。' },
], customerHypothesis: '待验证假设：分不清网页订阅与接口的客户需要这份答疑。', deliverable: '一份可核对出处的套餐答疑，以能解释差别为完成标准。', steps: [{ action: '打开官方说明，把网页订阅和接口用途分别记下来。', url: official[0].url }, { action: '填写今天确认的差别，保留没有弄懂的问题。', url: '#merchant-record' }], merchantActions: ['如果已有咨询，先确认对方需要网页还是接口；规格不清时停止报价。'], stopCondition: '不能解释套餐差别时先不收款。', copyAsset: '网页订阅与接口单独计费。付款前再次确认库存。', unknowns: ['自己的客户是否需要这份材料仍待验证。'], followUp: '记录实际问到的问题，明确答疑有没有帮助。' });

test('grounded editorial renders valid readable modes without pretending to have demand', async () => {
  const bundle = await buildMerchantEvidenceBundle({ dateStr: '2026-09-10', snapshot, official });
  assert.deepEqual(validateMerchantEditorial(draft(), bundle), { ok: true, issues: [] });
  const result = renderMerchantEditorial(draft(), bundle);
  assert.equal(validateMerchantEditorialPublication({ markdown: result.markdown, bundle }).ok, true);
  assert.match(result.markdown, /今天没有可比较的历史快照/);
  assert.match(result.markdown, /付款前再次确认库存/);
});
test('rejects fabricated prices, citations, demand, unsafe links and order-only beginner tasks', async () => {
  const bundle = await buildMerchantEvidenceBundle({ dateStr: '2026-09-10', snapshot, official });
  for (const mutate of [
    (x) => { x.facts[0].text = '售价是 99 元'; }, (x) => { x.facts[0].quote = 'never existed'; },
    (x) => { x.summary = '一定赚钱'; }, (x) => { x.customerHypothesis = '大家都想买'; },
    (x) => { x.steps[0].url = 'https://unknown.example'; }, (x) => { x.steps[0].action = '逐单复核待交付订单'; },
  ]) { const bad = draft(); mutate(bad); assert.equal(validateMerchantEditorial(bad, bundle).ok, false); }
});
test('same evidence with different fetch dates is not a new opportunity', async () => {
  const bundle = await buildMerchantEvidenceBundle({ dateStr: '2026-09-10', snapshot, official, memory: [{ date: '2026-09-09', evidenceHashes: ['a', 'b'] }] });
  assert.equal(bundle.newEvidenceIds.length, 0);
  assert.equal(validateMerchantEditorial(draft(), bundle).ok, false);
});

test('separate API billing does not prove a developer is ineligible for a subscription', async () => {
  const bundle = await buildMerchantEvidenceBundle({ dateStr: '2026-09-10', snapshot, official });
  const bad = draft(); bad.customerHypothesis = '待验证假设：需要 API 接口调用的开发者不适用 Pro 套餐。';
  assert.ok(validateMerchantEditorial(bad, bundle).issues.includes('editorial_billing_is_not_user_exclusion'));
  const leaked = draft(); leaked.deliverable = '对照 E1Q8、E1Q9 原文完成草稿。';
  assert.ok(validateMerchantEditorial(leaked, bundle).issues.includes('editorial_internal_identifiers'));
});
test('unrelated official news is excluded; no stock does not manufacture a trial recommendation', async () => {
  const bundle = await buildMerchantEvidenceBundle({ dateStr: '2026-09-10', snapshot: { ...snapshot, products: snapshot.products.map((p) => ({ ...p, availableOfferCount: 0 })) }, official: [...official, { ...official[0], platform: 'gaming' }] });
  assert.equal(bundle.evidence.length, 2);
  assert.doesNotMatch(renderMerchantEditorial(draft(), bundle).markdown, /建议直接试卖/);
});
test('model output gets at most one repair and failures remain useful briefings', async () => {
  let calls = 0;
  const debug = {};
  const result = await generateMerchantEditorial({ env: {}, dateStr: '2026-09-10', snapshot, officialEvidence: official, debugInfo: debug, dryRun: true, callModel: async () => { calls++; return '{}'; } });
  assert.equal(calls, 2);
  assert.equal(debug.accountOpportunityEditorialAccepted, false);
  assert.match(result.markdown, /今日不建议上新/);
  assert.equal(validateMerchantEditorialPublication({ markdown: result.markdown, bundle: result.bundle }).ok, true);
});
test('accepted draft dry-run never writes cache or history', async () => {
  let writes = 0;
  const result = await generateMerchantEditorial({ env: { DATA_KV: { get: async () => null, put: async () => writes++ } }, dateStr: '2026-09-10', snapshot, officialEvidence: official, dryRun: true, callModel: async () => JSON.stringify(draft()) });
  assert.equal(writes, 0); assert.equal(result.memoryEntry.title, draft().headline);
});
test('source fetch fails closed on private origins and redirects', async () => {
  await assert.rejects(fetchMerchantEvidence('https://127.0.0.1/'), /origin_not_allowed/);
  await assert.rejects(fetchMerchantEvidence(official[0].url, { fetchImpl: async () => new Response('', { status: 302 }) }), /http_302/);
  await assert.rejects(fetchMerchantEvidence(official[0].url, { maxBytes: 10, fetchImpl: async () => new Response('x'.repeat(20), { headers: { 'Content-Type': 'text/html' } }) }), /evidence_size/);
});
test('a successful page without matching stock, name, currency and price is not verification', () => {
  const offer = { originalName: '商品', price: 20, currency: 'CNY' };
  const html = '<script type="application/ld+json">{"@type":"Product","name":"商品","offers":{"price":20,"priceCurrency":"CNY","availability":"https://schema.org/InStock"}}</script>';
  assert.equal(originalOfferEvidence(html, offer).status, 'merchant_statement_matched');
  assert.equal(originalOfferEvidence(html, { ...offer, price: 1 }), null);
  assert.equal(originalOfferEvidence('<p>库存很多</p>', offer), null);
});
test('editorial failure cannot fail the AI daily isolation boundary', async () => {
  const result = await runIsolatedAccountOpportunity(async () => { throw new Error('editorial failure'); }, '2026-09-10', 'test');
  assert.equal(result.accountOpportunityIsolatedFailure, true);
});

test('unrelated platforms cannot be padded together to satisfy two-source evidence', async () => {
  const bundle = await buildMerchantEvidenceBundle({ dateStr: '2026-09-10', snapshot, official });
  assert.equal(focusMerchantEvidence({ ...bundle, evidence: [bundle.evidence[0], { ...bundle.evidence[1], platform: 'claude' }] }).evidence.length, 0);
  assert.equal(focusMerchantEvidence(bundle).evidence.length, 2);
});

test('repair feedback names exact quote mismatch and length with allowlisted destinations', async () => {
  const bundle = await buildMerchantEvidenceBundle({ dateStr: '2026-09-10', snapshot, official });
  const bad = draft(); bad.facts[0].quote = 'invented'; bad.summary = '长'.repeat(190);
  const feedback = editorialRepairDetails(bad, bundle, ['editorial_first_screen_too_long']);
  assert.equal(feedback.summary.actualCharacters, 190);
  assert.equal(feedback.facts[0].exactQuoteMatched, false);
  assert.ok(feedback.allowedLinks.includes('#merchant-record'));
});

test('changing page hash cannot turn the exact same published facts into a new issue', async () => {
  const bundle = await buildMerchantEvidenceBundle({ dateStr: '2026-09-10', snapshot, official });
  bundle.usedFactKeys = draft().facts.map((fact) => editorialFactKey(fact, bundle));
  assert.ok(validateMerchantEditorial(draft(), bundle).issues.includes('editorial_same_facts_reworded'));
});

test('provider preamble is tolerated but truncated JSON is never repaired by inventing fields', () => {
  assert.deepEqual(parseEditorialJson(`说明\n${JSON.stringify(draft())}\n结束`), draft());
  assert.equal(parseEditorialJson('{"headline":"half'), null);
  assert.equal(parseEditorialJson('x'.repeat(30001)), null);
  assert.deepEqual(parseEditorialJson('{"text":"商家写"月卡"但没写交付","steps":["问"套餐"是什么"]}'), { text: '商家写"月卡"但没写交付', steps: ['问"套餐"是什么'] });
});

test('unobserved effects, internal IDs and verbose copy cannot become merchant claims', async () => {
  const bundle = await buildMerchantEvidenceBundle({ dateStr: '2026-09-10', snapshot, official });
  for (const summary of ['客户常混淆这两个套餐', '得到：减少退款', '参考 E1 即可']) {
    assert.equal(validateMerchantEditorial({ ...draft(), summary }, bundle).ok, false);
  }
  assert.equal(validateMerchantEditorial({ ...draft(), copyAsset: `付款前再次确认库存${'字'.repeat(451)}` }, bundle).ok, false);
});

test('explicit stop conditions do not become affirmative trial recommendations', () => {
  assert.equal(hasUnverifiedTrialRecommendation({ stopCondition: '禁止向买家承诺交付或建议直接试卖。' }), false);
  assert.equal(hasUnverifiedTrialRecommendation({ headline: '交付未核对前不建议试卖' }), false);
  assert.equal(hasUnverifiedTrialRecommendation({ summary: '暂停建议直接试卖' }), false);
  assert.equal(hasUnverifiedTrialRecommendation({ summary: '建议直接试卖。' }), true);
  assert.equal(hasUnverifiedTrialRecommendation({ summary: '禁止虚构，但建议直接试卖。' }), true);
  assert.equal(hasUnverifiedTrialRecommendation({ followUp: '两项通过可继续上架流程' }), true);
  assert.equal(hasUnverifiedTrialRecommendation({ followUp: '不以核对通过为由直接上架，上架还需完整来源、成本和履约核验均完成。' }), false);
  assert.equal(hasUnverifiedTrialRecommendation({ stopCondition: '不能直接上架。' }), false);
  assert.equal(hasUnverifiedTrialRecommendation({ followUp: '不能直接上架，但是建议试卖。' }), true);
});

test('different quotation fragments within the same source sentence keep the same fact identity', async () => {
  const bundle = await buildMerchantEvidenceBundle({ dateStr: '2026-09-10', snapshot, official });
  assert.equal(editorialFactKey({ evidenceId: 'E1', quote: 'API usage' }, bundle), editorialFactKey({ evidenceId: 'E1', quote: 'usage is separate.' }, bundle));
  assert.notEqual(editorialFactKey({ evidenceId: 'E1', quote: 'API usage' }, bundle), editorialFactKey({ evidenceId: 'E1', quote: 'Message caps may vary.' }, bundle));
});

test('real comparable change evidence retains event time, not the fetch time', async () => {
  const eventTime = '2026-09-10T03:30:00Z';
  const bundle = await buildMerchantEvidenceBundle({ dateStr: '2026-09-10', snapshot: { ...snapshot, signals: [{ id: 'rise:plus', kind: 'price_rise', product: snapshot.products[0], title: '同规格报价上升', evidence: '同一来源报价从80升至90', observedAt: eventTime }] }, official });
  assert.equal(bundle.evidence.find((item) => item.kind === 'supply-change').occurredAt, eventTime);
});

test('compiler supplies only real quotes and turns internal references into source titles', async () => {
  const bundle = await buildMerchantEvidenceBundle({ dateStr: '2026-09-10', snapshot, official });
  const quotes = editorialQuoteOptions(bundle);
  assert.ok(quotes.every((option) => bundle.evidence.find((s) => s.id === option.evidenceId).text.includes(option.quote)));
  const generated = { ...draft(), summary: '参照 E1，状态 unknown', facts: [{ evidenceId: quotes[0].evidenceId, quoteId: quotes[0].id, text: '接口用量需要单独计费。' }] };
  const resolved = resolveEditorialDraft(generated, bundle, quotes);
  assert.equal(resolved.facts[0].quote, quotes[0].quote);
  assert.equal(resolved.summary, '参照 套餐，状态 尚未确认');
  generated.facts[0].quoteId = 'invented';
  assert.equal(resolveEditorialDraft(generated, bundle, quotes).facts[0].quote, '');
});

test('missing supply never invokes a model or fabricates observations', async () => {
  let calls = 0;
  const result = await generateMerchantEditorial({ env: {}, dateStr: '2026-09-10', snapshot: { products: [], generatedAt: snapshot.generatedAt, latestObservedAt: null }, dryRun: true, callModel: async () => { calls++; return '{}'; } });
  assert.equal(calls, 0);
  assert.match(result.markdown, /时间未确认/);
});

test('unpublished official facts may form a clearly labelled reference topic, never a recycled event', async () => {
  const memory = [{ date: '2026-09-09', evidenceHashes: ['a', 'b'], factKeys: ['https://help.openai.com/en/articles/6950777|an earlier different sentence.'], topicKey: 'chatgpt:other:earlier' }];
  const bundle = await buildMerchantEvidenceBundle({ dateStr: '2026-09-10', snapshot, official, memory });
  assert.equal(bundle.newEvidenceIds.length, 0);
  assert.equal(validateMerchantEditorial(draft(), bundle).ok, true);
  assert.match(renderMerchantEditorial(draft(), bundle).markdown, /不代表今天发生了新事件/);
  assert.equal(validateMerchantEditorial({ ...draft(), topicKey: memory[0].topicKey }, bundle).ok, false);
  assert.equal(validateMerchantEditorial({ ...draft(), headline: '今天刚刚发布' }, bundle).ok, false);
});
