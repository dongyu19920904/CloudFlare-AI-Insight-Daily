function toBoolean(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function normalizeMaxItems(value, fallback = 2) {
    const parsed = parseInt(String(value ?? ''), 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    return fallback;
}

export function isLinuxDoUrl(url) {
    if (!url) return false;
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return hostname === 'linux.do' || hostname.endsWith('.linux.do');
    } catch {
        return false;
    }
}

export function stripMediaTags(html) {
    if (!html) return '';
    const input = String(html);
    // Remove image and video tags to avoid broken media from anti-hotlink sources.
    return input
        .replace(/<img\b[^>]*>/gi, '')
        .replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, '')
        .replace(/<video\b[^>]*\/>/gi, '');
}

export function resolveLinuxDoPolicy(env) {
    return {
        maxItems: normalizeMaxItems(env?.LINUXDO_MAX_ITEMS, 2),
        stripMedia: !toBoolean(env?.LINUXDO_KEEP_MEDIA),
    };
}

export function applyLinuxDoPolicy(items, policy = {}) {
    const maxItems = normalizeMaxItems(policy.maxItems, 2);
    const stripMedia = policy.stripMedia !== false;
    let linuxCount = 0;
    const output = [];

    for (const item of items || []) {
        if (!item || typeof item !== 'object') continue;

        if (!isLinuxDoUrl(item.url)) {
            output.push(item);
            continue;
        }

        linuxCount += 1;
        if (linuxCount > maxItems) continue;

        if (!stripMedia || !item.details || typeof item.details.content_html !== 'string') {
            output.push(item);
            continue;
        }

        output.push({
            ...item,
            details: {
                ...item.details,
                content_html: stripMediaTags(item.details.content_html),
            },
        });
    }

    return output;
}

function canonicalizeUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        parsed.hash = '';
        for (const key of [...parsed.searchParams.keys()]) {
            if (/^utm_/i.test(key) || key === 'ref' || key === 'si') {
                parsed.searchParams.delete(key);
            }
        }
        const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
        const query = parsed.searchParams.toString();
        return `${parsed.origin.toLowerCase()}${pathname}${query ? `?${query}` : ''}`;
    } catch {
        return String(url).trim().toLowerCase();
    }
}

function getHostname(url) {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return '';
    }
}

function isEmojiLikeTitle(title) {
    const normalized = String(title ?? '').trim();
    if (!normalized) return false;
    return /^[^\p{L}\p{N}]+$/u.test(normalized);
}

function isLowValueTelegramItem(item) {
    const source = String(item?.source ?? '').toLowerCase();
    const url = String(item?.url ?? '').toLowerCase();
    const title = String(item?.title ?? '').trim();
    const description = String(item?.description ?? '').trim();
    const shortText = title.length + description.length < 40;

    if (source.includes('每日沙雕墙') || url.includes('t.me/woshadiao/')) {
        return true;
    }

    return (source.includes('telegram') || url.includes('t.me/')) && isEmojiLikeTitle(title) && shortText;
}

function isPaperLikeNewsItem(item) {
    const hostname = getHostname(item?.url);
    if (hostname === 'papers.cool' || hostname === 'arxiv.org' || hostname.endsWith('.arxiv.org')) {
        return true;
    }

    const source = String(item?.source ?? '').toLowerCase();
    return source === 'artificial intelligence' || source.includes('arxiv');
}

function isRecursiveDailyFeedItem(item) {
    const source = String(item?.source ?? '').toLowerCase();
    const url = String(item?.url ?? '').toLowerCase();
    const title = String(item?.title ?? '').toLowerCase();

    if (source.includes('ai洞察日报 rss feed') || source.includes('hubtoday')) {
        return true;
    }

    if (url.includes('ai.hubtoday.app') || url.includes('news.aivora.cn')) {
        return true;
    }

    return /\d{4}-\d{2}-\d{2}日刊/.test(title);
}

function buildDedupKey(item) {
    const normalizedUrl = canonicalizeUrl(item?.url);
    if (normalizedUrl) return normalizedUrl;

    const normalizedTitle = String(item?.title ?? '').trim().toLowerCase();
    const normalizedDate = String(item?.published_date ?? '').slice(0, 10);
    return `${normalizedTitle}::${normalizedDate}`;
}

export function applyNewsSourcePolicy(items) {
    const seen = new Set();
    const output = [];

    for (const item of items || []) {
        if (!item || typeof item !== 'object') continue;
        if (isLowValueTelegramItem(item)) continue;
        if (isPaperLikeNewsItem(item)) continue;
        if (isRecursiveDailyFeedItem(item)) continue;

        const dedupKey = buildDedupKey(item);
        if (dedupKey && seen.has(dedupKey)) continue;
        if (dedupKey) seen.add(dedupKey);

        output.push(item);
    }

    return output;
}
