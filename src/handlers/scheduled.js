import { getISODate, formatDateToChinese, removeMarkdownCodeBlock, stripHtml, convertPlaceholdersToMarkdownImages, setFetchDate, replaceIncorrectDomainLinks } from '../helpers.js';
import { normalizeMarkdownImageSyntax, normalizeMarkdownMediaUrl } from '../helpers.js';
import { fetchAllData, dataSources } from '../dataFetchers.js';
import { storeInKV, getFromKV } from '../kv.js';
import { callChatAPI, callChatAPIStream } from '../chatapi.js';
import { resolveScheduledModeFromEvent } from '../scheduleRouting.js';
import { resolveFoloCookie } from './foloCookieAdmin.js';
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
    buildOpportunityCandidateAssessment,
    buildOpportunityCandidates,
    formatOpportunityCandidatesForPrompt,
    inferOpportunityReplaySignals,
} from "../opportunityScoring.js";
import { assembleDailySummaryMarkdown } from '../dailyMarkdownAssembly.js';
import { buildDailyContentWithFrontMatter, getYearMonth, updateHomeIndexContent, buildMonthDirectoryIndex } from '../contentUtils.js';
import { createOrUpdateGitHubFile, getGitHubFileContent, getGitHubFileSha } from '../github.js';
import { buildDailyPromptSelection } from '../dailyPromptSelection.js';
import {
    buildOpportunityPaths,
    DEFAULT_OPPORTUNITY_PAGE_DESCRIPTION,
    DEFAULT_OPPORTUNITY_SECTION_DESCRIPTION,
    DEFAULT_OPPORTUNITY_SECTION_TITLE,
    stripTemplateOwnedOpportunityH1,
    updateSectionHomeIndexContent,
} from '../opportunityUtils.js';
import {
    assessAccountOpportunityMarketScope,
    buildAccountOpportunityPaths,
    buildRejectedAccountOpportunityDigest,
    DEFAULT_ACCOUNT_OPPORTUNITY_PAGE_DESCRIPTION,
    DEFAULT_ACCOUNT_OPPORTUNITY_SECTION_TITLE,
    DEFAULT_ACCOUNT_OPPORTUNITY_SECTION_DESCRIPTION,
    formatAccountOpportunityCandidatesForPrompt,
    insertAccountOpportunityAivoraLink,
    normalizeAccountOpportunityHardSignalLinks,
    normalizeAccountOpportunityObservationMarkdown,
    qualifyAccountOpportunityCandidates,
    updateAccountOpportunityHomeIndexContent,
} from '../accountOpportunityUtils.js';
import { runIsolatedAccountOpportunity } from '../accountOpportunityIsolation.js';
import {
    validateDailyPublication,
    validateAccountOpportunityPublication,
    validateOpportunityPublication,
    validateSupplyDrivenAccountOpportunityPublication,
    normalizeOpportunityAvoidSection,
    normalizeOpportunityEvidenceBoundaryLanguage,
} from '../publishValidation.js';
import {
    loadSupplyOpportunitySnapshot,
    recordSupplySnapshotDebug,
} from '../supplyOpportunitySnapshot.js';
import {
    buildSupplyDrivenAccountOpportunityMarkdown,
} from '../supplyDrivenAccountOpportunity.js';
import {
    extractGithubTopProjectsFromMarkdown,
    filterGithubProjectsAgainstRecentTop,
    loadRecentGithubTopProjects,
    mergeRecentGithubTopProjects,
    storeRecentGithubTopProjects,
} from '../githubTopProjectDedupe.js';
import {
    DEFAULT_OPPORTUNITY_REPLAY_LOOKBACK_DAYS,
    OPPORTUNITY_REPLAY_MEMORY_KEY,
    appendOpportunityReplayMetadata,
    createEmptyOpportunityReplayMemory,
    extractOpportunityReplayMemoryFromMarkdown,
    formatOpportunityReplayMemoryForPrompt,
    getMissingOpportunityReplaySections,
    getOpportunityReplayMemoryStats,
    hasOpportunityReplaySectionDate,
    mergeOpportunityReplayMemories,
    pruneOpportunityReplayMemory,
} from '../opportunityReplayDedupe.js';
import {
    buildAivoraOpportunityLinkIntent,
    insertOpportunityAivoraLink,
    loadAivoraOpportunityLinkPolicy,
    sanitizeOpportunityAivoraLinks,
} from '../opportunityAivoraLinkPolicy.js';
import { buildOpportunityEvidenceEnrichment } from '../opportunityEvidence.js';
import {
    enforceDailyTopGithubLimit,
    ensureUniqueDailyTopSources,
    isUsableDailyMediaUrl,
    normalizeDailyOutputPresentation,
    removeEmptyDailyFunSection,
    removeEmptyDailyTopicSections,
    sanitizeDuplicateDailySections,
} from '../dailySectionSanitizer.js';
import { ensureDailyMediaCoverage, repairDailyMediaReferences } from '../dailyMediaCoverage.js';
import { extractNumberedDailyItems } from '../dailyMarkdownItems.js';
import {
    buildDailyGenerationPromptInput,
    countDailyTopEligiblePromptItems,
    getDailyPromptAllocationStats,
} from '../dailyGenerationPromptInput.js';
import {
    DAILY_OPEN_SOURCE_MIN,
    DAILY_SOCIAL_MIN,
    DAILY_TOP_EMERGENCY_MIN,
    DAILY_TOP_TARGET,
} from '../dailyContentRules.js';
import { shouldAdoptDailyRepair } from '../dailyRepairPolicy.js';
import { prefetchDailySourceCategories } from '../dailySourcePrefetch.js';
import {
    buildStandaloneDailyFunPromptInput,
    insertDailyFunSection,
    normalizeStandaloneDailyFunSection,
    selectStandaloneDailyFunCandidates,
} from '../dailyFunSection.js';

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

    for (const match of str.matchAll(/<img\b[^>]*>/gi)) {
        const tag = match[0];
        const src = normalizeMarkdownMediaUrl(tag.match(/\bsrc=["']([^"']+)["']/i)?.[1]);
        const alt = tag.match(/\balt=["']([^"']*)["']/i)?.[1]?.trim();
        if (src && isUsableDailyMediaUrl(src)) addPlaceholder(`![${alt || 'image'}](${src})`);
        if (placeholders.length >= limit) return placeholders;
    }

    for (const match of str.matchAll(/<video\b[^>]*src="([^"]+)"[^>]*>/gi)) {
        const src = normalizeMarkdownMediaUrl(match[1]);
        if (src && isUsableDailyMediaUrl(src)) addPlaceholder(`<video controls preload="metadata" playsinline style="max-width:100%; height:auto;" src="${src}"></video>`);
        if (placeholders.length >= limit) return placeholders;
    }

    return placeholders;
}

function containsRenderedMedia(markdown) {
    if (!markdown) return false;
    return /!\[[^\]]*\]\([^)]+\)|<img\b|<video\b/i.test(markdown);
}

function getDailyFunSectionStats(markdown) {
    const section = String(markdown || '').match(
        /^##\s*\*\*.*(?:😄|😆|AI\s*趣闻|趣闻).*\*\*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im
    )?.[0] || '';

    return {
        present: section.length > 0,
        sourceLinkCount: (section.match(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g) || []).length,
    };
}

function truncatePromptText(text, maxChars = 500) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxChars) return normalized;
    return `${normalized.slice(0, maxChars)}…`;
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

function getPreviousDates(dateStr, count = 1) {
    const dates = [];
    let cursor = dateStr;
    const total = Math.max(1, Number.parseInt(String(count), 10) || 1);

    for (let index = 0; index < total; index += 1) {
        cursor = getPreviousDate(cursor);
        if (!cursor) break;
        dates.push(cursor);
    }

    return dates;
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
        .replace(/[`~!@#$%^&*()_+=[\]{};:'",.<>/?\\|，。！？、；：“”‘’（）【】《》·—…-]+/g, ' ')
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

    for (const item of extractNumberedDailyItems(topSection)) {
        const title = item.title?.trim();
        const url = item.url?.trim();
        const urlKey = normalizeReplayUrl(url);
        const titleKey = normalizeReplayTitle(title);
        const dedupeKey = `${urlKey}::${titleKey}`;
        if (!title || !url || seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        items.push({ title, url, urlKey, titleKey });
    }

    return items;
}

function isInternalDailyUrl(url) {
    if (!url) return false;

    try {
        const hostname = new URL(String(url)).hostname.toLowerCase().replace(/^www\./, '');
        return hostname === 'aivora.cn' || hostname === 'news.aivora.cn';
    } catch {
        return false;
    }
}

function extractPreviousDailyReplayItems(markdown) {
    const content = String(markdown || '');
    if (!content) return [];

    const items = [];
    const seen = new Set();
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

    for (const match of content.matchAll(linkRegex)) {
        if (match.index > 0 && content[match.index - 1] === '!') continue;

        const rawTitle = match[1]?.trim();
        const url = match[2]?.trim();
        if (!rawTitle || !url || isInternalDailyUrl(url)) continue;

        const urlKey = normalizeReplayUrl(url);
        if (!urlKey || seen.has(urlKey)) continue;
        seen.add(urlKey);

        const title = /^(链接|link|image)$/i.test(rawTitle) ? '' : rawTitle;
        items.push({
            title,
            url,
            urlKey,
            titleKey: normalizeReplayTitle(title),
        });
    }

    return items;
}

function isUsablePreviousDaily(markdown, topItems) {
    if (!markdown || !Array.isArray(topItems) || topItems.length < 3) return false;

    const failurePatterns = [
        /素材不足/i,
        /无法生成/i,
        /请补充素材/i,
        /请提供完整/i,
        /我需要你提供/i,
        /我理解你的困惑/i,
        /i can't help/i,
        /would you like help/i,
        /set up an api integration/i,
    ];

    return !failurePatterns.some((pattern) => pattern.test(markdown));
}

async function loadPreviousTopItems(env, dateStr, lookbackDays = 1) {
    const previousDates = getPreviousDates(dateStr, lookbackDays);
    const previousDate = previousDates[0] || null;
    if (!previousDate) {
        return { previousDate: null, items: [], allItems: [] };
    }

    let firstPreviousTopItems = [];
    const allReplayItems = [];

    for (const candidateDate of previousDates) {
        try {
            const previousMarkdown = await getGitHubFileContent(env, `daily/${candidateDate}.md`);
            const topItems = extractPreviousTopItems(previousMarkdown);
            const allItems = extractPreviousDailyReplayItems(previousMarkdown);
            if (!isUsablePreviousDaily(previousMarkdown, topItems)) {
                console.warn(`[Scheduled] Previous daily ${candidateDate} missing usable TOP section, skipping replay filter for this date.`);
                continue;
            }
            if (candidateDate === previousDate) {
                firstPreviousTopItems = topItems;
            }
            allReplayItems.push(...allItems);
        } catch (error) {
            console.warn(`[Scheduled] Failed to load previous daily ${candidateDate}, skipping replay filter for this date: ${error.message}`);
        }
    }

    const seenReplayUrls = new Set();
    const dedupedReplayItems = [];
    for (const item of allReplayItems) {
        const key = item?.urlKey || normalizeReplayUrl(item?.url);
        if (!key || seenReplayUrls.has(key)) continue;
        seenReplayUrls.add(key);
        dedupedReplayItems.push(item);
    }

    return { previousDate, items: firstPreviousTopItems, allItems: dedupedReplayItems };
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

function hasOpportunityReplayMemory(memory) {
    const stats = getOpportunityReplayMemoryStats(memory);
    return Object.values(stats).some((count) => count > 0);
}

const OPPORTUNITY_QUALITY_SKIP_KEY_PREFIX = 'opportunity-quality-skip';
const OPPORTUNITY_EVIDENCE_CACHE_KEY_PREFIX = 'opportunity-evidence-enrichment';

function getOpportunityQualitySkipKey(dateStr) {
    return `${OPPORTUNITY_QUALITY_SKIP_KEY_PREFIX}:${dateStr}`;
}

function getOpportunityEvidenceCacheKey(dateStr, candidates = []) {
    const sourceUrls = (candidates || [])
        .flatMap((candidate) => candidate?.supportingItems || [])
        .map((item) => String(item?.url || '').trim().toLowerCase())
        .filter(Boolean)
        .sort();
    let hash = 2166136261;
    for (const char of sourceUrls.join('|')) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return `${OPPORTUNITY_EVIDENCE_CACHE_KEY_PREFIX}:${dateStr}:${(hash >>> 0).toString(16)}`;
}

async function loadOpportunityEvidenceCache(env, cacheKey) {
    if (!env.DATA_KV) return null;
    try {
        const cached = await getFromKV(env.DATA_KV, cacheKey);
        return cached?.recordsBySourceUrl ? cached : null;
    } catch (error) {
        console.warn(`[Scheduled][Opportunity] Failed to read evidence cache: ${error.message}`);
        return null;
    }
}

async function storeOpportunityEvidenceCache(env, cacheKey, enrichment) {
    if (!env.DATA_KV || !enrichment?.recordsBySourceUrl) return;
    try {
        await storeInKV(env.DATA_KV, cacheKey, enrichment, 86400 * 2);
    } catch (error) {
        console.warn(`[Scheduled][Opportunity] Failed to store evidence cache: ${error.message}`);
    }
}

async function loadOpportunityQualitySkip(env, dateStr) {
    if (!env.DATA_KV) return null;
    try {
        return await getFromKV(env.DATA_KV, getOpportunityQualitySkipKey(dateStr));
    } catch (error) {
        console.warn(`[Scheduled][Opportunity] Failed to read quality-skip marker: ${error.message}`);
        return null;
    }
}

async function storeOpportunityQualitySkip(env, dateStr, details = {}) {
    if (!env.DATA_KV) return;
    try {
        await storeInKV(
            env.DATA_KV,
            getOpportunityQualitySkipKey(dateStr),
            {
                date: dateStr,
                reason: 'no-qualified-opportunity-candidates',
                recordedAt: new Date().toISOString(),
                ...details,
            },
            86400 * 2
        );
    } catch (error) {
        console.warn(`[Scheduled][Opportunity] Failed to store quality-skip marker: ${error.message}`);
    }
}

async function loadOpportunityReplayMemoryFromKv(env, dateStr, lookbackDays) {
    if (!env.DATA_KV) return createEmptyOpportunityReplayMemory();

    try {
        const stored = await getFromKV(env.DATA_KV, OPPORTUNITY_REPLAY_MEMORY_KEY);
        return pruneOpportunityReplayMemory(stored, dateStr, lookbackDays);
    } catch (error) {
        console.warn(`[Scheduled] Failed to load opportunity replay memory from KV: ${error.message}`);
        return createEmptyOpportunityReplayMemory();
    }
}

async function storeOpportunityReplayMemoryToKv(env, dateStr, section, markdown, playbook, existingMemory, debugInfo) {
    if (!env.DATA_KV) return;

    try {
        const lookbackDays = Math.max(
            1,
            Number.parseInt(env.OPPORTUNITY_REPLAY_LOOKBACK_DAYS || DEFAULT_OPPORTUNITY_REPLAY_LOOKBACK_DAYS, 10) ||
                DEFAULT_OPPORTUNITY_REPLAY_LOOKBACK_DAYS
        );
        const currentMemory = extractOpportunityReplayMemoryFromMarkdown(markdown, {
            date: dateStr,
            section,
            playbook,
        });
        const latestStoredMemory = await loadOpportunityReplayMemoryFromKv(env, dateStr, lookbackDays);
        const mergedMemory = pruneOpportunityReplayMemory(
            mergeOpportunityReplayMemories(latestStoredMemory, existingMemory, currentMemory),
            dateStr,
            lookbackDays
        );
        await storeInKV(env.DATA_KV, OPPORTUNITY_REPLAY_MEMORY_KEY, mergedMemory, 86400 * (lookbackDays + 2));
        if (debugInfo) {
            debugInfo.opportunityReplayMemoryStored = true;
            debugInfo.opportunityReplayMemoryStoredStats = getOpportunityReplayMemoryStats(mergedMemory);
        }
    } catch (error) {
        console.warn(`[Scheduled] Failed to store opportunity replay memory in KV: ${error.message}`);
        if (debugInfo) {
            debugInfo.opportunityReplayMemoryStoreError = error.message;
        }
    }
}

async function loadRecentOpportunityReplayMemory(env, dateStr, options = {}) {
    const lookbackDays = Math.max(
        1,
        Number.parseInt(
            options.lookbackDays || env.OPPORTUNITY_REPLAY_LOOKBACK_DAYS || DEFAULT_OPPORTUNITY_REPLAY_LOOKBACK_DAYS,
            10
        ) || DEFAULT_OPPORTUNITY_REPLAY_LOOKBACK_DAYS
    );
    const previousDates = getPreviousDates(dateStr, lookbackDays);
    const previousDate = previousDates[0] || null;
    let previousMainTopicSignals = { matchedRuleIds: [], matchedTerms: [], primaryLane: null };
    let memory = await loadOpportunityReplayMemoryFromKv(env, dateStr, lookbackDays);
    let loadedCount = 0;
    let missingCount = 0;
    let loadedFromKv = hasOpportunityReplayMemory(memory);

    const targets = getMissingOpportunityReplaySections(memory, previousDates)
        .map((target) => ({
            ...target,
            path: target.section === 'opportunity'
                ? buildOpportunityPaths(target.date).pagePath
                : buildAccountOpportunityPaths(target.date).pagePath,
            playbook: target.section === 'opportunity'
                ? opportunityPlaybook
                : accountOpportunityPlaybook,
        }));

    if (
        options.includeCurrentOpportunity &&
        !hasOpportunityReplaySectionDate(memory, 'opportunity', dateStr, {
            requireOfferFamily: true,
        })
    ) {
        targets.push({
            date: dateStr,
            section: 'opportunity',
            path: buildOpportunityPaths(dateStr).pagePath,
            playbook: opportunityPlaybook,
        });
    }

    for (const target of targets) {
        try {
            const markdown = await getGitHubFileContent(env, target.path);
            loadedCount += 1;
            memory = mergeOpportunityReplayMemories(
                memory,
                extractOpportunityReplayMemoryFromMarkdown(markdown, {
                    date: target.date,
                    section: target.section,
                    playbook: target.playbook,
                })
            );

            if (target.date === previousDate && target.section === 'opportunity') {
                const mainTopicSection = extractMarkdownSection(markdown, '今日主推') || markdown;
                previousMainTopicSignals = inferOpportunityReplaySignals(mainTopicSection, opportunityPlaybook);
            }
        } catch (error) {
            missingCount += 1;
            console.warn(
                `[Scheduled] Failed to load ${target.section} replay file ${target.date}, skipping this file: ${error.message}`
            );
        }
    }

    return {
        previousDate,
        previousMainTopicSignals,
        memory,
        loadedCount,
        missingCount,
        loadedFromKv,
        lookbackDays,
    };
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

function filterItemsAgainstPreviousDaily(items, previousItems) {
    if (!Array.isArray(items) || items.length === 0 || !Array.isArray(previousItems) || previousItems.length === 0) {
        return { filteredItems: items || [], filteredCount: 0 };
    }

    const previousUrlKeys = new Set(previousItems.map((item) => item.urlKey).filter(Boolean));
    const previousTitles = previousItems.map((item) => item.title).filter(Boolean);
    const filteredItems = [];
    let filteredCount = 0;

    for (const item of items) {
        const urlKey = normalizeReplayUrl(item?.url);
        const title = item?.title || '';
        const duplicateByUrl = urlKey && previousUrlKeys.has(urlKey);
        const duplicateByTitle = !duplicateByUrl && title && previousTitles.some((previousTitle) => isSimilarReplayTitle(title, previousTitle));

        if (duplicateByUrl || duplicateByTitle) {
            filteredCount += 1;
            continue;
        }

        filteredItems.push(item);
    }

    return { filteredItems, filteredCount };
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

function getStandaloneDailyFunSystemPrompt() {
    return [
        "你是 AI日报的中文编辑，只写真实来源驱动的 AI趣闻栏目。",
        "不要编造新闻，不要写兜底内容，不要解释生成过程。",
        "输出必须是 Markdown；如果写不出合格栏目，就输出空字符串。",
    ].join('\n');
}

function getDuplicateDailyTopSourceUrls(markdown) {
    const seen = new Set();
    const duplicates = new Set();

    for (const item of extractNumberedDailyItems(markdown)) {
        const url = String(item?.url || '').trim();
        if (!url) continue;
        const key = url.toLowerCase();
        if (seen.has(key)) duplicates.add(url);
        seen.add(key);
    }

    return [...duplicates];
}

function buildDailyRepairPrompt(basePromptInput, invalidMarkdown, validationIssues, dateStr) {
    const duplicateTopSourceUrls = getDuplicateDailyTopSourceUrls(invalidMarkdown);
    const duplicateSourceChecklist = duplicateTopSourceUrls.length > 0
        ? duplicateTopSourceUrls.map((url) => `- 必须把 ${url} 在今日焦点中的多条内容合并为 1 条，空出的序号使用去重备用素材补足`).join('\n')
        : "- 今日焦点中的每个原始来源 URL 最多出现一次";
    return [
        "你上一次输出的日报正文不合格，请立即重写，不要解释原因，不要道歉，不要拒答。",
        `这次重写的目标日期是 ${dateStr}。`,
        "上一次输出存在这些问题：",
        ...(validationIssues || []).map((issue) => `- ${issue}`),
        "",
        "请严格遵守以下规则：",
        `- 只输出从 \`## **🔥 今日焦点 TOP ${DAILY_TOP_TARGET}**\` 开始的 Markdown 正文，不要生成今日摘要、快速导航、前言、备注、AI思考或规则说明`,
        `- 必须包含 \`## **🔥 今日焦点 TOP ${DAILY_TOP_TARGET}**\` 和 \`## **❓ 相关问题**\`；素材充足时今日焦点必须写满 ${DAILY_TOP_TARGET} 条`,
        "- 产品与功能更新 / 前沿研究 / 行业变化与个人影响 / 开源 TOP 项目 / 社媒精选中，至少输出三个有真实来源的栏目；没有素材的栏目直接省略，不能留空标题",
        `- 输入有 ${DAILY_OPEN_SOURCE_MIN} 个以上合格 GitHub 日榜项目或 ${DAILY_SOCIAL_MIN} 条以上合格社媒原帖时，对应栏目至少输出 ${DAILY_OPEN_SOURCE_MIN} 条；不能只挑 1 条敷衍`,
        `- 修复清单出现 below target 时，按“TOP 主候选 -> 去重备用”补足 ${DAILY_TOP_TARGET} 条；输入已做 AI 相关性筛选，主候选和备用合计达到 ${DAILY_TOP_TARGET} 条时不得自行减为 6-9 条；专用区素材不得挪回今日焦点`,
        "- `## **😄 AI趣闻**` 是可选栏目；写不出完整、有来源链接的趣闻就省略，不能因为趣闻缺失影响主体日报",
        "- 如果输出 AI趣闻，必须标题二次创作，正文按 Hook -> What -> Punchline 再开发，不要照搬来源标题或正文",
        "- 所有 `###` 标题都必须是纯文本，不得包含 Markdown 链接；普通新闻、研究和社媒标题 14-30 字，AI 趣闻 12-24 字，开源标题保留 owner/repo 且冒号后用途说明 8-16 字，FAQ 使用固定问句格式",
        "- 每条正文不得以链接开头；第一句先写 6-18 字的 `**黄色短结论。**`，第二句或首段中部再把 1 个描述性原始来源链接放在可核实事实上",
        "- 来源名称写在链接外，例如“据 AIBase 报道”或“宝玉在推文中介绍”；链接只挂在 8-24 字的核心事实上，例如“[API 价格将在下周上调](URL)”或“[Origin 专为多 Agent 并行仓库设计](URL)”。禁止使用“某某整理的技术细节”“某某的实测记录”“截图推文”“频道消息”“报道详情”等来源标签作为链接文字",
        "- 链接文案要说明点开能验证什么，不能写“原文链接”“点击查看”“了解更多”；输入里有官方公告或项目主页时优先使用，不得编造 URL",
        "- 同一个 Source URL 在今日焦点最多使用一次；一篇聚合稿也只能生成一条，绝不能拆成多条新闻。若有重复，保留最重要的一条并用“今日焦点去重备用素材”补足条数",
        "- 每条正文写 4-5 个短句，每句尽量不超过 45 个可见字符，总长约 120-170 字；依次交代结论、来源事实、关键数字或限制、读者影响，不用空话补字数",
        "- 今日焦点每条正文通常恰好用 `**...**` 标出 3 处：开头黄色短结论，加上 2 个来源支持的关键能力、精确数字、限制或反常结果；作者名、媒体名、情绪反应、空泛评价和来源标签不得染黄。较短专业栏目保留 2-3 处，每处 2-12 个字符，链接文字保持蓝色且不要同时加粗",
        "- 任何带有 `Placement Hint: This is a welfare/freebie item` 的素材，或明显属于福利/羊毛/免费额度/优惠/coupon/discount/free/credit 的素材，严禁进入今日焦点；没有官方说明或可复核步骤时直接不用",
        "- 任何带有 `Placement Hint: This is a low-evidence AI workflow pitch` 的素材，来自指定 Folo 源的低证据短视频/副业/带货/涨粉类强承诺内容，严禁进入 TOP；素材充足时直接不用",
        "- 今日焦点最多 1 个 GitHub 项目；今日焦点和开源 TOP 中只要出现 GitHub 仓库链接，都必须来自 `Source: GitHub Trending Daily` 或对应 Placement Hint，媒体或社媒顺手提到的非日榜仓库不能使用",
        "- FAQ 每天必须有 1 条；问题要像真实搜索问句。涉及模型价格、额度或可用性时必须有输入中的官方来源，第一段先直接回答并可用三行以内对比表说明限制；第二段固定写：需要进一步比较当前公开的 AI 账号或订阅服务时，可查看 [**爱窝啦·AI账号店**](https://www.aivora.cn/)；商品、价格与可用状态以官网实时页面为准。正文只允许这 1 个主站链接，不得加 UTM、猜测商品 URL，也不得写成直接体验、统一访问、省去逐个注册、工具导航、官方入口或免注册聚合站",
        "- 允许从最近 2 天内补位，但不要解释日期过滤、候选编号、候选数量、淘汰原因或为什么条目变少",
        "- 不要写“我看了一下今天的素材”“今天新闻不够”“今日合格素材共几条”“TOP 候选几属于非 AI”“实际只能输出几条”“按照日期过滤规则”“根据容错机制”“素材质量参差不齐”这类句子",
        "- 直接输出可发布成稿，不要输出任何元话术",
        "",
        "下面是原始素材：",
        basePromptInput,
        "",
        "下面是上一次不合格输出，仅供你纠错参考：",
        invalidMarkdown || "(空)",
        "",
        "输出前做最后一次逐项检查：",
        duplicateSourceChecklist,
        `- 主候选和去重备用合计充足时，今日焦点必须保持 ${DAILY_TOP_TARGET} 条；两者各自最多使用一次，专用区素材不得回流凑数`,
        "- 来源名称必须留在链接外；链接只包住核心事实，不得使用“AIBase 对这项消息的报道”或“宝玉整理的技术细节”一类来源标签",
        "- 今日焦点每条正文必须有 3 个短高亮：1 个开头结论和 2 个事实重点；长句拆成短句，不得通过删除事实来缩短",
        "检查完成后仍然只输出 Markdown 成稿，不要附检查报告。",
    ].join('\n');
}

function getDailyBodyGenerationEnv(env) {
    const maxTokens = String(env.DAILY_ANTHROPIC_MAX_TOKENS || '').trim();
    if (!maxTokens) return env;

    return {
        ...env,
        ANTHROPIC_MAX_TOKENS: maxTokens,
    };
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

export async function handleScheduledCombined(event, env, ctx, specifiedDate = null) {
    // 濡傛灉鎸囧畾浜嗘棩鏈燂紝浣跨敤鎸囧畾鏃ユ湡锛涘惁鍒欎娇鐢ㄥ綋鍓嶆棩鏈?
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
        previousDayReplayItems: 0,
        previousReplayLookbackDays: 0,
        previousDayFilteredNews: 0,
        previousDayFilteredCounts: {},
        outputHasMediaBeforeFallback: false,
        outputHasMediaAfterFallback: false,
        mismatchedTopImagesRemoved: 0,
        fallbackInserted: false,
        mediaCoverageInserted: 0,
        mediaCoverageTarget: 0,
        usableMediaAfterCoverage: 0,
        labelsVersion: 'headings-v2',
        opportunityGenerated: false,
        opportunityPublicPath: null,
        opportunityCandidateCount: 0,
        opportunityTopScore: 0,
    };

    try {
        // 1. Fetch Data
        console.log(`[Scheduled] Fetching data...`);
        const { cookie: foloCookie, source: foloCookieSource } = await resolveFoloCookie(env);
        if (foloCookie) {
            console.log(`[Scheduled] Loaded Folo cookie from ${foloCookieSource}.`);
        }

        const allUnifiedData = await fetchAllData(env, foloCookie);
        const { previousDate, items: previousTopItems } = await loadPreviousTopItems(env, dateStr);
        debugInfo.previousDayReplayDate = previousDate;
        debugInfo.previousDayTopItems = previousTopItems.length;

        if (Array.isArray(allUnifiedData.news) && allUnifiedData.news.length > 0 && previousTopItems.length > 0) {
            const { filteredNewsItems, filteredCount } = filterNewsAgainstPreviousTop(allUnifiedData.news, previousTopItems);
            allUnifiedData.news = filteredNewsItems;
            debugInfo.previousDayFilteredNews = filteredCount;
            console.log(`[Scheduled] Filtered ${filteredCount} repeated news items from previous daily ${previousDate}.`);
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
            dailyFunContentItems,
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
        debugInfo.dailyFunCandidateItems = Array.isArray(dailyFunContentItems) ? dailyFunContentItems.length : 0;

        if (selectedContentItems.length === 0) {
            console.log(`[Scheduled] No items found. Skipping generation.`);
            return;
        }

        // 3. Generate Content (Call 2)
        console.log(`[Scheduled] Generating content...`);
        let fullPromptForCall2_System = getSystemPromptSummarizationStepOne(dateStr);
        let fullPromptForCall2_User = buildDailyGenerationPromptInput(
            selectedContentItems,
            dailyFunContentItems
        );
        
        let outputOfCall2 = await generateContentWithTransportFallback(env, fullPromptForCall2_User, fullPromptForCall2_System);
        outputOfCall2 = removeMarkdownCodeBlock(outputOfCall2);
        outputOfCall2 = convertPlaceholdersToMarkdownImages(outputOfCall2);
        debugInfo.outputHasMediaBeforeFallback = containsRenderedMedia(outputOfCall2);
        const mediaCoverage = ensureDailyMediaCoverage(outputOfCall2, mediaCandidates);
        outputOfCall2 = mediaCoverage.markdown;
        debugInfo.fallbackInserted = mediaCoverage.insertedCount > 0;
        debugInfo.mediaCoverageInserted = mediaCoverage.insertedCount;
        debugInfo.mediaCoverageTarget = mediaCoverage.targetCount;
        debugInfo.usableMediaAfterCoverage = mediaCoverage.usableMediaCount;
        debugInfo.outputHasMediaAfterFallback = containsRenderedMedia(outputOfCall2);
        // 鏇挎崲閿欒鐨勫煙鍚嶉摼鎺?
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
            `## 候选主题\n\n${opportunityCandidatesText}`,
            `## 今日摘要\n\n${outputOfCall3}`,
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
        opportunityMarkdownContent = `## ⚡ 快速导航\n\n- [🎯 今日主推](#今日主推) - 今天最值得先试的机会\n- [🧪 本周可试](#本周可试) - 适合先低成本测试的方向\n- [🚫 今天别碰](#今天别碰) - 看着热，但不建议小白跟进\n- [🗺️ 地图感](#地图感) - 知道就行的背景概念\n- [✅ 今日动作](#今日动作) - 今天先发什么、先卖什么\n\n${opportunityMarkdownContent}`;
        debugInfo.opportunityGenerated = true;

        // 6. Assemble Markdown
        let dailySummaryMarkdownContent = assembleDailySummaryMarkdown(outputOfCall2, outputOfCall3, env);
        dailySummaryMarkdownContent = insertOpportunityLinkIntoDailyNavigation(
            dailySummaryMarkdownContent,
            opportunityPaths.publicPath,
        );

        // 7. Commit to GitHub
        console.log(`[Scheduled] Committing to GitHub...`);
        const yearMonth = getYearMonth(dateStr);
        const dailyFilePath = `daily/${dateStr}.md`;
        const dailyPagePath = `content/cn/${yearMonth}/${dateStr}.md`;
        const monthDirectoryIndexPath = `content/cn/${yearMonth}/_index.md`;
        const homePath = 'content/cn/_index.md';

        const dailyPageTitle = `${env.DAILY_TITLE} ${formatDateToChinese(dateStr)}`;
        const dailyPageContent = buildDailyContentWithFrontMatter(dateStr, dailySummaryMarkdownContent, { title: dailyPageTitle });
        const opportunityTitleBase = env.DAILY_TITLE.includes('日报')
            ? env.DAILY_TITLE.replace('日报', '商机')
            : `${env.DAILY_TITLE} 商机`;
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
                title: DEFAULT_OPPORTUNITY_SECTION_TITLE,
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
        sourceItemCounts: {},
        sourceItemCountsAfterReplayFilter: {},
        totalSourceItemCount: 0,
        itemsWithMedia: 0,
        itemsWithoutMedia: 0,
        mediaCandidates: 0,
        previousDayReplayDate: null,
        previousDayTopItems: 0,
        previousDayReplayItems: 0,
        previousReplayLookbackDays: 0,
        previousDayFilteredNews: 0,
        previousDayFilteredCounts: {},
        outputHasMediaBeforeFallback: false,
        outputHasMediaAfterFallback: false,
        mismatchedTopImagesRemoved: 0,
        fallbackInserted: false,
        mediaCoverageInserted: 0,
        mediaCoverageTarget: 0,
        usableMediaAfterCoverage: 0,
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
        opportunityQualitySkipped: false,
        opportunityDryRun: false,
        opportunityWouldPublish: false,
        opportunityRejectedCandidateCount: 0,
        opportunityAivoraLinksKept: 0,
        opportunityAivoraLinksRemoved: 0,
        accountOpportunityGenerated: false,
        accountOpportunityPublished: false,
        accountOpportunityValidationPassed: false,
        accountOpportunityValidationIssues: [],
        accountOpportunityPublicPath: null,
        accountOpportunityCandidateCount: 0,
        accountOpportunityTopScore: 0,
    };
}

async function reportScheduledProgress(options, task, phase, progress, details = {}) {
    if (typeof options?.reportProgress !== 'function') return;

    try {
        await options.reportProgress(phase, {
            task,
            progress,
            ...details,
        });
    } catch (error) {
        console.warn(
            `[Scheduled][${task}] Failed to report ${phase} progress: ${error?.message || String(error)}`
        );
    }
}

function countUnifiedDataItems(allUnifiedData) {
    return Object.entries(allUnifiedData || {}).reduce((counts, [sourceType, items]) => {
        counts[sourceType] = Array.isArray(items) ? items.length : 0;
        return counts;
    }, {});
}

function sumItemCounts(counts) {
    return Object.values(counts || {}).reduce((total, count) => total + (Number(count) || 0), 0);
}

async function loadFoloCookie(env) {
    const { cookie: foloCookie, source } = await resolveFoloCookie(env);
    if (foloCookie) {
        console.log(`[Scheduled] Loaded Folo cookie from ${source}.`);
    }

    return foloCookie;
}

async function loadCachedUnifiedData(env, dateStr, options = {}) {
    const allUnifiedData = {};
    let hasAnyCachedItems = false;
    const missingSourceTypes = [];

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
                missingSourceTypes.push(sourceType);
            }
        } catch (error) {
            console.warn(`[Scheduled] Failed to load cached ${sourceType} data for ${dateStr}: ${error.message}`);
            allUnifiedData[sourceType] = [];
            missingSourceTypes.push(sourceType);
        }
    }

    if (options.requireAllSourceTypes && missingSourceTypes.length > 0) {
        if (options.debugInfo) {
            options.debugInfo.cachedDailyMissingSourceTypes = missingSourceTypes;
        }
        console.log(`[Scheduled] Cached source data for ${dateStr} is incomplete: ${missingSourceTypes.join(', ')}.`);
        return null;
    }

    return hasAnyCachedItems ? allUnifiedData : null;
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
            const mediaPlaceholders = extractMediaPlaceholdersFromHtml(item.details?.content_html);
            const itemHasMedia = mediaPlaceholders.length > 0;
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
                    itemText = `socialMedia Post by ${item.authors}锛歅ublished: ${item.published_date}\nUrl: ${item.url}\nContent: ${truncatePromptText(stripHtml(item.details.content_html))}`;
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
        allUnifiedData = await loadCachedUnifiedData(env, dateStr, {
            requireAllSourceTypes: true,
            debugInfo,
        });
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

    debugInfo.sourceItemCounts = countUnifiedDataItems(allUnifiedData);
    debugInfo.totalSourceItemCount = sumItemCounts(debugInfo.sourceItemCounts);

    const replayLookbackDays = Math.max(1, Number.parseInt(env.DAILY_REPLAY_LOOKBACK_DAYS || '3', 10) || 3);
    const { previousDate, items: previousTopItems, allItems: previousDailyItems = [] } = await loadPreviousTopItems(
        env,
        dateStr,
        replayLookbackDays
    );
    let previousOpportunityDate = null;
    let previousOpportunityReplaySignals = { matchedRuleIds: [], matchedTerms: [], primaryLane: null };
    let recentOpportunityReplayMemory = createEmptyOpportunityReplayMemory();
    let recentOpportunityReplayLoadedCount = 0;
    let recentOpportunityReplayMissingCount = 0;
    let opportunityReplayLookbackDays = 0;
    let opportunityReplayLoadedFromKv = false;

    if (options.loadOpportunityReplay) {
        const replay = await loadRecentOpportunityReplayMemory(env, dateStr, {
            lookbackDays: env.OPPORTUNITY_REPLAY_LOOKBACK_DAYS || DEFAULT_OPPORTUNITY_REPLAY_LOOKBACK_DAYS,
            includeCurrentOpportunity: Boolean(options.includeCurrentOpportunityReplay),
        });
        previousOpportunityDate = replay.previousDate;
        previousOpportunityReplaySignals = replay.previousMainTopicSignals;
        recentOpportunityReplayMemory = replay.memory;
        recentOpportunityReplayLoadedCount = replay.loadedCount;
        recentOpportunityReplayMissingCount = replay.missingCount;
        opportunityReplayLookbackDays = replay.lookbackDays;
        opportunityReplayLoadedFromKv = replay.loadedFromKv;
    }

    debugInfo.previousDayReplayDate = previousDate;
    debugInfo.previousDayTopItems = previousTopItems.length;
    debugInfo.previousDayReplayItems = previousDailyItems.length;
    debugInfo.previousReplayLookbackDays = replayLookbackDays;
    debugInfo.previousOpportunityReplayDate = previousOpportunityDate;
    debugInfo.previousOpportunityReplayRules =
        previousOpportunityReplaySignals.matchedRuleIds?.length || 0;
    debugInfo.opportunityReplayLookbackDays = opportunityReplayLookbackDays;
    debugInfo.opportunityReplayLoadedFromKv = opportunityReplayLoadedFromKv;
    debugInfo.opportunityReplayLoadedFiles = recentOpportunityReplayLoadedCount;
    debugInfo.opportunityReplayMissingFiles = recentOpportunityReplayMissingCount;
    debugInfo.opportunityReplayMemoryStats = getOpportunityReplayMemoryStats(recentOpportunityReplayMemory);

    const replayItems = previousDailyItems.length > 0 ? previousDailyItems : previousTopItems;
    if (replayItems.length > 0) {
        debugInfo.previousDayFilteredCounts = {};
        for (const sourceType in allUnifiedData) {
            if (!Object.hasOwnProperty.call(allUnifiedData, sourceType)) continue;

            const { filteredItems, filteredCount } = filterItemsAgainstPreviousDaily(allUnifiedData[sourceType], replayItems);
            allUnifiedData[sourceType] = filteredItems;
            debugInfo.previousDayFilteredCounts[sourceType] = filteredCount;
            if (sourceType === 'news') {
                debugInfo.previousDayFilteredNews = filteredCount;
            }
        }
    }
    debugInfo.sourceItemCountsAfterReplayFilter = countUnifiedDataItems(allUnifiedData);

    if (options.applyGithubTopProjectDedupe && Array.isArray(allUnifiedData.project)) {
        const recentGithubTopProjects = await loadRecentGithubTopProjects(env.DATA_KV);
        const {
            filteredItems,
            filteredCount,
            filteredExactCount,
            filteredFamilyCount,
        } = filterGithubProjectsAgainstRecentTop(
            allUnifiedData.project,
            recentGithubTopProjects,
            dateStr,
            env.DAILY_GITHUB_TOP_PROJECT_DEDUPE_DAYS || 7
        );
        allUnifiedData.project = filteredItems;
        debugInfo.recentGithubTopProjectCount = recentGithubTopProjects.length;
        debugInfo.recentGithubTopProjectFiltered = filteredCount;
        debugInfo.recentGithubTopProjectExactFiltered = filteredExactCount;
        debugInfo.recentGithubTopProjectFamilyFiltered = filteredFamilyCount;
    }

    if (!options.skipSourceCacheWrite && (!options.preferCachedData || !debugInfo.usedCachedDailySourceData)) {
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
        recentOpportunityReplayMemory,
        ...buildDailyPromptSelection(allUnifiedData, env),
    };
}

async function generateDailyMarkdown(env, dateStr, selectedContentItems, mediaCandidates, debugInfo, options = {}) {
    if (selectedContentItems.length === 0) {
        throw new Error('No content items found for daily generation.');
    }

    const dailyBodyGenerationEnv = getDailyBodyGenerationEnv(env);
    debugInfo.dailyBodyAnthropicMaxTokens = Number.parseInt(
        String(dailyBodyGenerationEnv.ANTHROPIC_MAX_TOKENS || ''),
        10
    ) || null;
    console.log(`[Scheduled][Daily] Generating content...`);
    const outputOfCall2System = getSystemPromptSummarizationStepOne(dateStr);
    const outputOfCall2User = buildDailyGenerationPromptInput(
        selectedContentItems,
        options.dailyFunContentItems
    );

    let outputOfCall2 = await generateContentWithTransportFallback(
        dailyBodyGenerationEnv,
        outputOfCall2User,
        outputOfCall2System
    );
    outputOfCall2 = removeMarkdownCodeBlock(outputOfCall2);
    outputOfCall2 = convertPlaceholdersToMarkdownImages(outputOfCall2);
    outputOfCall2 = normalizeMarkdownImageSyntax(outputOfCall2);
    debugInfo.outputHasMediaBeforeFallback = containsRenderedMedia(outputOfCall2);
    const cleanedOutput = repairDailyMediaReferences(outputOfCall2, mediaCandidates);
    outputOfCall2 = cleanedOutput.markdown;
    debugInfo.mismatchedTopImagesRemoved += cleanedOutput.correctedCount + cleanedOutput.removedCount;
    const mediaCoverage = ensureDailyMediaCoverage(outputOfCall2, mediaCandidates);
    outputOfCall2 = mediaCoverage.markdown;
    debugInfo.fallbackInserted = mediaCoverage.insertedCount > 0;
    debugInfo.mediaCoverageInserted = mediaCoverage.insertedCount;
    debugInfo.mediaCoverageTarget = mediaCoverage.targetCount;
    debugInfo.usableMediaAfterCoverage = mediaCoverage.usableMediaCount;
    debugInfo.outputHasMediaAfterFallback = containsRenderedMedia(outputOfCall2);
    outputOfCall2 = replaceIncorrectDomainLinks(outputOfCall2, env.BOOK_LINK ? new URL(env.BOOK_LINK).hostname : 'news.aivora.cn');

    console.log(`[Scheduled][Daily] Generating summary...`);
    let outputOfCall3 = await generateContentWithTransportFallback(env, outputOfCall2, getSystemPromptSummarizationStepThree());
    outputOfCall3 = removeMarkdownCodeBlock(outputOfCall3);

    let dailySummaryMarkdownContent = assembleDailySummaryMarkdown(outputOfCall2, outputOfCall3, env);
    dailySummaryMarkdownContent = sanitizeDuplicateDailySections(dailySummaryMarkdownContent);
    dailySummaryMarkdownContent = ensureUniqueDailyTopSources(dailySummaryMarkdownContent);
    dailySummaryMarkdownContent = enforceDailyTopGithubLimit(dailySummaryMarkdownContent);
    dailySummaryMarkdownContent = removeEmptyDailyTopicSections(dailySummaryMarkdownContent);
    dailySummaryMarkdownContent = removeEmptyDailyFunSection(dailySummaryMarkdownContent);
    dailySummaryMarkdownContent = normalizeDailyOutputPresentation(dailySummaryMarkdownContent);
    const dailyValidationOptions = {
        minimumTopItems: options.minimumTopItems || 0,
        hardMinimumTopItems: options.hardMinimumTopItems,
        minimumOpenSourceItems: options.minimumOpenSourceItems || 0,
        minimumSocialItems: options.minimumSocialItems || 0,
        minimumResearchItems: options.minimumResearchItems || 0,
        minimumIndustryItems: options.minimumIndustryItems || 0,
        minimumTopicSections: options.minimumTopicSections || 0,
        allowedTopGithubProjectUrls: options.allowedTopGithubProjectUrls || [],
        enforceTopGithubProjectAllowlist: true,
    };
    const validateGeneratedDaily = (summaryText, pageMarkdown) => validateDailyPublication({
        summaryText,
        pageMarkdown,
        ...dailyValidationOptions,
    });
    const getQualityTargetWarnings = (result) => (result?.warnings || [])
        .filter((warning) => /below target|reuses the same source URL|must contain at most one GitHub|dense long sentences|generic source-only link labels|awkward source-led or overlong link anchors|too few short highlights|too sparse for quick reading/i.test(warning));
    let validation = validateDailyPublication({
        summaryText: outputOfCall3,
        pageMarkdown: dailySummaryMarkdownContent,
        ...dailyValidationOptions,
    });
    const hasDedicatedDailyFunCandidates = outputOfCall2User.includes('【AI趣闻专用候选素材】');
    const initialDailyFunStats = getDailyFunSectionStats(dailySummaryMarkdownContent);
    debugInfo.dailyFunCandidatesInPrompt = hasDedicatedDailyFunCandidates;
    debugInfo.dailyFunSectionPresentBeforeRepair = initialDailyFunStats.present;

    const initialQualityTargetWarnings = getQualityTargetWarnings(validation);
    if (!validation.ok || initialQualityTargetWarnings.length > 0) {
        const initialValidation = validation;
        const repairIssues = [...validation.issues, ...initialQualityTargetWarnings];
        console.warn(
            `[Scheduled][Daily] First draft needs repair, retrying: ${repairIssues.join(' | ')}`
        );
        let repairedOutputOfCall2 = await generateContentWithTransportFallback(
            dailyBodyGenerationEnv,
            buildDailyRepairPrompt(outputOfCall2User, outputOfCall2, repairIssues, dateStr),
            outputOfCall2System
        );
        repairedOutputOfCall2 = removeMarkdownCodeBlock(repairedOutputOfCall2);
        repairedOutputOfCall2 = convertPlaceholdersToMarkdownImages(repairedOutputOfCall2);
        repairedOutputOfCall2 = normalizeMarkdownImageSyntax(repairedOutputOfCall2);
        const cleanedRepairedOutput = repairDailyMediaReferences(repairedOutputOfCall2, mediaCandidates);
        repairedOutputOfCall2 = cleanedRepairedOutput.markdown;
        debugInfo.mismatchedTopImagesRemoved += cleanedRepairedOutput.correctedCount + cleanedRepairedOutput.removedCount;
        const repairedMediaCoverage = ensureDailyMediaCoverage(repairedOutputOfCall2, mediaCandidates);
        repairedOutputOfCall2 = repairedMediaCoverage.markdown;
        debugInfo.mediaCoverageInserted = repairedMediaCoverage.insertedCount;
        debugInfo.mediaCoverageTarget = repairedMediaCoverage.targetCount;
        debugInfo.usableMediaAfterCoverage = repairedMediaCoverage.usableMediaCount;
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
        repairedDailySummaryMarkdownContent = sanitizeDuplicateDailySections(repairedDailySummaryMarkdownContent);
        repairedDailySummaryMarkdownContent = ensureUniqueDailyTopSources(repairedDailySummaryMarkdownContent);
        repairedDailySummaryMarkdownContent = enforceDailyTopGithubLimit(repairedDailySummaryMarkdownContent);
        repairedDailySummaryMarkdownContent = removeEmptyDailyTopicSections(repairedDailySummaryMarkdownContent);
        repairedDailySummaryMarkdownContent = removeEmptyDailyFunSection(repairedDailySummaryMarkdownContent);
        repairedDailySummaryMarkdownContent = normalizeDailyOutputPresentation(repairedDailySummaryMarkdownContent);
        const repairedValidation = validateGeneratedDaily(
            repairedOutputOfCall3,
            repairedDailySummaryMarkdownContent
        );
        const repairedQualityTargetWarnings = getQualityTargetWarnings(repairedValidation);
        const adoptRepair = shouldAdoptDailyRepair({
            initialPassed: initialValidation.ok,
            repairedPassed: repairedValidation.ok,
            initialQualityWarningCount: initialQualityTargetWarnings.length,
            repairedQualityWarningCount: repairedQualityTargetWarnings.length,
            initialQualityWarnings: initialQualityTargetWarnings,
            repairedQualityWarnings: repairedQualityTargetWarnings,
            initialTopItemCount: extractNumberedDailyItems(dailySummaryMarkdownContent).length,
            repairedTopItemCount: extractNumberedDailyItems(repairedDailySummaryMarkdownContent).length,
            targetTopItemCount: options.minimumTopItems || 0,
        });

        if (adoptRepair) {
            outputOfCall2 = repairedOutputOfCall2;
            outputOfCall3 = repairedOutputOfCall3;
            dailySummaryMarkdownContent = repairedDailySummaryMarkdownContent;
            validation = repairedValidation;
        }
        debugInfo.dailyRepairAttempted = true;
        debugInfo.dailyRepairPassed = repairedValidation.ok;
        debugInfo.dailyRepairAdopted = adoptRepair;
        debugInfo.dailyRepairMetQualityTargets = repairedQualityTargetWarnings.length === 0;
        debugInfo.dailyRepairIssues = repairedValidation.issues;
        debugInfo.dailyRepairWarnings = repairedValidation.warnings || [];
    }

    const funStatsBeforeStandaloneGeneration = getDailyFunSectionStats(dailySummaryMarkdownContent);
    if (validation.ok && hasDedicatedDailyFunCandidates && !funStatsBeforeStandaloneGeneration.present) {
        const standaloneDailyFunCandidates = selectStandaloneDailyFunCandidates(
            dailySummaryMarkdownContent,
            options.dailyFunContentItems,
            5
        );
        const standaloneDailyFunPrompt = buildStandaloneDailyFunPromptInput(dateStr, standaloneDailyFunCandidates);

        debugInfo.dailyFunSeparateGenerationAttempted = Boolean(standaloneDailyFunPrompt);
        debugInfo.dailyFunSeparateCandidateItems = standaloneDailyFunCandidates.length;

        if (standaloneDailyFunPrompt) {
            try {
                let standaloneDailyFunSection = await generateContentWithTransportFallback(
                    env,
                    standaloneDailyFunPrompt,
                    getStandaloneDailyFunSystemPrompt()
                );
                standaloneDailyFunSection = removeMarkdownCodeBlock(standaloneDailyFunSection);
                standaloneDailyFunSection = normalizeStandaloneDailyFunSection(standaloneDailyFunSection);

                debugInfo.dailyFunSeparateGenerationValid = Boolean(standaloneDailyFunSection);

                if (standaloneDailyFunSection) {
                    const markdownWithStandaloneFun = insertDailyFunSection(
                        dailySummaryMarkdownContent,
                        standaloneDailyFunSection
                    );
                    const validationWithStandaloneFun = validateGeneratedDaily(
                        outputOfCall3,
                        markdownWithStandaloneFun
                    );

                    if (validationWithStandaloneFun.ok) {
                        dailySummaryMarkdownContent = markdownWithStandaloneFun;
                        validation = validationWithStandaloneFun;
                        debugInfo.dailyFunSeparateGenerationInserted = true;
                    } else {
                        debugInfo.dailyFunSeparateGenerationInserted = false;
                        debugInfo.dailyFunSeparateGenerationRejectedIssues = validationWithStandaloneFun.issues;
                    }
                }
            } catch (error) {
                console.warn(`[Scheduled][Daily] Standalone AI fun generation failed: ${error.message}`);
                debugInfo.dailyFunSeparateGenerationError = error.message;
            }
        }
    }

    dailySummaryMarkdownContent = normalizeMarkdownImageSyntax(dailySummaryMarkdownContent);
    dailySummaryMarkdownContent = normalizeDailyOutputPresentation(dailySummaryMarkdownContent);
    const dailyFunStats = getDailyFunSectionStats(dailySummaryMarkdownContent);
    debugInfo.dailyFunSectionPresent = dailyFunStats.present;
    debugInfo.dailyFunSectionSourceLinks = dailyFunStats.sourceLinkCount;
    debugInfo.dailyGenerated = true;

    return { outputOfCall3, dailySummaryMarkdownContent, validation };
}

function buildOpportunitySourceDigest(
    candidates,
    maxCandidates = 3,
    maxItemsPerCandidate = 2,
    options = {}
) {
    const profile = options.profile || 'account';
    const visibleCandidates = (candidates || []).slice(0, maxCandidates);
    if (visibleCandidates.length === 0) {
        return '今天候选主题较弱，请保守输出，不要硬凑热门。';
    }

    return visibleCandidates.map((candidate) => {
        const supportingText = (candidate.supportingItems || [])
            .slice(0, maxItemsPerCandidate)
            .map((item, index) => {
                const title = item.title || item.source || '未命名素材';
                const linkedTitle = item.url ? `[${title}](${item.url})` : title;
                return `${index + 1}. ${linkedTitle} - ${item.description || item.plainText || '无'}`;
            })
            .join('\n');

        const evidenceCheckText = (candidate.officialEvidenceChecks || [])
            .map((check) => check.checked
                ? check.summary || '已完成确定性来源核验'
                : `核验失败，不得据此断言原文缺少官方链接：${check.error || '未知错误'}`)
            .join('；');
        const commonLines = [
            `### ${candidate.label}`,
            `- 证据强度: ${candidate.evidenceStrength}`,
            `- 证据缺口: ${(candidate.evidenceGaps || []).join('；') || '暂无明显缺口'}`,
            `- 机会实体: ${candidate.entityKey}`,
            `- 商业模式: ${candidate.businessModel}`,
            `- 交付类型: ${candidate.deliveryType}`,
            evidenceCheckText ? `- 官方链接核验: ${evidenceCheckText}` : '',
        ].filter(Boolean);

        if (profile === 'general') {
            return [
                ...commonLines,
                `- 读者交付家族: ${candidate.offerFamily || '未分类'}`,
                `- 优先交付方向: ${candidate.preferredLaneName}`,
                `- 最小交付角度: ${candidate.productAngle || '先定义一个固定范围、可验收的小结果'}`,
                `- 目标鱼塘提示: ${candidate.buyerHint || '先缩到同一职业、同一高频任务'}`,
                `- 可验收交付: ${candidate.deliveryHint || '写清结果、边界和不包含项'}`,
                `- 48 小时触达: ${candidate.channelHint || '访谈同一鱼塘的 3-5 位用户'}`,
                `- 标题写法: ${candidate.titleHint || '先写目标用户和可验收结果'}`,
                `- 不要主写: ${candidate.avoidLeadHint || '不要把技术热度写成付费需求'}`,
                `- 证据片段:\n${supportingText || '- 无'}`,
            ].join('\n');
        }

        return [
            ...commonLines,
            `- 优先卖法: ${candidate.preferredLaneName}`,
            `- 商品化角度: ${candidate.productAngle || '先写今天能卖的商品，再补技术解释'}`,
            `- 更适合成交给: ${candidate.buyerHint || '优先写成中文新手也能买懂的商品'}`,
            `- 你能交付: ${candidate.deliveryHint || '写清楚交付内容，不要只写热点'}`,
            `- 更适合发到: ${candidate.channelHint || '群里、朋友圈、商品页'}`,
            `- 标题写法: ${candidate.titleHint || '先写结果或场景，再写工具名'}`,
            `- 不要主写: ${candidate.avoidLeadHint || '不要把技术热闹、stars、安装量写成主卖点'}`,
            `- 建议形式: ${candidate.sellFormats.join('、') || '按热点灵活处理'}`,
            `- 证据片段:\n${supportingText || '- 无'}`,
        ].join('\n');
    }).join('\n\n');
}

function buildRejectedOpportunityDigest(candidates, maxCandidates = 3) {
    const visibleCandidates = (candidates || []).slice(0, maxCandidates);
    if (visibleCandidates.length === 0) {
        return '今天没有额外需要点名的弱证据方向。';
    }

    return visibleCandidates.map((candidate) => {
        const source = candidate.supportingItems?.[0];
        const sourceTitle = source?.title || source?.source || candidate.label;
        const linkedSource = source?.url ? `[${sourceTitle}](${source.url})` : sourceTitle;
        const evidenceChecks = (candidate.officialEvidenceChecks || [])
            .map((check) => check.checked
                ? check.summary || '已完成来源核验'
                : `核验失败，只能写“本次候选未提供”，不能断言原文没有官方来源`)
            .join('；');
        return [
            `- ${linkedSource}`,
            `  - 拒绝原因: ${(candidate.rejectionReasons || []).join('；') || '未达到发布门槛'}`,
            evidenceChecks ? `  - 官方链接核验: ${evidenceChecks}` : '',
        ].filter(Boolean).join('\n');
    }).join('\n');
}

function collectOpportunityValidationRecords(candidates = []) {
    const records = [];
    const seen = new Set();

    for (const candidate of candidates || []) {
        for (const item of candidate.supportingItems || []) {
            if (!item?.url || seen.has(item.url)) continue;
            seen.add(item.url);
            records.push({
                url: item.url,
                tier: item.evidence?.tier || 'unknown',
                isPrimary: Boolean(item.evidence?.isPrimary),
                reason: item.evidence?.reason || '',
            });
        }
    }

    return records;
}

function buildOpportunityValidationContext(
    qualifiedCandidates = [],
    rejectedCandidates = []
) {
    const qualifiedRecords = collectOpportunityValidationRecords(qualifiedCandidates);
    const rejectedRecords = collectOpportunityValidationRecords(rejectedCandidates);
    const sourceEvidence = collectOpportunityValidationRecords([
        ...qualifiedCandidates,
        ...rejectedCandidates,
    ]);

    return {
        allowedSourceUrls: qualifiedRecords.map((record) => record.url),
        allowedRejectedSourceUrls: rejectedRecords.map((record) => record.url),
        sourceEvidence,
    };
}

function buildOpportunityRepairPrompt(basePromptInput, invalidMarkdown, validationIssues) {
    return [
        "你上一次 AI 商机草稿没有通过发布校验。请只基于原始候选重写，不要补新事实。",
        "上一次输出存在这些问题：",
        ...(validationIssues || []).map((issue) => `- ${issue}`),
        "",
        "请严格遵守以下规则：",
        "- 只输出 Markdown 正文，不要输出前言、说明或额外解释",
        "- 页面模板已经提供唯一 H1；正文不得输出一级标题，只包含：## 直接结论 / ## 今日主推 / ## 本周小试 / ## 今天别碰 / ## 今日三步",
        "- `###` 标题必须是纯文本；来源只放在 `证据来源` 字段中",
        "- 每个机会的证据字段必须在同一个列表项、同一行内包含至少 1 个 Markdown 链接，且 URL 必须来自下面原始候选；不要把链接另起一行",
        "- 今日主推只用六组字段：证据与可信度、鱼塘与笨办法、最小交付、48小时验证、第一单与复购、风险与停止；证据链接和缺口合并写在第一组，售后/合规风险和停止条件合并写在最后一组",
        "- 本周小试每个候选包含：证据来源、目标鱼塘、最小交付、48小时验证、为什么只是小试、停止条件",
        "- 所有用户痛点、频率、市场缺口和付费意愿只能写成待验证假设，相关句子必须明确包含：待验证假设、可能、如果、若、需要验证或有待验证",
        "- 输入没有“发布模式: 观察”时不得输出“今天没有新的差异化商机，不凑数。”，必须保留至少一个最小样品与 48 小时验证",
        "- 直接结论约 140-220 字，今日主推约 420-700 字，每个本周小试约 180-320 字，今日三步合计约 100-180 字；每个字段只回答一件事",
        "- 硬上限按含 Markdown 的字符数计算：直接结论 360、今日主推单条 1100、本周小试单条 650、今日三步 520；必须留出余量，不要贴线写",
        "- 今日主推开场最多 2 个短句，不复述项目 README，不在多个字段重复同一事实",
        "- 今日三步必须恰好 3 个一级列表项，每项只有一个完整句子且不超过 80 个中文字符；不得放链接、子列表、背景、范围、证据说明或第二句解释，只写动作、对象和可观察结果",
        "- 48 小时验证必须看到访谈、样品、真实报价或意向金等行为，不能只写发帖、挂闲鱼或录屏",
        "- 只有一个合格候选时，本周小试明确写不凑数，不得编第二个",
        "- 产品存在、功能可用或 star 增长不等于有人愿意付费；没有访谈、报价、订单或用户原话时，付费需求只能写成待验证假设",
        "- 不要写目标用户不缺、每个人都踩过、人人都需要、共同烦恼、没人提供、用户普遍遇到、只要跑通就能卖、这类人愿意直接花钱等市场绝对判断，标题也不例外",
        "- 没有实测记录时不得编造安装或交付耗时，只写记录实际耗时，不写预计 1-2 小时",
        "- 标题只写目标用户、最小交付和可验收结果；没有真实买家证据时，不得断言用户愿意付钱",
        "- 今天别碰如果点名具体方向，必须引用对应的被拒候选链接；没有被拒候选时使用默认句，不得点名",
        "- 只有候选明确标注完成官方外链核验时，才可写“本次候选输入未提取到官方链接”；禁止断言“原文没有官方链接”或“报道没有指向官方来源”",
        "- 链接文字只能描述 URL 实际指向的页面；仓库首页不能称为 LICENSE、定价页或教程的直接链接",
        "- 不要生成 aivora.cn 或 news.aivora.cn 链接",
        "- 不要出现便宜 token、风险自负、多用户商业化",
        "- 不得虚构销量、利润率、价格、政策、授权、用户反馈或确定性赚钱结果",
        "- 今日主推与本周小试不能重复同一实体、同一商业模式与交付组合或同一读者交付家族",
        "",
        "下面是原始候选素材：",
        basePromptInput,
        "",
        "下面是上一次不合格输出，仅供你纠错参考：",
        invalidMarkdown || "(空)",
    ].join('\n');
}

function buildAccountOpportunityRepairPrompt(basePromptInput, invalidMarkdown, validationIssues) {
    return [
        "你上一次 AI 账号商机草稿没有通过发布校验。请只基于原始候选重写，不要补新事实。",
        "上一次输出存在这些问题：",
        ...(validationIssues || []).map((issue) => `- ${issue}`),
        "",
        "请严格遵守以下规则：",
        "- 只输出 Markdown 正文，不要输出前言、说明或额外解释",
        "- 页面模板已经提供唯一 H1；正文不得输出一级标题，只包含：## 30 秒结论 / ## 今日硬信号 / ## 今日可执行 / ## 买家避坑 / ## 今天别碰 / ## 今日三步",
        "- `###` 行动标题必须是纯文本，来源链接只放在正文证据字段中",
        "- 每个行动标题后的第一行必须逐字以 `**判断：**` 开头；不能改成判断结论、直接判断或普通段落",
        "- 30 秒结论必须恰好写今天发生什么、今天做什么、最大风险三条",
        "- 今日可执行只写 1-2 个行动；每个行动必须包含：证据与可信度、供给形态、适合买家与真实需求、是否今天能挂闲鱼、今天最小动作、售后与合规、不能承诺与停止",
        "- 今日硬信号至少写 1 个一级列表项，每一条必须在同一行包含候选中的 Markdown 链接；没有官方价格或政策变化时，改写候选实际证明的功能或使用线索，不能留空",
        "- 功能、价格、额度、地区、支付、登录、服务状态和政策变化必须引用候选里的官方页面",
        "- 所有来源 URL 必须逐字来自下面候选；不得补充你记忆里的官方文档 URL，即使地址看起来正确；不要生成 aivora.cn 或 news.aivora.cn 链接",
        "- 链接文字必须说明页面证明了什么，禁止只写原文、来源或链接",
        "- 可信度只能写高/中/低；是否今天能挂闲鱼只能写是/否/观察；售后风险只能写低/中/高",
        "- 不得编造建议售价、闲鱼销量、搜索热度、利润率、库存、封号规模、转化率或稳定性",
        "- 不得提供共享滥用、凭据转卖、盗号、黑卡、接码、绕过验证、规避风控或破解激活建议",
        "- 不得承诺长期稳定、永不封号、官方授权或无条件可用",
        "- 今天别碰点名具体方向时只能引用被拒候选；没有被拒候选时使用默认句",
        "- 今日三步必须恰好是三个一级列表项：今天确认、今天修改、今天记录；不得放链接或子列表",
        "- 同一产品实体、供给形态、买家痛点和行动组合不得换标题重复",
        "- 输入没有标记观察模式时，必须保留至少 1 个低风险教程、FAQ、标题、选型或需求验证动作，不能因为没有官方价格变化就把整篇写成不上新观察",
        "",
        "下面是通过门槛的候选和被拒候选：",
        basePromptInput,
        "",
        "下面是上一次不合格输出，仅供你纠错参考：",
        invalidMarkdown || "(空)",
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

    const assessmentOptions = {
        profile: 'general',
        previousMainTopicSignals: options.previousMainTopicSignals || null,
        recentReplayMemory: options.recentReplayMemory || null,
        // Restore the pre-August editorial profile: source URL replay and same-day
        // entity dedupe stay in place, while broad similarity is guidance rather than a hard gate.
        enforceReplayDimensions: false,
        entityAwareGrouping: true,
        avoidGenericDuplicates: true,
        dedupeCandidateEntities: true,
    };
    const previewAssessment = buildOpportunityCandidateAssessment(
        allUnifiedData,
        opportunityPlaybook,
        {
            ...assessmentOptions,
            requireStrongEvidence: false,
        }
    );
    const evidenceCacheKey = getOpportunityEvidenceCacheKey(
        dateStr,
        previewAssessment.candidates
    );
    let evidenceEnrichment = await loadOpportunityEvidenceCache(env, evidenceCacheKey);
    if (evidenceEnrichment) {
        debugInfo.opportunityEvidenceEnrichmentCacheHit = true;
    } else {
        evidenceEnrichment = await buildOpportunityEvidenceEnrichment(
            previewAssessment.candidates.slice(0, 6),
            {
                githubToken: env.GITHUB_TOKEN || env.GH_TOKEN || '',
                maxGithubRequests: 4,
                maxTrustedMediaRequests: 2,
                timeoutMs: 8000,
            }
        );
        debugInfo.opportunityEvidenceEnrichmentCacheHit = false;
        if (!options.dryRun) {
            await storeOpportunityEvidenceCache(env, evidenceCacheKey, evidenceEnrichment);
        }
    }
    debugInfo.opportunityEvidenceEnrichment = evidenceEnrichment?.stats || {};

    const candidateAssessment = buildOpportunityCandidateAssessment(
        allUnifiedData,
        opportunityPlaybook,
        {
            ...assessmentOptions,
            requireStrongEvidence: true,
            minimumCandidateScore: 1,
            allowObservationFallback: false,
            supplementalEvidenceBySourceUrl:
                evidenceEnrichment?.recordsBySourceUrl || {},
        }
    );
    const opportunityCandidates = candidateAssessment.candidates.slice(
        0,
        opportunityPlaybook.outputRules.maxPromptCandidates || 4
    );
    const observationMode =
        opportunityCandidates.length > 0 &&
        opportunityCandidates.every((candidate) => candidate.observationOnly);
    const rejectedOpportunityCandidates = candidateAssessment.rejectedCandidates.slice(
        0,
        opportunityPlaybook.outputRules.maxDigestCandidates || 3
    );
    const validationContext = buildOpportunityValidationContext(
        opportunityCandidates,
        rejectedOpportunityCandidates
    );
    const playbookText = [
        serializeOpportunityPlaybook(opportunityPlaybook, { profile: 'general' }),
    ].join('\n\n');

    debugInfo.opportunityCandidateCount = opportunityCandidates.length;
    debugInfo.opportunityCandidateAssessment = candidateAssessment.stats;
    debugInfo.opportunityRejectedCandidateCount = candidateAssessment.rejectedCandidates.length;
    debugInfo.opportunityTopScore = opportunityCandidates[0]?.score || 0;
    debugInfo.opportunityObservationMode = observationMode;

    if (opportunityCandidates.length === 0) {
        debugInfo.opportunityQualitySkipped = true;
        debugInfo.opportunityQualitySkipReason = 'no-qualified-opportunity-candidates';
        return {
            opportunityPaths,
            opportunityMarkdownContent: '',
            validation: {
                ok: false,
                issues: ['今天没有通过一手证据、商业可操作性与 7 天去重门槛的候选'],
            },
            candidateAssessment,
            qualitySkipped: true,
        };
    }

    const opportunityCandidatesText = formatOpportunityCandidatesForPrompt(
        opportunityCandidates,
        opportunityPlaybook,
        { profile: 'general' }
    );
    const opportunitySourceDigest = buildOpportunitySourceDigest(
        opportunityCandidates,
        opportunityPlaybook.outputRules.maxDigestCandidates || 4,
        opportunityPlaybook.outputRules.maxEvidenceItemsPerCandidate || 2,
        { profile: 'general' }
    );

    console.log(`[Scheduled][Opportunity] Generating content...`);
    const replayMemoryPrompt = formatOpportunityReplayMemoryForPrompt(options.recentReplayMemory);
    const opportunityPromptInput = [
        `${observationMode ? '## 仅供观察核验的候选' : '## 有真实来源、可继续编辑的候选'}\n\n${opportunityCandidatesText}`,
        replayMemoryPrompt ? `## 近7天商机记忆\n\n${replayMemoryPrompt}` : '',
        `## 候选证据摘要\n\n${opportunitySourceDigest}`,
        `## 弱证据或重复候选（只能用于“今天别碰”）\n\n${buildRejectedOpportunityDigest(rejectedOpportunityCandidates)}`,
    ].filter(Boolean).join('\n\n');

    const opportunitySystemPrompt = getSystemPromptAiOpportunity(dateStr, playbookText);
    const aivoraLinkIntent = observationMode
        ? { eligible: false, tokens: [], cacheKey: 'observation' }
        : buildAivoraOpportunityLinkIntent(opportunityCandidates);
    let aivoraLinkPolicy = await loadAivoraOpportunityLinkPolicy(env, dateStr, {
        intent: aivoraLinkIntent,
        maxSemanticPageChecks: 2,
    });
    debugInfo.opportunityAivoraLinkRelevant = Boolean(aivoraLinkIntent.eligible);
    debugInfo.opportunityAivoraSuggestedUrl = aivoraLinkPolicy.suggestedUrl || '';
    const normalizeAndValidate = async (rawMarkdown) => {
        let markdown = removeMarkdownCodeBlock(rawMarkdown);
        markdown = stripTemplateOwnedOpportunityH1(markdown);
        markdown = convertPlaceholdersToMarkdownImages(markdown);
        markdown = replaceIncorrectDomainLinks(
            markdown,
            env.BOOK_LINK ? new URL(env.BOOK_LINK).hostname : 'news.aivora.cn'
        );
        markdown = normalizeOpportunityAvoidSection(markdown, {
            hasRejectedCandidates: rejectedOpportunityCandidates.length > 0,
        });
        markdown = normalizeOpportunityEvidenceBoundaryLanguage(markdown, {
            observationMode,
        });

        const insertedAivoraLink = insertOpportunityAivoraLink(
            markdown,
            aivoraLinkPolicy
        );
        markdown = insertedAivoraLink.markdown;
        debugInfo.opportunityAivoraLinkInserted = insertedAivoraLink.inserted;
        const sanitizedLinks = sanitizeOpportunityAivoraLinks(
            markdown,
            aivoraLinkPolicy,
            { maxLinks: 1 }
        );
        debugInfo.opportunityAivoraLinksKept = sanitizedLinks.keptCount;
        debugInfo.opportunityAivoraLinksRemoved =
            (debugInfo.opportunityAivoraLinksRemoved || 0) + sanitizedLinks.removedCount;
        const visibleMarkdown = sanitizedLinks.markdown;
        const validation = validateOpportunityPublication({
            markdown: visibleMarkdown,
            bannedPublicPhrases: opportunityPlaybook.outputRules.bannedPublicPhrases || [],
            ...validationContext,
            aivoraLinkPolicy,
            minimumOpportunityCount: 1,
            maximumOpportunityCount: opportunityPlaybook.outputRules.maxPublishedOpportunities || 4,
            observationMode,
        });
        markdown = validation.ok
            ? appendOpportunityReplayMetadata(visibleMarkdown, opportunityCandidates)
            : visibleMarkdown;
        return { markdown, validation };
    };

    const firstDraft = await generateContentWithTransportFallback(
        env,
        opportunityPromptInput,
        opportunitySystemPrompt
    );
    let normalizedDraft = await normalizeAndValidate(firstDraft);
    let opportunityMarkdownContent = normalizedDraft.markdown;
    let validation = normalizedDraft.validation;

    if (!validation.ok) {
        console.warn(
            `[Scheduled][Opportunity] First draft failed validation, retrying repair pass: ${validation.issues.join(' | ')}`
        );
        const repairedDraft = await generateContentWithTransportFallback(
            env,
            buildOpportunityRepairPrompt(
                opportunityPromptInput,
                opportunityMarkdownContent,
                validation.issues
            ),
            opportunitySystemPrompt
        );
        normalizedDraft = await normalizeAndValidate(repairedDraft);
        opportunityMarkdownContent = normalizedDraft.markdown;
        validation = normalizedDraft.validation;
    }

    debugInfo.opportunityGenerated = true;

    return {
        opportunityPaths,
        opportunityMarkdownContent,
        validation,
        candidateAssessment,
        qualitySkipped: false,
        observationMode,
        validationContext,
        aivoraLinkPolicy,
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

    const assessmentOptions = {
        profile: 'account',
        previousMainTopicSignals: options.previousMainTopicSignals || null,
        recentReplayMemory: options.recentReplayMemory || null,
        entityAwareGrouping: true,
        avoidGenericDuplicates: true,
        requireStrongEvidence: false,
    };
    const previewAssessment = buildOpportunityCandidateAssessment(
        allUnifiedData,
        accountOpportunityPlaybook,
        assessmentOptions
    );
    const overseasPreviewCandidates = previewAssessment.candidates.filter(
        (candidate) => assessAccountOpportunityMarketScope(candidate).eligible
    );
    debugInfo.accountOpportunityOutOfScopePreviewCount =
        previewAssessment.candidates.length - overseasPreviewCandidates.length;

    if (options.supplySnapshot) {
        const supplyResult = buildSupplyDrivenAccountOpportunityMarkdown({
            dateStr,
            snapshot: options.supplySnapshot,
            industryCandidates: overseasPreviewCandidates,
        });
        const allowedSupplyUrls = [
            options.supplySnapshot.source,
            ...(options.supplySnapshot.products || []).flatMap((product) => [
                product.productUrl,
                product.profitCalculatorUrl,
            ]),
        ];
        const validation = validateSupplyDrivenAccountOpportunityPublication({
            markdown: supplyResult.markdown,
            allowedSupplyUrls,
            expectedStats: options.supplySnapshot.stats,
            expectedProductSlugs: supplyResult.selectedSignals.map(
                (signal) => signal.product.slug
            ),
            expectedCoreProductSlugs: supplyResult.coreProducts.map(
                (product) => product.slug
            ),
            expectedPausedProductSlugs: supplyResult.pausedProducts.map(
                (product) => product.slug
            ),
            expectedCategories: supplyResult.categories,
            aivoraLinkPolicy: { allowedUrls: [] },
        });

        debugInfo.accountOpportunityPipelineVersion = 'supply-merchant-daily-v2';
        debugInfo.accountOpportunitySupplyDriven = true;
        debugInfo.accountOpportunityModelCalls = 0;
        debugInfo.accountOpportunityCandidateCount = overseasPreviewCandidates.length;
        debugInfo.accountOpportunityCandidateAssessment = previewAssessment.stats;
        debugInfo.accountOpportunitySelectedSupplySignals =
            supplyResult.selectedSignals.map((signal) => ({
                slug: signal.product.slug,
                kind: signal.kind,
                tone: signal.tone,
            }));
        debugInfo.accountOpportunityMerchantCoreProducts =
            supplyResult.coreProducts.map((product) => product.slug);
        debugInfo.accountOpportunityPausedSupplyProducts =
            supplyResult.pausedProducts.map((product) => product.slug);
        debugInfo.accountOpportunityMerchantCategoryCount =
            supplyResult.categories.length;
        debugInfo.accountOpportunityGenerated = true;

        return {
            accountOpportunityPaths,
            accountOpportunityMarkdownContent: supplyResult.markdown,
            validation,
            candidateAssessment: previewAssessment,
            qualitySkipped: false,
            observationMode: false,
            validationContext: null,
        };
    }

    debugInfo.accountOpportunitySupplyDriven = false;
    const evidenceCacheKey = getOpportunityEvidenceCacheKey(
        dateStr,
        overseasPreviewCandidates
    );
    let evidenceEnrichment = await loadOpportunityEvidenceCache(env, evidenceCacheKey);
    if (evidenceEnrichment) {
        debugInfo.accountOpportunityEvidenceEnrichmentCacheHit = true;
    } else {
        evidenceEnrichment = await buildOpportunityEvidenceEnrichment(
            overseasPreviewCandidates.slice(0, 6),
            {
                githubToken: env.GITHUB_TOKEN || env.GH_TOKEN || '',
                maxGithubRequests: 2,
                maxTrustedMediaRequests: 2,
                timeoutMs: 6000,
            }
        );
        debugInfo.accountOpportunityEvidenceEnrichmentCacheHit = false;
        if (!options.dryRun) {
            await storeOpportunityEvidenceCache(env, evidenceCacheKey, evidenceEnrichment);
        }
    }
    debugInfo.accountOpportunityEvidenceEnrichment = evidenceEnrichment?.stats || {};

    const rawAssessment = buildOpportunityCandidateAssessment(
        allUnifiedData,
        accountOpportunityPlaybook,
        {
            ...assessmentOptions,
            supplementalEvidenceBySourceUrl:
                evidenceEnrichment?.recordsBySourceUrl || {},
        }
    );
    const accountAssessment = qualifyAccountOpportunityCandidates(
        rawAssessment.candidates,
        accountOpportunityPlaybook,
        options.recentReplayMemory,
        {
            // Match the useful pre-August behavior: a traceable overseas signal
            // can produce a low-risk title/tutorial/FAQ experiment even when no
            // same-day price or policy change exists.
            requireOfficialChange: false,
            enforceMinimumScore: false,
            enforceReplayDimensions: false,
            dedupeCandidateEntities: true,
            dedupeCandidateSignatures: false,
            allowObservationFallback: false,
        }
    );
    const accountOpportunityCandidates = accountAssessment.candidates.slice(
        0,
        accountOpportunityPlaybook.outputRules.maxPromptCandidates || 4
    );
    const observationMode =
        accountOpportunityCandidates.length > 0 &&
        accountOpportunityCandidates.every((candidate) => candidate.observationOnly);
    const allRejectedAccountOpportunityCandidates = [
        ...accountAssessment.rejectedCandidates,
        ...rawAssessment.rejectedCandidates,
    ];
    const inScopeRejectedAccountOpportunityCandidates =
        allRejectedAccountOpportunityCandidates.filter(
            (candidate) => assessAccountOpportunityMarketScope(candidate).eligible
        );
    const rejectedAccountOpportunityCandidates =
        inScopeRejectedAccountOpportunityCandidates.slice(
            0,
            accountOpportunityPlaybook.outputRules.maxDigestCandidates || 4
        );
    debugInfo.accountOpportunityOutOfScopeCandidateCount =
        allRejectedAccountOpportunityCandidates.length -
        inScopeRejectedAccountOpportunityCandidates.length;
    const validationContext = buildOpportunityValidationContext(
        accountOpportunityCandidates,
        rejectedAccountOpportunityCandidates
    );

    debugInfo.accountOpportunityCandidateCount = accountOpportunityCandidates.length;
    debugInfo.accountOpportunityCandidateAssessment = accountAssessment.stats;
    debugInfo.accountOpportunityRejectedCandidateCount = rejectedAccountOpportunityCandidates.length;
    debugInfo.accountOpportunityTopScore = accountOpportunityCandidates[0]?.score || 0;
    debugInfo.accountOpportunityObservationMode = observationMode;

    if (accountOpportunityCandidates.length === 0) {
        debugInfo.accountOpportunityQualitySkipped = true;
        debugInfo.accountOpportunityQualitySkipReason = 'no-qualified-account-opportunity-candidates';
        return {
            accountOpportunityPaths,
            accountOpportunityMarkdownContent: '',
            validation: {
                ok: false,
                issues: ['今天没有通过账号硬信号、官方证据与 7 天去重门槛的候选'],
            },
            candidateAssessment: accountAssessment,
            qualitySkipped: true,
        };
    }

    const playbookText = serializeAccountOpportunityPlaybook(
        accountOpportunityPlaybook
    );
    const accountOpportunityCandidatesText =
        formatAccountOpportunityCandidatesForPrompt(
            accountOpportunityCandidates,
            accountOpportunityPlaybook.outputRules.maxPromptCandidates || 4
        );

    console.log(`[Scheduled][AccountOpportunity] Generating content...`);
    const accountReplayMemoryPrompt = formatOpportunityReplayMemoryForPrompt(options.recentReplayMemory);
    const accountOpportunityPromptInput = [
        `${observationMode ? '## 仅供观察核验的账号线索' : '## 有真实来源、可形成经营动作的海外账号候选'}\n\n${accountOpportunityCandidatesText}`,
        accountReplayMemoryPrompt ? `## 近7天商机记忆\n\n${accountReplayMemoryPrompt}` : '',
        `## 弱证据、重复或高风险候选（只能用于“今天别碰”）\n\n${buildRejectedAccountOpportunityDigest(rejectedAccountOpportunityCandidates)}`,
    ].filter(Boolean).join('\n\n');

    const accountOpportunitySystemPrompt = getSystemPromptAiAccountOpportunity(dateStr, playbookText);
    const aivoraLinkIntent = observationMode
        ? { eligible: false, tokens: [], cacheKey: 'account-observation' }
        : buildAivoraOpportunityLinkIntent(accountOpportunityCandidates);
    const aivoraLinkPolicy = await loadAivoraOpportunityLinkPolicy(
        options.dryRun ? { ...env, DATA_KV: null } : env,
        dateStr,
        {
            intent: aivoraLinkIntent,
            maxSemanticPageChecks: 2,
        }
    );
    debugInfo.accountOpportunityAivoraLinkRelevant = Boolean(aivoraLinkIntent.eligible);
    debugInfo.accountOpportunityAivoraSuggestedUrl = aivoraLinkPolicy.suggestedUrl || '';

    const normalizeAndValidate = (rawMarkdown) => {
        let markdown = removeMarkdownCodeBlock(rawMarkdown);
        markdown = stripTemplateOwnedOpportunityH1(markdown);
        markdown = convertPlaceholdersToMarkdownImages(markdown);
        markdown = replaceIncorrectDomainLinks(
            markdown,
            env.BOOK_LINK ? new URL(env.BOOK_LINK).hostname : 'news.aivora.cn'
        );
        markdown = normalizeOpportunityAvoidSection(markdown, {
            hasRejectedCandidates: rejectedAccountOpportunityCandidates.length > 0,
        });
        markdown = normalizeOpportunityEvidenceBoundaryLanguage(markdown);
        if (observationMode) {
            markdown = normalizeAccountOpportunityObservationMarkdown(markdown);
        } else {
            markdown = normalizeAccountOpportunityHardSignalLinks(markdown);
        }

        const insertedAivoraLink = insertAccountOpportunityAivoraLink(
            markdown,
            aivoraLinkPolicy
        );
        debugInfo.accountOpportunityAivoraLinkInserted = insertedAivoraLink.inserted;
        const sanitizedLinks = sanitizeOpportunityAivoraLinks(
            insertedAivoraLink.markdown,
            aivoraLinkPolicy,
            { maxLinks: 1 }
        );
        debugInfo.accountOpportunityAivoraLinksKept = sanitizedLinks.keptCount;
        debugInfo.accountOpportunityAivoraLinksRemoved =
            (debugInfo.accountOpportunityAivoraLinksRemoved || 0) +
            sanitizedLinks.removedCount;
        const visibleMarkdown = sanitizedLinks.markdown;
        const validation = validateAccountOpportunityPublication({
            markdown: visibleMarkdown,
            bannedPublicPhrases:
                accountOpportunityPlaybook.outputRules.bannedPublicPhrases || [],
            ...validationContext,
            aivoraLinkPolicy,
            minimumOpportunityCount: 1,
            maximumOpportunityCount:
                accountOpportunityPlaybook.outputRules.maxPublishedOpportunities || 2,
            observationMode,
            enforceOfficialFactSources: false,
        });
        markdown = validation.ok
            ? appendOpportunityReplayMetadata(
                visibleMarkdown,
                accountOpportunityCandidates
            )
            : visibleMarkdown;
        return { markdown, validation };
    };

    const firstDraft = await generateContentWithTransportFallback(
        env,
        accountOpportunityPromptInput,
        accountOpportunitySystemPrompt
    );
    let normalizedDraft = normalizeAndValidate(firstDraft);
    let accountOpportunityMarkdownContent = normalizedDraft.markdown;
    let validation = normalizedDraft.validation;

    if (!validation.ok) {
        console.warn(
            `[Scheduled][AccountOpportunity] First draft failed validation, retrying repair pass: ${validation.issues.join(' | ')}`
        );
        const repairedDraft = await generateContentWithTransportFallback(
            env,
            buildAccountOpportunityRepairPrompt(
                accountOpportunityPromptInput,
                accountOpportunityMarkdownContent,
                validation.issues
            ),
            accountOpportunitySystemPrompt
        );
        normalizedDraft = normalizeAndValidate(repairedDraft);
        validation = normalizedDraft.validation;
        accountOpportunityMarkdownContent = normalizedDraft.markdown;
    }

    debugInfo.accountOpportunityGenerated = true;

    return {
        accountOpportunityPaths,
        accountOpportunityMarkdownContent,
        validation,
        candidateAssessment: accountAssessment,
        qualitySkipped: false,
        observationMode,
        validationContext,
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
    const opportunityTitleBase = env.DAILY_TITLE.includes('日报')
        ? env.DAILY_TITLE.replace('日报', '商机')
        : `${env.DAILY_TITLE} 商机`;
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
            title: DEFAULT_OPPORTUNITY_SECTION_TITLE,
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
    const accountOpportunityPageTitle = `${DEFAULT_ACCOUNT_OPPORTUNITY_SECTION_TITLE} ${formatDateToChinese(dateStr)}`;
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
            title: DEFAULT_ACCOUNT_OPPORTUNITY_SECTION_TITLE,
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

async function storePublishedDailyGithubTopProjects(env, dateStr, dailySummaryMarkdownContent, debugInfo) {
    const newRecords = extractGithubTopProjectsFromMarkdown(dailySummaryMarkdownContent, dateStr);
    debugInfo.dailyTopGithubProjectCount = newRecords.length;
    if (newRecords.length === 0) return;

    try {
        const existingRecords = await loadRecentGithubTopProjects(env.DATA_KV);
        const mergedRecords = mergeRecentGithubTopProjects(
            existingRecords,
            newRecords,
            dateStr,
            env.DAILY_GITHUB_TOP_PROJECT_DEDUPE_DAYS || 7
        );
        await storeRecentGithubTopProjects(env.DATA_KV, mergedRecords);
        debugInfo.dailyTopGithubProjectDedupeStored = true;
        debugInfo.dailyTopGithubProjectRecentCount = mergedRecords.length;
    } catch (error) {
        debugInfo.dailyTopGithubProjectDedupeStored = false;
        debugInfo.dailyTopGithubProjectDedupeError = error.message;
        console.warn(`[Scheduled][Daily] Failed to store GitHub TOP project dedupe records: ${error.message}`);
    }
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

async function handleScheduledDailyBackup(event, env, ctx, specifiedDate = null, options = {}) {
    const dateStr = specifiedDate || getISODate();
    const yearMonth = getYearMonth(dateStr);
    await reportScheduledProgress(options, 'daily-backup', 'checking-output', 15);
    const health = await checkScheduledOutputHealth(env, {
        pagePath: `content/cn/${yearMonth}/${dateStr}.md`,
        homePath: 'content/cn/_index.md',
        expectedHomeNext: `/${yearMonth}/${dateStr}`,
    });

    if (health.healthy) {
        return buildSkippedScheduledResult(dateStr, 'daily-backup', 'daily-output-healthy', health);
    }

    return handleScheduledDaily(event, env, ctx, dateStr, options);
}

async function handleScheduledOpportunityBackup(event, env, ctx, specifiedDate = null, options = {}) {
    const dateStr = specifiedDate || getISODate();
    const opportunityPaths = buildOpportunityPaths(dateStr);
    await reportScheduledProgress(options, 'opportunity-backup', 'checking-output', 15);
    const health = await checkScheduledOutputHealth(env, {
        pagePath: opportunityPaths.pagePath,
        homePath: opportunityPaths.homePath,
        expectedHomeNext: opportunityPaths.publicPath.replace(/\/$/, ''),
    });

    if (health.healthy) {
        return buildSkippedScheduledResult(dateStr, 'opportunity-backup', 'opportunity-output-healthy', health);
    }

    return handleScheduledOpportunity(event, env, ctx, dateStr, options);
}

async function handleScheduledAccountOpportunityBackup(event, env, ctx, specifiedDate = null, options = {}) {
    const dateStr = specifiedDate || getISODate();
    const accountOpportunityPaths = buildAccountOpportunityPaths(dateStr);
    await reportScheduledProgress(options, 'account-opportunity-backup', 'checking-output', 15);
    const health = await checkScheduledOutputHealth(env, {
        pagePath: accountOpportunityPaths.pagePath,
        homePath: accountOpportunityPaths.homePath,
        expectedHomeNext: accountOpportunityPaths.publicPath.replace(/\/$/, ''),
    });

    if (health.healthy) {
        return buildSkippedScheduledResult(dateStr, 'account-opportunity-backup', 'account-opportunity-output-healthy', health);
    }

    return handleScheduledAccountOpportunity(event, env, ctx, dateStr, options);
}

async function handleScheduledBackup(event, env, ctx, specifiedDate = null, options = {}) {
    const dateStr = specifiedDate || getISODate();
    const daily = await handleScheduledDailyBackup(event, env, ctx, specifiedDate, options);
    const opportunity = await handleScheduledOpportunityBackup(event, env, ctx, specifiedDate, options);
    const accountOpportunity = await runIsolatedAccountOpportunity(
        () => handleScheduledAccountOpportunityBackup(event, env, ctx, specifiedDate, options),
        dateStr,
        'backup'
    );

    return { daily, opportunity, accountOpportunity };
}

export async function handleScheduledDailyPrefetch(event, env, ctx, specifiedDate = null, options = {}) {
    const dateStr = specifiedDate || getISODate();
    setFetchDate(dateStr);
    const debugInfo = buildBaseDebugInfo(dateStr, 'daily-prefetch');
    console.log(`[Scheduled][DailyPrefetch] Starting source prefetch for ${dateStr}${specifiedDate ? ' (specified date)' : ''}`);

    await reportScheduledProgress(options, 'daily-prefetch', 'fetching-sources', 20);
    const result = await prefetchDailySourceCategories(env, dateStr);
    debugInfo.dailyPrefetchAttempted = true;
    debugInfo.dailyPrefetchComplete = result.failedCategories.length === 0;
    debugInfo.dailyPrefetchCategories = result.categories;
    debugInfo.dailyPrefetchSuccessfulCategories = result.successfulCategories;
    debugInfo.dailyPrefetchFailedCategories = result.failedCategories;
    debugInfo.dailyPrefetchResults = result.results;
    debugInfo.totalSourceItemCount = result.totalItemCount;
    debugInfo.sourceItemCounts = result.results.reduce((counts, item) => {
        counts[item.category] = Number(item.itemCount) || 0;
        return counts;
    }, {});

    if (result.successfulCategories.length === 0) {
        throw new Error(`Daily source prefetch failed for all categories on ${dateStr}`);
    }

    await reportScheduledProgress(options, 'daily-prefetch', 'sources-ready', 95, {
        sourceItems: result.totalItemCount,
        successfulCategories: result.successfulCategories.length,
        failedCategories: result.failedCategories.length,
    });
    console.log(
        `[Scheduled][DailyPrefetch] Finished for ${dateStr}: ${result.successfulCategories.length}/${result.categories.length} categories, ${result.totalItemCount} items.`
    );
    return debugInfo;
}

export async function handleScheduledDaily(event, env, ctx, specifiedDate = null, options = {}) {
    const dateStr = specifiedDate || getISODate();
    setFetchDate(dateStr);
    const debugInfo = buildBaseDebugInfo(dateStr, 'daily');
    const dryRun = Boolean(options.dryRun);
    debugInfo.dailyDryRun = dryRun;
    console.log(`[Scheduled][Daily] Starting automation for ${dateStr}${specifiedDate ? ' (specified date)' : ''}${dryRun ? ' (dry-run)' : ''}`);

    await reportScheduledProgress(options, 'daily', 'loading-sources', 10);
    const {
        selectedContentItems,
        dailyFunContentItems,
        mediaCandidates,
        totalCandidateCount,
        selectedCounts,
        selectionDiagnostics,
        allowedTopGithubProjectUrls,
    } = await loadScheduledContext(env, dateStr, debugInfo, {
        preferCachedData: options.preferCachedData !== false,
        applyGithubTopProjectDedupe: true,
        skipSourceCacheWrite: dryRun,
    });
    debugInfo.promptSelectedItems = selectedContentItems.length;
    debugInfo.dailyFunCandidateItems = Array.isArray(dailyFunContentItems) ? dailyFunContentItems.length : 0;
    debugInfo.promptTotalCandidateCount = totalCandidateCount || 0;
    debugInfo.promptSelectedCounts = selectedCounts || {};
    debugInfo.promptSelectionDiagnostics = selectionDiagnostics || null;
    const dailyPromptAllocation = getDailyPromptAllocationStats(selectedContentItems, dailyFunContentItems);
    const dailyTopEligiblePromptItems = countDailyTopEligiblePromptItems(
        selectedContentItems,
        dailyFunContentItems
    );
    const minimumTopItems = Math.min(dailyTopEligiblePromptItems, DAILY_TOP_TARGET);
    const hardMinimumTopItems = Math.min(minimumTopItems, DAILY_TOP_EMERGENCY_MIN);
    const minimumOpenSourceItems = Math.min(
        dailyPromptAllocation.reservedProjectItems,
        DAILY_OPEN_SOURCE_MIN
    );
    const minimumSocialItems = Math.min(
        dailyPromptAllocation.reservedSocialItems,
        DAILY_SOCIAL_MIN
    );
    const minimumResearchItems = Math.min(dailyPromptAllocation.reservedPaperItems, 1);
    const minimumIndustryItems = dailyPromptAllocation.reservedNewsItems >= 2 ? 1 : 0;
    const potentialTopicSections =
        Math.min(dailyPromptAllocation.reservedNewsItems, 2) +
        (dailyPromptAllocation.reservedPaperItems > 0 ? 1 : 0) +
        (dailyPromptAllocation.reservedProjectItems > 0 ? 1 : 0) +
        (dailyPromptAllocation.reservedSocialItems > 0 ? 1 : 0);
    const minimumTopicSections = Math.min(potentialTopicSections, 3);
    debugInfo.dailyPromptAllocation = dailyPromptAllocation;
    debugInfo.dailyTopEligiblePromptItems = dailyTopEligiblePromptItems;
    debugInfo.dailyTopTargetItems = minimumTopItems;
    debugInfo.dailyMinimumTopItems = hardMinimumTopItems;
    debugInfo.dailyOpenSourceTargetItems = minimumOpenSourceItems;
    debugInfo.dailySocialTargetItems = minimumSocialItems;
    debugInfo.dailyResearchTargetItems = minimumResearchItems;
    debugInfo.dailyIndustryTargetItems = minimumIndustryItems;
    debugInfo.dailyTopicSectionTarget = minimumTopicSections;

    await reportScheduledProgress(options, 'daily', 'generating', 40, {
        candidateItems: totalCandidateCount || 0,
        selectedItems: selectedContentItems.length,
        funCandidates: Array.isArray(dailyFunContentItems) ? dailyFunContentItems.length : 0,
    });
    const { outputOfCall3, dailySummaryMarkdownContent, validation: generatedValidation } = await generateDailyMarkdown(
        env,
        dateStr,
        selectedContentItems,
        mediaCandidates,
        debugInfo,
        {
            minimumTopItems,
            hardMinimumTopItems,
            minimumOpenSourceItems,
            minimumSocialItems,
            minimumResearchItems,
            minimumIndustryItems,
            minimumTopicSections,
            dailyFunContentItems,
            allowedTopGithubProjectUrls,
        }
    );

    await reportScheduledProgress(options, 'daily', 'validating', 78);
    const validation = generatedValidation || validateDailyPublication({
        summaryText: outputOfCall3,
        pageMarkdown: dailySummaryMarkdownContent,
        minimumTopItems,
        hardMinimumTopItems,
        minimumOpenSourceItems,
        minimumSocialItems,
        minimumResearchItems,
        minimumIndustryItems,
        minimumTopicSections,
        allowedTopGithubProjectUrls,
        enforceTopGithubProjectAllowlist: true,
    });
    debugInfo.dailyValidationPassed = validation.ok;
    debugInfo.dailyValidationIssues = validation.issues;
    debugInfo.dailyValidationWarnings = validation.warnings || [];
    if (!validation.ok) {
        await reportScheduledProgress(options, 'daily', 'validation-failed', 100, {
            issueCount: validation.issues.length,
        });
        console.warn(`[Scheduled][Daily] Validation failed, skipping publish: ${validation.issues.join(' | ')}`);
        return debugInfo;
    }

    if (dryRun) {
        await reportScheduledProgress(options, 'daily', 'dry-run-complete', 100);
        debugInfo.dailyWouldPublish = true;
        debugInfo.dailyPublished = false;
        debugInfo.dailyPreviewSummary = outputOfCall3;
        debugInfo.dailyPreviewMarkdown = dailySummaryMarkdownContent;
        console.log(`[Scheduled][Daily] Dry-run completed successfully for ${dateStr}; skipping GitHub publish.`);
        return debugInfo;
    }

    await reportScheduledProgress(options, 'daily', 'publishing', 88);
    await commitDailyOutputs(env, dateStr, dailySummaryMarkdownContent);
    await storePublishedDailyGithubTopProjects(env, dateStr, dailySummaryMarkdownContent, debugInfo);
    debugInfo.dailyPublished = true;
    await reportScheduledProgress(options, 'daily', 'published', 98);
    return debugInfo;
}

export async function handleScheduledOpportunity(event, env, ctx, specifiedDate = null, options = {}) {
    const dateStr = specifiedDate || getISODate();
    setFetchDate(dateStr);
    const debugInfo = buildBaseDebugInfo(dateStr, 'opportunity');
    debugInfo.opportunityPipelineVersion = 'pre-0803-actionable-v1';
    const dryRun = Boolean(options.dryRun);
    debugInfo.opportunityDryRun = dryRun;
    console.log(`[Scheduled][Opportunity] Starting automation for ${dateStr}${specifiedDate ? ' (specified date)' : ''}${dryRun ? ' (dry-run)' : ''}`);

    if (!dryRun && !options.ignoreQualitySkipMarker) {
        const existingQualitySkip = await loadOpportunityQualitySkip(env, dateStr);
        if (existingQualitySkip) {
            debugInfo.skipped = true;
            debugInfo.skipReason = 'opportunity-quality-skip-already-recorded';
            debugInfo.opportunityQualitySkipped = true;
            debugInfo.opportunityQualitySkipMarker = existingQualitySkip;
            await reportScheduledProgress(options, 'opportunity', 'quality-skipped', 100, {
                reason: debugInfo.skipReason,
            });
            return debugInfo;
        }
    }

    await reportScheduledProgress(options, 'opportunity', 'loading-sources', 10);
    const {
        allUnifiedData,
        previousOpportunityReplaySignals,
        recentOpportunityReplayMemory,
    } = await loadScheduledContext(env, dateStr, debugInfo, {
        preferCachedData: true,
        loadOpportunityReplay: true,
        skipSourceCacheWrite: dryRun,
    });
    await reportScheduledProgress(options, 'opportunity', 'generating', 42, {
        sourceItems: debugInfo.totalSourceItemCount,
    });
    const {
        opportunityPaths,
        opportunityMarkdownContent,
        validation: generatedValidation,
        candidateAssessment,
        qualitySkipped,
    } = await generateOpportunityMarkdown(
        env,
        dateStr,
        allUnifiedData,
        debugInfo,
        {
            previousMainTopicSignals: previousOpportunityReplaySignals,
            recentReplayMemory: recentOpportunityReplayMemory,
            dryRun,
        }
    );

    if (qualitySkipped) {
        debugInfo.skipped = true;
        debugInfo.skipReason = 'no-qualified-opportunity-candidates';
        debugInfo.opportunityQualitySkipped = true;
        debugInfo.opportunityValidationIssues = generatedValidation.issues;
        if (!dryRun) {
            await storeOpportunityQualitySkip(env, dateStr, {
                candidateAssessment: candidateAssessment?.stats || null,
            });
        }
        await reportScheduledProgress(options, 'opportunity', 'quality-skipped', 100, {
            reason: debugInfo.skipReason,
            rejectedCandidates: candidateAssessment?.stats?.rejected || 0,
        });
        console.warn(`[Scheduled][Opportunity] No qualified candidates; skipping AI generation and publish.`);
        return debugInfo;
    }

    await reportScheduledProgress(options, 'opportunity', 'validating', 78);
    const validation = generatedValidation;
    debugInfo.opportunityValidationPassed = validation.ok;
    debugInfo.opportunityValidationIssues = validation.issues;
    if (!validation.ok) {
        await reportScheduledProgress(options, 'opportunity', 'validation-failed', 100, {
            issueCount: validation.issues.length,
        });
        console.warn(`[Scheduled][Opportunity] Validation failed, skipping publish: ${validation.issues.join(' | ')}`);
        return debugInfo;
    }

    if (dryRun) {
        debugInfo.opportunityWouldPublish = true;
        debugInfo.opportunityPublished = false;
        debugInfo.opportunityDryRunMarkdown = opportunityMarkdownContent;
        await reportScheduledProgress(options, 'opportunity', 'dry-run-complete', 100);
        console.log(`[Scheduled][Opportunity] Dry-run completed successfully for ${dateStr}; skipping GitHub publish.`);
        return debugInfo;
    }

    await reportScheduledProgress(options, 'opportunity', 'publishing', 88);
    await commitOpportunityOutputs(env, dateStr, opportunityPaths, opportunityMarkdownContent);
    await storeOpportunityReplayMemoryToKv(
        env,
        dateStr,
        'opportunity',
        opportunityMarkdownContent,
        opportunityPlaybook,
        recentOpportunityReplayMemory,
        debugInfo
    );
    debugInfo.opportunityPublished = true;
    await reportScheduledProgress(options, 'opportunity', 'published', 98);
    return debugInfo;
}

export async function handleScheduledAccountOpportunity(event, env, ctx, specifiedDate = null, options = {}) {
    const dateStr = specifiedDate || getISODate();
    setFetchDate(dateStr);
    const debugInfo = buildBaseDebugInfo(dateStr, 'account-opportunity');
    const dryRun = Boolean(options.dryRun);
    debugInfo.accountOpportunityPipelineVersion = 'pre-0803-actionable-overseas-v1';
    debugInfo.accountOpportunityDryRun = dryRun;
    console.log(`[Scheduled][AccountOpportunity] Starting automation for ${dateStr}${specifiedDate ? ' (specified date)' : ''}${dryRun ? ' (dry-run)' : ''}`);

    await reportScheduledProgress(options, 'account-opportunity', 'loading-sources', 10);
    const [scheduledContext, supplySnapshotResult] = await Promise.all([
        loadScheduledContext(env, dateStr, debugInfo, {
            preferCachedData: true,
            loadOpportunityReplay: true,
            includeCurrentOpportunityReplay: true,
            skipSourceCacheWrite: dryRun,
        }),
        loadSupplyOpportunitySnapshot(env),
    ]);
    recordSupplySnapshotDebug(debugInfo, supplySnapshotResult);
    const {
        allUnifiedData,
        previousOpportunityReplaySignals,
        recentOpportunityReplayMemory,
    } = scheduledContext;
    await reportScheduledProgress(options, 'account-opportunity', 'generating', 42, {
        sourceItems: debugInfo.totalSourceItemCount,
    });
    const {
        accountOpportunityPaths,
        accountOpportunityMarkdownContent,
        validation: generatedValidation,
        candidateAssessment,
        qualitySkipped,
    } = await generateAccountOpportunityMarkdown(
        env,
        dateStr,
        allUnifiedData,
        debugInfo,
        {
            previousMainTopicSignals: previousOpportunityReplaySignals,
            recentReplayMemory: recentOpportunityReplayMemory,
            supplySnapshot: supplySnapshotResult.snapshot,
            dryRun,
        }
    );

    if (qualitySkipped) {
        debugInfo.skipped = true;
        debugInfo.skipReason = 'no-qualified-account-opportunity-candidates';
        debugInfo.accountOpportunityQualitySkipped = true;
        debugInfo.accountOpportunityValidationIssues = generatedValidation.issues;
        await reportScheduledProgress(options, 'account-opportunity', 'quality-skipped', 100, {
            reason: debugInfo.skipReason,
            rejectedCandidates: candidateAssessment?.stats?.rejected || 0,
        });
        console.warn(`[Scheduled][AccountOpportunity] No qualified account signals; skipping AI generation and publish.`);
        return debugInfo;
    }

    await reportScheduledProgress(options, 'account-opportunity', 'validating', 78);
    const validation = generatedValidation;
    debugInfo.accountOpportunityValidationPassed = validation.ok;
    debugInfo.accountOpportunityValidationIssues = validation.issues;
    if (!validation.ok) {
        await reportScheduledProgress(options, 'account-opportunity', 'validation-failed', 100, {
            issueCount: validation.issues.length,
        });
        console.warn(`[Scheduled][AccountOpportunity] Validation failed, skipping publish: ${validation.issues.join(' | ')}`);
        return debugInfo;
    }

    if (dryRun) {
        debugInfo.accountOpportunityWouldPublish = true;
        debugInfo.accountOpportunityPublished = false;
        debugInfo.accountOpportunityDryRunMarkdown = accountOpportunityMarkdownContent;
        await reportScheduledProgress(options, 'account-opportunity', 'dry-run-complete', 100);
        console.log(`[Scheduled][AccountOpportunity] Dry-run completed successfully for ${dateStr}; skipping GitHub publish and replay writes.`);
        return debugInfo;
    }

    await reportScheduledProgress(options, 'account-opportunity', 'publishing', 88);
    await commitAccountOpportunityOutputs(
        env,
        dateStr,
        accountOpportunityPaths,
        accountOpportunityMarkdownContent
    );
    await storeOpportunityReplayMemoryToKv(
        env,
        dateStr,
        'account-opportunity',
        accountOpportunityMarkdownContent,
        accountOpportunityPlaybook,
        recentOpportunityReplayMemory,
        debugInfo
    );
    debugInfo.accountOpportunityPublished = true;
    await reportScheduledProgress(options, 'account-opportunity', 'published', 98);
    return debugInfo;
}

export async function handleScheduled(event, env, ctx, specifiedDate = null, mode = 'auto', options = {}) {
    const resolvedMode = resolveScheduledModeFromEvent(event, env, mode);

    if (resolvedMode === 'backup') {
        return handleScheduledBackup(event, env, ctx, specifiedDate, options);
    }

    if (resolvedMode === 'daily-backup') {
        return handleScheduledDailyBackup(event, env, ctx, specifiedDate, options);
    }

    if (resolvedMode === 'daily-prefetch') {
        return handleScheduledDailyPrefetch(event, env, ctx, specifiedDate, options);
    }

    if (resolvedMode === 'account-opportunity') {
        return handleScheduledAccountOpportunity(event, env, ctx, specifiedDate, options);
    }

    if (resolvedMode === 'opportunity') {
        return handleScheduledOpportunity(event, env, ctx, specifiedDate, options);
    }

    if (resolvedMode === 'all') {
        const daily = await handleScheduledDaily(event, env, ctx, specifiedDate, options);
        const opportunity = await handleScheduledOpportunity(event, env, ctx, specifiedDate, options);
        const accountOpportunity = await runIsolatedAccountOpportunity(
            () => handleScheduledAccountOpportunity(event, env, ctx, specifiedDate, options),
            specifiedDate || getISODate(),
            'combined run'
        );
        return { daily, opportunity, accountOpportunity };
    }

    return handleScheduledDaily(event, env, ctx, specifiedDate, options);
}
