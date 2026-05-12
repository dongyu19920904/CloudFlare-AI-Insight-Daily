// src/index.js
import { handleWriteData } from './handlers/writeData.js';
import { handleGetContent } from './handlers/getContent.js';
import { handleGetContentHtml } from './handlers/getContentHtml.js';
import { handleGenAIContent, handleGenAIPodcastScript, handleGenAIDailyAnalysis } from './handlers/genAIContent.js';
import { handleGenAIDailyPage } from './handlers/genAIDailyPage.js';
import { handleMediaProxy } from './handlers/mediaProxy.js';
import { handleCommitToGitHub } from './handlers/commitToGitHub.js';
import { handleRss } from './handlers/getRss.js';
import { handleWriteRssData, handleGenerateRssContent } from './handlers/writeRssData.js';
import { handleFoloCookieAdmin, resolveFoloCookie } from './handlers/foloCookieAdmin.js';
import { fetchDataByCategory, dataSources } from './dataFetchers.js';
import { handleLogin, isAuthenticated, handleLogout } from './auth.js';
import { getFromKV, storeInKV } from './kv.js';
import { getISODate, setFetchDate } from './helpers.js';
import { resolveScheduledModeFromEvent } from './scheduleRouting.js';
import { getScheduledStatusKey, storeScheduledRunStatus } from './scheduledStatus.js';
import { repairDailyHomePointer } from './dailyHomeRepair.js';
import {
    handleScheduled,
    handleScheduledDaily,
    handleScheduledOpportunity,
    handleScheduledAccountOpportunity,
} from './handlers/scheduled.js';

function getSpecifiedDate(url) {
    const dateParam = url.searchParams.get('date');
    return dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;
}

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}

function validateTestTriggerSecret(url, env) {
    const expectedKey = String(env.TEST_TRIGGER_SECRET || '').trim();
    if (!expectedKey) {
        console.error('CRITICAL: TEST_TRIGGER_SECRET is not configured; refusing test trigger access.');
        return jsonResponse({
            error: 'TEST_TRIGGER_SECRET is not configured. Configure the Worker secret before using test trigger endpoints.',
        }, 503);
    }

    const secretKey = String(url.searchParams.get('key') || '').trim();
    if (secretKey !== expectedKey) {
        return jsonResponse({
            error: 'Unauthorized. Please provide correct secret key.',
        }, 401);
    }

    return null;
}

async function fetchAndStoreSourceCategory(env, category, dateStr) {
    setFetchDate(dateStr);
    const { cookie: foloCookie, source: foloCookieSource } = await resolveFoloCookie(env);
    const items = await fetchDataByCategory(env, category, foloCookie);
    const key = `${dateStr}-${category}`;
    const existingItems = await getFromKV(env.DATA_KV, key);
    const hasExistingItems = Array.isArray(existingItems) && existingItems.length > 0;
    const shouldStore = items.length > 0 || !hasExistingItems;

    if (shouldStore) {
        await storeInKV(env.DATA_KV, key, items);
    }

    return {
        key,
        category,
        date: dateStr,
        itemCount: items.length,
        stored: shouldStore,
        previousItemCount: Array.isArray(existingItems) ? existingItems.length : 0,
        foloCookieSource,
    };
}

async function queueScheduledMode(ctx, env, mode, specifiedDate) {
    const statusKey = getScheduledStatusKey(mode, specifiedDate);
    const queuedAt = new Date().toISOString();

    await storeScheduledRunStatus(env.DATA_KV, mode, specifiedDate, {
        state: 'queued',
        mode,
        date: specifiedDate || 'current date',
        queuedAt,
    }, {
        ttl: 86400,
    });

    ctx.waitUntil((async () => {
        await storeScheduledRunStatus(env.DATA_KV, mode, specifiedDate, {
            state: 'running',
            mode,
            date: specifiedDate || 'current date',
            queuedAt,
            startedAt: new Date().toISOString(),
        }, {
            ttl: 86400,
        });

        try {
            const debug = await runScheduledMode(mode, env, specifiedDate);
            await storeScheduledRunStatus(env.DATA_KV, mode, specifiedDate, {
                state: 'success',
                mode,
                date: specifiedDate || 'current date',
                queuedAt,
                finishedAt: new Date().toISOString(),
                debug: debug || null,
            }, {
                ttl: 86400,
            });
        } catch (error) {
            console.error(`Async scheduled ${mode} trigger failed`, error);
            await storeScheduledRunStatus(env.DATA_KV, mode, specifiedDate, {
                state: 'error',
                mode,
                date: specifiedDate || 'current date',
                queuedAt,
                finishedAt: new Date().toISOString(),
                error: error?.message || String(error),
                stack: error?.stack ? String(error.stack) : '',
            }, {
                ttl: 86400,
            });
        }
    })());

    return statusKey;
}

function getScheduledEventDate(event) {
    const scheduledTime = Number(event?.scheduledTime);
    const dateObj = Number.isFinite(scheduledTime) ? new Date(scheduledTime) : new Date();
    return getISODate(dateObj);
}

async function tryStoreScheduledRunStatus(kvNamespace, mode, dateOrAlias, status, options = {}) {
    try {
        return await storeScheduledRunStatus(kvNamespace, mode, dateOrAlias, status, options);
    } catch (error) {
        console.warn(`Failed to store scheduled ${mode} status: ${error?.message || String(error)}`);
        return [];
    }
}

async function runScheduledEventWithStatus(event, env, ctx) {
    const mode = resolveScheduledModeFromEvent(event, env);
    const date = getScheduledEventDate(event);
    const cron = String(event?.cron || '');
    const scheduledTime = Number.isFinite(Number(event?.scheduledTime)) ? Number(event.scheduledTime) : null;
    const startedAt = new Date().toISOString();
    const baseStatus = {
        mode,
        date,
        source: 'cron',
        cron,
        scheduledTime,
        startedAt,
    };

    await tryStoreScheduledRunStatus(env.DATA_KV, mode, date, {
        ...baseStatus,
        state: 'running',
    }, {
        includeCurrentAlias: true,
    });

    try {
        const debug = await handleScheduled(event, env, ctx);
        await tryStoreScheduledRunStatus(env.DATA_KV, mode, date, {
            ...baseStatus,
            state: 'success',
            finishedAt: new Date().toISOString(),
            debug: debug || null,
        }, {
            includeCurrentAlias: true,
        });
        return debug;
    } catch (error) {
        await tryStoreScheduledRunStatus(env.DATA_KV, mode, date, {
            ...baseStatus,
            state: 'error',
            finishedAt: new Date().toISOString(),
            error: error?.message || String(error),
            stack: error?.stack ? String(error.stack) : '',
        }, {
            includeCurrentAlias: true,
        });
        throw error;
    }
}

async function runScheduledMode(mode, env, specifiedDate) {
    const fakeEvent = { scheduledTime: Date.now(), cron: '' };
    const fakeCtx = { waitUntil: (promise) => promise };

    if (mode === 'account-opportunity') {
        return handleScheduledAccountOpportunity(fakeEvent, env, fakeCtx, specifiedDate);
    }

    if (mode === 'opportunity') {
        return handleScheduledOpportunity(fakeEvent, env, fakeCtx, specifiedDate);
    }

    if (mode === 'daily') {
        return handleScheduledDaily(fakeEvent, env, fakeCtx, specifiedDate);
    }

    return handleScheduled(fakeEvent, env, fakeCtx, specifiedDate, 'all');
}

async function runScheduledModeWithStatus(mode, env, specifiedDate, source = 'manual') {
    const date = specifiedDate || getISODate();
    const statusDateOrAlias = specifiedDate || null;
    const startedAt = new Date().toISOString();
    const baseStatus = {
        mode,
        date,
        source,
        startedAt,
    };

    await tryStoreScheduledRunStatus(env.DATA_KV, mode, statusDateOrAlias, {
        ...baseStatus,
        state: 'running',
    }, {
        ttl: 86400,
    });

    try {
        const debug = await runScheduledMode(mode, env, specifiedDate);
        await tryStoreScheduledRunStatus(env.DATA_KV, mode, statusDateOrAlias, {
            ...baseStatus,
            state: 'success',
            finishedAt: new Date().toISOString(),
            debug: debug || null,
        }, {
            ttl: 86400,
        });
        return debug;
    } catch (error) {
        await tryStoreScheduledRunStatus(env.DATA_KV, mode, statusDateOrAlias, {
            ...baseStatus,
            state: 'error',
            finishedAt: new Date().toISOString(),
            error: error?.message || String(error),
            stack: error?.stack ? String(error.stack) : '',
        }, {
            ttl: 86400,
        });
        throw error;
    }
}

export default {
    async scheduled(event, env, ctx) {
        await runScheduledEventWithStatus(event, env, ctx);
    },
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        if (path === '/mediaProxy' && (request.method === 'GET' || request.method === 'HEAD')) {
            return await handleMediaProxy(request);
        }

        const requiredEnvVars = [
            'DATA_KV', 'OPEN_TRANSLATE', 'USE_MODEL_PLATFORM',
            'GITHUB_TOKEN', 'GITHUB_REPO_OWNER', 'GITHUB_REPO_NAME', 'GITHUB_BRANCH',
            'LOGIN_USERNAME', 'LOGIN_PASSWORD',
            'PODCAST_TITLE', 'PODCAST_BEGIN', 'PODCAST_END',
            'FOLO_COOKIE_KV_KEY', 'FOLO_DATA_API', 'FOLO_FILTER_DAYS',
        ];

        const platform = String(env.USE_MODEL_PLATFORM || '').toUpperCase();
        if (platform.startsWith('OPEN')) {
            requiredEnvVars.push('DEFAULT_OPEN_MODEL', 'OPENAI_API_KEY');
        } else if (platform.startsWith('ANTHROPIC')) {
            requiredEnvVars.push('DEFAULT_ANTHROPIC_MODEL', 'ANTHROPIC_API_KEY');
        } else {
            requiredEnvVars.push('GEMINI_API_URL', 'DEFAULT_GEMINI_MODEL');
        }

        const missingVars = requiredEnvVars.filter((varName) => !env[varName]);
        if (platform.startsWith('ANTHROPIC')) {
            const hasAnthropicBaseUrl = Boolean(env.ANTHROPIC_BASE_URL || env.ANTHROPIC_API_URL);
            if (!hasAnthropicBaseUrl) missingVars.push('ANTHROPIC_BASE_URL');
        } else if (platform.startsWith('OPEN')) {
            const hasOpenAIBaseUrl = Boolean(env.OPENAI_BASE_URL || env.OPENAI_API_URL);
            if (!hasOpenAIBaseUrl) missingVars.push('OPENAI_API_URL');
        }

        if (!platform.startsWith('OPEN') && !platform.startsWith('ANTHROPIC')) {
            const hasGeminiKey = Boolean(env.GEMINI_API_KEY || env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY);
            if (!hasGeminiKey) missingVars.push('GEMINI_API_KEY');
        }

        if (missingVars.length > 0) {
            console.error(`CRITICAL: Missing environment variables/bindings: ${missingVars.join(', ')}`);
            const errorPage = `
                <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Configuration Error</title></head>
                <body style="font-family: sans-serif; padding: 20px;"><h1>Server Configuration Error</h1>
                <p>Essential environment variables or bindings are missing: ${missingVars.join(', ')}. The service cannot operate.</p>
                <p>Please contact the administrator.</p></body></html>`;
            return new Response(errorPage, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        console.log(`Request received: ${request.method} ${path}`);

        if (path === '/login') {
            return await handleLogin(request, env);
        } else if (path === '/logout') {
            return await handleLogout(request, env);
        } else if (path === '/getContent' && request.method === 'GET') {
            return await handleGetContent(request, env);
        } else if (path.startsWith('/rss') && request.method === 'GET') {
            return await handleRss(request, env);
        } else if (path === '/writeRssData' && request.method === 'GET') {
            return await handleWriteRssData(request, env);
        } else if (path === '/generateRssContent' && request.method === 'GET') {
            return await handleGenerateRssContent(request, env);
        } else if (path === '/testFoloCookie' && (request.method === 'GET' || request.method === 'POST')) {
            const authError = validateTestTriggerSecret(url, env);
            if (authError) return authError;
            return await handleFoloCookieAdmin(request, env);
        } else if (path === '/testFetchCategory' && request.method === 'GET') {
            const authError = validateTestTriggerSecret(url, env);
            if (authError) return authError;

            const category = url.searchParams.get('category');
            if (!category || !dataSources[category]) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `Invalid category. Available categories: ${Object.keys(dataSources).join(', ')}`
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json; charset=utf-8' }
                });
            }

            const specifiedDate = getSpecifiedDate(url);
            const result = await fetchAndStoreSourceCategory(env, category, specifiedDate || getISODate());
            return new Response(JSON.stringify({
                success: true,
                ...result,
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
        } else if (path === '/testTriggerScheduledStatus' && request.method === 'GET') {
            const authError = validateTestTriggerSecret(url, env);
            if (authError) return authError;
            const specifiedDate = getSpecifiedDate(url);
            const mode = url.searchParams.get('mode') || 'daily';
            const statusKey = url.searchParams.get('statusKey') || getScheduledStatusKey(mode, specifiedDate);
            const status = await getFromKV(env.DATA_KV, statusKey);
            return new Response(JSON.stringify({
                success: true,
                statusKey,
                status: status || null,
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
        } else if (path === '/testRepairDailyHome' && request.method === 'GET') {
            const authError = validateTestTriggerSecret(url, env);
            if (authError) return authError;
            const specifiedDate = getSpecifiedDate(url) || getISODate();
            const result = await repairDailyHomePointer(env, specifiedDate);
            return new Response(JSON.stringify({
                success: true,
                message: `Daily home pointer repaired for date: ${specifiedDate}`,
                ...result,
                timestamp: new Date().toISOString(),
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
        } else if (
            (path === '/testTriggerScheduled' ||
                path === '/testTriggerScheduledDaily' ||
                path === '/testTriggerScheduledOpportunity' ||
                path === '/testTriggerScheduledAccountOpportunity') &&
            request.method === 'GET'
        ) {
            const authError = validateTestTriggerSecret(url, env);
            if (authError) return authError;
            const specifiedDate = getSpecifiedDate(url);
            const requestedMode = url.searchParams.get('mode');
            const runAsync = url.searchParams.get('async') === '1';
            const mode =
                path === '/testTriggerScheduledDaily'
                    ? 'daily'
                    : path === '/testTriggerScheduledOpportunity'
                      ? 'opportunity'
                      : path === '/testTriggerScheduledAccountOpportunity'
                        ? 'account-opportunity'
                        : requestedMode === 'daily' || requestedMode === 'opportunity' || requestedMode === 'account-opportunity' || requestedMode === 'all'
                        ? requestedMode
                        : 'daily';
            try {
                if (runAsync) {
                    const statusKey = await queueScheduledMode(ctx, env, mode, specifiedDate);
                    return new Response(JSON.stringify({
                        success: true,
                        queued: true,
                        statusKey,
                        message: `Scheduled ${mode} task queued${specifiedDate ? ` for date: ${specifiedDate}` : ' for current date'}`,
                        mode,
                        date: specifiedDate || 'current date',
                        timestamp: new Date().toISOString(),
                    }), {
                        status: 202,
                        headers: { 'Content-Type': 'application/json; charset=utf-8' }
                    });
                }
                const debug = await runScheduledModeWithStatus(mode, env, specifiedDate, 'test-trigger');
                return new Response(JSON.stringify({
                    success: true,
                    message: `Scheduled ${mode} task completed${specifiedDate ? ` for date: ${specifiedDate}` : ' for current date'}`,
                    mode,
                    date: specifiedDate || 'current date',
                    timestamp: new Date().toISOString(),
                    debug: debug || null,
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json; charset=utf-8' }
                });
            } catch (error) {
                return new Response(JSON.stringify({
                    success: false,
                    error: error.message,
                    mode,
                    date: specifiedDate || 'current date',
                    timestamp: new Date().toISOString()
                }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json; charset=utf-8' }
                });
            }
        }

        const { authenticated, cookie: newCookie } = await isAuthenticated(request, env);
        if (!authenticated) {
            const loginUrl = new URL('/login', url.origin);
            loginUrl.searchParams.set('redirect', url.pathname + url.search);
            return Response.redirect(loginUrl.toString(), 302);
        }

        let response;
        try {
            if (path === '/writeData' && request.method === 'POST') {
                response = await handleWriteData(request, env);
            } else if ((path === '/getContentHtml' || path === '/') && request.method === 'GET') {
                const dataCategories = Object.keys(dataSources).map((key) => ({
                    id: key,
                    name: dataSources[key].name
                }));
                response = await handleGetContentHtml(request, env, dataCategories);
            } else if (path === '/genAIContent' && request.method === 'POST') {
                response = await handleGenAIContent(request, env);
            } else if (path === '/genAIPodcastScript' && request.method === 'POST') {
                response = await handleGenAIPodcastScript(request, env);
            } else if (path === '/genAIDailyAnalysis' && request.method === 'POST') {
                response = await handleGenAIDailyAnalysis(request, env);
            } else if (path === '/genAIDailyPage' && request.method === 'GET') {
                response = await handleGenAIDailyPage(request, env);
            } else if (path === '/commitToGitHub' && request.method === 'POST') {
                response = await handleCommitToGitHub(request, env);
            } else if (
                (path === '/triggerScheduled' ||
                    path === '/triggerScheduledDaily' ||
                    path === '/triggerScheduledOpportunity' ||
                    path === '/triggerScheduledAccountOpportunity') &&
                request.method === 'GET'
            ) {
                const specifiedDate = getSpecifiedDate(url);
                const requestedMode = url.searchParams.get('mode');
                const runAsync = url.searchParams.get('async') === '1';
                const mode =
                    path === '/triggerScheduledDaily'
                        ? 'daily'
                        : path === '/triggerScheduledOpportunity'
                          ? 'opportunity'
                          : path === '/triggerScheduledAccountOpportunity'
                            ? 'account-opportunity'
                          : requestedMode === 'daily' || requestedMode === 'opportunity' || requestedMode === 'account-opportunity' || requestedMode === 'all'
                            ? requestedMode
                            : 'daily';
                if (runAsync) {
                    const statusKey = await queueScheduledMode(ctx, env, mode, specifiedDate);
                    response = new Response(JSON.stringify({
                        success: true,
                        queued: true,
                        statusKey,
                        message: `Scheduled ${mode} task queued${specifiedDate ? ` for date: ${specifiedDate}` : ''}`,
                        mode,
                        date: specifiedDate || 'current date',
                        timestamp: new Date().toISOString(),
                    }), {
                        status: 202,
                        headers: { 'Content-Type': 'application/json; charset=utf-8' }
                    });
                } else {
                    const debug = await runScheduledModeWithStatus(mode, env, specifiedDate, 'manual-trigger');
                    response = new Response(JSON.stringify({
                        success: true,
                        message: `Scheduled ${mode} task triggered successfully${specifiedDate ? ` for date: ${specifiedDate}` : ''}`,
                        mode,
                        date: specifiedDate || 'current date',
                        timestamp: new Date().toISOString(),
                        debug: debug || null,
                    }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json; charset=utf-8' }
                    });
                }
            } else {
                return new Response(null, { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
            }
        } catch (error) {
            console.error('Unhandled error in fetch handler:', error);
            return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
        }

        if (newCookie) {
            response.headers.append('Set-Cookie', newCookie);
        }
        return response;
    }
};
