// src/handlers/scheduledDailyBlog.js
import { getISODate, removeMarkdownCodeBlock } from '../helpers.js';
import { callChatAPIStream } from '../chatapi.js';
import { getSystemPromptDailyBlog } from "../prompt/dailyBlogPrompt.js";
import { createOrUpdateGitHubFile, getGitHubFileSha, getDailyReportContent } from '../github.js';

export async function handleScheduledDailyBlog(event, env, ctx) {
    const today = new Date();
    const dateStr = getISODate();
    console.log(`[DailyBlog] Starting daily blog generation for ${dateStr}`);

    try {
        // 1. Get today's daily report content
        console.log(`[DailyBlog] Fetching today's daily report...`);
        const filePath = `daily/${dateStr}.md`;

        let dailyContent;
        try {
            dailyContent = await getDailyReportContent(env, filePath);
            if (!dailyContent) {
                console.log(`[DailyBlog] No daily report found for ${dateStr}. Skipping blog generation.`);
                return;
            }
        } catch (err) {
            console.log(`[DailyBlog] Error fetching daily report: ${err.message}`);
            return;
        }

        console.log(`[DailyBlog] Daily report fetched. Length: ${dailyContent.length}`);

        // 2. Prepare prompt content
        let userPrompt = `以下是 ${dateStr} 的 AI 资讯日报内容：\n\n`;
        userPrompt += dailyContent;
        userPrompt += `\n\n请根据以上内容，撰写一篇每日博客文章。今天日期是 ${dateStr}。`;

        // 3. Call AI to generate blog
        console.log(`[DailyBlog] Generating blog content with AI...`);
        const systemPrompt = getSystemPromptDailyBlog();

        let blogContent = "";
        for await (const chunk of callChatAPIStream(env, userPrompt, systemPrompt)) {
            blogContent += chunk;
        }
        blogContent = removeMarkdownCodeBlock(blogContent);

        if (!blogContent || blogContent.trim().length < 300) {
            console.error(`[DailyBlog] Generated content too short or empty.`);
            return;
        }

        console.log(`[DailyBlog] Blog generated. Length: ${blogContent.length}`);

        // 4. Generate filename based on date
        const blogFileName = `${dateStr}.md`;
        const blogFilePath = `blog/daily/${blogFileName}`;

        // 5. Commit to GitHub
        console.log(`[DailyBlog] Committing to GitHub: ${blogFilePath}`);
        const existingSha = await getGitHubFileSha(env, blogFilePath);
        const commitMessage = `${existingSha ? 'Update' : 'Create'} daily blog for ${dateStr}`;
        await createOrUpdateGitHubFile(env, blogFilePath, blogContent, commitMessage, existingSha);

        console.log(`[DailyBlog] Successfully published daily blog!`);

    } catch (error) {
        console.error(`[DailyBlog] Error:`, error);
    }
}
