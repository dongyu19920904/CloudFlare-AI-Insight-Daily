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

export function buildScheduledProgressStatus(baseStatus, phase, details = {}, phaseAt = new Date().toISOString()) {
    const numericProgress = Number(details.progress);
    const progress = Number.isFinite(numericProgress)
        ? Math.max(0, Math.min(100, Math.round(numericProgress)))
        : undefined;

    return {
        ...baseStatus,
        ...details,
        state: 'running',
        phase,
        phaseAt,
        ...(progress === undefined ? {} : { progress }),
    };
}

function inferSingleTaskOutcome(taskMode, debugInfo) {
    if (!debugInfo || typeof debugInfo !== 'object') {
        return { task: taskMode, outcome: 'completed' };
    }

    if (debugInfo.skipped) {
        return {
            task: taskMode,
            outcome: 'skipped',
            reason: debugInfo.skipReason || null,
        };
    }

    if (debugInfo.dailyDryRun && debugInfo.dailyWouldPublish) {
        return { task: taskMode, outcome: 'dry-run', published: false };
    }

    if (debugInfo.opportunityDryRun && debugInfo.opportunityWouldPublish) {
        return { task: taskMode, outcome: 'dry-run', published: false };
    }

    const normalizedMode = String(taskMode || debugInfo.mode || '');
    const fields = normalizedMode.includes('account-opportunity')
        ? {
            generated: 'accountOpportunityGenerated',
            published: 'accountOpportunityPublished',
            validation: 'accountOpportunityValidationPassed',
        }
        : normalizedMode.includes('opportunity')
          ? {
              generated: 'opportunityGenerated',
              published: 'opportunityPublished',
              validation: 'opportunityValidationPassed',
          }
          : normalizedMode.includes('daily')
            ? {
                generated: 'dailyGenerated',
                published: 'dailyPublished',
                validation: 'dailyValidationPassed',
            }
            : null;

    if (!fields) {
        return { task: taskMode, outcome: 'completed' };
    }

    if (debugInfo[fields.published] === true) {
        return { task: taskMode, outcome: 'published', published: true };
    }

    if (debugInfo[fields.generated] === true && debugInfo[fields.validation] === false) {
        return { task: taskMode, outcome: 'not-published', published: false };
    }

    return { task: taskMode, outcome: 'completed' };
}

export function inferScheduledOutcome(mode, debugInfo) {
    const nestedTasks = mode === 'all' || mode === 'backup'
        ? [
            ['daily', debugInfo?.daily],
            ['opportunity', debugInfo?.opportunity],
            ['account-opportunity', debugInfo?.accountOpportunity],
        ].filter(([, value]) => value)
        : [];

    const taskOutcomes = nestedTasks.length > 0
        ? nestedTasks.map(([taskMode, value]) => inferSingleTaskOutcome(taskMode, value))
        : [inferSingleTaskOutcome(mode, debugInfo)];
    const outcomes = taskOutcomes.map((item) => item.outcome);

    let outcome = 'completed';
    if (outcomes.includes('not-published')) {
        outcome = outcomes.some((item) => item === 'published' || item === 'skipped')
            ? 'partial'
            : 'not-published';
    } else if (outcomes.includes('published')) {
        outcome = 'published';
    } else if (outcomes.every((item) => item === 'skipped')) {
        outcome = 'skipped';
    } else if (outcomes.includes('dry-run')) {
        outcome = 'dry-run';
    }

    return {
        outcome,
        published: taskOutcomes.some((item) => item.published === true),
        taskOutcomes,
    };
}

export async function storeScheduledRunStatus(kvNamespace, mode, dateOrAlias, status, options = {}) {
    const ttl = options.ttl || SCHEDULED_STATUS_TTL_SECONDS;
    const keys = getScheduledStatusKeys(mode, dateOrAlias, {
        includeCurrentAlias: Boolean(options.includeCurrentAlias),
    });

    await Promise.all(keys.map((key) => storeInKV(kvNamespace, key, status, ttl)));
    return keys;
}
