import { createOrUpdateGitHubFile, getGitHubFileContent, getGitHubFileSha } from './github.js';
import { buildMonthDirectoryIndex } from './contentUtils.js';
import { extractFrontMatterField } from './dailyHomeRepair.js';
import {
    DEFAULT_OPPORTUNITY_SECTION_DESCRIPTION,
    buildOpportunityPaths,
    updateSectionHomeIndexContent,
} from './opportunityUtils.js';
import {
    DEFAULT_ACCOUNT_OPPORTUNITY_SECTION_DESCRIPTION,
    buildAccountOpportunityPaths,
    updateAccountOpportunityHomeIndexContent,
} from './accountOpportunityUtils.js';

function assertDate(dateStr) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new Error('A valid date in YYYY-MM-DD format is required.');
    }
}

async function repairSectionHomePointer(env, dateStr, options) {
    assertDate(dateStr);

    const paths = options.buildPaths(dateStr);
    const pageContent = await getGitHubFileContent(env, paths.pagePath);

    if (!String(pageContent || '').trim()) {
        throw new Error(`${options.label} page is empty and cannot be used for home repair: ${paths.pagePath}.`);
    }

    let existingHomeContent = '';
    try {
        existingHomeContent = await getGitHubFileContent(env, paths.homePath);
    } catch (error) {
        console.warn(`[${options.logPrefix}] Home page not found, will create a new one.`);
    }

    const pageTitle = extractFrontMatterField(pageContent, 'title') || undefined;
    const homeContent = options.updateHome(existingHomeContent, pageContent, dateStr, {
        title: pageTitle,
        description: options.description,
        sectionPrefix: options.sectionPrefix,
    });

    const existingMonthIndexSha = await getGitHubFileSha(env, paths.monthDirectoryIndexPath);
    let monthDirectoryUpdated = false;
    if (!existingMonthIndexSha) {
        const monthDirectoryIndexContent = buildMonthDirectoryIndex(paths.yearMonth, { sidebarOpen: true });
        await createOrUpdateGitHubFile(
            env,
            paths.monthDirectoryIndexPath,
            monthDirectoryIndexContent,
            `Create ${options.label} month directory index for ${paths.yearMonth} (Home Repair)`,
            null,
        );
        monthDirectoryUpdated = true;
    }

    const existingHomeSha = await getGitHubFileSha(env, paths.homePath);
    await createOrUpdateGitHubFile(
        env,
        paths.homePath,
        homeContent,
        `Repair ${options.label} home page pointer for ${dateStr}`,
        existingHomeSha,
    );

    return {
        date: dateStr,
        pagePath: paths.pagePath,
        homePath: paths.homePath,
        monthDirectoryIndexPath: paths.monthDirectoryIndexPath,
        nextPath: paths.publicPath.replace(/\/$/, ''),
        homeUpdated: true,
        monthDirectoryUpdated,
    };
}

export function buildOpportunityHomeRepairContent(existingHomeContent, pageContent, dateStr) {
    return updateSectionHomeIndexContent(existingHomeContent, pageContent, dateStr, {
        title: extractFrontMatterField(pageContent, 'title') || undefined,
        description: DEFAULT_OPPORTUNITY_SECTION_DESCRIPTION,
        sectionPrefix: '/opportunity',
    });
}

export function buildAccountOpportunityHomeRepairContent(existingHomeContent, pageContent, dateStr) {
    return updateAccountOpportunityHomeIndexContent(existingHomeContent, pageContent, dateStr, {
        title: extractFrontMatterField(pageContent, 'title') || undefined,
        description: DEFAULT_ACCOUNT_OPPORTUNITY_SECTION_DESCRIPTION,
        sectionPrefix: '/account-opportunity',
    });
}

export async function repairOpportunityHomePointer(env, dateStr) {
    return repairSectionHomePointer(env, dateStr, {
        label: 'AI opportunity',
        logPrefix: 'OpportunityHomeRepair',
        buildPaths: buildOpportunityPaths,
        updateHome: updateSectionHomeIndexContent,
        description: DEFAULT_OPPORTUNITY_SECTION_DESCRIPTION,
        sectionPrefix: '/opportunity',
    });
}

export async function repairAccountOpportunityHomePointer(env, dateStr) {
    return repairSectionHomePointer(env, dateStr, {
        label: 'AI account opportunity',
        logPrefix: 'AccountOpportunityHomeRepair',
        buildPaths: buildAccountOpportunityPaths,
        updateHome: updateAccountOpportunityHomeIndexContent,
        description: DEFAULT_ACCOUNT_OPPORTUNITY_SECTION_DESCRIPTION,
        sectionPrefix: '/account-opportunity',
    });
}
