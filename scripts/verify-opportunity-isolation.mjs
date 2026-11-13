import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Task-scoped audit, not a permanent freeze of the main daily in normal CI.
const baseline = process.argv[2] || 'c17c2b135de54b1564600a1a13b425cfa2b06700';
const root = new URL('../', import.meta.url);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).replaceAll('\r\n', '\n');
const current = readFileSync(new URL('../src/handlers/scheduled.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const restored = current
    .replace("import { normalizeOpportunityEditorialMarkdown } from '../opportunityEditorial.js';\n", '')
    .replace(`        // Opportunity-only editorial adapter; daily and account pipelines stay unchanged.
        const editorial = normalizeOpportunityEditorialMarkdown(markdown, {
            normalizeEvidence: (text) => normalizeOpportunityEvidenceBoundaryLanguage(text, { observationMode }),
        });
        markdown = editorial.markdown;
        debugInfo.opportunityEditorialVersion = editorial.version;
        debugInfo.opportunityEditorialWarnings = editorial.warnings;`, `        markdown = normalizeOpportunityEvidenceBoundaryLanguage(markdown, {
            observationMode,
        });`);
assert.equal(restored, git('show', `${baseline}:src/handlers/scheduled.js`));
const allowed = ['src/handlers/scheduled.js', 'src/prompt/aiOpportunityPrompt.js', 'src/opportunityEditorial.js'];
const changed = git('diff', '--name-only', baseline, '--', 'src', '.github', 'wrangler.toml').trim().split('\n').filter(Boolean);
const untracked = git('ls-files', '--others', '--exclude-standard', '--', 'src', '.github').trim().split('\n').filter(Boolean);
assert.ok([...changed, ...untracked].every((file) => allowed.includes(file)), [...changed, ...untracked].join('\n'));
const files = git('ls-tree', '-r', '--name-only', baseline, '--', 'src', '.github', 'wrangler.toml').trim().split('\n').filter((file) => !allowed.includes(file));
const hashes = files.map((file) => {
    const content = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
    return { file, sha256: createHash('sha256').update(content).digest('hex') };
});
const output = 'D:/CodexReports/opportunity-editorial-20261026';
mkdirSync(output, { recursive: true });
writeFileSync(path.join(output, 'protected-source.json'), JSON.stringify({ baseline, protectedFiles: hashes, scheduledApprovedBlockOnly: true, changed, untracked }, null, 2));
console.log(JSON.stringify({ protectedFiles: hashes.length, scheduledApprovedBlockOnly: true, output }));
