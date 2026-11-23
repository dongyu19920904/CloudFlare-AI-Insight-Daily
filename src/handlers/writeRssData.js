import { formatMarkdownText, formatDateToGMT8WithTime, removeMarkdownCodeBlock, parseReportDate } from '../helpers.js';
import { getDailyReportContent, getGitHubFileSha, createOrUpdateGitHubFile } from '../github.js';
import { storeInKV } from '../kv.js';
import { marked } from '../marked.esm.js';
import { callChatAPI } from '../chatapi.js'; // 导入 callChatAPI
import { getSummarizationSimplifyPrompt } from '../prompt/summarizationSimplifyPrompt.js';
import { getAppUrl } from '../appUrl.js';

/**
 * 处理生成RSS内容的请求（从daily目录读取，生成AI内容，写入rss目录）
 * @param {Request} request - 请求对象
 * @param {object} env - 环境对象
 * @returns {Promise<Response>} 包含生成内容的响应
 */
export async function handleGenerateRssContent(request, env) {
    const url = new URL(request.url);
    const dateStr = parseReportDate(url.searchParams.getAll('date'));
    if (!dateStr) {
        return new Response('Expected one valid date (YYYY-MM-DD)', { status: 400 });
    }

    try {
        // 从daily目录读取原始内容
        const dailyPath = `daily/${dateStr}.md`;
        console.log(`[generateRssContent] Attempting to get content from GitHub path: ${dailyPath}`);
        let content = await getDailyReportContent(env, dailyPath);

        if (!content) {
            console.warn(`[generateRssContent] No content found for ${dailyPath}. Returning 404.`);
            return new Response(`No content found for ${dailyPath}`, { status: 404 });
        }
        console.log(`[generateRssContent] Successfully retrieved content for ${dailyPath}. Content length: ${content.length}`);

        content = extractContentFromSecondHash(content);

        // 生成AI内容（内部已包含截断逻辑）
        const aiContent = await generateAIContent(env, content);

        // 写入到rss目录
        const rssPath = `rss/${dateStr}.md`;
        const existingSha = await getGitHubFileSha(env, rssPath);
        const commitMessage = `${existingSha ? 'Update' : 'Create'} RSS content for ${dateStr}`;
        await createOrUpdateGitHubFile(env, rssPath, aiContent, commitMessage, existingSha);
        console.log(`[generateRssContent] Successfully wrote AI content to GitHub: ${rssPath}`);

        // 从 "YYYY-MM-DD" 格式的 dateStr 中提取 "YYYY-MM"
        const yearMonth = dateStr.substring(0, 7);
        const result = {
            report_date: dateStr,
            title: dateStr + '日刊',
            link: '/' + yearMonth + '/' + dateStr + '/',
            content_markdown: aiContent,
            github_path: rssPath,
            published_date: formatDateToGMT8WithTime(new Date())
        };

        console.log(`[generateRssContent] Successfully generated and saved content for ${dateStr}. Content length: ${aiContent.length}`);

        return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });
    } catch (error) {
        console.error('[generateRssContent] Error generating content:', error.message, error.stack);
        return new Response(`Error generating content: ${error.message}`, { status: 500 });
    }
}

/**
 * 处理写入RSS数据的请求（从rss目录读取已生成的内容，写入KV）
 * @param {Request} request - 请求对象
 * @param {object} env - 环境对象
 * @returns {Promise<Response>} 包含写入结果的响应
 */
export async function handleWriteRssData(request, env) {
    const url = new URL(request.url);
    const dateStr = parseReportDate(url.searchParams.getAll('date'));
    if (!dateStr) {
        return new Response('Expected one valid date (YYYY-MM-DD)', { status: 400 });
    }

    try {
        // 从rss目录读取已生成的AI内容
        const rssPath = `rss/${dateStr}.md`;
        console.log(`[writeRssData] Attempting to get content from GitHub path: ${rssPath}`);
        let content = await getDailyReportContent(env, rssPath);

        if (!content) {
            console.warn(`[writeRssData] No content found for ${rssPath}. Returning 404.`);
            return new Response(`No content found for ${rssPath}. Please run /generateRssContent first.`, { status: 404 });
        }
        console.log(`[writeRssData] Successfully retrieved content for ${rssPath}. Content length: ${content.length}`);

        // 从 "YYYY-MM-DD" 格式的 dateStr 中提取 "YYYY-MM"
        const yearMonth = dateStr.substring(0, 7);
        const report = {
            report_date: dateStr,
            title: dateStr + '日刊',
            link: '/' + yearMonth + '/' + dateStr + '/',
            content_html: marked.parse(formatMarkdownText(content)),
            // 可以添加其他相關欄位，例如作者、來源等
            published_date: formatDateToGMT8WithTime(new Date()) // 記錄保存時間
        };

        const kvKey = `${dateStr}-report`;
        console.log(`[writeRssData] Preparing to store report in KV. Key: ${kvKey}, Report object:`, JSON.stringify(report).substring(0, 200) + '...'); // Log first 200 chars
        await storeInKV(env.DATA_KV, kvKey, report);
        console.log(`[writeRssData] Successfully stored report in KV with key: ${kvKey}`);

        return new Response(JSON.stringify(report), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });
    } catch (error) {
        console.error('[writeRssData] Error handling daily report:', error.message, error.stack);
        return new Response(`Error handling daily report: ${error.message}`, { status: 500 });
    }
}

/**
 * 从第二个 ### 开始截取内容，包括 ###。
 *
 * @param {string} content - 原始文本内容。
 * @returns {string} 截取后的内容。
 */
export function extractContentFromSecondHash(content) {
    const parts = content.split('###');
    if (parts.length > 2) {
        // 原始逻辑：重新组合从第二个 ### 开始的所有部分
        let newcontent = '###' + parts.slice(2).join('###');
        const lastHashIndex = newcontent.lastIndexOf('AI资讯日报语音版');
        if (lastHashIndex !== -1) {
            newcontent = newcontent.substring(0, lastHashIndex-10);
        }
        return newcontent;
    }
    return content; // 如果没有找到 ### 或不符合上述条件，则返回原始内容
}

/**
 * 截断内容到指定字数，并添加省略样式
 * @param {string} content - 原始内容
 * @param {number} maxLength - 最大字数，默认150
 * @returns {string} 截断后的内容
 */
export function truncateContent(content, maxLength = 150) {
    if (!content || content.length <= maxLength) {
        return content;
    }

    // 截断到指定长度
    let truncated = content.substring(0, maxLength);

    // 尝试在最后一个换行符处截断
    const lastNewlineEnd = truncated.lastIndexOf('\n');

    // 如果找到换行符且位置合理（至少保留一半内容），则在换行符处截断
    if (lastNewlineEnd > maxLength / 2) {
        truncated = content.substring(0, lastNewlineEnd);
    }

    // 添加省略样式
    truncated += '\n\n......\n\n*[剩余内容已省略]*';

    return truncated;
}

/**
 * 调用 Gemini 或 OpenAI 模型生成指定提示词的内容。
 * 此方法可供外部调用。
 *
 * @param {object} env - 环境对象，包含 AI 模型相关的配置。
 * @param {string} promptText - 用户提示词。
 * @returns {Promise<string>} AI 模型生成的内容。
 * @throws {Error} 如果 API 调用失败或返回空内容。
 */
export async function generateAIContent(env, promptText) {
    console.log(`[generateAIContent] Calling AI model with prompt: ${promptText.substring(0, 100)}...`);
    try {
        let result = await callChatAPI(env, promptText, getSummarizationSimplifyPrompt());
        console.log(`[generateAIContent] AI model returned content. Length: ${result.length}`);
        result = removeMarkdownCodeBlock(result);
        // 截断内容到360字并添加省略样式
        result = truncateContent(result, 360);
        result += "\n\n</br>" + getAppUrl();
        return result;
    } catch (error) {
        console.error('[generateAIContent] Error calling AI model:', error.message, error.stack);
        throw new Error(`Failed to generate AI content: ${error.message}`);
    }
}
