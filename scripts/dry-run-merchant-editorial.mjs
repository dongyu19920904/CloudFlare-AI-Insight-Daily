import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSupplyOpportunitySnapshot } from '../src/supplyOpportunitySnapshot.js';
import { generateMerchantEditorial } from '../src/merchantEditorial.js';
import { validateMerchantEditorialPublication } from '../src/publishValidation.js';

const dateStr = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) throw new Error('Specify Shanghai date YYYY-MM-DD');
const output = path.resolve(process.argv[3] || 'artifacts/merchant-editorial');
const env = {
  USE_MODEL_PLATFORM: 'ANTHROPIC',
  ANTHROPIC_API_URL: process.env.ANTHROPIC_BASE_URL,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_AUTH_TOKEN,
  DEFAULT_ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
};
const loaded = await loadSupplyOpportunitySnapshot({});
if (!loaded.snapshot) throw new Error(`snapshot_unavailable:${loaded.error}`);
const debug = {};
const result = await generateMerchantEditorial({ env, dateStr, snapshot: loaded.snapshot, debugInfo: debug, dryRun: true });
const validation = validateMerchantEditorialPublication({ markdown: result.markdown, bundle: result.bundle });
await mkdir(output, { recursive: true });
await writeFile(path.join(output, `${dateStr}.md`), result.markdown, 'utf8');
await writeFile(path.join(output, `${dateStr}-evidence.json`), JSON.stringify(result.bundle, null, 2), 'utf8');
await writeFile(path.join(output, `${dateStr}-result.json`), JSON.stringify({ debug, validation, pageTitle: result.pageTitle, databaseWrites: 0, published: false }, null, 2), 'utf8');
console.log(JSON.stringify({ debug, validation, output, pageTitle: result.pageTitle, databaseWrites: 0, published: false }));
if (!validation.ok || !debug.accountOpportunityEditorialAccepted) process.exitCode = 1;
