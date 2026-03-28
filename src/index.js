// src/index.js
import { handleWriteData } from './handlers/writeData.js';
import { handleGetContent } from './handlers/getContent.js';
import { handleGetContentHtml } from './handlers/getContentHtml.js';
import { handleGenAIContent, handleGenAIPodcastScript, handleGenAIDailyAnalysis } from './handlers/genAIContent.js';
import { handleGenAIDailyPage } from './handlers/genAIDailyPage.js';
import { handleCommitToGitHub } from './handlers/commitToGitHub.js';
import { handleRss } from './handlers/getRss.js';
import { handleWriteRssData, handleGenerateRssContent } from './handlers/writeRssData.js';
import { dataSources } from './dataFetchers.js';
import { handleLogin, isAuthenticated, handleLogout } from './auth.js';
import { getFromKV, storeInKV } from './kv.js';
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

function getScheduledStatusKey(mode, specifiedDate) {
    return `scheduled-status:${mode}:${specifiedDate || 'current'}`;
}

async function queueScheduledMode(ctx, env, mode, specifiedDate) {
    const statusKey = getScheduledStatusKey(mode, specifiedDate);
    const queuedAt = new Date().toISOString();

    await storeInKV(env.DATA_KV, statusKey, {
        state: 'queued',
        mode,
        date: specifiedDate || 'current date',
        queuedAt,
    }, 86400);

    ctx.waitUntil((async () => {
        await storeInKV(env.DATA_KV, statusKey, {
            state: 'running',
            mode,
            date: specifiedDate || 'current date',
            queuedAt,
            startedAt: new Date().toISOString(),
        }, 86400);

        try {
            const debug = await runScheduledMode(mode, env, specifiedDate);
            await storeInKV(env.DATA_KV, statusKey, {
                state: 'success',
                mode,
                date: specifiedDate || 'current date',
                queuedAt,
                finishedAt: new Date().toISOString(),
                debug: debug || null,
            }, 86400);
        } catch (error) {
            console.error(`Async scheduled ${mode} trigger failed`, error);
            await storeInKV(env.DATA_KV, statusKey, {
                state: 'error',
                mode,
                date: specifiedDate || 'current date',
                queuedAt,
                finishedAt: new Date().toISOString(),
                error: error?.message || String(error),
                stack: error?.stack ? String(error.stack) : '',
            }, 86400);
        }
    })());

    return statusKey;
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

export default {
    async scheduled(event, env, ctx) {
        await handleScheduled(event, env, ctx);
    },
    async fetch(request, env, ctx) {
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

        const url = new URL(request.url);
        const path = url.pathname;
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
        } else if (path === '/testTriggerScheduledStatus' && request.method === 'GET') {
            const secretKey = url.searchParams.get('key');
            const expectedKey = env.TEST_TRIGGER_SECRET || 'test-secret-key-change-me';
            if (secretKey !== expectedKey) {
                return new Response(JSON.stringify({
                    error: 'Unauthorized. Please provide correct secret key.'
                }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json; charset=utf-8' }
                });
            }
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
        } else if (
            (path === '/testTriggerScheduled' ||
                path === '/testTriggerScheduledDaily' ||
                path === '/testTriggerScheduledOpportunity' ||
                path === '/testTriggerScheduledAccountOpportunity') &&
            request.method === 'GET'
        ) {
            const secretKey = url.searchParams.get('key');
            const expectedKey = env.TEST_TRIGGER_SECRET || 'test-secret-key-change-me';
            if (secretKey !== expectedKey) {
                return new Response(JSON.stringify({
                    error: 'Unauthorized. Please provide correct secret key.'
                }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json; charset=utf-8' }
                });
            }
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
                const debug = await runScheduledMode(mode, env, specifiedDate);
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
                    const debug = await runScheduledMode(mode, env, specifiedDate);
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
