import { insertFoot } from './foot.js';
import { insertAd, insertMidAd } from './ad.js';

const DAILY_TOP_HEADING_PATTERN = /^##\s*\*{0,2}.*TOP.*\*{0,2}\s*$/im;

function normalizeThreeLineSummary(summary) {
    const cleaned = String(summary || '')
        .replace(/^```(?:text|markdown)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*(?:#{1,6}|[-*]|\d+[.)])\s*/, '').trim())
        .filter(Boolean);

    const candidates = cleaned.length > 1
        ? cleaned
        : (cleaned[0]?.match(/[^。！？!?]+[。！？!?]?/g) || []);

    return candidates.slice(0, 3).map((line) => line.trim()).filter(Boolean).join('\n');
}

function stripGeneratedDailyPreamble(markdown) {
    const content = String(markdown || '').trim();
    const topHeading = content.match(DAILY_TOP_HEADING_PATTERN);
    if (!topHeading || topHeading.index == null) return content;
    return content.slice(topHeading.index).trim();
}

export function assembleDailySummaryMarkdown(outputOfCall2, outputOfCall3, env) {
    const summary = normalizeThreeLineSummary(outputOfCall3);
    const body = stripGeneratedDailyPreamble(outputOfCall2);
    const contentWithMidAd = insertMidAd(body);
    let dailySummaryMarkdownContent = `## **今日摘要**\n\n\`\`\`\n${summary}\n\`\`\`\n\n${contentWithMidAd}`;

    if (env.INSERT_AD == 'true') dailySummaryMarkdownContent += `${insertAd()}\n`;
    if (env.INSERT_FOOT == 'true') dailySummaryMarkdownContent += `${insertFoot()}\n\n`;

    return dailySummaryMarkdownContent;
}
