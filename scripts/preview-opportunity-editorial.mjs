import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeOpportunityEditorialMarkdown } from '../src/opportunityEditorial.js';
import { normalizeOpportunityEvidenceBoundaryLanguage, validateOpportunityPublication } from '../src/publishValidation.js';

const frontend = path.resolve(process.argv[2] || '');
const destination = path.resolve(process.argv[3] || '');
if (!frontend.endsWith('Hextra-AI-Insight-Daily-opportunity-20261026') || !destination.startsWith('D:\\CodexCache\\runs\\opportunity-editorial-20261026-')) {
    throw new Error('Specify the isolated frontend worktree and a task-owned D-drive preview content directory');
}
const raw = await readFile(new URL('../tests/fixtures/opportunityEditorial.md', import.meta.url), 'utf8');
const result = normalizeOpportunityEditorialMarkdown(raw, { normalizeEvidence: normalizeOpportunityEvidenceBoundaryLanguage });
const sourceUrls = ['https://github.com/garrytan/gstack', 'https://github.com/Egonex-AI/Understand-Anything'];
const validation = validateOpportunityPublication({ markdown: result.markdown, allowedSourceUrls: sourceUrls, sourceEvidence: sourceUrls.map((url) => ({ url, isPrimary: true })), minimumOpportunityCount: 1 });
assert.equal(validation.ok, true, validation.issues.join('\n'));
await mkdir(destination, { recursive: true });
await cp(path.join(frontend, 'content'), destination, { recursive: true });
const datedPath = path.join(destination, 'cn/opportunity/2026-10/2026-10-25.md');
const published = await readFile(datedPath, 'utf8');
const metadata = published.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)?.[0];
assert.ok(metadata, 'Existing frontmatter must remain unchanged');
await writeFile(datedPath, metadata + '\n' + result.markdown);
await writeFile(path.join(destination, 'preview.json'), JSON.stringify({ languages: { zh: { contentDir: path.join(destination, 'cn') }, en: { contentDir: path.join(destination, 'en') } } }));
await writeFile(new URL('../docs/opportunity/preview-20261025.md', import.meta.url), '# 离线样稿，不是正式生成或已发布内容\n\n这是 10 月 25 日两个原项目候选的人工 fixture。未调用模型、未实测部署、未联系用户，也没有成交记录。样品和触达均为待执行动作。\n\n' + result.markdown);
console.log(JSON.stringify({ destination, version: result.version, warnings: result.warnings, validation, paidCalls: 0, productionWrites: 0 }));
