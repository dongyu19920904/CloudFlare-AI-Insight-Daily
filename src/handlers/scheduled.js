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
    if (!markdown) return false;
    return /!\[[^\]]*\]\([^)]+\)|<img\b|<video\b/i.test(markdown);
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
            extractMarkdownSection(previousMarkdown, '今日主推') || previousMarkdown;
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
    let dailySummaryMarkdownContent = `## **今日摘要**\n\n\`\`\`\n${outputOfCall3}\n\`\`\`\n\n`;
    dailySummaryMarkdownContent += '\n\n## ⚡ 快速导航\n\n';
    dailySummaryMarkdownContent += '- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览\n\n';
    dailySummaryMarkdownContent += `\n\n${contentWithMidAd}`;

    if (env.INSERT_AD == 'true') dailySummaryMarkdownContent += insertAd() + `\n`;
    if (env.INSERT_FOOT == 'true') dailySummaryMarkdownContent += insertFoot() + `\n\n`;

    return dailySummaryMarkdownContent;
}

function buildDailyRepairPrompt(basePromptInput, invalidMarkdown, validationIssues, dateStr) {
    return [
        "你上一次输出的日报正文不合格，请立即重写，不要解释原因，不要道歉，不要拒答。",
        `这次重写的目标日期是 ${dateStr}。`,
        "上一次输出存在这些问题：",
        ...(validationIssues || []).map((issue) => `- ${issue}`),
        "",
        "请严格遵守以下规则：",
        "- 只输出从 `## **今日AI资讯**` 开始的 Markdown 正文，不要输出前言、备注、AI思考、规则说明或额外解释",
        "- 必须包含这些结构：`### **👀 只有一句话**` / `### **🔑 3 个关键词**` / `## **🔥 重磅 TOP` / `## **❓ 相关问题**`",
        "- FAQ 每天必须有 1 条，并且必须包含指向 https://aivora.cn 的链接",
        "- 允许从最近 2 天内补位，但不要解释日期过滤过程，也不要解释为什么条目变少",
        "- 不要写“我看了一下今天的素材”“今天新闻不够”“按照日期过滤规则”“根据容错机制”“素材质量参差不齐”这类句子",
        "- 直接输出可发布成稿，不要输出任何元话术",
        "",
        "下面是原始素材：",
        basePromptInput,
        "",
        "下面是上一次不合格输出，仅供你纠错参考：",
        invalidMarkdown || "(空)",
    ].join('\n');
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

function appendFallbackMediaSection(markdown, mediaCandidates, limit = 4) {
    if (containsRenderedMedia(markdown)) return markdown;

    const ranked = [...(mediaCandidates || [])]
        .map((candidate) => ({ candidate, score: scoreMediaCandidate(markdown, candidate) }))
        .filter(({ candidate }) => Array.isArray(candidate.placeholders) && candidate.placeholders.length > 0)
        .sort((a, b) => b.score - a.score);

    const placeholders = [];
    const seen = new Set();

    for (const { candidate } of ranked) {
        for (const placeholder of candidate.placeholders) {
            if (!seen.has(placeholder)) {
                seen.add(placeholder);
                placeholders.push(placeholder);
                break;
            }
        }
        if (placeholders.length >= limit) break;
    }

    if (placeholders.length === 0) return markdown;

    const rendered = placeholders.join('\n\n');

    return `${markdown}\n\n### **相关配图**\n\n${rendered}`;
}

function normalizeDailyLinkTitle(title) {
    return String(title || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[`~!@#$%^&*()_+=[\]{};:'",.<>/?\\|，。！？、；：“”‘’（）【】《》·—…-]+/g, ' ')
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

function sanitizeDuplicateDailySections(markdown) {
    const content = String(markdown || '');
    if (!content) return content;

    const topMatch = content.match(/^##\s*\*\*.*TOP.*\*\*[\s\S]*?(?=\n##\s+|$)/im);
    if (!topMatch) return content;

    const topLinks = [...topMatch[0].matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)].map((match) => ({
        title: match[1],
        url: normalizeReplayUrl(match[2]),
    }));

    const seenStories = [...topLinks];
    const sectionPatterns = [
        /^##\s*\*\*.*值得关注.*\*\*[\s\S]*?(?=\n##\s+|$)/im,
        /^##\s*\*\*.*AI趣闻.*\*\*[\s\S]*?(?=\n##\s+|$)/im,
    ];

    let sanitized = content;

    for (const pattern of sectionPatterns) {
        sanitized = sanitized.replace(pattern, (section) => {
            const headingMatch = section.match(/^##[^\n]*/);
            if (!headingMatch) return section;

            const heading = headingMatch[0];
            const body = section.slice(heading.length).trim();
            if (!body) return section;

            const chunks = body.split(/\n(?=(?:###\s+|- \*\*))/g).map((item) => item.trim()).filter(Boolean);
            const keptChunks = [];

            for (const chunk of chunks) {
                const linkMatch = chunk.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
                if (!linkMatch) {
                    keptChunks.push(chunk);
                    continue;
                }

                const title = linkMatch[1];
                const url = normalizeReplayUrl(linkMatch[2]);
                const duplicated = seenStories.some((story) => {
                    if (story.url && url && story.url === url) return true;
                    return isRepeatedDailyStory(story.title, title);
                });

                if (duplicated) continue;

                seenStories.push({ title, url });
                keptChunks.push(chunk);
            }

            if (keptChunks.length === 0) {
                return '';
            }

            return `${heading}\n\n${keptChunks.join('\n\n')}`;
        });
    }

    return sanitized.replace(/\n{3,}/g, '\n\n').trim();
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
        previousDayFilteredNews: 0,
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
        // 瀹氭椂浠诲姟鏃犳硶浠庢祻瑙堝櫒 localStorage 鑾峰彇 Cookie锛岃繖閲屼紭鍏堜娇鐢ㄧ幆澧冨彉閲?FOLO_COOKIE锛?
        // 濡傛灉鏈缃垯灏濊瘯浠?KV(FOLO_COOKIE_KV_KEY) 璇诲彇銆?
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
        const contentWithMidAd = insertMidAd(outputOfCall2);
        let dailySummaryMarkdownContent = `## **今日摘要**\n\n\`\`\`\n${outputOfCall3}\n\`\`\`\n\n`;
        dailySummaryMarkdownContent += '\n\n## ⚡ 快速导航\n\n';
        dailySummaryMarkdownContent += '- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览\n\n';
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
        allUnifiedData = await loadCachedUnifiedData(env, dateStr);
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
        const { filteredNewsItems, filteredCount } = filterNewsAgainstPreviousTop(allUnifiedData.news, previousTopItems);
        allUnifiedData.news = filteredNewsItems;
        debugInfo.previousDayFilteredNews = filteredCount;
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
    dailySummaryMarkdownContent = sanitizeDuplicateDailySections(dailySummaryMarkdownContent);
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
        repairedDailySummaryMarkdownContent = sanitizeDuplicateDailySections(repairedDailySummaryMarkdownContent);
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
        return '今天候选主题较弱，请保守输出，不要硬凑热门。';
    }

    return visibleCandidates.map((candidate) => {
        const supportingText = (candidate.supportingItems || [])
            .slice(0, maxItemsPerCandidate)
            .map((item, index) => `${index + 1}. ${item.title || item.source} - ${item.description || item.plainText || '无'}`)
            .join('\n');

        return [
            `### ${candidate.label}`,
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

function buildOpportunityRepairPrompt(basePromptInput, invalidMarkdown, validationIssues) {
    return [
        "你上一次输出不合格，请立即按要求重写，不要解释原因，不要道歉，不要拒答。",
        "上一次输出存在这些问题：",
        ...(validationIssues || []).map((issue) => `- ${issue}`),
        "",
        "请严格遵守以下规则：",
        "- 只输出 Markdown 正文，不要输出前言、说明或额外解释",
        "- 必须包含完整结构：# 今日AI商机 / ## 先说结论 / ## 今日主推 / ## 本周可试 / ## 今天别碰 / ## 地图感 / ## 今日动作",
        "- 今日主推必须先用 2-3 句短段落讲场景、痛点和结果，再包含：适合谁、这钱从哪来、最简单卖法、今天先做哪一步、今天就能发的文案、配图建议",
        "- 本周可试必须先用 1-2 句短段落讲为什么值得盯，再包含：适合谁、先怎么试、为什么先别冲太猛、配图建议",
        "- 整篇要像日报在讲赚钱机会，不要像系统填表，也不要写成长篇分析",
        "- 如果证据偏弱，可以写成先试、先观察、先小范围验证，但不能拒答",
        "- 不要出现便宜 token、风险自负、多用户商业化",
        "- 标题先写结果、场景或交付动作，不要把 GitHub stars、安装量、SDK 名词堆进标题",
        "- “这钱从哪来”先写买家今天为什么会心动，再补当天新变化，控制在 1-2 句",
        "- 少写技术圈热闹，多写买家今天为什么会心动、今天先做什么",
        "- 今日主推和本周可试不要写成同一种卖法模式，至少换一个角度",
        "- 至少保留一个带点脑洞但今晚就能试卖的方向，不要所有机会都像同一张报价单",
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
        "你上一次输出不合格，请立即按要求重写，不要解释原因，不要道歉，不要拒答。",
        "上一次输出存在这些问题：",
        ...(validationIssues || []).map((issue) => `- ${issue}`),
        "",
        "请严格遵守以下规则：",
        "- 只输出 Markdown 正文，不要输出前言、说明或额外解释",
        "- 必须包含完整结构：# 今日AI账号商机 / ## 先看信号 / ## 今日主推 / ## 平替机会 / ## 闲鱼新品 / ## 今天别碰 / ## 今日动作",
        "- 今日主推必须先用 2-3 句短段落讲清今天发生了什么、买家为什么会动、你今天最适合先挂什么",
        "- 今日主推必须包含：发生了什么、今天先挂什么、今天先测什么、售后风险",
        "- 整篇像账号卖家给自己做盘货判断，不像公开科普，也不要写成长篇分析",
        "- 必须从账号、镜像、平替、组合包、迁移包里做判断，不要只写原账号新闻",
        "- 可以写先试挂、先观察、先低成本验证，但不能拒答",
        "- 不要出现便宜 token、风险自负、多用户商业化",
        "- 不要假装知道闲鱼实时销量、真实利润率或全网成交量",
        "- 闲鱼新品部分要写今天适合测试的新标题、新组合或新卖法，不要空泛",
        "- 今日主推、平替机会、闲鱼新品至少覆盖两种不同卖法模式",
        "- 至少保留一个不是原账号直接卖的方向，比如迁移包、组合体验包、筛选服务或标题实验",
        "",
        "下面是原始候选素材：",
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
            issueLabel: 'AI商机',
            sectionLabels: ['今日主推', '本周可试'],
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
        `## 候选主题\n\n${opportunityCandidatesText}`,
        `## 今日摘要\n\n${opportunitySourceDigest}`,
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

    opportunityMarkdownContent = `## ⚡ 快速导航\n\n- [🎯 今日主推](#今日主推) - 今天最值得先试的机会\n- [🧪 本周可试](#本周可试) - 适合先低成本测试的方向\n- [🚫 今天别碰](#今天别碰) - 看着热，但不建议小白跟进\n- [🗺️ 地图感](#地图感) - 知道就行的背景概念\n- [✅ 今日动作](#今日动作) - 今天先发什么、先卖什么\n\n${opportunityMarkdownContent}`;

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
            issueLabel: 'AI账号商机',
            sectionLabels: ['今日主推', '平替机会'],
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
        `## 候选主题\n\n${accountOpportunityCandidatesText}`,
        `## 今日摘要\n\n${accountOpportunitySourceDigest}`,
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

    accountOpportunityMarkdownContent = `## ⚡ 快速导航\n\n- [📡 先看信号](#先看信号) - 今天先盯哪些账号与入口变化\n- [🎯 今日主推](#今日主推) - 今天最值得先挂的方向\n- [🪄 平替机会](#平替机会) - 可接住流量的替代入口\n- [🛒 闲鱼新品](#闲鱼新品) - 适合上新测试的标题和组合\n- [🚫 今天别碰](#今天别碰) - 售后重、不稳或不值得追\n- [✅ 今日动作](#今日动作) - 今天先发什么、先录什么、先卖什么\n\n${accountOpportunityMarkdownContent}`;

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
    const accountOpportunityTitleBase = env.DAILY_TITLE.includes('日报')
        ? env.DAILY_TITLE.replace('日报', '账号商机')
        : `${env.DAILY_TITLE} 账号商机`;
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

export async function handleScheduledDaily(event, env, ctx, specifiedDate = null) {
    const dateStr = specifiedDate || getISODate();
    setFetchDate(dateStr);
    const debugInfo = buildBaseDebugInfo(dateStr, 'daily');
    console.log(`[Scheduled][Daily] Starting automation for ${dateStr}${specifiedDate ? ' (specified date)' : ''}`);

    const { selectedContentItems, mediaCandidates, totalCandidateCount, selectedCounts } = await loadScheduledContext(env, dateStr, debugInfo, {
        preferCachedData: Boolean(specifiedDate),
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
