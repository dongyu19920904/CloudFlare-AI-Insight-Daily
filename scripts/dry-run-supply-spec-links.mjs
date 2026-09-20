import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSupplyOpportunitySnapshot } from '../src/supplyOpportunitySnapshot.js';
import { buildSupplyDrivenAccountOpportunityMarkdown } from '../src/supplyDrivenAccountOpportunity.js';
import { validateSupplyDrivenAccountOpportunityPublication } from '../src/publishValidation.js';

// Public read-only integration check: no model, KV, GitHub or Supabase writes.
const dateStr = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) throw new Error('Specify Shanghai date YYYY-MM-DD');
const started = Date.now();
let requests = 0;
const loaded = await loadSupplyOpportunitySnapshot({}, { fetchImpl: (...args) => { requests++; return fetch(...args); } });
if (!loaded.snapshot) throw new Error(`snapshot_unavailable:${loaded.error}`);
const snapshot = loaded.snapshot;
const result = buildSupplyDrivenAccountOpportunityMarkdown({ dateStr, snapshot });
const validation = validateSupplyDrivenAccountOpportunityPublication({
  markdown: result.markdown,
  allowedSupplyUrls: result.allowedSupplyUrls,
  expectedStats: snapshot.stats,
  expectedLeadProductSlug: result.leadProduct?.slug || null,
  expectedVerifiedSourceCount: result.leadProduct?.verifiedSourceCount || 0,
  expectComparableHistory: result.hasComparableHistory,
  expectedFreshComparableSignalCount: result.freshComparableSignalCount,
  expectedDailyFocusKey: result.dailyFocusKey,
  pageTitle: result.pageTitle,
});
const metadata = JSON.parse(result.markdown.match(/<!-- opportunity-replay: (.+) -->/)[1]);
if (metadata.productUrl) {
  for (const href of [metadata.productUrl, metadata.calculatorUrl]) {
    const url = new URL(href);
    if (url.searchParams.get('spec') !== metadata.verifiedSpecLabel || url.searchParams.get('report') !== dateStr) throw new Error('spec_link_mismatch');
  }
}
const output = path.resolve('reports', 'supply-spec-seo');
await mkdir(output, { recursive: true });
await writeFile(path.join(output, `${dateStr}.md`), result.markdown, 'utf8');
const summary = { dateStr, validation, lead: metadata.leadProductSlug, spec: metadata.verifiedSpecLabel, cost: metadata.referenceCost, stats: snapshot.stats, requests, elapsedMs: Date.now() - started, modelCalls: 0, databaseWrites: 0, published: false, historyMode: 'current public snapshot; no seven-day replay loaded' };
await writeFile(path.join(output, `${dateStr}.json`), JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify(summary));
if (!validation.ok) process.exitCode = 1;
