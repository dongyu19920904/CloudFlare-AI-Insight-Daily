// src/handlers/scheduledWeeklyBlog.js
import { getISODate, removeMarkdownCodeBlock } from '../helpers.js';
import { callChatAPIStream } from '../chatapi.js';
import { getSystemPromptWeeklyBlog } from "../prompt/weeklyBlogPrompt.js";
import { createOrUpdateGitHubFile, getGitHubFileSha, getDailyReportContent } from '../github.js';

export async function handleScheduledWeeklyBlog(event, env, ctx) {
    const today = new Date();
    const dateStr = getISODate();
    console.log(`[WeeklyBlog] Starting weekly blog generation for ${dateStr}`);

    try {
        // 1. Collect past 7 days of daily reports
        console.log(`[WeeklyBlog] Fetching past 7 days of daily reports...`);
        const dailyContents = [];
        
        for (let i = 1; i <= 7; i++) {
            const pastDate = new Date(today);
            pastDate.setDate(today.getDate() - i);
            const pastDateStr = pastDate.toISOString().split('T')[0];
            const filePath = `content/cn/daily/${pastDateStr}.md`;
            
            try {
                const content = await getDailyReportContent(env, filePath);
                if (content) {
                    dailyContents.push({
                        date: pastDateStr,
                        content: content
                    });
                    console.log(`[WeeklyBlog] Fetched ${filePath}`);
                }
            } catch (err) {
                console.log(`[WeeklyBlog] No content for ${filePath}, skipping.`);
            }
        }

        if (dailyContents.length === 0) {
            console.log(`[WeeklyBlog] No daily reports found. Skipping blog generation.`);
            return;
        }

        console.log(`[WeeklyBlog] Collected ${dailyContents.length} daily reports.`);

        // 2. Prepare prompt content
        const weekStart = dailyContents[dailyContents.length - 1]?.date || dateStr;
        const weekEnd = dailyContents[0]?.date || dateStr;
        
        let userPrompt = `以下是 ${weekStart} 至 ${weekEnd} 这一周的 AI 日报内容：\n\n`;
        
        for (const daily of dailyContents.reverse()) { // Oldest first
            userPrompt += `\n\n=== ${daily.date} ===\n\n`;
            userPrompt += daily.content;
            userPrompt += '\n\n---\n\n';
        }
        
        userPrompt += `\n\n请根据以上内容，撰写一篇本周 AI 深度周报/博客文章。今天日期是 ${dateStr}。`;

        // 3. Call AI to generate blog
        console.log(`[WeeklyBlog] Generating blog content with AI...`);
        const systemPrompt = getSystemPromptWeeklyBlog();
        
        let blogContent = "";
        for await (const chunk of callChatAPIStream(env, userPrompt, systemPrompt)) {
            blogContent += chunk;
        }
        blogContent = removeMarkdownCodeBlock(blogContent);

        if (!blogContent || blogContent.trim().length < 500) {
            console.error(`[WeeklyBlog] Generated content too short or empty.`);
            return;
        }

        console.log(`[WeeklyBlog] Blog generated. Length: ${blogContent.length}`);

        // 4. Generate filename based on week number
        const weekNumber = getWeekNumber(today);
        const year = today.getFullYear();
        const blogFileName = `${year}-week-${String(weekNumber).padStart(2, '0')}.md`;
        const blogFilePath = `content/blog/${blogFileName}`;

        // 5. Commit to GitHub
        console.log(`[WeeklyBlog] Committing to GitHub: ${blogFilePath}`);
        const existingSha = await getGitHubFileSha(env, blogFilePath);
        const commitMessage = `${existingSha ? 'Update' : 'Create'} weekly blog for ${year} Week ${weekNumber}`;
        await createOrUpdateGitHubFile(env, blogFilePath, blogContent, commitMessage, existingSha);
        
        console.log(`[WeeklyBlog] Successfully published weekly blog!`);

    } catch (error) {
        console.error(`[WeeklyBlog] Error:`, error);
    }
}

// Helper: Get ISO week number
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
