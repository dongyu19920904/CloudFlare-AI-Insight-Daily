// src/dataSources/projects.js
import { fetchData, getISODate, removeMarkdownCodeBlock, formatDateToChineseWithTime, escapeHtml, getRandomUserAgent} from '../helpers.js';
import { callChatAPI } from '../chatapi.js';

function parsePositiveInt(value, fallback) {
    const parsed = parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function decodeHtmlEntities(value) {
    return String(value || '')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'");
}

function cleanHtmlText(html) {
    return decodeHtmlEntities(String(html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim());
}

function parseCompactNumber(value) {
    const normalized = String(value || '').replace(/,/g, '').trim().toLowerCase();
    const match = normalized.match(/(\d+(?:\.\d+)?)\s*(k)?/i);
    if (!match) return '';
    const number = parseFloat(match[1]);
    if (!Number.isFinite(number)) return '';
    return String(match[2] ? Math.round(number * 1000) : Math.round(number));
}

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseGithubTrendingHtml(html, limit = 10) {
    const articles = String(html || '').match(/<article\b[\s\S]*?<\/article>/gi) || [];
    const projects = [];

    for (const article of articles) {
        const repoLinkMatch = article.match(/<h2\b[\s\S]*?<a\b[^>]*href="\/([^"?#]+)"[^>]*>([\s\S]*?)<\/a>/i);
        const repoPath = decodeHtmlEntities(repoLinkMatch?.[1] || '').trim().replace(/^\/+|\/+$/g, '');
        if (!/^[^/]+\/[^/]+$/.test(repoPath)) continue;

        const [owner, name] = repoPath.split('/');
        const escapedRepoPath = escapeRegExp(repoPath);
        const descriptionMatch =
            article.match(/<p\b[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
            article.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
        const languageMatch = article.match(/itemprop="programmingLanguage"[^>]*>([^<]+)</i);
        const starsLinkMatch = article.match(new RegExp(`<a\\b[^>]*href="/${escapedRepoPath}/stargazers"[^>]*>[\\s\\S]*?<\\/a>`, 'i'));
        const forksLinkMatch = article.match(new RegExp(`<a\\b[^>]*href="/${escapedRepoPath}/forks"[^>]*>[\\s\\S]*?<\\/a>|<a\\b[^>]*href="/${escapedRepoPath}/network/members"[^>]*>[\\s\\S]*?<\\/a>`, 'i'));
        const starsTodayMatch = article.match(/<span\b[^>]*class="[^"]*float-sm-right[^"]*"[^>]*>([\s\S]*?)<\/span>/i);

        projects.push({
            owner,
            name,
            url: `https://github.com/${repoPath}`,
            description: cleanHtmlText(descriptionMatch?.[1] || ''),
            language: cleanHtmlText(languageMatch?.[1] || ''),
            totalStars: parseCompactNumber(cleanHtmlText(starsLinkMatch?.[0] || '')),
            forks: parseCompactNumber(cleanHtmlText(forksLinkMatch?.[0] || '')),
            starsToday: parseCompactNumber(cleanHtmlText(starsTodayMatch?.[1] || '')),
            builtBy: [],
        });

        if (projects.length >= limit) break;
    }

    return projects;
}

async function fetchGithubTrendingFallback(env) {
    const url = env.GITHUB_TRENDING_URL || 'https://github.com/trending?since=daily';
    const limit = parsePositiveInt(env.GITHUB_TRENDING_FALLBACK_LIMIT, 10);

    try {
        console.warn(`Falling back to GitHub Trending HTML: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });

        if (!response.ok) {
            throw new Error(`GitHub Trending fallback returned ${response.status}`);
        }

        const html = await response.text();
        const projects = parseGithubTrendingHtml(html, limit);
        console.log(`Parsed ${projects.length} projects from GitHub Trending fallback.`);
        return projects;
    } catch (error) {
        console.error('GitHub Trending fallback failed:', error.message);
        return [];
    }
}

const ProjectsDataSource = {
    fetch: async (env) => {
        console.log(`Fetching projects from: ${env.PROJECTS_API_URL}`);
        let projects;
        try {
            projects = await fetchData(env.PROJECTS_API_URL);
        } catch (error) {
            console.error("Error fetching projects data:", error.message);
            projects = await fetchGithubTrendingFallback(env);
            if (projects.length === 0) {
                return { error: "Failed to fetch projects data", details: error.message, items: [] };
            }
        }

        if (!Array.isArray(projects)) {
            console.error("Projects data is not an array:", projects);
            projects = await fetchGithubTrendingFallback(env);
            if (projects.length === 0) {
                return { error: "Invalid projects data format", received: projects, items: [] };
            }
        }
         if (projects.length === 0) {
            projects = await fetchGithubTrendingFallback(env);
            if (projects.length === 0) {
                console.log("No projects fetched from API.");
                return { items: [] };
            }
        }

        if (String(env.OPEN_TRANSLATE || '').toLowerCase() !== "true") {
            console.warn("Skipping paper translations.");
            return projects.map(p => ({ ...p, description_zh: p.description || "" }));
        }

        const descriptionsToTranslate = projects
            .map(p => p.description || "")
            .filter(desc => typeof desc === 'string');

        const nonEmptyDescriptions = descriptionsToTranslate.filter(d => d.trim() !== "");
        if (nonEmptyDescriptions.length === 0) {
            console.log("No non-empty project descriptions to translate.");
            return projects.map(p => ({ ...p, description_zh: p.description || "" }));
        }
        const promptText = `Translate the following English project descriptions to Chinese.
Provide the translations as a JSON array of strings, in the exact same order as the input.
Each string in the output array must correspond to the string at the same index in the input array.
If an input description is an empty string, the corresponding translated string in the output array should also be an empty string.
Input Descriptions (JSON array of strings):
${JSON.stringify(descriptionsToTranslate)}
Respond ONLY with the JSON array of Chinese translations. Do not include any other text or explanations.
JSON Array of Chinese Translations:`;

        let translatedTexts = [];
        try {
            console.log(`Requesting translation for ${descriptionsToTranslate.length} project descriptions.`);
            const chatResponse = await callChatAPI(env, promptText);
            const parsedTranslations = JSON.parse(removeMarkdownCodeBlock(chatResponse)); // Assuming direct JSON array response

            if (parsedTranslations && Array.isArray(parsedTranslations) && parsedTranslations.length === descriptionsToTranslate.length) {
                translatedTexts = parsedTranslations;
            } else {
                console.warn(`Translation count mismatch or parsing error for project descriptions. Expected ${descriptionsToTranslate.length}, received ${parsedTranslations ? parsedTranslations.length : 'null'}. Falling back.`);
                translatedTexts = descriptionsToTranslate.map(() => null);
            }
        } catch (translationError) {
            console.error("Failed to translate project descriptions in batch:", translationError.message);
            translatedTexts = descriptionsToTranslate.map(() => null);
        }

        return projects.map((project, index) => {
            const translated = translatedTexts[index];
            return {
                ...project,
                description_zh: (typeof translated === 'string') ? translated : (project.description || "")
            };
        });
    },
    transform: (projectsData, sourceType) => {
        const unifiedProjects = [];
        const now = getISODate();
        if (Array.isArray(projectsData)) {
            projectsData.forEach((project, index) => {
                unifiedProjects.push({
                    id: index + 1, // Use project.url as ID if available
                    type: sourceType,
                    url: project.url,
                    title: project.name,
                    description: project.description_zh || project.description || "",
                    published_date: now, // Projects don't have a published date, use current date
                    authors: project.owner ? [project.owner] : [],
                    source: "GitHub Trending",
                    details: {
                        owner: project.owner,
                        name: project.name,
                        language: project.language,
                        languageColor: project.languageColor,
                        totalStars: project.totalStars,
                        forks: project.forks,
                        starsToday: project.starsToday,
                        builtBy: project.builtBy || []
                    }
                });
            });
        }
        return unifiedProjects;
    },

    generateHtml: (item) => {
        return `
            <strong>${escapeHtml(item.title)}</strong> (所有者: ${escapeHtml(item.details.owner)})<br>
            <small>星标: ${escapeHtml(item.details.totalStars)} (今日: ${escapeHtml(item.details.starsToday)}) | 语言: ${escapeHtml(item.details.language || 'N/A')}</small>
            描述: ${escapeHtml(item.description) || 'N/A'}<br>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">在 GitHub 上查看</a>
        `;
    }
};

export default ProjectsDataSource;
