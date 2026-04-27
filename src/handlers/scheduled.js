import { getISODate, formatDateToChinese, removeMarkdownCodeBlock, stripHtml, convertPlaceholdersToMarkdownImages, setFetchDate, hasMedia, replaceIncorrectDomainLinks } from '../helpers.js';
import { fetchAllData, dataSources } from '../dataFetchers.js';
import { storeInKV, getFromKV } from '../kv.js';
import { callChatAPI, callChatAPIStream } from '../chatapi.js';
import { resolveScheduledModeFromEvent } from '../scheduleRouting.js';
import { getSystemPromptSummarizationStepOne } from "../prompt/summarizationPromptStepZero.js";
import { getSystemPromptSummarizationStepThree } from "../prompt/summarizationPromptStepThree.js";
import { getSystemPromptAiOpportunity } from "../prompt/aiOpportunityPrompt.js";
import { getSystemPromptAiAccountOpportunity } from "../prompt/aiAccountOpportunityPrompt.js";
import {
    opportunityPlaybook,
    serializeOpportunityPlaybook,
} from "../opportunityPlaybook.js";
import {
    accountOpportunityPlaybook,
    serializeAccountOpportunityPlaybook,
} from "../accountOpportunityPlaybook.js";
import {
    buildOpportunityCandidates,
    formatOpportunityCandidatesForPrompt,
    inferOpportunityReplaySignals,
} from "../opportunityScoring.js";
import { insertFoot } from '../foot.js';
import { insertAd, insertMidAd } from '../ad.js';
import { buildDailyContentWithFrontMatter, getYearMonth, updateHomeIndexContent, buildMonthDirectoryIndex } from '../contentUtils.js';
import { createOrUpdateGitHubFile, getGitHubFileContent, getGitHubFileSha } from '../github.js';
import { buildDailyPromptSelection } from '../dailyPromptSelection.js';
import { buildDailyCreativityBrief } from '../opportunityCreativity.js';
import {
    buildOpportunityPaths,
    DEFAULT_OPPORTUNITY_PAGE_DESCRIPTION,
    DEFAULT_OPPORTUNITY_SECTION_DESCRIPTION,
    updateSectionHomeIndexContent,
} from '../opportunityUtils.js';
import {
    buildAccountOpportunityPaths,
    DEFAULT_ACCOUNT_OPPORTUNITY_PAGE_DESCRIPTION,
    DEFAULT_ACCOUNT_OPPORTUNITY_SECTION_DESCRIPTION,
    updateAccountOpportunityHomeIndexContent,
} from '../accountOpportunityUtils.js';
import {
    validateDailyPublication,
    validateAccountOpportunityPublication,
    validateOpportunityPublication,
} from '../publishValidation.js';

function extractMediaPlaceholdersFromHtml(html, limit = 3) {
    if (!html) return [];

    const placeholders = [];
    const seen = new Set();
    const str = String(html);

    const addPlaceholder = (placeholder) => {
        if (!placeholder || seen.has(placeholder)) return;
        seen.add(placeholder);
        placeholders.push(placeholder);
    };

    for (const match of str.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi)) {
        const src = match[1]?.trim();
        const alt = match[2]?.trim();
        if (src) addPlaceholder(`![${alt || 'image'}](${src})`);
        if (placeholders.length >= limit) return placeholders;
    }

    for (const match of str.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*>/gi)) {
        const src = match[1]?.trim();
        if (src) addPlaceholder(`![image](${src})`);
        if (placeholders.length >= limit) return placeholders;
    }

    for (const match of str.matchAll(/<video\b[^>]*src="([^"]+)"[^>]*>/gi)) {
        const src = match[1]?.trim();
        if (src) addPlaceholder(`<video controls preload="metadata" playsinline style="max-width:100%; height:auto;" src="${src}"></video>`);
        if (placeholders.length >= limit) return placeholders;
    }

    return placeholders;
}

function containsRenderedMedia(markdown) {
    return countRenderedMedia(markdown) > 0;
}

function countRenderedMedia(markdown) {
    if (!markdown) return 0;
    return (String(markdown).match(/!\[[^\]]*\]\([^)]+\)|<img\b|<video\b/gi) || []).length;
}

function truncatePromptText(text, maxChars = 500) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxChars) return normalized;
    return `${normalized.slice(0, maxChars)}?`;
}

function getPreviousDate(dateStr) {
    const [year, month, day] = String(dateStr || '').split('-').map(Number);
    if (!year || !month || !day) return null;

    const utcDate = new Date(Date.UTC(year, month - 1, day));
    utcDate.setUTCDate(utcDate.getUTCDate() - 1);

    const previousYear = utcDate.getUTCFullYear();
    const previousMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    const previousDay = String(utcDate.getUTCDate()).padStart(2, '0');

    return `${previousYear}-${previousMonth}-${previousDay}`;
}

function normalizeReplayUrl(url) {
    if (!url) return '';

    try {
        const parsed = new URL(String(url).trim());
        let hostname = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
        if (hostname === 'twitter.com') hostname = 'x.com';
        const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
        return `${hostname}${pathname}`.toLowerCase();
    } catch {
        return String(url).trim().toLowerCase().replace(/\/+$/, '');
    }
}

function normalizeReplayTitle(title) {
    return String(title || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[`~!@#$%^&*()_+=[\]{};:'",.<>/?\\|????????????????????-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getReplayTitleTokens(title) {
    const normalized = String(title || '').normalize('NFKC').toLowerCase();
    const tokens = new Set();

    for (const match of normalized.match(/[a-z0-9][a-z0-9.+_-]{1,}/g) || []) {
        if (match.length >= 2) tokens.add(match);
    }

    const cjkOnly = normalized.replace(/[^\u4e00-\u9fff]/g, '');
    for (let index = 0; index <= cjkOnly.length - 3; index += 1) {
        tokens.add(cjkOnly.slice(index, index + 3));
    }

    return tokens;
}

function isSimilarReplayTitle(currentTitle, previousTitle) {
    const normalizedCurrent = normalizeReplayTitle(currentTitle);
    const normalizedPrevious = normalizeReplayTitle(previousTitle);

    if (!normalizedCurrent || !normalizedPrevious) return false;
    if (normalizedCurrent === normalizedPrevious) return true;

    if (
        normalizedCurrent.length >= 12 &&
        normalizedPrevious.length >= 12 &&
        (normalizedCurrent.includes(normalizedPrevious) || normalizedPrevious.includes(normalizedCurrent))
    ) {
        return true;
    }

    const currentTokens = getReplayTitleTokens(currentTitle);
    const previousTokens = getReplayTitleTokens(previousTitle);
    if (currentTokens.size === 0 || previousTokens.size === 0) return false;

    const overlap = [...currentTokens].filter((token) => previousTokens.has(token));
    const strongOverlap = overlap.filter((token) => /[a-z]/.test(token) ? token.length >= 4 : token.length >= 3);
    const minTokenCount = Math.min(currentTokens.size, previousTokens.size);

    return strongOverlap.length >= 2 || (overlap.length >= 3 && overlap.length / minTokenCount >= 0.6);
}

function extractPreviousTopItems(markdown) {
    const content = String(markdown || '');
    if (!content) return [];

    const topSectionMatch = content.match(/^##\s*\*\*.*TOP.*\*\*/im);
    if (!topSectionMatch || topSectionMatch.index == null) return [];

    const startIndex = topSectionMatch.index;
    const remaining = content.slice(startIndex + topSectionMatch[0].length);
    const nextSectionMatch = remaining.match(/\n##\s+/);
    const endIndex = nextSectionMatch ? startIndex + topSectionMatch[0].length + nextSectionMatch.index : content.length;
    const topSection = content.slice(startIndex, endIndex);

    const items = [];
    const seen = new Set();
    const itemRegex = /^###\s+\d+\.\s+\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gm;

    for (const match of topSection.matchAll(itemRegex)) {
        const title = match[1]?.trim();
        const url = match[2]?.trim();
        const urlKey = normalizeReplayUrl(url);
        const titleKey = normalizeReplayTitle(title);
        const dedupeKey = `${urlKey}::${titleKey}`;
        if (!title || !url || seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        items.push({ title, url, urlKey, titleKey });
    }

    return items;
}

function isUsablePreviousDaily(markdown, topItems) {
    if (!markdown || !Array.isArray(topItems) || topItems.length < 3) return false;

    const failurePatterns = [
        /????/i,
        /????/i,
        /?????/i,
        /?????/i,
        /??????/i,
        /???????/i,
        /i can't help/i,
        /would you like help/i,
        /set up an api integration/i,
    ];

    return !failurePatterns.some((pattern) => pattern.test(markdown));
}

async function loadPreviousTopItems(env, dateStr) {
    const previousDate = getPreviousDate(dateStr);
    if (!previousDate) {
        return { previousDate: null, items: [] };
    }

    try {
        const previousMarkdown = await getGitHubFileContent(env, `daily/${previousDate}.md`);
        const topItems = extractPreviousTopItems(previousMarkdown);
        if (!isUsablePreviousDaily(previousMarkdown, topItems)) {
            console.warn(`[Scheduled] Previous daily ${previousDate} missing usable TOP section, skipping replay filter.`);
            return { previousDate, items: [] };
        }
        return { previousDate, items: topItems };
    } catch (error) {
        console.warn(`[Scheduled] Failed to load previous daily ${previousDate}, skipping replay filter: ${error.message}`);
        return { previousDate, items: [] };
    }
}

function extractMarkdownSection(markdown, heading) {
    const content = String(markdown || '');
    const normalizedHeading = String(heading || '').trim();
    if (!content || !normalizedHeading) return '';

    const escapedHeading = normalizedHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sectionHeaderRegex = new RegExp(`^##\\s+${escapedHeading}\\s*$`, 'm');
    const sectionMatch = content.match(sectionHeaderRegex);
    if (!sectionMatch || sectionMatch.index == null) return '';

    const startIndex = sectionMatch.index;
    const remaining = content.slice(startIndex + sectionMatch[0].length);
    const nextSectionMatch = remaining.match(/\n##\s+/);
    const endIndex = nextSectionMatch
        ? startIndex + sectionMatch[0].length + nextSectionMatch.index
        : content.length;

    return content.slice(startIndex, endIndex).trim();
}

async function loadPreviousOpportunityMainTopicSignals(env, dateStr) {
    const previousDate = getPreviousDate(dateStr);
    if (!previousDate) {
        return {
            previousDate: null,
            signals: { matchedRuleIds: [], matchedTerms: [], primaryLane: null },
        };
    }

    const previousPaths = buildOpportunityPaths(previousDate);

    try {
        const previousMarkdown = await getGitHubFileContent(env, previousPaths.pagePath);
        const mainTopicSection =
            extractMarkdownSection(previousMarkdown, '????') || previousMarkdown;
        const signals = inferOpportunityReplaySignals(mainTopicSection, opportunityPlaybook);

        return { previousDate, signals };
    } catch (error) {
        console.warn(
            `[Scheduled] Failed to load previous opportunity ${previousDate}, skipping replay penalty: ${error.message}`
        );
        return {
            previousDate,
            signals: { matchedRuleIds: [], matchedTerms: [], primaryLane: null },
        };
    }
}

function filterNewsAgainstPreviousTop(newsItems, previousTopItems) {
    if (!Array.isArray(newsItems) || newsItems.length === 0 || !Array.isArray(previousTopItems) || previousTopItems.length === 0) {
        return { filteredNewsItems: newsItems || [], filteredCount: 0 };
    }

    const previousUrlKeys = new Set(previousTopItems.map((item) => item.urlKey).filter(Boolean));
    const previousTitles = previousTopItems.map((item) => item.title).filter(Boolean);

    const filteredNewsItems = [];
    let filteredCount = 0;

    for (const item of newsItems) {
        const urlKey = normalizeReplayUrl(item?.url);
        const title = item?.title || '';
        const duplicateByUrl = urlKey && previousUrlKeys.has(urlKey);
        const duplicateByTitle = !duplicateByUrl && title && previousTitles.some((previousTitle) => isSimilarReplayTitle(title, previousTitle));

        if (duplicateByUrl || duplicateByTitle) {
            filteredCount += 1;
            continue;
        }

        filteredNewsItems.push(item);
    }

    return { filteredNewsItems, filteredCount };
}

function getPositiveInteger(value, fallback) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function mergeReplayBackfillNewsItems(filteredNewsItems, originalNewsItems, minimumCount = 12) {
    const output = [...(filteredNewsItems || [])];
    if (output.length >= minimumCount || !Array.isArray(originalNewsItems) || originalNewsItems.length === 0) {
        return { newsItems: output, backfillCount: 0 };
    }

    const seen = new Set(output.map((item) => `${normalizeReplayUrl(item?.url)}::${normalizeReplayTitle(item?.title)}`));
    let backfillCount = 0;

    for (const item of originalNewsItems) {
        if (output.length >= minimumCount) break;
        const key = `${normalizeReplayUrl(item?.url)}::${normalizeReplayTitle(item?.title)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(item);
        backfillCount += 1;
    }

    return { newsItems: output, backfillCount };
}

async function generateContentWithTransportFallback(env, userPrompt, systemPrompt) {
    try {
        let output = "";
        for await (const chunk of callChatAPIStream(env, userPrompt, systemPrompt)) {
            output += chunk;
        }
        return output;
    } catch (error) {
        const message = String(error?.message || error);
        if (!/(524|timeout|timed out)/i.test(message)) {
            throw error;
        }
        console.warn(`[Scheduled] Stream generation failed, retrying non-stream: ${message}`);
        return await callChatAPI(env, userPrompt, systemPrompt);
    }
}

function assembleDailySummaryMarkdown(outputOfCall2, outputOfCall3, env) {
    const contentWithMidAd = insertMidAd(outputOfCall2);
    let dailySummaryMarkdownContent = `## **????**\n\n\`\`\`\n${outputOfCall3}\n\`\`\`\n\n`;
    dailySummaryMarkdownContent += '\n\n## ? ????\n\n';
    dailySummaryMarkdownContent += '- [?? ?? AI ??](#??ai??) - ??????\n\n';
    dailySummaryMarkdownContent += `\n\n${contentWithMidAd}`;

    if (env.INSERT_AD == 'true') dailySummaryMarkdownContent += insertAd() + `\n`;
    if (env.INSERT_FOOT == 'true') dailySummaryMarkdownContent += insertFoot() + `\n\n`;

    return dailySummaryMarkdownContent;
}

function buildDailyRepairPrompt(basePromptInput, invalidMarkdown, validationIssues, dateStr) {
    return [
        "??????????????????????????????????????",
        `?????????? ${dateStr}?`,
        "????????????",
        ...(validationIssues || []).map((issue) => `- ${issue}`),
        "",
        "??????????",
        "- ???? `## **??AI??**` ??? Markdown ?????????????AI????????????",
        "- ?????????`### **?? ?????**` / `### **?? 3 ????**` / `## **?? ?? TOP` / `## **?? ????` / `## **?? AI??` / `## **? ????**`",
        "- FAQ ????? 1 ?????????? https://aivora.cn ???",
        "- ????????AI??????? TOP ????????????????????",
        "- AI??????????????? 1 ????? Markdown ??????????????AI??????????????",
        "- ????? 2 ?????????????????????????????",
        "- ???????????????????????????????????????????????????????",
        "- ???????????????????",
        "",
        "????????",
        basePromptInput,
        "",
        "????????????????????",
        invalidMarkdown || "(?)",
    ].join('\n');
}

function extractPromptFallbackCandidates(selectedContentItems, existingMarkdown) {
    const usedUrls = new Set(
        [...String(existingMarkdown || '').matchAll(/https?:\/\/[^\s)]+/g)]
            .map((match) => normalizeReplayUrl(match[0]))
            .filter(Boolean)
    );
    const usedStories = [...String(existingMarkdown || '').matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)]
        .map((match) => ({
            title: match[1],
            url: normalizeReplayUrl(match[2]),
        }))
        .filter((story) => story.title || story.url);
    const candidates = [];

    for (const itemText of selectedContentItems || []) {
        const text = String(itemText || '');
        const urlMatch = text.match(/^(?:Url|URL):\s*(https?:\/\/\S+)/im);
        const url = urlMatch?.[1]?.trim();
        const urlKey = normalizeReplayUrl(url);
        if (urlKey && usedUrls.has(urlKey)) continue;
        if (!url || !urlKey) continue;

        const titleMatch =
            text.match(/^(?:News Title|Project Name|Papers Title|Title):\s*(.+)$/im) ||
            text.match(/^socialMedia Post by\s+(.+)$/im);
        let title = String(titleMatch?.[1] || '')
            .replace(/https?:\/\/\S+/gi, '')
            .replace(/^RT\s+[^:?]{1,40}[:?]\s*/i, '')
            .replace(/^[\s:?,??.!????\-??]+|[\s:?,??.!????\-??]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const summaryMatch = text.match(/^(?:Content Summary|Description|Abstract\/Content Summary|Content):\s*(.+)$/im);
        const summary = String(summaryMatch?.[1] || '')
            .replace(/https?:\/\/\S+/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!title && summary) title = summary.slice(0, 42);
        if (!title) continue;
        if (usedStories.some((story) => {
            if (story.url && urlKey && story.url === urlKey) return true;
            return isRepeatedDailyStory(story.title, title);
        })) continue;

        const mediaMatch = text.match(/Media References:\s*(.+)$/im);
        const searchText = `${title} ${summary}`.toLowerCase();
        const funTokens = [
            '?', '??', '??', '?', 'token', '??', '??', '??', '??', 'bug',
            '??', '??', '??', '??', '??', '??', 'psd', '??', '??',
            '??', 'dating', '??', '???', '??', '??', '???', '??',
        ];
        const score = funTokens.reduce((total, token) => total + (searchText.includes(token.toLowerCase()) ? 1 : 0), 0)
            + (mediaMatch ? 2 : 0);

        candidates.push({
            title,
            summary,
            url,
            media: mediaMatch?.[1]?.trim() || '',
            score,
        });
    }

    return candidates.sort((left, right) => right.score - left.score);
}

function cleanMarkdownLinkTitle(title) {
    return String(title || '')
        .replace(/[\[\]\(\)\n\r]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80) || '?? AI ????';
}

function truncateDailyFunSubject(text, limit = 34) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function buildDailyFunStory(selectedContentItems, existingMarkdown) {
    const [candidate] = extractPromptFallbackCandidates(selectedContentItems, existingMarkdown);
    if (!candidate) return '';

    const title = cleanMarkdownLinkTitle(candidate.title);
    const subject = truncateDailyFunSubject(candidate.title);
    const searchText = `${candidate.title} ${candidate.summary}`.toLowerCase();
    let body;

    if (/token|??|??|??|??/.test(searchText)) {
        body = `?????????????? AI ?????????????${subject}????????????????? token ??????????????????`;
    } else if (/?|??|?|??/.test(searchText)) {
        body = `????????????${subject}??????????????????????????????????AI ??????????????????????`;
    } else if (/?|??|psd|??|??|??|??|??|ppt/.test(searchText)) {
        body = `????????????????????? ${subject} ??????????????? AI ?????????????????????????????`;
    } else if (/dating|??|???|??|???|??|??/.test(searchText)) {
        body = `???????????????????????????????${subject}?AI ?????????????????????????????`;
    } else {
        body = `?????????????????? AI ???????????${subject}???????????????????????????? AI ????????`;
    }

    const media = candidate.media ? `\n\n${candidate.media}` : '';
    return `### [${title}](${candidate.url})\n${body}${media}`;
}

function isInvalidDailyFunSection(sectionMarkdown) {
    const body = String(sectionMarkdown || '').replace(/^##[^\n]*/m, '').trim();
    if (!body) return true;
    if (/???|????|AI???|????/.test(body)) return true;
    return !/^###\s+\[[^\]]+\]\(https?:\/\/[^\s)]+\)/m.test(body);
}

export function ensureDailyFunSection(markdown, selectedContentItems) {
    let content = String(markdown || '');
    const existingSection = findMarkdownHeadingSection(content, /^##\s*\*\*.*AI.*??.*\*\*/im);
    if (existingSection) {
        if (!isInvalidDailyFunSection(existingSection.section)) return content;
        content = `${content.slice(0, existingSection.start)}${content.slice(existingSection.end)}`.replace(/\n{3,}/g, '\n\n').trim();
    }

    const funStory = buildDailyFunStory(selectedContentItems, content);
    if (!funStory) return content;
    const section = `## **?? AI??**\n\n${funStory}`;
    const tailMatch = content.match(/\n##\s+\*\*(?:[^*\n]*AI????|?\s*????)/m);
    if (!tailMatch || tailMatch.index == null) {
        return `${content}\n\n${section}`.replace(/\n{3,}/g, '\n\n').trim();
    }

    const before = content.slice(0, tailMatch.index).trimEnd();
    const after = content.slice(tailMatch.index).trimStart();
    return `${before}\n\n${section}\n\n${after}`.replace(/\n{3,}/g, '\n\n').trim();
}

function extractMatchTokens(item) {
    const text = [
        item?.title || '',
        item?.description || '',
        item?.source || '',
        item?.plainText || '',
    ].join(' ');
    const tokens = new Set();

    for (const match of text.match(/[A-Za-z][A-Za-z0-9.+_-]{2,}/g) || []) {
        tokens.add(match.toLowerCase());
    }

    const curated = [
        'openai', 'karpathy', 'metanovas', 'workbuddy', 'agenthub',
        'autoclaw', 'openclaw', 'kimi', 'skillhub', 'songgeneration',
        'jeff', 'dean', 'yann', 'lecun', 'tencent', 'zhipu', 'netease',
    ];

    const lowerText = text.toLowerCase();
    for (const token of curated) {
        if (lowerText.includes(token)) {
            tokens.add(token);
        }
    }

    return [...tokens];
}

function scoreMediaCandidate(output, candidate) {
    const lowerOutput = String(output || '').toLowerCase();
    let score = 0;

    if (candidate.url && lowerOutput.includes(String(candidate.url).toLowerCase())) score += 20;
    if (candidate.title && lowerOutput.includes(String(candidate.title).toLowerCase())) score += 12;

    for (const token of candidate.matchTokens || []) {
        if (token && lowerOutput.includes(token)) {
            score += token.length >= 6 ? 4 : 2;
        }
    }

    if (/(aibase|ai base|openai|karpathy|metanovas|workbuddy|autoclaw|openclaw|skillhub|kimi|tencent|zhipu|netease)/i.test(candidate.searchText || '')) {
        score += 3;
    }

    if (/t\.me|okjike\.com/i.test(candidate.url || '')) {
        score -= 2;
    } else {
        score += 1;
    }

    return score;
}

function appendFallbackMediaSection(markdown, mediaCandidates, limit = 4, minimumMedia = 3) {
    const existingMediaCount = countRenderedMedia(markdown);
    if (existingMediaCount >= minimumMedia) return markdown;

    const ranked = [...(mediaCandidates || [])]
        .map((candidate) => ({ candidate, score: scoreMediaCandidate(markdown, candidate) }))
        .filter(({ candidate }) => Array.isArray(candidate.placeholders) && candidate.placeholders.length > 0)
        .sort((a, b) => b.score - a.score);

    const placeholders = [];
    const seen = new Set();
    const existingMarkdown = String(markdown || '');
    const targetAdditionalMedia = Math.min(limit, Math.max(0, minimumMedia - existingMediaCount));

    for (const { candidate } of ranked) {
        for (const placeholder of candidate.placeholders) {
            if (!seen.has(placeholder) && !existingMarkdown.includes(placeholder)) {
                seen.add(placeholder);
                placeholders.push(placeholder);
                break;
            }
        }
        if (placeholders.length >= targetAdditionalMedia) break;
    }

    if (placeholders.length === 0) return markdown;

    const rendered = placeholders.join('\n\n');

    return `${markdown}\n\n### **????**\n\n${rendered}`;
}

function normalizeDailyLinkTitle(title) {
    return String(title || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[`~!@#$%^&*()_+=[\]{};:'",.<>/?\\|????????????????????-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isRepeatedDailyStory(leftTitle, rightTitle) {
    const left = normalizeDailyLinkTitle(leftTitle);
    const right = normalizeDailyLinkTitle(rightTitle);

    if (!left || !right) return false;
    if (left === right) return true;

    if (left.length >= 10 && right.length >= 10) {
        return left.includes(right) || right.includes(left);
    }

    return false;
}

function findMarkdownHeadingSection(content, headingPattern) {
    const text = String(content || '');
    const headingMatch = text.match(headingPattern);
    if (!headingMatch || headingMatch.index == null) return null;

    const start = headingMatch.index;
    const afterHeading = start + headingMatch[0].length;
    const nextSectionMatch = text.slice(afterHeading).match(/\n##\s+/);
    const end = nextSectionMatch ? afterHeading + nextSectionMatch.index : text.length;

    return {
        start,
        end,
        section: text.slice(start, end),
    };
}

function splitDailySectionChunks(body) {
    const normalized = String(body || '').trim();
    if (!normalized) return [];

    const chunks = [];
    for (const block of normalized.split(/\n{2,}/g)) {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) continue;

        const pieces = trimmedBlock
            .split(/\n(?=(?:###\s+|- \s*(?:\*\*|\[[^\]]+\])|\*\*\[[^\]]+\]\*\*))/g)
            .map((item) => item.trim())
            .filter(Boolean);
        chunks.push(...pieces);
    }

    return chunks;
}

function sanitizeDuplicateDailySections(markdown) {
    const content = String(markdown || '');
    if (!content) return content;

    const topMatch = findMarkdownHeadingSection(content, /^##\s*\*\*.*TOP.*\*\*/im);
    if (!topMatch) return content;

    const topLinks = [...topMatch.section.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)].map((match) => ({
        title: match[1],
        url: normalizeReplayUrl(match[2]),
    }));

    const seenStories = [...topLinks];
    const sectionHeadingPatterns = [
        /^##\s*\*\*.*????.*\*\*/im,
        /^##\s*\*\*.*AI.*??.*\*\*/im,
    ];

    let sanitized = content;

    for (const pattern of sectionHeadingPatterns) {
        const sectionMatch = findMarkdownHeadingSection(sanitized, pattern);
        if (!sectionMatch) continue;

        const section = sectionMatch.section;
        const headingMatch = section.match(/^##[^\n]*/);
        if (!headingMatch) continue;

        const heading = headingMatch[0];
        const body = section.slice(heading.length).trim();
        if (!body) continue;

        const chunks = splitDailySectionChunks(body);
        const keptChunks = [];

        for (const chunk of chunks) {
            const links = [...chunk.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)];
            if (links.length === 0) {
                keptChunks.push(chunk);
                continue;
            }

            const duplicated = links.some((linkMatch) => {
                const title = linkMatch[1];
                const url = normalizeReplayUrl(linkMatch[2]);
                return seenStories.some((story) => {
                    if (story.url && url && story.url === url) return true;
                    return isRepeatedDailyStory(story.title, title);
                });
            });

            if (duplicated) continue;

            for (const linkMatch of links) {
                seenStories.push({
                    title: linkMatch[1],
                    url: normalizeReplayUrl(linkMatch[2]),
                });
            }
            keptChunks.push(chunk);
        }

        const replacement = keptChunks.length === 0 ? '' : `${heading}\n\n${keptChunks.join('\n\n')}`;

        sanitized = `${sanitized.slice(0, sectionMatch.start)}${replacement}${sanitized.slice(sectionMatch.end)}`;
    }

    return sanitized.replace(/\n{3,}/g, '\n\n').trim();
}

function sanitizeAndEnsureDailyFunSection(markdown, selectedContentItems) {
    let content = sanitizeDuplicateDailySections(markdown);
    const ensured = ensureDailyFunSection(content, selectedContentItems);
    content = ensured;

    const cleanedAfterFun = sanitizeDuplicateDailySections(content);
    if (cleanedAfterFun !== content) {
        content = ensureDailyFunSection(cleanedAfterFun, selectedContentItems);
    }

    return content;
}

function removeTopSectionOverflow(markdown) {
    const content = String(markdown || '');
    const topMatch = findMarkdownHeadingSection(content, /^##\s*\*\*.*TOP.*\*\*/im);
    if (!topMatch) return content;

    const topSection = topMatch.section;
    const numberedItems = [...topSection.matchAll(/^###\s+\d+\.\s+/gm)];
    if (numberedItems.length === 0) return content;

    const lastItemStart = numberedItems[numberedItems.length - 1].index || 0;
    const lastItemText = topSection.slice(lastItemStart);
    const overflowMatch = lastItemText.match(/\n---[ \t\r]*\n+(?=(?:\*\*\[[^\]]+\]\*\*|###\s+(?!\d+\.)))/m);
    if (!overflowMatch || overflowMatch.index == null) return content;

    const keepTopSection = topSection.slice(0, lastItemStart + overflowMatch.index).trimEnd();
    const beforeTop = content.slice(0, topMatch.start);
    const afterTop = content.slice(topMatch.end);

    return `${beforeTop}${keepTopSection}${afterTop}`.replace(/\n{3,}/g, '\n\n').trim();
}

function removeSecondaryDailySections(markdown) {
    let content = String(markdown || '');
    for (const pattern of [/^##\s*\*\*.*????.*\*\*/im, /^##\s*\*\*.*AI.*??.*\*\*/im]) {
        const sectionMatch = findMarkdownHeadingSection(content, pattern);
        if (!sectionMatch) continue;
        content = `${content.slice(0, sectionMatch.start)}${content.slice(sectionMatch.end)}`;
    }

    return content.replace(/\n{3,}/g, '\n\n').trim();
}

export async function handleScheduledCombined(event, env, ctx, specifiedDate = null) {
    // ???????????????????????????????????
    const dateStr = specifiedDate || getISODate();
    setFetchDate(dateStr);
    console.log(`[Scheduled] Starting daily automation for ${dateStr}${specifiedDate ? ' (specified date)' : ''}`);
    const debugInfo = {
        date: dateStr,
        itemsWithMedia: 0,
        itemsWithoutMedia: 0,
        mediaCandidates: 0,
        previousDayReplayDate: null,
        previousDayTopItems: 0,
        previousDayFilteredNews: 0,
        previousDayBackfillNews: 0,
        outputHasMediaBeforeFallback: false,
        outputHasMediaAfterFallback: false,
        fallbackInserted: false,
        labelsVersion: 'headings-v2',
        opportunityGenerated: false,
        opportunityPublicPath: null,
        opportunityCandidateCount: 0,
        opportunityTopScore: 0,
    };

    try {
        // 1. Fetch Data
        console.log(`[Scheduled] Fetching data...`);
        // ??????????????? localStorage ??? Cookie?????????????????FOLO_COOKIE??
        // ??????????????KV(FOLO_COOKIE_KV_KEY) ?????
        let foloCookie = env.FOLO_COOKIE;
        if (!foloCookie && env.FOLO_COOKIE_KV_KEY) {
            try {
                foloCookie = await getFromKV(env.DATA_KV, env.FOLO_COOKIE_KV_KEY);
                if (foloCookie) console.log(`[Scheduled] Loaded Folo cookie from KV (${env.FOLO_COOKIE_KV_KEY}).`);
            } catch (err) {
                console.warn(`[Scheduled] Failed to load Folo cookie from KV: ${err.message}`);
            }
        }

        const allUnifiedData = await fetchAllData(env, foloCookie);
        const { previousDate, items: previousTopItems } = await loadPreviousTopItems(env, dateStr);
        debugInfo.previousDayReplayDate = previousDate;
        debugInfo.previousDayTopItems = previousTopItems.length;

        if (Array.isArray(allUnifiedData.news) && allUnifiedData.news.length > 0 && previousTopItems.length > 0) {
            const originalNewsItems = [...allUnifiedData.news];
            const { filteredNewsItems, filteredCount } = filterNewsAgainstPreviousTop(allUnifiedData.news, previousTopItems);
            const replayBackfillMinimum = getPositiveInteger(env.DAILY_REPLAY_BACKFILL_MIN_ITEMS, 12);
            const { newsItems, backfillCount } = mergeReplayBackfillNewsItems(
                filteredNewsItems,
                originalNewsItems,
                replayBackfillMinimum
            );
            allUnifiedData.news = newsItems;
            debugInfo.previousDayFilteredNews = filteredCount;
            debugInfo.previousDayBackfillNews = backfillCount;
            console.log(`[Scheduled] Filtered ${filteredCount} repeated news items from previous daily ${previousDate}; backfilled ${backfillCount} items for prompt coverage.`);
        }

        const fetchPromises = [];
        for (const sourceType in dataSources) {
            if (Object.hasOwnProperty.call(dataSources, sourceType)) {
                fetchPromises.push(storeInKV(env.DATA_KV, `${dateStr}-${sourceType}`, allUnifiedData[sourceType] || []));
            }
        }
        await Promise.all(fetchPromises);
        console.log(`[Scheduled] Data fetched and stored.`);

        // 2. Prepare Content Items
        const {
            selectedContentItems,
            mediaCandidates,
            itemsWithMedia,
            itemsWithoutMedia,
            selectedCounts,
        } = buildDailyPromptSelection(allUnifiedData, env);

        if (itemsWithMedia > 0) {
            console.log(`[Scheduled] Found ${itemsWithMedia} items with images/videos, ${itemsWithoutMedia} items without.`);
        }
        console.log(`[Scheduled] Prompt source mix: ${JSON.stringify(selectedCounts)}`);
        debugInfo.itemsWithMedia = itemsWithMedia;
        debugInfo.itemsWithoutMedia = itemsWithoutMedia;
        debugInfo.mediaCandidates = mediaCandidates.length;
        debugInfo.promptSourceMix = selectedCounts;

        if (selectedContentItems.length === 0) {
            console.log(`[Scheduled] No items found. Skipping generation.`);
            return;
        }

        // 3. Generate Content (Call 2)
        console.log(`[Scheduled] Generating content...`);
        let fullPromptForCall2_System = getSystemPromptSummarizationStepOne(dateStr);
        let fullPromptForCall2_User = '\n\n------\n\n'+selectedContentItems.join('\n\n------\n\n')+'\n\n------\n\n';
        
        let outputOfCall2 = await generateContentWithTransportFallback(env, fullPromptForCall2_User, fullPromptForCall2_System);
        outputOfCall2 = removeMarkdownCodeBlock(outputOfCall2);
        outputOfCall2 = convertPlaceholdersToMarkdownImages(outputOfCall2);
        debugInfo.outputHasMediaBeforeFallback = containsRenderedMedia(outputOfCall2);
        const outputBeforeFallback = outputOfCall2;
        outputOfCall2 = appendFallbackMediaSection(outputOfCall2, mediaCandidates);
        debugInfo.fallbackInserted = outputBeforeFallback !== outputOfCall2;
        debugInfo.outputHasMediaAfterFallback = containsRenderedMedia(outputOfCall2);
        // ??????????????
        outputOfCall2 = replaceIncorrectDomainLinks(outputOfCall2, env.BOOK_LINK ? new URL(env.BOOK_LINK).hostname : 'news.aivora.cn');

        // 4. Generate Summary (Call 3)
        console.log(`[Scheduled] Generating summary...`);
        let fullPromptForCall3_System = getSystemPromptSummarizationStepThree();
        let fullPromptForCall3_User = outputOfCall2;
        
        let outputOfCall3 = await generateContentWithTransportFallback(env, fullPromptForCall3_User, fullPromptForCall3_System);
        outputOfCall3 = removeMarkdownCodeBlock(outputOfCall3);

        // 5. Generate Opportunity Content
        const opportunityPaths = buildOpportunityPaths(dateStr);
        debugInfo.opportunityPublicPath = opportunityPaths.publicPath;
        const opportunityCandidates = buildOpportunityCandidates(allUnifiedData, opportunityPlaybook);
        const playbookText = serializeOpportunityPlaybook(opportunityPlaybook);
        const opportunityCandidatesText = formatOpportunityCandidatesForPrompt(
            opportunityCandidates,
            opportunityPlaybook,
        );
        debugInfo.opportunityCandidateCount = opportunityCandidates.length;
        debugInfo.opportunityTopScore = opportunityCandidates[0]?.score || 0;

        console.log(`[Scheduled] Generating AI opportunity content...`);
        const opportunityPromptInput = [
            `## ????\n\n${opportunityCandidatesText}`,
            `## ????\n\n${outputOfCall3}`,
        ].join('\n\n');

        let opportunityMarkdownContent = await generateContentWithTransportFallback(
            env,
            opportunityPromptInput,
            getSystemPromptAiOpportunity(dateStr, playbookText),
        );
        opportunityMarkdownContent = removeMarkdownCodeBlock(opportunityMarkdownContent);
        opportunityMarkdownContent = convertPlaceholdersToMarkdownImages(opportunityMarkdownContent);
        opportunityMarkdownContent = replaceIncorrectDomainLinks(
            opportunityMarkdownContent,
            env.BOOK_LINK ? new URL(env.BOOK_LINK).hostname : 'news.aivora.cn'
        );
        opportunityMarkdownContent = `## ? ????\n\n- [?? ????](#????) - ??????????\n- [?? ????](#????) - ???????????\n- [?? ????](#????) - ????????????\n- [??? ???](#???) - ?????????\n- [? ????](#????) - ???????????\n\n${opportunityMarkdownContent}`;
        debugInfo.opportunityGenerated = true;

        // 6. Assemble Markdown
        const contentWithMidAd = insertMidAd(outputOfCall2);
        let dailySummaryMarkdownContent = `## **????**\n\n\`\`\`\n${outputOfCall3}\n\`\`\`\n\n`;
        dailySummaryMarkdownContent += '\n\n## ? ????\n\n';
        dailySummaryMarkdownContent += '- [?? ?? AI ??](#??ai??) - ??????\n\n';
        dailySummaryMarkdownContent += `\n\n${contentWithMidAd}`;
        dailySummaryMarkdownContent = insertOpportunityLinkIntoDailyNavigation(
            dailySummaryMarkdownContent,
            opportunityPaths.publicPath,
        );
        
        if (env.INSERT_AD=='true') dailySummaryMarkdownContent += insertAd() +`\n`;
        if (env.INSERT_FOOT=='true') dailySummaryMarkdownContent += insertFoot() +`\n\n`;

        // 7. Commit to GitHub
        console.log(`[Scheduled] Committing to GitHub...`);
        const yearMonth = getYearMonth(dateStr);
        const dailyFilePath = `daily/${dateStr}.md`;
        const dailyPagePath = `content/cn/${yearMonth}/${dateStr}.md`;
        const monthDirectoryIndexPath = `content/cn/${yearMonth}/_index.md`;
        const homePath = 'content/cn/_index.md';

        const dailyPageTitle = `${env.DAILY_TITLE} ${formatDateToChinese(dateStr)}`;
        const dailyPageContent = buildDailyContentWithFrontMatter(dateStr, dailySummaryMarkdownContent, { title: dailyPageTitle });
        const opportunityTitleBase = env.DAILY_TITLE.includes('??')
            ? env.DAILY_TITLE.replace('??', '??')
            : `${env.DAILY_TITLE} ??`;
        const opportunityPageTitle = `${opportunityTitleBase} ${formatDateToChinese(dateStr)}`;
        const opportunityDescription = DEFAULT_OPPORTUNITY_PAGE_DESCRIPTION;
        const opportunityPageContent = buildDailyContentWithFrontMatter(dateStr, opportunityMarkdownContent, {
            title: opportunityPageTitle,
            description: opportunityDescription,
        });

        const existingDailySha = await getGitHubFileSha(env, dailyFilePath);
        const dailyCommitMessage = `${existingDailySha ? 'Update' : 'Create'} daily summary for ${dateStr} (Scheduled)`;
        await createOrUpdateGitHubFile(env, dailyFilePath, dailySummaryMarkdownContent, dailyCommitMessage, existingDailySha);

        const existingDailyPageSha = await getGitHubFileSha(env, dailyPagePath);
        const dailyPageCommitMessage = `${existingDailyPageSha ? 'Update' : 'Create'} daily page for ${dateStr} (Scheduled)`;
        await createOrUpdateGitHubFile(env, dailyPagePath, dailyPageContent, dailyPageCommitMessage, existingDailyPageSha);

        // Create or update month directory _index.md
        const monthDirectoryIndexContent = buildMonthDirectoryIndex(yearMonth, { sidebarOpen: true });
        const existingMonthIndexSha = await getGitHubFileSha(env, monthDirectoryIndexPath);
        const monthIndexCommitMessage = `${existingMonthIndexSha ? 'Update' : 'Create'} month directory index for ${yearMonth} (Scheduled)`;
        await createOrUpdateGitHubFile(env, monthDirectoryIndexPath, monthDirectoryIndexContent, monthIndexCommitMessage, existingMonthIndexSha);

        const existingOpportunityPageSha = await getGitHubFileSha(env, opportunityPaths.pagePath);
        const opportunityPageCommitMessage = `${existingOpportunityPageSha ? 'Update' : 'Create'} AI opportunity page for ${dateStr} (Scheduled)`;
        await createOrUpdateGitHubFile(env, opportunityPaths.pagePath, opportunityPageContent, opportunityPageCommitMessage, existingOpportunityPageSha);

        const existingOpportunityMonthIndexSha = await getGitHubFileSha(env, opportunityPaths.monthDirectoryIndexPath);
        if (!existingOpportunityMonthIndexSha) {
            const opportunityMonthIndexContent = buildMonthDirectoryIndex(opportunityPaths.yearMonth, { sidebarOpen: true });
            const opportunityMonthIndexCommitMessage = `Create AI opportunity month directory index for ${opportunityPaths.yearMonth} (Scheduled)`;
            await createOrUpdateGitHubFile(
                env,
                opportunityPaths.monthDirectoryIndexPath,
                opportunityMonthIndexContent,
                opportunityMonthIndexCommitMessage,
                null
            );
        }

        let existingOpportunityHomeContent = '';
        try {
            existingOpportunityHomeContent = await getGitHubFileContent(env, opportunityPaths.homePath);
        } catch (error) {
            console.warn(`[Scheduled] Opportunity home page not found, will create a new one.`);
        }
        const opportunityHomeContent = updateSectionHomeIndexContent(
            existingOpportunityHomeContent,
            opportunityMarkdownContent,
            dateStr,
            {
                title: opportunityPageTitle,
                description: DEFAULT_OPPORTUNITY_SECTION_DESCRIPTION,
                sectionPrefix: '/opportunity',
            }
        );
        const existingOpportunityHomeSha = await getGitHubFileSha(env, opportunityPaths.homePath);
        const opportunityHomeCommitMessage = `${existingOpportunityHomeSha ? 'Update' : 'Create'} AI opportunity home page for ${dateStr} (Scheduled)`;
        await createOrUpdateGitHubFile(
            env,
            opportunityPaths.homePath,
            opportunityHomeContent,
            opportunityHomeCommitMessage,
            existingOpportunityHomeSha
        );

        let existingHomeContent = '';
        try {
            existingHomeContent = await getGitHubFileContent(env, homePath);
        } catch (error) {
            console.warn(`[Scheduled] Home page not found, will create a new one.`);
        }
        const homeTitle = dailyPageTitle;
        const homeContent = updateHomeIndexContent(existingHomeContent, dailySummaryMarkdownContent, dateStr, { title: homeTitle });
        const existingHomeSha = await getGitHubFileSha(env, homePath);
        const homeCommitMessage = `${existingHomeSha ? 'Update' : 'Create'} home page for ${dateStr} (Scheduled)`;
        await createOrUpdateGitHubFile(env, homePath, homeContent, homeCommitMessage, existingHomeSha);

        console.log(`[Scheduled] Success!`);
        return debugInfo;

    } catch (error) {
        console.error(`[Scheduled] Error:`, error);
        throw error;
    }
}

function buildBaseDebugInfo(dateStr, mode) {
    return {
        mode,
        date: dateStr,
        itemsWithMedia: 0,
        itemsWithoutMedia: 0,
        mediaCandidates: 0,
        previousDayReplayDate: null,
        previousDayTopItems: 0,
        previousDayFilteredNews: 0,
        previousDayBackfillNews: 0,
        outputHasMediaBeforeFallback: false,
        outputHasMediaAfterFallback: false,
        fallbackInserted: false,
        labelsVersion: 'headings-v2',
        dailyGenerated: false,
        dailyPublished: false,
        dailyValidationPassed: false,
        dailyValidationIssues: [],
        opportunityGenerated: false,
        opportunityPublished: false,
        opportunityValidationPassed: false,
        opportunityValidationIssues: [],
        opportunityPublicPath: null,
        opportunityCandidateCount: 0,
        opportunityTopScore: 0,
        accountOpportunityGenerated: false,
        accountOpportunityPublished: false,
        accountOpportunityValidationPassed: false,
        accountOpportunityValidationIssues: [],
        accountOpportunityPublicPath: null,
        accountOpportunityCandidateCount: 0,
        accountOpportunityTopScore: 0,
    };
}

async function loadFoloCookie(env) {
    let foloCookie = env.FOLO_COOKIE;
    if (!foloCookie && env.FOLO_COOKIE_KV_KEY) {
        try {
            foloCookie = await getFromKV(env.DATA_KV, env.FOLO_COOKIE_KV_KEY);
            if (foloCookie) {
                console.log(`[Scheduled] Loaded Folo cookie from KV (${env.FOLO_COOKIE_KV_KEY}).`);
            }
        } catch (error) {
            console.warn(`[Scheduled] Failed to load Folo cookie from KV: ${error.message}`);
        }
    }

    return foloCookie;
}

async function loadCachedUnifiedData(env, dateStr) {
    const allUnifiedData = {};
    let hasAnyCachedItems = false;

    for (const sourceType in dataSources) {
        if (!Object.hasOwnProperty.call(dataSources, sourceType)) continue;

        try {
            const cachedItems = await getFromKV(env.DATA_KV, `${dateStr}-${sourceType}`);
            if (Array.isArray(cachedItems)) {
                allUnifiedData[sourceType] = cachedItems;
                if (cachedItems.length > 0) {
                    hasAnyCachedItems = true;
                }
            } else {
                allUnifiedData[sourceType] = [];
            }
        } catch (error) {
            console.warn(`[Scheduled] Failed to load cached ${sourceType} data for ${dateStr}: ${error.message}`);
            allUnifiedData[sourceType] = [];
        }
    }

    return hasAnyCachedItems ? allUnifiedData : null;
}

function countUnifiedDataItems(allUnifiedData) {
    return Object.values(allUnifiedData || {}).reduce((total, items) => {
        return total + (Array.isArray(items) ? items.length : 0);
    }, 0);
}

function buildPromptCollections(allUnifiedData, debugInfo) {
    const selectedContentItems = [];
    const itemsWithMedia = [];
    const itemsWithoutMedia = [];
    const mediaCandidates = [];

    for (const sourceType in allUnifiedData) {
        const items = allUnifiedData[sourceType];
        if (!items || items.length === 0) continue;

        for (const item of items) {
            const itemHasMedia = item.details?.content_html && hasMedia(item.details.content_html);
            const mediaPlaceholders = extractMediaPlaceholdersFromHtml(item.details?.content_html);
            const plainTextContent = truncatePromptText(stripHtml(item.details?.content_html));
            let itemText = "";

            switch (item.type) {
                case 'news':
                    itemText = `News Title: ${item.title}\nPublished: ${item.published_date}\nUrl: ${item.url}\nContent Summary: ${plainTextContent}`;
                    break;
                case 'project':
                    itemText = `Project Name: ${item.title}\nPublished: ${item.published_date}\nUrl: ${item.url}\nDescription: ${truncatePromptText(item.description)}\nStars: ${item.details.totalStars}`;
                    break;
                case 'paper':
                    itemText = `Papers Title: ${item.title}\nPublished: ${item.published_date}\nUrl: ${item.url}\nAbstract/Content Summary: ${plainTextContent}`;
                    break;
                case 'socialMedia':
                    itemText = `socialMedia Post by ${item.authors}??ublished: ${item.published_date}\nUrl: ${item.url}\nContent: ${truncatePromptText(stripHtml(item.details.content_html))}`;
                    break;
                default:
                    itemText = `Type: ${item.type}\nTitle: ${item.title || 'N/A'}\nDescription: ${truncatePromptText(item.description || 'N/A')}\nURL: ${item.url || 'N/A'}`;
                    if (item.published_date) itemText += `\nPublished: ${item.published_date}`;
                    if (item.source) itemText += `\nSource: ${item.source}`;
                    if (item.details?.content_html) itemText += `\nContent: ${plainTextContent}`;
                    break;
            }

            if (mediaPlaceholders.length > 0) {
                itemText += `\nMedia References: ${mediaPlaceholders.join(' ')}`;
            }

            if (!itemText) continue;

            if (itemHasMedia) {
                itemsWithMedia.push(itemText);
                mediaCandidates.push({
                    title: item.title,
                    description: item.description,
                    source: item.source,
                    url: item.url,
                    plainText: plainTextContent,
                    placeholders: mediaPlaceholders,
                    searchText: [item.title, item.description, item.source, plainTextContent].filter(Boolean).join(' '),
                    matchTokens: extractMatchTokens({
                        title: item.title,
                        description: item.description,
                        source: item.source,
                        plainText: plainTextContent,
                    }),
                });
            } else {
                itemsWithoutMedia.push(itemText);
            }
        }
    }

    const promptItems = [...itemsWithMedia, ...itemsWithoutMedia].slice(0, 16);
    selectedContentItems.push(...promptItems);

    debugInfo.itemsWithMedia = itemsWithMedia.length;
    debugInfo.itemsWithoutMedia = itemsWithoutMedia.length;
    debugInfo.mediaCandidates = mediaCandidates.length;

    return { selectedContentItems, mediaCandidates };
}

async function loadScheduledContext(env, dateStr, debugInfo, options = {}) {
    console.log(`[Scheduled] Fetching data for ${dateStr}...`);
    let allUnifiedData = null;

    if (options.preferCachedData) {
        const cachedUnifiedData = await loadCachedUnifiedData(env, dateStr);
        if (cachedUnifiedData) {
            const cachedItemCount = countUnifiedDataItems(cachedUnifiedData);
            const minimumCachedItems = getPositiveInteger(env.DAILY_CACHED_SOURCE_MIN_ITEMS || env.DAILY_PROMPT_MIN_ITEMS, 12);
            debugInfo.cachedDailySourceItemCount = cachedItemCount;
            debugInfo.cachedDailySourceMinimum = minimumCachedItems;
            if (cachedItemCount >= minimumCachedItems) {
                allUnifiedData = cachedUnifiedData;
            } else {
                debugInfo.cachedDailySourceTooThin = true;
                console.warn(`[Scheduled] Cached source data for ${dateStr} only has ${cachedItemCount} items; refreshing.`);
            }
        }

        if (allUnifiedData) {
            debugInfo.usedCachedDailySourceData = true;
            console.log(`[Scheduled] Reusing cached source data for ${dateStr}.`);
        }
    }

    if (!allUnifiedData) {
        const foloCookie = await loadFoloCookie(env);
        allUnifiedData = await fetchAllData(env, foloCookie);
        debugInfo.usedCachedDailySourceData = false;
    }

    const { previousDate, items: previousTopItems } = await loadPreviousTopItems(env, dateStr);
    const {
        previousDate: previousOpportunityDate,
        signals: previousOpportunityReplaySignals,
    } = await loadPreviousOpportunityMainTopicSignals(env, dateStr);

    debugInfo.previousDayReplayDate = previousDate;
    debugInfo.previousDayTopItems = previousTopItems.length;
    debugInfo.previousOpportunityReplayDate = previousOpportunityDate;
    debugInfo.previousOpportunityReplayRules =
        previousOpportunityReplaySignals.matchedRuleIds?.length || 0;

    if (Array.isArray(allUnifiedData.news) && allUnifiedData.news.length > 0 && previousTopItems.length > 0) {
        const originalNewsItems = [...allUnifiedData.news];
        const { filteredNewsItems, filteredCount } = filterNewsAgainstPreviousTop(allUnifiedData.news, previousTopItems);
        const replayBackfillMinimum = getPositiveInteger(env.DAILY_REPLAY_BACKFILL_MIN_ITEMS, 12);
        const { newsItems, backfillCount } = mergeReplayBackfillNewsItems(
            filteredNewsItems,
            originalNewsItems,
            replayBackfillMinimum
        );
        allUnifiedData.news = newsItems;
        debugInfo.previousDayFilteredNews = filteredCount;
        debugInfo.previousDayBackfillNews = backfillCount;
        console.log(`[Scheduled] Filtered ${filteredCount} repeated news items from previous daily ${previousDate}; backfilled ${backfillCount} items for prompt coverage.`);
    }

    if (!options.preferCachedData || !debugInfo.usedCachedDailySourceData) {
        const fetchPromises = [];
        for (const sourceType in dataSources) {
            if (Object.hasOwnProperty.call(dataSources, sourceType)) {
                fetchPromises.push(storeInKV(env.DATA_KV, `${dateStr}-${sourceType}`, allUnifiedData[sourceType] || []));
            }
        }
        await Promise.all(fetchPromises);
    }

    return {
        allUnifiedData,
        previousOpportunityReplaySignals,
        ...buildDailyPromptSelection(allUnifiedData, env),
    };
}

export async function handleScheduledDailyPrefetch(event, env, ctx, specifiedDate = null) {
    const dateStr = specifiedDate || getISODate();
    setFetchDate(dateStr);
    const debugInfo = buildBaseDebugInfo(dateStr, 'daily-prefetch');
    console.log(`[Scheduled][DailyPrefetch] Starting source prefetch for ${dateStr}${specifiedDate ? ' (specified date)' : ''}`);

    const foloCookie = await loadFoloCookie(env);
    const allUnifiedData = await fetchAllData(env, foloCookie);
    const storePromises = [];
    const storedCounts = {};

    for (const sourceType in dataSources) {
        if (!Object.hasOwnProperty.call(dataSources, sourceType)) continue;
        const items = allUnifiedData[sourceType] || [];
        storedCounts[sourceType] = Array.isArray(items) ? items.length : 0;
        storePromises.push(storeInKV(env.DATA_KV, `${dateStr}-${sourceType}`, items));
    }

    await Promise.all(storePromises);
    debugInfo.prefetchStoredCounts = storedCounts;
    debugInfo.prefetchStoredItemCount = countUnifiedDataItems(allUnifiedData);
    debugInfo.usedCachedDailySourceData = false;
    return debugInfo;
}

async function generateDailyMarkdown(env, dateStr, selectedContentItems, mediaCandidates, debugInfo, options = {}) {
    if (selectedContentItems.length === 0) {
        throw new Error('No content items found for daily generation.');
    }

    console.log(`[Scheduled][Daily] Generating content...`);
    const outputOfCall2System = getSystemPromptSummarizationStepOne(dateStr);
    const outputOfCall2User = '\n\n------\n\n' + selectedContentItems.join('\n\n------\n\n') + '\n\n------\n\n';

    let outputOfCall2 = await generateContentWithTransportFallback(env, outputOfCall2User, outputOfCall2System);
    outputOfCall2 = removeMarkdownCodeBlock(outputOfCall2);
    outputOfCall2 = convertPlaceholdersToMarkdownImages(outputOfCall2);
    debugInfo.outputHasMediaBeforeFallback = containsRenderedMedia(outputOfCall2);
    const outputBeforeFallback = outputOfCall2;
    outputOfCall2 = appendFallbackMediaSection(outputOfCall2, mediaCandidates);
    debugInfo.fallbackInserted = outputBeforeFallback !== outputOfCall2;
    debugInfo.outputHasMediaAfterFallback = containsRenderedMedia(outputOfCall2);
    outputOfCall2 = replaceIncorrectDomainLinks(outputOfCall2, env.BOOK_LINK ? new URL(env.BOOK_LINK).hostname : 'news.aivora.cn');

    console.log(`[Scheduled][Daily] Generating summary...`);
    let outputOfCall3 = await generateContentWithTransportFallback(env, outputOfCall2, getSystemPromptSummarizationStepThree());
    outputOfCall3 = removeMarkdownCodeBlock(outputOfCall3);

    let dailySummaryMarkdownContent = assembleDailySummaryMarkdown(outputOfCall2, outputOfCall3, env);
    const dailySummaryMarkdownContentBeforeFun = dailySummaryMarkdownContent;
    const funEnsuredDailySummaryMarkdownContent = sanitizeAndEnsureDailyFunSection(
        dailySummaryMarkdownContent,
        selectedContentItems
    );
    debugInfo.dailyFunSectionInserted = funEnsuredDailySummaryMarkdownContent !== dailySummaryMarkdownContent;
    dailySummaryMarkdownContent = funEnsuredDailySummaryMarkdownContent;
    debugInfo.dailyDuplicateSectionSanitized = dailySummaryMarkdownContent !== dailySummaryMarkdownContentBeforeFun;
    dailySummaryMarkdownContent = removeTopSectionOverflow(dailySummaryMarkdownContent);
    let validation = validateDailyPublication({
        summaryText: outputOfCall3,
        pageMarkdown: dailySummaryMarkdownContent,
        minimumTopItems: options.minimumTopItems || 0,
    });

    if (!validation.ok) {
        console.warn(
            `[Scheduled][Daily] First draft failed validation, retrying repair pass: ${validation.issues.join(' | ')}`
        );
        let repairedOutputOfCall2 = await generateContentWithTransportFallback(
            env,
            buildDailyRepairPrompt(outputOfCall2User, outputOfCall2, validation.issues, dateStr),
            outputOfCall2System
        );
        repairedOutputOfCall2 = removeMarkdownCodeBlock(repairedOutputOfCall2);
        repairedOutputOfCall2 = convertPlaceholdersToMarkdownImages(repairedOutputOfCall2);
        repairedOutputOfCall2 = appendFallbackMediaSection(repairedOutputOfCall2, mediaCandidates);
        repairedOutputOfCall2 = replaceIncorrectDomainLinks(
            repairedOutputOfCall2,
            env.BOOK_LINK ? new URL(env.BOOK_LINK).hostname : 'news.aivora.cn'
        );

        let repairedOutputOfCall3 = await generateContentWithTransportFallback(
            env,
            repairedOutputOfCall2,
            getSystemPromptSummarizationStepThree()
        );
        repairedOutputOfCall3 = removeMarkdownCodeBlock(repairedOutputOfCall3);

        let repairedDailySummaryMarkdownContent = assembleDailySummaryMarkdown(
            repairedOutputOfCall2,
            repairedOutputOfCall3,
            env
        );
        const repairedDailySummaryMarkdownContentBeforeFun = repairedDailySummaryMarkdownContent;
        const funEnsuredRepairedDailySummaryMarkdownContent = sanitizeAndEnsureDailyFunSection(
            repairedDailySummaryMarkdownContent,
            selectedContentItems
        );
        debugInfo.dailyRepairFunSectionInserted =
            funEnsuredRepairedDailySummaryMarkdownContent !== repairedDailySummaryMarkdownContent;
        repairedDailySummaryMarkdownContent = funEnsuredRepairedDailySummaryMarkdownContent;
        debugInfo.dailyRepairDuplicateSectionSanitized =
            repairedDailySummaryMarkdownContent !== repairedDailySummaryMarkdownContentBeforeFun;
        repairedDailySummaryMarkdownContent = removeTopSectionOverflow(repairedDailySummaryMarkdownContent);
        const repairedValidation = validateDailyPublication({
            summaryText: repairedOutputOfCall3,
            pageMarkdown: repairedDailySummaryMarkdownContent,
            minimumTopItems: options.minimumTopItems || 0,
        });

        outputOfCall2 = repairedOutputOfCall2;
        outputOfCall3 = repairedOutputOfCall3;
        dailySummaryMarkdownContent = repairedDailySummaryMarkdownContent;
        validation = repairedValidation;
        debugInfo.dailyRepairAttempted = true;
        debugInfo.dailyRepairPassed = repairedValidation.ok;
        debugInfo.dailyRepairIssues = repairedValidation.issues;
    }

    debugInfo.dailyGenerated = true;

    return { outputOfCall3, dailySummaryMarkdownContent, validation };
}

function buildOpportunitySourceDigest(candidates, maxCandidates = 3, maxItemsPerCandidate = 2) {
    const visibleCandidates = (candidates || []).slice(0, maxCandidates);
    if (visibleCandidates.length === 0) {
        return '??????????????????????';
    }

    return visibleCandidates.map((candidate) => {
        const supportingText = (candidate.supportingItems || [])
            .slice(0, maxItemsPerCandidate)
            .map((item, index) => `${index + 1}. ${item.title || item.source} - ${item.description || item.plainText || '?'}`)
            .join('\n');

        return [
            `### ${candidate.label}`,
            `- ????: ${candidate.preferredLaneName}`,
            `- ?????: ${candidate.productAngle || '????????????????'}`,
            `- ??????: ${candidate.buyerHint || '???????????????'}`,
            `- ????: ${candidate.deliveryHint || '??????????????'}`,
            `- ?????: ${candidate.channelHint || '??????????'}`,
            `- ????: ${candidate.titleHint || '?????????????'}`,
            `- ????: ${candidate.avoidLeadHint || '????????stars?????????'}`,
            `- ????: ${candidate.sellFormats.join('?') || '???????'}`,
            `- ????:\n${supportingText || '- ?'}`,
        ].join('\n');
    }).join('\n\n');
}

function buildOpportunityRepairPrompt(basePromptInput, invalidMarkdown, validationIssues) {
    return [
        "????????????????????????????????????",
        "????????????",
        ...(validationIssues || []).map((issue) => `- ${issue}`),
        "",
        "??????????",
        "- ??? Markdown ?????????????????",
        "- ?????????# ??AI?? / ## ???? / ## ???? / ## ???? / ## ???? / ## ??? / ## ????",
        "- ???????? 2-3 ???????????????????????????????????????????????????????",
        "- ???????? 1-2 ??????????????????????????????????????",
        "- ??????????????????????????????",
        "- ??????????????????????????????",
        "- ?????? token????????????",
        "- ?????????????????? GitHub stars?????SDK ??????",
        "- ??????????????????????????????? 1-2 ?",
        "- ???????????????????????????",
        "- ????????????????????????????",
        "- ???????????????????????????????????",
        "",
        "??????????",
        basePromptInput,
        "",
        "????????????????????",
        invalidMarkdown || "(?)",
    ].join('\n');
}

function buildAccountOpportunityRepairPrompt(basePromptInput, invalidMarkdown, validationIssues) {
    return [
        "????????????????????????????????????",
        "????????????",
        ...(validationIssues || []).map((issue) => `- ${issue}`),
        "",
        "??????????",
        "- ??? Markdown ?????????????????",
        "- ?????????# ??AI???? / ## ???? / ## ???? / ## ???? / ## ???? / ## ???? / ## ????",
        "- ???????? 2-3 ????????????????????????????????",
        "- ?????????????????????????????????",
        "- ????????????????????????????????",
        "- ?????????????????????????????????",
        "- ???????????????????????",
        "- ?????? token????????????",
        "- ????????????????????????",
        "- ???????????????????????????????",
        "- ??????????????????????????",
        "- ???????????????????????????????????????",
        "",
        "??????????",
        basePromptInput,
        "",
        "????????????????????",
        invalidMarkdown || "(?)",
    ].join('\n');
}

async function generateOpportunityMarkdown(
    env,
    dateStr,
    allUnifiedData,
    debugInfo,
    options = {}
) {
    const opportunityPaths = buildOpportunityPaths(dateStr);
    debugInfo.opportunityPublicPath = opportunityPaths.publicPath;

    const opportunityCandidates = buildOpportunityCandidates(
        allUnifiedData,
        opportunityPlaybook,
        {
            previousMainTopicSignals: options.previousMainTopicSignals || null,
        }
    );
    const playbookText = [
        serializeOpportunityPlaybook(opportunityPlaybook),
        buildDailyCreativityBrief(opportunityPlaybook, dateStr, {
            issueLabel: 'AI??',
            sectionLabels: ['????', '????'],
        }),
    ].join('\n\n');
    const opportunityCandidatesText = formatOpportunityCandidatesForPrompt(
        opportunityCandidates,
        opportunityPlaybook
    );
    const opportunitySourceDigest = buildOpportunitySourceDigest(
        opportunityCandidates,
        opportunityPlaybook.outputRules.maxDigestCandidates || 3,
        opportunityPlaybook.outputRules.maxEvidenceItemsPerCandidate || 2
    );

    debugInfo.opportunityCandidateCount = opportunityCandidates.length;
    debugInfo.opportunityTopScore = opportunityCandidates[0]?.score || 0;

    console.log(`[Scheduled][Opportunity] Generating content...`);
    const opportunityPromptInput = [
        `## ????\n\n${opportunityCandidatesText}`,
        `## ????\n\n${opportunitySourceDigest}`,
    ].join('\n\n');

    const opportunitySystemPrompt = getSystemPromptAiOpportunity(dateStr, playbookText);
    let opportunityMarkdownContent = await generateContentWithTransportFallback(
        env,
        opportunityPromptInput,
        opportunitySystemPrompt
    );
    opportunityMarkdownContent = removeMarkdownCodeBlock(opportunityMarkdownContent);
    opportunityMarkdownContent = convertPlaceholdersToMarkdownImages(opportunityMarkdownContent);
    opportunityMarkdownContent = replaceIncorrectDomainLinks(
        opportunityMarkdownContent,
        env.BOOK_LINK ? new URL(env.BOOK_LINK).hostname : 'news.aivora.cn'
    );

    let validation = validateOpportunityPublication({
        markdown: opportunityMarkdownContent,
        bannedPublicPhrases: opportunityPlaybook.outputRules.bannedPublicPhrases || [],
    });

    if (!validation.ok) {
        console.warn(
            `[Scheduled][Opportunity] First draft failed validation, retrying repair pass: ${validation.issues.join(' | ')}`
        );
        let repairedMarkdownContent = await generateContentWithTransportFallback(
            env,
            buildOpportunityRepairPrompt(
                opportunityPromptInput,
                opportunityMarkdownContent,
                validation.issues
            ),
            opportunitySystemPrompt
        );
        repairedMarkdownContent = removeMarkdownCodeBlock(repairedMarkdownContent);
        repairedMarkdownContent = convertPlaceholdersToMarkdownImages(repairedMarkdownContent);
        repairedMarkdownContent = replaceIncorrectDomainLinks(
            repairedMarkdownContent,
            env.BOOK_LINK ? new URL(env.BOOK_LINK).hostname : 'news.aivora.cn'
        );

        const repairedValidation = validateOpportunityPublication({
            markdown: repairedMarkdownContent,
            bannedPublicPhrases: opportunityPlaybook.outputRules.bannedPublicPhrases || [],
        });

        if (repairedValidation.ok) {
            opportunityMarkdownContent = repairedMarkdownContent;
            validation = repairedValidation;
        } else {
            validation = repairedValidation;
            opportunityMarkdownContent = repairedMarkdownContent;
        }
    }

    opportunityMarkdownContent = `## ? ????\n\n- [?? ????](#????) - ??????????\n- [?? ????](#????) - ???????????\n- [?? ????](#????) - ????????????\n- [??? ???](#???) - ?????????\n- [? ????](#????) - ???????????\n\n${opportunityMarkdownContent}`;

    debugInfo.opportunityGenerated = true;

    return {
        opportunityPaths,
        opportunityMarkdownContent,
        validation,
    };
}

async function generateAccountOpportunityMarkdown(
    env,
    dateStr,
    allUnifiedData,
    debugInfo,
    options = {}
) {
    const accountOpportunityPaths = buildAccountOpportunityPaths(dateStr);
    debugInfo.accountOpportunityPublicPath = accountOpportunityPaths.publicPath;

    const accountOpportunityCandidates = buildOpportunityCandidates(
        allUnifiedData,
        accountOpportunityPlaybook,
        {
            previousMainTopicSignals: options.previousMainTopicSignals || null,
        }
    );
    const playbookText = [
        serializeAccountOpportunityPlaybook(accountOpportunityPlaybook),
        buildDailyCreativityBrief(accountOpportunityPlaybook, dateStr, {
            issueLabel: 'AI????',
            sectionLabels: ['????', '????'],
        }),
    ].join('\n\n');
    const accountOpportunityCandidatesText = formatOpportunityCandidatesForPrompt(
        accountOpportunityCandidates,
        accountOpportunityPlaybook
    );
    const accountOpportunitySourceDigest = buildOpportunitySourceDigest(
        accountOpportunityCandidates,
        accountOpportunityPlaybook.outputRules.maxDigestCandidates || 4,
        accountOpportunityPlaybook.outputRules.maxEvidenceItemsPerCandidate || 2
    );

    debugInfo.accountOpportunityCandidateCount = accountOpportunityCandidates.length;
    debugInfo.accountOpportunityTopScore = accountOpportunityCandidates[0]?.score || 0;

    console.log(`[Scheduled][AccountOpportunity] Generating content...`);
    const accountOpportunityPromptInput = [
        `## ????\n\n${accountOpportunityCandidatesText}`,
        `## ????\n\n${accountOpportunitySourceDigest}`,
    ].join('\n\n');

    const accountOpportunitySystemPrompt = getSystemPromptAiAccountOpportunity(dateStr, playbookText);
    let accountOpportunityMarkdownContent = await generateContentWithTransportFallback(
        env,
        accountOpportunityPromptInput,
        accountOpportunitySystemPrompt
    );
    accountOpportunityMarkdownContent = removeMarkdownCodeBlock(accountOpportunityMarkdownContent);
    accountOpportunityMarkdownContent = convertPlaceholdersToMarkdownImages(accountOpportunityMarkdownContent);
    accountOpportunityMarkdownContent = replaceIncorrectDomainLinks(
        accountOpportunityMarkdownContent,
        env.BOOK_LINK ? new URL(env.BOOK_LINK).hostname : 'news.aivora.cn'
    );

    let validation = validateAccountOpportunityPublication({
        markdown: accountOpportunityMarkdownContent,
        bannedPublicPhrases: accountOpportunityPlaybook.outputRules.bannedPublicPhrases || [],
    });

    if (!validation.ok) {
        console.warn(
            `[Scheduled][AccountOpportunity] First draft failed validation, retrying repair pass: ${validation.issues.join(' | ')}`
        );
        let repairedMarkdownContent = await generateContentWithTransportFallback(
            env,
            buildAccountOpportunityRepairPrompt(
                accountOpportunityPromptInput,
                accountOpportunityMarkdownContent,
                validation.issues
            ),
            accountOpportunitySystemPrompt
        );
        repairedMarkdownContent = removeMarkdownCodeBlock(repairedMarkdownContent);
        repairedMarkdownContent = convertPlaceholdersToMarkdownImages(repairedMarkdownContent);
        repairedMarkdownContent = replaceIncorrectDomainLinks(
            repairedMarkdownContent,
            env.BOOK_LINK ? new URL(env.BOOK_LINK).hostname : 'news.aivora.cn'
        );

        const repairedValidation = validateAccountOpportunityPublication({
            markdown: repairedMarkdownContent,
            bannedPublicPhrases: accountOpportunityPlaybook.outputRules.bannedPublicPhrases || [],
        });

        validation = repairedValidation;
        accountOpportunityMarkdownContent = repairedMarkdownContent;
    }

    accountOpportunityMarkdownContent = `## ? ????\n\n- [?? ????](#????) - ?????????????\n- [?? ????](#????) - ??????????\n- [?? ????](#????) - ??????????\n- [?? ????](#????) - ????????????\n- [?? ????](#????) - ???????????\n- [? ????](#????) - ????????????????\n\n${accountOpportunityMarkdownContent}`;

    debugInfo.accountOpportunityGenerated = true;

    return {
        accountOpportunityPaths,
        accountOpportunityMarkdownContent,
        validation,
    };
}

async function commitDailyOutputs(env, dateStr, dailySummaryMarkdownContent) {
    const yearMonth = getYearMonth(dateStr);
    const dailyFilePath = `daily/${dateStr}.md`;
    const dailyPagePath = `content/cn/${yearMonth}/${dateStr}.md`;
    const monthDirectoryIndexPath = `content/cn/${yearMonth}/_index.md`;
    const homePath = 'content/cn/_index.md';
    const dailyPageTitle = `${env.DAILY_TITLE} ${formatDateToChinese(dateStr)}`;
    const dailyPageContent = buildDailyContentWithFrontMatter(dateStr, dailySummaryMarkdownContent, {
        title: dailyPageTitle,
    });

    const existingDailySha = await getGitHubFileSha(env, dailyFilePath);
    await createOrUpdateGitHubFile(
        env,
        dailyFilePath,
        dailySummaryMarkdownContent,
        `${existingDailySha ? 'Update' : 'Create'} daily summary for ${dateStr} (Scheduled)`,
        existingDailySha
    );

    const existingDailyPageSha = await getGitHubFileSha(env, dailyPagePath);
    await createOrUpdateGitHubFile(
        env,
        dailyPagePath,
        dailyPageContent,
        `${existingDailyPageSha ? 'Update' : 'Create'} daily page for ${dateStr} (Scheduled)`,
        existingDailyPageSha
    );

    const monthDirectoryIndexContent = buildMonthDirectoryIndex(yearMonth, { sidebarOpen: true });
    const existingMonthIndexSha = await getGitHubFileSha(env, monthDirectoryIndexPath);
    await createOrUpdateGitHubFile(
        env,
        monthDirectoryIndexPath,
        monthDirectoryIndexContent,
        `${existingMonthIndexSha ? 'Update' : 'Create'} month directory index for ${yearMonth} (Scheduled)`,
        existingMonthIndexSha
    );

    let existingHomeContent = '';
    try {
        existingHomeContent = await getGitHubFileContent(env, homePath);
    } catch (error) {
        console.warn(`[Scheduled][Daily] Home page not found, will create a new one.`);
    }

    const homeContent = updateHomeIndexContent(existingHomeContent, dailySummaryMarkdownContent, dateStr, {
        title: dailyPageTitle,
    });
    const existingHomeSha = await getGitHubFileSha(env, homePath);
    await createOrUpdateGitHubFile(
        env,
        homePath,
        homeContent,
        `${existingHomeSha ? 'Update' : 'Create'} home page for ${dateStr} (Scheduled)`,
        existingHomeSha
    );
}

async function commitOpportunityOutputs(env, dateStr, opportunityPaths, opportunityMarkdownContent) {
    const opportunityTitleBase = env.DAILY_TITLE.includes('??')
        ? env.DAILY_TITLE.replace('??', '??')
        : `${env.DAILY_TITLE} ??`;
    const opportunityPageTitle = `${opportunityTitleBase} ${formatDateToChinese(dateStr)}`;
    const opportunityDescription = DEFAULT_OPPORTUNITY_PAGE_DESCRIPTION;
    const opportunityPageContent = buildDailyContentWithFrontMatter(dateStr, opportunityMarkdownContent, {
        title: opportunityPageTitle,
        description: opportunityDescription,
    });

    const existingOpportunityPageSha = await getGitHubFileSha(env, opportunityPaths.pagePath);
    await createOrUpdateGitHubFile(
        env,
        opportunityPaths.pagePath,
        opportunityPageContent,
        `${existingOpportunityPageSha ? 'Update' : 'Create'} AI opportunity page for ${dateStr} (Scheduled)`,
        existingOpportunityPageSha
    );

    const existingOpportunityMonthIndexSha = await getGitHubFileSha(env, opportunityPaths.monthDirectoryIndexPath);
    if (!existingOpportunityMonthIndexSha) {
        const opportunityMonthIndexContent = buildMonthDirectoryIndex(opportunityPaths.yearMonth, { sidebarOpen: true });
        await createOrUpdateGitHubFile(
            env,
            opportunityPaths.monthDirectoryIndexPath,
            opportunityMonthIndexContent,
            `Create AI opportunity month directory index for ${opportunityPaths.yearMonth} (Scheduled)`,
            null
        );
    }

    let existingOpportunityHomeContent = '';
    try {
        existingOpportunityHomeContent = await getGitHubFileContent(env, opportunityPaths.homePath);
    } catch (error) {
        console.warn(`[Scheduled][Opportunity] Home page not found, will create a new one.`);
    }

    const opportunityHomeContent = updateSectionHomeIndexContent(
        existingOpportunityHomeContent,
        opportunityMarkdownContent,
        dateStr,
        {
            title: opportunityPageTitle,
            description: DEFAULT_OPPORTUNITY_SECTION_DESCRIPTION,
            sectionPrefix: '/opportunity',
        }
    );
    const existingOpportunityHomeSha = await getGitHubFileSha(env, opportunityPaths.homePath);
    await createOrUpdateGitHubFile(
        env,
        opportunityPaths.homePath,
        opportunityHomeContent,
        `${existingOpportunityHomeSha ? 'Update' : 'Create'} AI opportunity home page for ${dateStr} (Scheduled)`,
        existingOpportunityHomeSha
    );
}

async function commitAccountOpportunityOutputs(env, dateStr, accountOpportunityPaths, accountOpportunityMarkdownContent) {
    const accountOpportunityTitleBase = env.DAILY_TITLE.includes('??')
        ? env.DAILY_TITLE.replace('??', '????')
        : `${env.DAILY_TITLE} ????`;
    const accountOpportunityPageTitle = `${accountOpportunityTitleBase} ${formatDateToChinese(dateStr)}`;
    const accountOpportunityDescription = DEFAULT_ACCOUNT_OPPORTUNITY_PAGE_DESCRIPTION;
    const accountOpportunityPageContent = buildDailyContentWithFrontMatter(dateStr, accountOpportunityMarkdownContent, {
        title: accountOpportunityPageTitle,
        description: accountOpportunityDescription,
    });

    const existingAccountOpportunityPageSha = await getGitHubFileSha(env, accountOpportunityPaths.pagePath);
    await createOrUpdateGitHubFile(
        env,
        accountOpportunityPaths.pagePath,
        accountOpportunityPageContent,
        `${existingAccountOpportunityPageSha ? 'Update' : 'Create'} AI account opportunity page for ${dateStr} (Scheduled)`,
        existingAccountOpportunityPageSha
    );

    const existingAccountOpportunityMonthIndexSha = await getGitHubFileSha(env, accountOpportunityPaths.monthDirectoryIndexPath);
    if (!existingAccountOpportunityMonthIndexSha) {
        const accountOpportunityMonthIndexContent = buildMonthDirectoryIndex(accountOpportunityPaths.yearMonth, { sidebarOpen: true });
        await createOrUpdateGitHubFile(
            env,
            accountOpportunityPaths.monthDirectoryIndexPath,
            accountOpportunityMonthIndexContent,
            `Create AI account opportunity month directory index for ${accountOpportunityPaths.yearMonth} (Scheduled)`,
            null
        );
    }

    let existingAccountOpportunityHomeContent = '';
    try {
        existingAccountOpportunityHomeContent = await getGitHubFileContent(env, accountOpportunityPaths.homePath);
    } catch (error) {
        console.warn(`[Scheduled][AccountOpportunity] Home page not found, will create a new one.`);
    }

    const accountOpportunityHomeContent = updateAccountOpportunityHomeIndexContent(
        existingAccountOpportunityHomeContent,
        accountOpportunityMarkdownContent,
        dateStr,
        {
            title: accountOpportunityPageTitle,
            description: DEFAULT_ACCOUNT_OPPORTUNITY_SECTION_DESCRIPTION,
            sectionPrefix: '/account-opportunity',
        }
    );
    const existingAccountOpportunityHomeSha = await getGitHubFileSha(env, accountOpportunityPaths.homePath);
    await createOrUpdateGitHubFile(
        env,
        accountOpportunityPaths.homePath,
        accountOpportunityHomeContent,
        `${existingAccountOpportunityHomeSha ? 'Update' : 'Create'} AI account opportunity home page for ${dateStr} (Scheduled)`,
        existingAccountOpportunityHomeSha
    );
}

function extractHomeNextPath(markdownContent) {
    const match = String(markdownContent || '').match(/^next:\s*(\S+)\s*$/m);
    return match?.[1] || '';
}

async function checkScheduledOutputHealth(env, options = {}) {
    const { pagePath, homePath, expectedHomeNext } = options;
    const pageExists = Boolean(pagePath && await getGitHubFileSha(env, pagePath));
    let homeCurrent = true;

    if (homePath && expectedHomeNext) {
        try {
            const homeContent = await getGitHubFileContent(env, homePath);
            homeCurrent = extractHomeNextPath(homeContent) === expectedHomeNext;
        } catch (error) {
            homeCurrent = false;
        }
    }

    return {
        pageExists,
        homeCurrent,
        healthy: pageExists && homeCurrent,
    };
}

function buildSkippedScheduledResult(dateStr, mode, reason, extra = {}) {
    return {
        ...buildBaseDebugInfo(dateStr, mode),
        skipped: true,
        skipReason: reason,
        ...extra,
    };
}

async function handleScheduledDailyBackup(event, env, ctx, specifiedDate = null) {
    const dateStr = specifiedDate || getISODate();
    const yearMonth = getYearMonth(dateStr);
    const health = await checkScheduledOutputHealth(env, {
        pagePath: `content/cn/${yearMonth}/${dateStr}.md`,
        homePath: 'content/cn/_index.md',
        expectedHomeNext: `/${yearMonth}/${dateStr}`,
    });

    if (health.healthy) {
        return buildSkippedScheduledResult(dateStr, 'daily-backup', 'daily-output-healthy', health);
    }

    return handleScheduledDaily(event, env, ctx, dateStr);
}

async function handleScheduledOpportunityBackup(event, env, ctx, specifiedDate = null) {
    const dateStr = specifiedDate || getISODate();
    const opportunityPaths = buildOpportunityPaths(dateStr);
    const health = await checkScheduledOutputHealth(env, {
        pagePath: opportunityPaths.pagePath,
        homePath: opportunityPaths.homePath,
        expectedHomeNext: opportunityPaths.publicPath.replace(/\/$/, ''),
    });

    if (health.healthy) {
        return buildSkippedScheduledResult(dateStr, 'opportunity-backup', 'opportunity-output-healthy', health);
    }

    return handleScheduledOpportunity(event, env, ctx, dateStr);
}

async function handleScheduledAccountOpportunityBackup(event, env, ctx, specifiedDate = null) {
    const dateStr = specifiedDate || getISODate();
    const accountOpportunityPaths = buildAccountOpportunityPaths(dateStr);
    const health = await checkScheduledOutputHealth(env, {
        pagePath: accountOpportunityPaths.pagePath,
        homePath: accountOpportunityPaths.homePath,
        expectedHomeNext: accountOpportunityPaths.publicPath.replace(/\/$/, ''),
    });

    if (health.healthy) {
        return buildSkippedScheduledResult(dateStr, 'account-opportunity-backup', 'account-opportunity-output-healthy', health);
    }

    return handleScheduledAccountOpportunity(event, env, ctx, dateStr);
}

async function handleScheduledBackup(event, env, ctx, specifiedDate = null) {
    const daily = await handleScheduledDailyBackup(event, env, ctx, specifiedDate);
    const opportunity = await handleScheduledOpportunityBackup(event, env, ctx, specifiedDate);
    const accountOpportunity = await handleScheduledAccountOpportunityBackup(event, env, ctx, specifiedDate);

    return { daily, opportunity, accountOpportunity };
}

export async function handleScheduledDaily(event, env, ctx, specifiedDate = null) {
    const dateStr = specifiedDate || getISODate();
    setFetchDate(dateStr);
    const debugInfo = buildBaseDebugInfo(dateStr, 'daily');
    console.log(`[Scheduled][Daily] Starting automation for ${dateStr}${specifiedDate ? ' (specified date)' : ''}`);

    const { selectedContentItems, mediaCandidates, totalCandidateCount, selectedCounts } = await loadScheduledContext(env, dateStr, debugInfo, {
        preferCachedData: Boolean(specifiedDate) || String(env.DAILY_USE_PREFETCH_CACHE || 'true').toLowerCase() !== 'false',
    });
    debugInfo.promptSelectedItems = selectedContentItems.length;
    debugInfo.promptTotalCandidateCount = totalCandidateCount || 0;
    debugInfo.promptSelectedCounts = selectedCounts || {};

    const { outputOfCall3, dailySummaryMarkdownContent, validation: generatedValidation } = await generateDailyMarkdown(
        env,
        dateStr,
        selectedContentItems,
        mediaCandidates,
        debugInfo,
        {
            minimumTopItems: selectedContentItems.length >= 10 ? 10 : Math.min(selectedContentItems.length, 9),
        }
    );

    const validation = generatedValidation || validateDailyPublication({
        summaryText: outputOfCall3,
        pageMarkdown: dailySummaryMarkdownContent,
        minimumTopItems: selectedContentItems.length >= 10 ? 10 : Math.min(selectedContentItems.length, 9),
    });
    debugInfo.dailyValidationPassed = validation.ok;
    debugInfo.dailyValidationIssues = validation.issues;
    if (!validation.ok) {
        console.warn(`[Scheduled][Daily] Validation failed, skipping publish: ${validation.issues.join(' | ')}`);
        return debugInfo;
    }

    await commitDailyOutputs(env, dateStr, dailySummaryMarkdownContent);
    debugInfo.dailyPublished = true;
    return debugInfo;
}

export async function handleScheduledOpportunity(event, env, ctx, specifiedDate = null) {
    const dateStr = specifiedDate || getISODate();
    setFetchDate(dateStr);
    const debugInfo = buildBaseDebugInfo(dateStr, 'opportunity');
    console.log(`[Scheduled][Opportunity] Starting automation for ${dateStr}${specifiedDate ? ' (specified date)' : ''}`);

    const { allUnifiedData, previousOpportunityReplaySignals } = await loadScheduledContext(env, dateStr, debugInfo, {
        preferCachedData: Boolean(specifiedDate),
    });
    const { opportunityPaths, opportunityMarkdownContent } = await generateOpportunityMarkdown(
        env,
        dateStr,
        allUnifiedData,
        debugInfo,
        {
            previousMainTopicSignals: previousOpportunityReplaySignals,
        }
    );

    const validation = validateOpportunityPublication({
        markdown: opportunityMarkdownContent,
        bannedPublicPhrases: opportunityPlaybook.outputRules.bannedPublicPhrases || [],
    });
    debugInfo.opportunityValidationPassed = validation.ok;
    debugInfo.opportunityValidationIssues = validation.issues;
    if (!validation.ok) {
        console.warn(`[Scheduled][Opportunity] Validation failed, skipping publish: ${validation.issues.join(' | ')}`);
        return debugInfo;
    }

    await commitOpportunityOutputs(env, dateStr, opportunityPaths, opportunityMarkdownContent);
    debugInfo.opportunityPublished = true;
    return debugInfo;
}

export async function handleScheduledAccountOpportunity(event, env, ctx, specifiedDate = null) {
    const dateStr = specifiedDate || getISODate();
    setFetchDate(dateStr);
    const debugInfo = buildBaseDebugInfo(dateStr, 'account-opportunity');
    console.log(`[Scheduled][AccountOpportunity] Starting automation for ${dateStr}${specifiedDate ? ' (specified date)' : ''}`);

    const { allUnifiedData, previousOpportunityReplaySignals } = await loadScheduledContext(env, dateStr, debugInfo, {
        preferCachedData: Boolean(specifiedDate),
    });
    const { accountOpportunityPaths, accountOpportunityMarkdownContent } = await generateAccountOpportunityMarkdown(
        env,
        dateStr,
        allUnifiedData,
        debugInfo,
        {
            previousMainTopicSignals: previousOpportunityReplaySignals,
        }
    );

    const validation = validateAccountOpportunityPublication({
        markdown: accountOpportunityMarkdownContent,
        bannedPublicPhrases: accountOpportunityPlaybook.outputRules.bannedPublicPhrases || [],
    });
    debugInfo.accountOpportunityValidationPassed = validation.ok;
    debugInfo.accountOpportunityValidationIssues = validation.issues;
    if (!validation.ok) {
        console.warn(`[Scheduled][AccountOpportunity] Validation failed, skipping publish: ${validation.issues.join(' | ')}`);
        return debugInfo;
    }

    await commitAccountOpportunityOutputs(
        env,
        dateStr,
        accountOpportunityPaths,
        accountOpportunityMarkdownContent
    );
    debugInfo.accountOpportunityPublished = true;
    return debugInfo;
}

export async function handleScheduled(event, env, ctx, specifiedDate = null, mode = 'auto') {
    const resolvedMode = resolveScheduledModeFromEvent(event, env, mode);

    if (resolvedMode === 'backup') {
        return handleScheduledBackup(event, env, ctx, specifiedDate);
    }

    if (resolvedMode === 'daily-backup') {
        return handleScheduledDailyBackup(event, env, ctx, specifiedDate);
    }

    if (resolvedMode === 'daily-prefetch') {
        return handleScheduledDailyPrefetch(event, env, ctx, specifiedDate);
    }

    if (resolvedMode === 'account-opportunity') {
        return handleScheduledAccountOpportunity(event, env, ctx, specifiedDate);
    }

    if (resolvedMode === 'opportunity') {
        return handleScheduledOpportunity(event, env, ctx, specifiedDate);
    }

    if (resolvedMode === 'all') {
        const daily = await handleScheduledDaily(event, env, ctx, specifiedDate);
        const opportunity = await handleScheduledOpportunity(event, env, ctx, specifiedDate);
        const accountOpportunity = await handleScheduledAccountOpportunity(event, env, ctx, specifiedDate);
        return { daily, opportunity, accountOpportunity };
    }

    return handleScheduledDaily(event, env, ctx, specifiedDate);
}
