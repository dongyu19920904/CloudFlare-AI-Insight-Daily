import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { normalizeOpportunityEditorialMarkdown } from '../src/opportunityEditorial.js';
import { normalizeOpportunityEvidenceBoundaryLanguage } from '../src/publishValidation.js';
import { getSystemPromptAiOpportunity, AI_OPPORTUNITY_PROMPT_VERSION } from '../src/prompt/aiOpportunityPrompt.js';
import { assembleDailySummaryMarkdown } from '../src/dailyMarkdownAssembly.js';

const options = { normalizeEvidence: normalizeOpportunityEvidenceBoundaryLanguage };

test('opportunity yes/no demand questions survive the existing evidence policy', () => {
    const raw = '- **48小时验证：** 问有没有付费意向；目前没有付费证据。';
    assert.match(normalizeOpportunityEvidenceBoundaryLanguage(raw), /有本次候选输入未提供/);
    const result = normalizeOpportunityEditorialMarkdown(raw, options);
    assert.equal(result.fallback, false);
    assert.equal(result.markdown, '- **48小时验证：** 问是否有付费意向；本次候选输入未提供付费证据。');
    assert.equal(normalizeOpportunityEditorialMarkdown(result.markdown, options).markdown, result.markdown);
});

test('AST normalization preserves metadata, URLs, numbers, code, HTML, math and replay data', () => {
    const protectedText = [
        '---\nslug: sample-2026-10-25\ndate: 2026-10-25\ncanonical: https://example.org/a\ntitle: 有没有付费意向\n---\n',
        '[有没有付费意向](https://example.org/没有付费证据?q=8192#48)',
        '![有没有付费意向](https://example.org/img-8192.png "没有付费证据")',
        '`有没有付费意向；没有付费证据`',
        '```js\nconst evidence = "没有付费证据";\n// 有没有付费意向\n```',
        '    const example = "有没有付费意向";\n',
        '$x = \\text{有没有付费意向}$',
        '$$\nx = \\text{没有付费证据}\n$$',
        '\\(x = 有没有付费意向\\)',
        '<script type="application/ld+json">{"name":"没有付费证据","count":8192}</script>',
        '<!-- opportunity-replay: {"entity":"没有付费证据","date":"2026-10-25"} -->',
    ];
    const raw = `${protectedText.join('\n\n')}\n\n- 问有没有付费意向；3-5 人，48 小时，8192 token。\n`;
    for (const crlf of [false, true]) {
        const source = crlf ? raw.replaceAll('\n', '\r\n') : raw;
        const result = normalizeOpportunityEditorialMarkdown(source, options);
        assert.equal(result.fallback, false, result.warnings.join(','));
        for (const text of protectedText) assert.ok(result.markdown.includes(crlf ? text.replaceAll('\n', '\r\n') : text), text);
        assert.match(result.markdown, /问是否有付费意向/);
        assert.deepEqual(result.markdown.match(/\d+(?:-\d+)?/g), source.match(/\d+(?:-\d+)?/g));
        assert.equal(normalizeOpportunityEditorialMarkdown(result.markdown, options).markdown, result.markdown);
    }
});

test('empty drafts stay empty without fabricated filler', () => {
    assert.equal(normalizeOpportunityEditorialMarkdown('').markdown, '');
});

test('formatter exceptions never substitute fabricated content', () => {
    for (const normalizeEvidence of [() => { throw new Error('fixture'); }, () => null, () => 'lost']) {
        const raw = '`literal` 问有没有付费意向。';
        const result = normalizeOpportunityEditorialMarkdown(raw, { normalizeEvidence });
        assert.equal(result.markdown, raw);
        assert.equal(result.fallback, true);
    }
    const long = '长'.repeat(90);
    const result = normalizeOpportunityEditorialMarkdown(long);
    assert.equal(result.markdown, long);
    assert.deepEqual(result.warnings, ['long-sentence']);
});

test('opportunity prompt is versioned without changing publication shape', () => {
    const prompt = getSystemPromptAiOpportunity('2026-10-25');
    assert.ok(prompt.includes(AI_OPPORTUNITY_PROMPT_VERSION));
    assert.match(prompt, /不机械七字一断/);
    assert.match(prompt, /一次性配置不叫复购资产/);
    assert.match(prompt, /待验证假设/);
});

test('only the opportunity generator calls the adapter and fixed daily assembly stays identical', () => {
    const current = readFileSync(new URL('../src/handlers/scheduled.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
    const callSites = [...current.matchAll(/normalizeOpportunityEditorialMarkdown\(/g)].map((match) => match.index);
    assert.equal(callSites.length, 1);
    assert.ok(callSites[0] > current.indexOf('async function generateOpportunityMarkdown('));
    assert.ok(callSites[0] < current.indexOf('async function generateAccountOpportunityMarkdown('));
    const result = assembleDailySummaryMarkdown('## 今日焦点 TOP\n\n### 1. 固定输入\n**22.6** 次，[官方链接](https://example.org/a)。', '第一句。\n第二句。\n第三句。', {});
    assert.equal(result, '## **今日摘要**\n\n```\n第一句。\n第二句。\n第三句。\n```\n\n## 今日焦点 TOP\n\n### 1. 固定输入\n**22.6** 次，[官方链接](https://example.org/a)。');
});

test('actual scheduled opportunity handler passes offline fixtures and never writes in dry-run or failed validation', () => {
    const result = spawnSync(process.execPath, ['--experimental-vm-modules', new URL('./helpers/opportunityEditorialDryRun.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')], {
        encoding: 'utf8', timeout: 60000, env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /offline opportunity pipeline passed/);
});
