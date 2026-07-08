import {
    escapeHtml,
    formatDateToChineseWithTime,
    isDateWithinLastDays,
    stripHtml,
} from '../helpers.js';

const DEFAULT_AI_KEYWORDS = [
    'ai',
    'artificial intelligence',
    'machine learning',
    'deep learning',
    'large language model',
    'llm',
    'gpt',
    'openai',
    'anthropic',
    'claude',
    'gemini',
    'glm',
    'codex',
    'cursor',
    'mcp',
    'agent',
    'inference',
    'reasoning',
    'transformer',
    'neural',
    'diffusion',
    '人工智能',
    '机器学习',
    '深度学习',
    '大模型',
    '语言模型',
    '推理',
    '智能体',
];

function parsePositiveInteger(value, defaultValue) {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function decodeXmlEntities(value) {
    if (!value) return '';
    return String(value)
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number.parseInt(num, 10)))
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#039;/g, "'");
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTag(block, tagNames) {
    for (const tagName of tagNames) {
        const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, 'i');
        const match = String(block || '').match(pattern);
        if (match) return decodeXmlEntities(match[1].trim());
    }
    return '';
}

function extractAllTags(block, tagNames) {
    const values = [];
    for (const tagName of tagNames) {
        const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, 'gi');
        let match;
        while ((match = pattern.exec(String(block || ''))) !== null) {
            values.push(decodeXmlEntities(match[1].trim()));
        }
    }
    return values;
}

function parseFeedDefinitions(rawValue) {
    return String(rawValue || '')
        .split(/\s*\|\s*|\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
            const separatorIndex = entry.indexOf('::');
            if (separatorIndex >= 0) {
                return {
                    name: entry.slice(0, separatorIndex).trim() || 'RSS',
                    url: entry.slice(separatorIndex + 2).trim(),
                };
            }
            return { name: 'RSS', url: entry };
        })
        .filter((feed) => /^https?:\/\//i.test(feed.url));
}

function splitList(value) {
    return String(value || '')
        .split(/[|,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function parseKeywordList(value, fallback) {
    const custom = splitList(value);
    return custom.length > 0 ? custom.map((item) => item.toLowerCase()) : fallback;
}

function containsKeyword(text, keyword) {
    const normalizedKeyword = String(keyword || '').trim().toLowerCase();
    if (!normalizedKeyword) return false;
    if (/^[a-z0-9]+$/i.test(normalizedKeyword)) {
        const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedKeyword)}([^a-z0-9]|$)`, 'i');
        return pattern.test(text);
    }
    return text.includes(normalizedKeyword);
}

function itemMatchesAiTopic(item, env) {
    const requireAi = String(env.RSS_NEWS_REQUIRE_AI_RELEVANCE ?? 'true').toLowerCase() !== 'false';
    if (!requireAi) return true;
    const text = `${item.title || ''}\n${item.description || ''}\n${item.content_html || ''}`.toLowerCase();
    const keywords = parseKeywordList(env.RSS_NEWS_AI_KEYWORDS, DEFAULT_AI_KEYWORDS);
    return keywords.some((keyword) => containsKeyword(text, keyword));
}

function extractFeedItems(xml) {
    const items = [];
    const itemPattern = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemPattern.exec(String(xml || ''))) !== null) {
        const block = match[1];
        const title = extractTag(block, ['title']);
        const link = extractTag(block, ['link', 'guid']);
        const description = extractTag(block, ['content:encoded', 'description']);
        const publishedAt = extractTag(block, ['pubDate', 'dc:date']) || new Date().toISOString();
        const authors = extractAllTags(block, ['dc:creator', 'author']);
        if (!title || !link) continue;
        items.push({ title, link, description, publishedAt, authors });
    }
    return items;
}

function extractFirstLink(html) {
    const match = String(html || '').match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/i);
    return match ? decodeXmlEntities(match[1]) : '';
}

function splitSuperTechFansItem(item, feedName, feedUrl, maxStories) {
    const html = item.description || '';
    if (!/supertechfans\.com\/cn\/post\/\d{4}-\d{2}-\d{2}-HackerNews/i.test(item.link)) {
        return [];
    }

    const blocks = [];
    const sectionPattern = /<h2\b[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<hr>|<h2\b|$)/gi;
    let match;
    while ((match = sectionPattern.exec(html)) !== null && blocks.length < maxStories) {
        const anchor = decodeXmlEntities(match[1]);
        const rawHeadingText = stripHtml(decodeXmlEntities(match[2]))
            .replace(/\s*#\s*$/, '')
            .trim();
        if (!/^\d+\.\s+/.test(rawHeadingText)) continue;
        const headingText = rawHeadingText.replace(/^\d+\.\s*/, '').trim();
        const sectionHtml = decodeXmlEntities(match[3]);
        const sourceUrl = extractFirstLink(sectionHtml) || item.link;
        const summary = stripHtml(sectionHtml).slice(0, 1500);
        if (!headingText || !summary) continue;
        blocks.push({
            id: `${item.link}#${anchor}`,
            url: sourceUrl,
            title: headingText,
            content_html: sectionHtml,
            description: summary,
            date_published: item.publishedAt,
            authors: item.authors,
            source: feedName,
            feedUrl,
            sourcePageUrl: item.link,
        });
    }
    return blocks;
}

async function fetchText(url, env) {
    const timeoutMs = parsePositiveInteger(env.RSS_NEWS_FETCH_TIMEOUT_MS || env.DATA_SOURCE_FETCH_TIMEOUT_MS, 20000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Aivora-AI-Daily-Worker/1.0',
                Accept: 'application/rss+xml, application/xml, text/xml, */*',
            },
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.text();
    } finally {
        clearTimeout(timeoutId);
    }
}

const RssNewsDataSource = {
    type: 'rss-news',

    async fetch(env) {
        const feeds = parseFeedDefinitions(env.RSS_NEWS_URLS);
        if (feeds.length === 0) {
            console.warn('RSS_NEWS_URLS is not set. Skipping rss-news fetch.');
            return { items: [] };
        }

        const maxFeeds = parsePositiveInteger(env.RSS_NEWS_MAX_FEEDS_PER_RUN, 4);
        const maxItemsPerFeed = parsePositiveInteger(env.RSS_NEWS_MAX_ITEMS_PER_FEED, 3);
        const maxStoriesPerItem = parsePositiveInteger(env.RSS_NEWS_MAX_STORIES_PER_ITEM, 12);
        const filterDays = parsePositiveInteger(env.RSS_NEWS_FILTER_DAYS || env.FOLO_FILTER_DAYS, 3);
        const allItems = [];
        const seen = new Set();

        const selectedFeeds = feeds.slice(0, maxFeeds);
        const feedResults = await Promise.all(selectedFeeds.map(async (feed) => {
            try {
                const xml = await fetchText(feed.url, env);
                const entries = extractFeedItems(xml)
                    .filter((item) => isDateWithinLastDays(item.publishedAt, filterDays))
                    .slice(0, maxItemsPerFeed);

                return entries.flatMap((item) => {
                    const splitItems = splitSuperTechFansItem(item, feed.name, feed.url, maxStoriesPerItem);
                    if (splitItems.length > 0) {
                        return splitItems.filter((splitItem) => itemMatchesAiTopic(splitItem, env));
                    }
                    const fallbackItem = {
                        id: item.link,
                        url: item.link,
                        title: item.title,
                        content_html: item.description,
                        description: stripHtml(item.description || ''),
                        date_published: item.publishedAt,
                        authors: item.authors,
                        source: feed.name,
                        feedUrl: feed.url,
                    };
                    return itemMatchesAiTopic(fallbackItem, env) ? [fallbackItem] : [];
                });
            } catch (error) {
                console.warn(`[rss-news] Failed to fetch ${feed.url}: ${error.message}`);
                return [];
            }
        }));

        for (const parsedItems of feedResults) {
            for (const item of parsedItems) {
                const key = item.url || item.id || item.title;
                if (!key || seen.has(key)) continue;
                seen.add(key);
                allItems.push(item);
            }
        }

        return { items: allItems };
    },

    transform(rawData, sourceType) {
        if (!rawData || !Array.isArray(rawData.items)) return [];
        return rawData.items.map((item) => ({
            id: item.id,
            type: sourceType,
            url: item.url,
            title: item.title,
            description: item.description || stripHtml(item.content_html || ''),
            published_date: item.date_published,
            authors: Array.isArray(item.authors) && item.authors.length > 0 ? item.authors.join(', ') : 'Unknown',
            source: item.source || 'RSS',
            details: {
                content_html: item.content_html || '',
                feedUrl: item.feedUrl || '',
                sourcePageUrl: item.sourcePageUrl || '',
            },
        }));
    },

    generateHtml(item) {
        return `
            <strong>${escapeHtml(item.title)}</strong><br>
            <small>来源: ${escapeHtml(item.source || 'RSS')} | 发布时间: ${formatDateToChineseWithTime(item.published_date)}</small>
            <div class="content-html">${item.details.content_html || ''}</div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">阅读更多</a>
        `;
    },
};

export default RssNewsDataSource;
