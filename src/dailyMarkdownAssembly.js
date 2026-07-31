import { insertFoot } from './foot.js';
import { insertAd, insertMidAd } from './ad.js';

const DAILY_BRIEFING_V2_PATTERN = /^##\s*\*{0,2}\s*⏱(?:️)?\s*3\s*分钟读懂今天\s*\*{0,2}\s*$/im;
const DAILY_BRIEFING_V2_LABELS = ['发生了什么', '为什么重要', '今天可以做'];

function hasDailyBriefingV2(markdown) {
    const content = String(markdown || '');
    return DAILY_BRIEFING_V2_PATTERN.test(content) && DAILY_BRIEFING_V2_LABELS.every((label) => (
        new RegExp(`(?:\\*\\*)?${label}(?:\\*\\*)?\\s*[：:]`).test(content)
    ));
}

function insertMidAdAfterDailyBriefing(markdown) {
    const content = String(markdown || '');
    const headingMatch = content.match(DAILY_BRIEFING_V2_PATTERN);
    if (!headingMatch || headingMatch.index === undefined) return insertMidAd(content);

    const briefingStart = headingMatch.index;
    const headingEnd = briefingStart + headingMatch[0].length;
    const nextSectionOffset = content.slice(headingEnd).search(/^##\s+/m);
    if (nextSectionOffset < 0) return insertMidAd(content);

    const nextSectionStart = headingEnd + nextSectionOffset;
    const briefing = content.slice(0, nextSectionStart).trimEnd();
    const remainingSections = content.slice(nextSectionStart).trimStart();
    return `${briefing}\n\n${insertMidAd(remainingSections)}`;
}

export function assembleDailySummaryMarkdown(outputOfCall2, outputOfCall3, env) {
    const hasV2Briefing = hasDailyBriefingV2(outputOfCall2);
    const contentWithMidAd = hasV2Briefing
        ? insertMidAdAfterDailyBriefing(outputOfCall2)
        : insertMidAd(outputOfCall2);
    let dailySummaryMarkdownContent = contentWithMidAd;

    // Keep the generated legacy summary as a publish-safe fallback when the model misses the V2 intro.
    if (!hasV2Briefing) {
        dailySummaryMarkdownContent = `## **今日摘要**\n\n\`\`\`\n${outputOfCall3}\n\`\`\`\n\n`;
        dailySummaryMarkdownContent += '\n\n## ⚡ 快速导航\n\n';
        dailySummaryMarkdownContent += '- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览\n\n';
        dailySummaryMarkdownContent += `\n\n${contentWithMidAd}`;
    }

    if (env.INSERT_AD == 'true') dailySummaryMarkdownContent += insertAd() + `\n`;
    if (env.INSERT_FOOT == 'true') dailySummaryMarkdownContent += insertFoot() + `\n\n`;

    return dailySummaryMarkdownContent;
}
