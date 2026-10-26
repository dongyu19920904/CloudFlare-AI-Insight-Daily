import { Lexer } from './marked.esm.js';

export const OPPORTUNITY_EDITORIAL_VERSION = 'opportunity-reader-20261026-v1';

function separateMetadata(source) {
    const lines = source.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) || [];
    const delimiter = lines[0]?.trim();
    if (delimiter !== '---' && delimiter !== '+++') return ['', source];
    let offset = lines[0].length;
    for (const line of lines.slice(1)) {
        offset += line.length;
        if (line.trim() === delimiter) return [source.slice(0, offset), source.slice(offset)];
    }
    throw new Error('unclosed-frontmatter');
}

function collectRanges(tokens, raw, offset, ranges) {
    let cursor = 0;
    for (const token of tokens) {
        if (!token.raw) continue;
        const index = raw.indexOf(token.raw, cursor);
        if (index < 0) throw new Error('unmapped-markdown-token');
        const start = offset + index;
        const end = start + token.raw.length;
        cursor = index + token.raw.length;
        if (['code', 'codespan', 'html', 'link', 'image', 'def', 'escape'].includes(token.type)) {
            ranges.protected.push({ start, end, escape: token.type === 'escape' });
        } else if (token.tokens || token.items) {
            collectRanges(token.tokens || token.items, token.raw, start, ranges);
        } else if (token.type === 'text') {
            // Marked core does not parse math; leave a math-bearing leaf untouched.
            if (token.raw.includes('$')) ranges.protected.push({ start, end });
            else ranges.text.push({ start, end });
        }
    }
}

function replaceRanges(source, replacements) {
    let result = source;
    for (const edit of [...replacements].sort((a, b) => b.start - a.start)) {
        result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
    }
    return result;
}

function protectMath(body, ranges) {
    for (let start = 0; start < body.length; start += 1) {
        if (ranges.protected.some((range) => !range.escape && start >= range.start && start < range.end)) continue;
        if (body[start - 1] === '\\') continue;
        const open = ['$$', '\\[', '\\(', '$'].find((mark) => body.startsWith(mark, start));
        if (!open) continue;
        const close = ({ '\\[': '\\]', '\\(': '\\)' })[open] || open;
        const end = body.indexOf(close, start + open.length);
        if (end < 0) continue;
        ranges.protected.push({ start, end: end + close.length });
        start = end + close.length - 1;
    }
    const text = [];
    for (const range of ranges.text) {
        if (ranges.protected.some((literal) => range.start < literal.end && range.end > literal.start)) {
            ranges.protected.push(range);
        } else text.push(range);
    }
    ranges.text = text;
    const merged = [];
    for (const range of ranges.protected.sort((a, b) => a.start - b.start)) {
        const last = merged.at(-1);
        if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
        else merged.push({ ...range });
    }
    ranges.protected = merged;
}

/** Keep the existing evidence policy, but never run its prose rules over code or URLs. */
export function normalizeOpportunityEditorialMarkdown(source, {
    normalizeEvidence = (text) => text,
} = {}) {
    const original = String(source ?? '');
    const warnings = [];
    try {
        const [metadata, body] = separateMetadata(original);
        const ranges = { protected: [], text: [] };
        // Marked normalizes CRLF internally; map parser offsets back to the untouched input.
        const positions = [];
        let parseBody = '';
        for (let index = 0; index < body.length; index += 1) {
            positions.push(index);
            parseBody += body[index] === '\r' ? '\n' : body[index];
            if (body[index] === '\r' && body[index + 1] === '\n') index += 1;
        }
        positions.push(body.length);
        collectRanges(new Lexer({ gfm: true }).lex(parseBody), parseBody, 0, ranges);
        for (const group of Object.values(ranges)) {
            for (const range of group) {
                range.start = positions[range.start];
                range.end = positions[range.end];
            }
        }
        protectMath(body, ranges);
        let prefix = 'OPPORTUNITY_LITERAL_';
        while (body.includes(prefix)) prefix += 'X';
        const literals = ranges.protected.map((range, index) => ({
            ...range,
            text: `${prefix}${index}_END`,
            original: body.slice(range.start, range.end),
        }));
        const questions = ranges.text.map((range) => {
            const text = body.slice(range.start, range.end);
            if (/[^。！？\n]{75}/u.test(text)) warnings.push('long-sentence');
            return {
                ...range,
                // Avoid interpreting the negative substring of a yes/no question as an evidence gap.
                text: text.replace(/有没有(?=(?:真实)?(?:付费意向|付费证据|用户原话|询价记录))/gu, '是否有'),
            };
        });
        let normalized = normalizeEvidence(replaceRanges(body, [...literals, ...questions]));
        if (typeof normalized !== 'string') throw new Error('invalid-normalizer-output');
        for (const literal of literals) {
            if (normalized.split(literal.text).length !== 2) throw new Error('lost-protected-literal');
            normalized = normalized.replace(literal.text, () => literal.original);
        }
        return {
            markdown: metadata + normalized,
            version: OPPORTUNITY_EDITORIAL_VERSION,
            warnings: [...new Set(warnings)],
            fallback: false,
        };
    } catch {
        // The caller still applies the unchanged publication gate to this original draft.
        return {
            markdown: original,
            version: OPPORTUNITY_EDITORIAL_VERSION,
            warnings: ['editorial-original-retained'],
            fallback: true,
        };
    }
}
