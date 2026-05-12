import { createOrUpdateGitHubFile, getGitHubFileContent, getGitHubFileSha } from './github.js';
import { formatDateToChinese } from './helpers.js';
import { buildMonthDirectoryIndex, getYearMonth, updateHomeIndexContent } from './contentUtils.js';

export function extractFrontMatterField(content, fieldName) {
    const field = String(fieldName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = String(content || '').match(new RegExp(`^${field}:\\s*(.+?)\\s*$`, 'm'));
    if (!match) return '';
    return match[1].trim().replace(/^["']|["']$/g, '');
}

export function buildDailyHomeRepairContent(existingHomeContent, dailyPageContent, dateStr, options = {}) {
    const title =
        extractFrontMatterField(dailyPageContent, 'title') ||
        options.title ||
        (options.dailyTitle ? `${options.dailyTitle} ${formatDateToChinese(dateStr)}` : undefined);

    return updateHomeIndexContent(existingHomeContent, dailyPageContent, dateStr, { title });
}

export async function repairDailyHomePointer(env, dateStr) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new Error('A valid date in YYYY-MM-DD format is required.');
    }

    const yearMonth = getYearMonth(dateStr);
    const dailyPagePath = `content/cn/${yearMonth}/${dateStr}.md`;
    const monthDirectoryIndexPath = `content/cn/${yearMonth}/_index.md`;
    const homePath = 'content/cn/_index.md';
    const nextPath = `/${yearMonth}/${dateStr}`;

    let dailyPageContent = '';
    try {
        dailyPageContent = await getGitHubFileContent(env, dailyPagePath);
    } catch (error) {
        throw new Error(`Daily page is not available for home repair: ${dailyPagePath}. ${error.message}`);
    }

    if (!String(dailyPageContent || '').trim()) {
        throw new Error(`Daily page is empty and cannot be used for home repair: ${dailyPagePath}.`);
    }

    let existingHomeContent = '';
    try {
        existingHomeContent = await getGitHubFileContent(env, homePath);
    } catch (error) {
        console.warn(`[DailyHomeRepair] Home page not found, will create a new one.`);
    }

    const homeContent = buildDailyHomeRepairContent(existingHomeContent, dailyPageContent, dateStr, {
        dailyTitle: env.DAILY_TITLE,
    });

    const existingMonthIndexSha = await getGitHubFileSha(env, monthDirectoryIndexPath);
    let monthDirectoryUpdated = false;
    if (!existingMonthIndexSha) {
        const monthDirectoryIndexContent = buildMonthDirectoryIndex(yearMonth, { sidebarOpen: true });
        await createOrUpdateGitHubFile(
            env,
            monthDirectoryIndexPath,
            monthDirectoryIndexContent,
            `Create month directory index for ${yearMonth} (Home Repair)`,
            null,
        );
        monthDirectoryUpdated = true;
    }

    const existingHomeSha = await getGitHubFileSha(env, homePath);
    await createOrUpdateGitHubFile(
        env,
        homePath,
        homeContent,
        `Repair home page pointer for ${dateStr}`,
        existingHomeSha,
    );

    return {
        date: dateStr,
        dailyPagePath,
        homePath,
        monthDirectoryIndexPath,
        nextPath,
        homeUpdated: true,
        monthDirectoryUpdated,
    };
}
