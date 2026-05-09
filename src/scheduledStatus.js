import { storeInKV } from './kv.js';

export const SCHEDULED_STATUS_TTL_SECONDS = 86400;

export function getScheduledStatusKey(mode, dateOrAlias) {
    return `scheduled-status:${mode}:${dateOrAlias || 'current'}`;
}

export function getScheduledStatusKeys(mode, dateOrAlias, options = {}) {
    const keys = new Set([getScheduledStatusKey(mode, dateOrAlias)]);

    if (options.includeCurrentAlias && dateOrAlias && dateOrAlias !== 'current') {
        keys.add(getScheduledStatusKey(mode, null));
    }

    return [...keys];
}

export async function storeScheduledRunStatus(kvNamespace, mode, dateOrAlias, status, options = {}) {
    const ttl = options.ttl || SCHEDULED_STATUS_TTL_SECONDS;
    const keys = getScheduledStatusKeys(mode, dateOrAlias, {
        includeCurrentAlias: Boolean(options.includeCurrentAlias),
    });

    await Promise.all(keys.map((key) => storeInKV(kvNamespace, key, status, ttl)));
    return keys;
}
