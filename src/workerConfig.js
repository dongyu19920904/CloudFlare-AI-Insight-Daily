// Fixed non-secret settings moved from wrangler.toml to stay below the binding limit.
// Apply once at Worker entrypoints; explicit bindings always take precedence.
export const WORKER_CONFIG_DEFAULTS = Object.freeze({
    IMG_PROXY: '',
    OPEN_TRANSLATE: 'true',
    ANTHROPIC_BASE_URL: '',
    DAILY_ANTHROPIC_MAX_TOKENS: '4096',
    ANTHROPIC_RETRY_MAX: '2',
    ANTHROPIC_RETRY_BASE_MS: '3000',
    GEMINI_STREAM_MODE: 'auto',
    GEMINI_API_VERSION: 'auto',
    GEMINI_DEBUG: 'false',
    GEMINI_RETRY_MAX: '3',
    GEMINI_RETRY_BASE_MS: '2000',
    GEMINI_FALLBACK_ENABLED: 'false',
    NEWS_AGGREGATOR_FETCH_PAGES: '1',
    RSS_NEWS_FILTER_DAYS: '3',
    RSS_NEWS_MAX_FEEDS_PER_RUN: '1',
    RSS_NEWS_MAX_ITEMS_PER_FEED: '2',
    RSS_NEWS_MAX_STORIES_PER_ITEM: '12',
    HGPAPERS_FETCH_PAGES: '1',
    TWITTER_FETCH_PAGES: '0',
    REDDIT_FETCH_PAGES: '1',
    GITHUB_PROJECT_SEARCH_DAYS: '7',
    GITHUB_PROJECT_SEARCH_LIMIT: '10',
    MAX_ITEMS_PER_TYPE: '50',
    MAX_ITEMS_PAPER: '8',
    LINUXDO_MAX_ITEMS: '2',
    LINUXDO_KEEP_MEDIA: 'false',
    FOLO_NEWS_ID_TYPE: 'feed',
    FOLO_NEWS_FETCH_PAGES: '1',
    GITHUB_API_RETRY_MAX: '3',
    GITHUB_API_RETRY_BASE_MS: '1000',
    INSERT_FOOT: 'false',
    INSERT_AD: 'false',
});

export function withWorkerConfigDefaults(env = {}) {
    return { ...WORKER_CONFIG_DEFAULTS, ...env };
}
