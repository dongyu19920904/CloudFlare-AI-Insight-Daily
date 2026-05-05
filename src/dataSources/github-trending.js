// src/dataSources/github-trending.js
import { fetchData, getISODate, removeMarkdownCodeBlock, escapeHtml } from '../helpers.js';
import { callChatAPI } from '../chatapi.js';

function getDateDaysAgo(days) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - Math.max(1, Number.parseInt(days, 10) || 7));
    return date.toISOString().slice(0, 10);
}

function parseSearchQueries(env, pushedAfter) {
    const configured = String(env.GITHUB_PROJECT_SEARCH_QUERIES || '')
        .split('|')
        .map((query) => query.trim())
        .filter(Boolean);

    const baseQueries = configured.length > 0
        ? configured
        : [
            'topic:artificial-intelligence stars:>50',
            'topic:llm stars:>20',
            'topic:ai-agent stars:>10',
            'topic:mcp stars:>10',
        ];

    return baseQueries.map((query) => {
        const withPushed = /\bpushed:/.test(query) ? query : `${query} pushed:>=${pushedAfter}`;
        return withPushed;
    });
}

async function fetchGithubSearchProjects(env) {
    const limit = Math.max(1, Number.parseInt(env.GITHUB_PROJECT_SEARCH_LIMIT || '10', 10) || 10);
    const pushedAfter = getDateDaysAgo(env.GITHUB_PROJECT_SEARCH_DAYS || '7');
    const queries = parseSearchQueries(env, pushedAfter);
    const headers = {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'AI-Insight-Daily-Worker',
        'X-GitHub-Api-Version': '2022-11-28',
    };

    if (env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    }

    const projects = [];
    const seen = new Set();

    for (const query of queries) {
        if (projects.length >= limit) break;

        const url = new URL('https://api.github.com/search/repositories');
        url.searchParams.set('q', query);
        url.searchParams.set('sort', 'stars');
        url.searchParams.set('order', 'desc');
        url.searchParams.set('per_page', String(Math.min(10, limit)));

        console.log(`Fetching GitHub projects from official API: ${query}`);
        const response = await fetch(url.toString(), { headers });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`GitHub Search API returned ${response.status}: ${body.slice(0, 200)}`);
        }

        const payload = await response.json();
        for (const repo of payload.items || []) {
            if (!repo?.html_url || seen.has(repo.html_url)) continue;
            seen.add(repo.html_url);
            projects.push({
                name: repo.name,
                owner: repo.owner?.login || '',
                url: repo.html_url,
                description: repo.description || '',
                language: repo.language || '',
                languageColor: '',
                totalStars: repo.stargazers_count || 0,
                forks: repo.forks_count || 0,
                starsToday: repo.stargazers_count || 0,
                builtBy: [],
                pushedAt: repo.pushed_at,
                createdAt: repo.created_at,
            });
            if (projects.length >= limit) break;
        }
    }

    return projects;
}

async function fetchConfiguredProjects(env) {
    const configuredUrl = String(env.PROJECTS_API_URL || '').trim();
    if (!configuredUrl) return [];

    console.log(`Fetching projects from configured URL: ${configuredUrl}`);
    const projects = await fetchData(configuredUrl);
    if (!Array.isArray(projects)) {
        throw new Error('Configured projects data is not an array');
    }
    return projects;
}

const ProjectsDataSource = {
    fetch: async (env) => {
        let projects = [];

        try {
            projects = await fetchConfiguredProjects(env);
        } catch (error) {
            console.warn(`Configured GitHub trending source failed, falling back to GitHub Search API: ${error.message}`);
        }

        if (!Array.isArray(projects) || projects.length === 0) {
            try {
                projects = await fetchGithubSearchProjects(env);
            } catch (error) {
                console.error('Error fetching projects from GitHub Search API:', error.message);
                return { error: 'Failed to fetch projects data', details: error.message, items: [] };
            }
        }

        if (!Array.isArray(projects) || projects.length === 0) {
            console.log('No projects fetched.');
            return { items: [] };
        }

        if (String(env.OPEN_TRANSLATE || '').toLowerCase() !== 'true') {
            return projects.map((project) => ({ ...project, description_zh: project.description || '' }));
        }

        const descriptionsToTranslate = projects
            .map((project) => project.description || '')
            .filter((description) => typeof description === 'string');

        const nonEmptyDescriptions = descriptionsToTranslate.filter((description) => description.trim() !== '');
        if (nonEmptyDescriptions.length === 0) {
            return projects.map((project) => ({ ...project, description_zh: project.description || '' }));
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
            const chatResponse = await callChatAPI(env, promptText);
            const parsedTranslations = JSON.parse(removeMarkdownCodeBlock(chatResponse));
            translatedTexts = Array.isArray(parsedTranslations) && parsedTranslations.length === descriptionsToTranslate.length
                ? parsedTranslations
                : descriptionsToTranslate.map(() => null);
        } catch (translationError) {
            console.warn('Failed to translate project descriptions in batch:', translationError.message);
            translatedTexts = descriptionsToTranslate.map(() => null);
        }

        return projects.map((project, index) => {
            const translated = translatedTexts[index];
            return {
                ...project,
                description_zh: typeof translated === 'string' ? translated : (project.description || ''),
            };
        });
    },

    transform: (projectsData, sourceType) => {
        const unifiedProjects = [];
        const now = getISODate();
        if (Array.isArray(projectsData)) {
            projectsData.forEach((project, index) => {
                unifiedProjects.push({
                    id: project.url || index + 1,
                    type: sourceType,
                    url: project.url,
                    title: project.name,
                    description: project.description_zh || project.description || '',
                    published_date: project.pushedAt || project.createdAt || now,
                    authors: project.owner ? [project.owner] : [],
                    source: 'GitHub Search',
                    details: {
                        owner: project.owner,
                        name: project.name,
                        language: project.language,
                        languageColor: project.languageColor,
                        totalStars: project.totalStars,
                        forks: project.forks,
                        starsToday: project.starsToday,
                        builtBy: project.builtBy || [],
                    },
                });
            });
        }
        return unifiedProjects;
    },

    generateHtml: (item) => {
        return `
            <strong>${escapeHtml(item.title)}</strong> (Owner: ${escapeHtml(item.details.owner)})<br>
            <small>Stars: ${escapeHtml(item.details.totalStars)} | Language: ${escapeHtml(item.details.language || 'N/A')}</small>
            Description: ${escapeHtml(item.description) || 'N/A'}<br>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">View on GitHub</a>
        `;
    },
};

export default ProjectsDataSource;
