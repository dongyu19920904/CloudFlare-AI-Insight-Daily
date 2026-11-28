import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const scheduledUrl = new URL('../../src/handlers/scheduled.js', import.meta.url);
const fixture = readFileSync(new URL('../fixtures/opportunityEditorial.md', import.meta.url), 'utf8');
const source = readFileSync(scheduledUrl, 'utf8');
const candidates = [
    ['gstack', 'https://github.com/garrytan/gstack'],
    ['Understand-Anything', 'https://github.com/Egonex-AI/Understand-Anything'],
].map(([label, url]) => ({
    label, entityKey: `github:${new URL(url).pathname.slice(1).toLowerCase()}`,
    businessModel: 'result-delivery', deliveryType: 'result-service', offerFamily: 'developer-tool-setup',
    evidenceSources: url, evidenceStrength: 'strong', evidenceGaps: [], confidence: '中',
    score: 80, matchedTerms: [], sellFormats: [], preferredLaneName: '固定范围交付',
    supportingItems: [{ title: label, url, type: 'project', source: 'GitHub', description: '公开项目说明，需求待验证。', evidence: { isPrimary: true, tier: 'primary', reason: '原项目' } }],
}));

let calls = 0;
let writes = 0;
let network = 0;
let drafts = [];
let qualified = true;
globalThis.fetch = async () => { network += 1; throw new Error('offline fixture forbids network'); };
const forbidWrite = async () => { writes += 1; throw new Error('fixture forbids production writes'); };
const root = new vm.SourceTextModule(`${source}\nexport function __setContextFixture(fn) { loadScheduledContext = fn; }`, {
    identifier: scheduledUrl.href,
});
await root.link(async (specifier) => {
    const url = new URL(specifier, scheduledUrl);
    const forbiddenDaily = async () => { throw new Error('unexpected main daily operation'); };
    const infrastructure = {
        '../dataFetchers.js': { fetchAllData: forbiddenDaily, dataSources: [] },
        '../dailySourcePrefetch.js': { prefetchDailySourceCategories: forbiddenDaily },
    };
    const actual = infrastructure[specifier] || await import(url.href);
    const exported = { ...actual };
    if (specifier === '../chatapi.js') {
        exported.callChatAPIStream = async function* () {
            const draft = drafts[Math.min(calls, drafts.length - 1)] ?? '';
            calls += 1;
            if (draft instanceof Error) throw draft;
            yield draft;
        };
        exported.callChatAPI = async () => { throw new Error('unexpected transport fallback'); };
    }
    if (specifier === '../opportunityScoring.js') {
        exported.buildOpportunityCandidateAssessment = () => ({ candidates: qualified ? candidates : [], rejectedCandidates: [], stats: { rejected: 0 } });
    }
    if (specifier === '../opportunityEvidence.js') {
        exported.buildOpportunityEvidenceEnrichment = async () => ({ recordsBySourceUrl: {}, stats: { requests: 0 } });
    }
    if (specifier === '../opportunityAivoraLinkPolicy.js') {
        exported.loadAivoraOpportunityLinkPolicy = async () => ({ allowedUrls: [], suggestedUrl: '' });
    }
    if (specifier === '../github.js') {
        exported.createOrUpdateGitHubFile = forbidWrite;
        exported.getGitHubFileContent = async () => { throw new Error('unexpected repository read'); };
    }
    if (specifier === '../kv.js') {
        exported.storeInKV = forbidWrite;
        exported.getFromKV = async () => null;
    }
    return new vm.SyntheticModule(Object.keys(exported), function() {
        for (const [key, value] of Object.entries(exported)) this.setExport(key, value);
    }, { identifier: url.href });
});
await root.evaluate();
root.namespace.__setContextFixture(async () => ({
    allUnifiedData: {}, previousOpportunityReplaySignals: null, recentOpportunityReplayMemory: null,
}));
async function run(nextDrafts, { dryRun = true, noCandidates = false } = {}) {
    calls = 0;
    drafts = nextDrafts;
    qualified = !noCandidates;
    return root.namespace.handleScheduledOpportunity({}, { BOOK_LINK: 'https://news.aivora.cn/' }, {}, '2026-10-25', { dryRun });
}

const valid = await run([fixture]);
assert.equal(valid.opportunityValidationPassed, true, valid.opportunityValidationIssues?.join('\n'));
assert.equal(valid.opportunityWouldPublish, true);
assert.equal(valid.opportunityPublished, false);
assert.match(valid.opportunityDryRunMarkdown, /是否有付费意向/);
assert.doesNotMatch(valid.opportunityDryRunMarkdown, /有本次候选输入未提供付费意向/);
assert.match(valid.opportunityDryRunMarkdown, /opportunity-replay:/);
assert.equal(calls, 1);

const repaired = await run(['无来源也无完整结构', fixture]);
assert.equal(repaired.opportunityValidationPassed, true);
assert.equal(calls, 2);

// Even a non-dry-run invalid draft must never reach the real save functions.
const invalid = await run(['无来源也无完整结构'], { dryRun: false });
assert.equal(invalid.opportunityValidationPassed, false);
assert.notEqual(invalid.opportunityPublished, true);
assert.equal(calls, 2);
const empty = await run([''], { dryRun: false });
assert.equal(empty.opportunityValidationPassed, false);
assert.equal(calls, 2);
const skipped = await run([], { noCandidates: true });
assert.equal(skipped.opportunityQualitySkipped, true);
assert.equal(calls, 0);
await assert.rejects(run([new Error('fixture model unavailable')]), /fixture model unavailable/);
assert.equal(calls, 1);
assert.equal(writes, 0);
assert.equal(network, 0);
if (process.argv[2]) {
    const output = path.resolve(process.argv[2]);
    assert.ok(output.startsWith('D:\\CodexReports\\opportunity-editorial-20261026'));
    mkdirSync(output, { recursive: true });
    writeFileSync(path.join(output, 'actual-handler-dry-run.md'), valid.opportunityDryRunMarkdown);
    writeFileSync(path.join(output, 'actual-handler-dry-run.json'), JSON.stringify({
        mode: 'offline-fixture-not-live-model', valid, repaired: { passed: repaired.opportunityValidationPassed, mockCalls: 2 },
        invalid: { passed: invalid.opportunityValidationPassed, mockCalls: 2 }, empty: { passed: empty.opportunityValidationPassed, mockCalls: 2 },
        noCandidates: { skipped: skipped.opportunityQualitySkipped, mockCalls: 0 }, modelFailure: { mockCalls: 1, thrown: true },
        productionWrites: writes, network, paidCalls: 0,
    }, null, 2));
}
console.log('offline opportunity pipeline passed: valid, repair, invalid, empty, no-candidate, model-failure; writes=0 network=0');
