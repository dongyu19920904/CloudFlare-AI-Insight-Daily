// src/github.js

const GITHUB_API_MAX_ATTEMPTS = 4;
const GITHUB_API_BASE_DELAY_MS = 1000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGitHubErrorMessage(errorText) {
    let errorJsonMessage = errorText;
    try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && errorJson.message) {
            errorJsonMessage = errorJson.message;
            if (errorJson.errors) {
                errorJsonMessage += ` Details: ${JSON.stringify(errorJson.errors)}`;
            }
        }
    } catch (e) {
        // Ignore JSON parse failures and fall back to the raw response text.
    }
    return errorJsonMessage;
}

function shouldRetryGitHubResponse(response, errorMessage) {
    if (!response) return false;

    if (response.status === 408 || response.status === 429 || response.status >= 500) {
        return true;
    }

    if (response.status === 403 && /secondary rate limit|abuse detection/i.test(errorMessage)) {
        return true;
    }

    return false;
}

function getRetryDelayMs(attempt, response, errorMessage = '') {
    const retryAfterHeader = response?.headers?.get?.('retry-after');
    const retryAfterSeconds = Number.parseInt(retryAfterHeader || '', 10);

    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        return retryAfterSeconds * 1000;
    }

    const exponentialDelay = GITHUB_API_BASE_DELAY_MS * (2 ** (attempt - 1));
    if (/secondary rate limit|abuse detection/i.test(errorMessage)) {
        return Math.max(exponentialDelay, 5000);
    }

    return exponentialDelay;
}

function shouldRetryGitHubNetworkError(error) {
    if (!error?.message) return true;
    if (error.message.startsWith('GitHub API request to')) return false;

    return /fetch failed|network|timeout|timed out|econnreset|tls|socket/i.test(error.message);
}

/**
 * Generic wrapper for calling the GitHub API.
 */
export async function callGitHubApi(env, path, method = 'GET', body = null) {
    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    const GITHUB_REPO_OWNER = env.GITHUB_REPO_OWNER;
    const GITHUB_REPO_NAME = env.GITHUB_REPO_NAME;

    if (!GITHUB_TOKEN || !GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
        console.error("GitHub environment variables (GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME) are not configured.");
        throw new Error("GitHub API configuration is missing in environment variables.");
    }

    const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}${path}`;
    const headers = {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Cloudflare-Worker-ContentBot/1.0'
    };

    if (method !== 'GET' && method !== 'DELETE' && body) {
        headers['Content-Type'] = 'application/json';
    }

    for (let attempt = 1; attempt <= GITHUB_API_MAX_ATTEMPTS; attempt += 1) {
        try {
            const response = await fetch(url, {
                method: method,
                headers: headers,
                body: body ? JSON.stringify(body) : null
            });

            if (!response.ok) {
                const errorText = await response.text();
                const errorJsonMessage = parseGitHubErrorMessage(errorText);

                if (attempt < GITHUB_API_MAX_ATTEMPTS && shouldRetryGitHubResponse(response, errorJsonMessage)) {
                    const delayMs = getRetryDelayMs(attempt, response, errorJsonMessage);
                    console.warn(
                        `GitHub API transient error (${response.status}) for ${method} ${url}. ` +
                        `Attempt ${attempt}/${GITHUB_API_MAX_ATTEMPTS}. Retrying in ${delayMs}ms. Message: ${errorJsonMessage}`
                    );
                    await sleep(delayMs);
                    continue;
                }

                console.error(`GitHub API Error: ${response.status} ${response.statusText} for ${method} ${url}. Message: ${errorJsonMessage}`);
                throw new Error(`GitHub API request to ${path} failed: ${response.status} - ${errorJsonMessage}`);
            }

            if (response.status === 204 || response.headers.get("content-length") === "0") {
                return null;
            }
            return response.json();
        } catch (error) {
            if (attempt < GITHUB_API_MAX_ATTEMPTS && shouldRetryGitHubNetworkError(error)) {
                const delayMs = getRetryDelayMs(attempt);
                console.warn(
                    `GitHub API network error for ${method} ${url}. ` +
                    `Attempt ${attempt}/${GITHUB_API_MAX_ATTEMPTS}. Retrying in ${delayMs}ms. Error: ${error.message}`
                );
                await sleep(delayMs);
                continue;
            }

            throw error;
        }
    }

    throw new Error(`GitHub API request to ${path} exhausted all retry attempts.`);
}

/**
 * Gets the SHA of a file from GitHub.
 */
export async function getGitHubFileSha(env, filePath) {
    const GITHUB_BRANCH = env.GITHUB_BRANCH || 'main';
    try {
        const data = await callGitHubApi(env, `/contents/${filePath}?ref=${GITHUB_BRANCH}`);
        return data && data.sha ? data.sha : null;
    } catch (error) {
        if (error.message.includes("404") || error.message.toLowerCase().includes("not found")) {
            console.log(`File not found on GitHub: ${filePath} (branch: ${GITHUB_BRANCH})`);
            return null;
        }
        console.error(`Error getting SHA for ${filePath}:`, error);
        throw error;
    }
}

/**
 * Creates a new file or updates an existing one on GitHub.
 */
export async function createOrUpdateGitHubFile(env, filePath, content, commitMessage, existingSha = null) {
    const GITHUB_BRANCH = env.GITHUB_BRANCH || 'main';
    const base64Content = b64EncodeUnicode(content);

    const payload = {
        message: commitMessage,
        content: base64Content,
        branch: GITHUB_BRANCH
    };

    if (existingSha) {
        payload.sha = existingSha;
    }
    return callGitHubApi(env, `/contents/${filePath}`, 'PUT', payload);
}

/**
 * Gets the decoded content of a file from GitHub.
 */
export async function getGitHubFileContent(env, filePath) {
    const GITHUB_BRANCH = env.GITHUB_BRANCH || 'main';
    const data = await callGitHubApi(env, `/contents/${filePath}?ref=${GITHUB_BRANCH}`);
    return data && data.content ? b64DecodeUnicode(data.content) : '';
}

/**
 * Gets the content of a file from GitHub.
 */
export async function getDailyReportContent(env, filePath) {
    const GITHUB_BRANCH = env.GITHUB_BRANCH || 'main';
    const GITHUB_REPO_OWNER = env.GITHUB_REPO_OWNER;
    const GITHUB_REPO_NAME = env.GITHUB_REPO_NAME;

    if (!GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
        console.error("GitHub environment variables (GITHUB_REPO_OWNER, GITHUB_REPO_NAME) are not configured.");
        throw new Error("GitHub API configuration is missing in environment variables.");
    }

    try {
        const data = await callGitHubApi(env, `/contents/${filePath}?ref=${GITHUB_BRANCH}`);
        return b64DecodeUnicode(data.content);
    } catch (error) {
        console.error(`Error fetching daily report content from ${filePath}:`, error);
        throw error;
    }
}

// Base64 encode (UTF-8 safe)
function b64EncodeUnicode(str) {
    // Replacing '+' with '-' and '/' with '_' makes it URL-safe, but GitHub API expects standard Base64
    // Using btoa directly after encodeURIComponent is standard
    try {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            function toSolidBytes(match, p1) {
                return String.fromCharCode('0x' + p1);
        }));
    } catch (e) {
        console.error("Base64 Encoding Error:", e);
        throw new Error("Could not encode content for GitHub.");
    }
}

// Base64 decode (UTF-8 safe)
function b64DecodeUnicode(str) {
    try {
        // Standard Base64 decoding
        return decodeURIComponent(atob(str).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    } catch(e) {
        console.error("Base64 Decoding Error:", e);
        throw new Error("Could not decode file content from GitHub.");
    }
}
