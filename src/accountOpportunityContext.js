export function buildAccountOpportunityContextOptions({ supplyDriven = false, dryRun = false } = {}) {
    return {
        preferCachedData: true,
        cachedOnly: Boolean(supplyDriven),
        skipDailyReplay: Boolean(supplyDriven),
        loadOpportunityReplay: !supplyDriven,
        includeCurrentOpportunityReplay: !supplyDriven,
        skipSourceCacheWrite: Boolean(dryRun),
    };
}
