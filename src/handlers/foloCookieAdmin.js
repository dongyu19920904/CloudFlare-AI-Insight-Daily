import { getRandomUserAgent, isDateWithinLastDays } from '../helpers.js';

const DEFAULT_FOLO_COOKIE_KV_KEY = 'folo_auth_cookie';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}

function getCookieKvKey(env) {
    return env.FOLO_COOKIE_KV_KEY || DEFAULT_FOLO_COOKIE_KV_KEY;
}

function normalizeCookie(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function parseStoredCookie(rawValue) {
    const rawCookie = normalizeCookie(rawValue);
    if (!rawCookie) return '';

    try {
        const parsed = JSON.parse(rawCookie);
        if (typeof parsed === 'string') return normalizeCookie(parsed);
        if (parsed && typeof parsed.cookie === 'string') return normalizeCookie(parsed.cookie);
    } catch (_) {
        // KV may contain a plain cookie if it was written manually.
    }

    return rawCookie;
}

export async function readFoloCookieFromKV(env) {
    if (!env.DATA_KV) return '';

    const key = getCookieKvKey(env);
    const rawValue = await env.DATA_KV.get(key);
    return parseStoredCookie(rawValue);
}

export async function resolveFoloCookie(env, preferredCookie = '') {
    const providedCookie = normalizeCookie(preferredCookie);
    if (providedCookie) {
        return { cookie: providedCookie, source: 'provided' };
    }

    const kvCookie = await readFoloCookieFromKV(env);
    if (kvCookie) {
        return { cookie: kvCookie, source: 'kv' };
    }

    const envCookie = normalizeCookie(env.FOLO_COOKIE);
    if (envCookie) {
        return { cookie: envCookie, source: 'env' };
    }

    return { cookie: '', source: 'none' };
}

async function readCookieFromRequest(request) {
    if (request.method !== 'POST') return '';

    const contentType = request.headers.get('content-type') || '';
    const bodyText = await request.text();
    if (!bodyText.trim()) return '';

    if (contentType.includes('application/json')) {
        const payload = JSON.parse(bodyText);
        return normalizeCookie(payload.cookie || payload.foloCookie || payload.FOLO_COOKIE);
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(bodyText);
        return normalizeCookie(params.get('cookie') || params.get('foloCookie') || params.get('FOLO_COOKIE'));
    }

    return normalizeCookie(bodyText);
}

async function storeFoloCookieInKV(env, cookie) {
    if (!env.DATA_KV) {
        throw new Error('DATA_KV binding is not available.');
    }

    const key = getCookieKvKey(env);
    await env.DATA_KV.put(key, JSON.stringify(cookie));
    return key;
}

function splitIds(rawValue) {
    return String(rawValue || '')
        .split(/[,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function getVerifyTargets(env) {
    const targets = [];

    if (env.NEWS_AGGREGATOR_LIST_ID) {
        targets.push({ type: 'list', id: env.NEWS_AGGREGATOR_LIST_ID });
    }

    const firstFeedId = splitIds(env.FOLO_NEWS_IDS || env.FOLO_FEED_IDS)[0];
    if (firstFeedId) {
        targets.push({ type: 'feed', id: firstFeedId });
    }

    return targets.slice(0, 2);
}

async function verifyTarget(env, cookie, target) {
    const headers = {
        'User-Agent': getRandomUserAgent(),
        'Content-Type': 'application/json',
        accept: 'application/json',
        'accept-language': 'zh-CN,zh;q=0.9',
        origin: 'https://app.follow.is',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'x-app-name': 'Folo Web',
        'x-app-version': '0.4.9',
        Cookie: cookie,
    };
    const body = { view: 1, withContent: true };
    if (target.type === 'list') body.listId = target.id;
    else body.feedId = target.id;

    const response = await fetch(env.FOLO_DATA_API, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    const result = {
        targetType: target.type,
        status: response.status,
        ok: response.ok,
        rawCount: 0,
        recentCount: 0,
        firstTitle: '',
        firstPublishedAt: '',
    };

    if (!response.ok) {
        result.statusText = response.statusText;
        const responseBody = await response.text().catch(() => '');
        if (responseBody) {
            result.errorBody = responseBody.slice(0, 200);
        }
        return result;
    }

    const payload = await response.json();
    const entries = Array.isArray(payload?.data) ? payload.data : [];
    const filterDays = parseInt(env.FOLO_FILTER_DAYS || '2', 10);

    result.rawCount = entries.length;
    result.recentCount = entries.filter((entry) =>
        isDateWithinLastDays(entry?.entries?.publishedAt, filterDays),
    ).length;
    result.firstTitle = entries[0]?.entries?.title || '';
    result.firstPublishedAt = entries[0]?.entries?.publishedAt || '';

    return result;
}

async function verifyFoloCookie(env, cookie) {
    if (!env.FOLO_DATA_API) {
        return { ok: false, error: 'FOLO_DATA_API is not configured.', targets: [] };
    }

    if (!cookie) {
        return { ok: false, error: 'No Folo cookie available.', targets: [] };
    }

    const targets = getVerifyTargets(env);
    if (targets.length === 0) {
        return { ok: false, error: 'No Folo list/feed id configured.', targets: [] };
    }

    const results = [];
    for (const target of targets) {
        try {
            results.push(await verifyTarget(env, cookie, target));
        } catch (error) {
            results.push({
                targetType: target.type,
                ok: false,
                error: error?.message || String(error),
            });
        }
    }

    return {
        ok: results.some((result) => result.ok && result.rawCount > 0),
        targets: results,
    };
}

export async function handleFoloCookieAdmin(request, env) {
    let incomingCookie = '';
    let updated = false;
    let kvKey = getCookieKvKey(env);

    try {
        incomingCookie = await readCookieFromRequest(request);
        if (request.method === 'POST') {
            if (!incomingCookie) {
                return jsonResponse({ success: false, error: 'POST body must include a Folo cookie.' }, 400);
            }
            kvKey = await storeFoloCookieInKV(env, incomingCookie);
            updated = true;
        }

        const kvCookie = await readFoloCookieFromKV(env);
        const { cookie, source } = await resolveFoloCookie(env, incomingCookie);
        const verification = await verifyFoloCookie(env, cookie);

        return jsonResponse({
            success: true,
            cookieUpdated: updated,
            kvKey,
            envCookieAvailable: Boolean(normalizeCookie(env.FOLO_COOKIE)),
            kvCookieAvailable: Boolean(kvCookie),
            usingCookieSource: source,
            verification,
        });
    } catch (error) {
        return jsonResponse({
            success: false,
            cookieUpdated: updated,
            error: error?.message || String(error),
        }, 500);
    }
}
