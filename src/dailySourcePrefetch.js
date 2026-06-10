import { dataSources, fetchDataByCategory } from './dataFetchers.js';
import { resolveFoloCookie } from './handlers/foloCookieAdmin.js';
import { getFromKV, storeInKV } from './kv.js';
import { setFetchDate } from './helpers.js';

export const DAILY_SOURCE_CATEGORIES = ['news', 'project', 'paper', 'socialMedia'];

export function getDailySourceCategories() {
    return DAILY_SOURCE_CATEGORIES.filter((category) => Boolean(dataSources[category]));
}

export async function fetchAndStoreSourceCategory(env, category, dateStr) {
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

export async function prefetchDailySourceCategories(env, dateStr, categories = getDailySourceCategories()) {
    const results = [];

    for (const category of categories) {
        try {
            const result = await fetchAndStoreSourceCategory(env, category, dateStr);
            results.push({
                success: true,
                ...result,
            });
        } catch (error) {
            console.error(`[DailyPrefetch] Failed to prefetch ${category} for ${dateStr}:`, error);
            results.push({
                success: false,
                category,
                date: dateStr,
                error: error?.message || String(error),
            });
        }
    }

    return {
        date: dateStr,
        categories,
        results,
        successfulCategories: results.filter((result) => result.success).map((result) => result.category),
        failedCategories: results.filter((result) => !result.success).map((result) => result.category),
        totalItemCount: results.reduce((total, result) => total + (Number(result.itemCount) || 0), 0),
    };
}
