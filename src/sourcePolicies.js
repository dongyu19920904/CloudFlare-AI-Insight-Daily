function toBoolean(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function normalizeMaxItems(value, fallback = 2) {
    const parsed = parseInt(String(value ?? ''), 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    return fallback;
}

export function isLinuxDoUrl(url) {
    if (!url) return false;
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return hostname === 'linux.do' || hostname.endsWith('.linux.do');
    } catch {
        return false;
    }
}

export function stripMediaTags(html) {
    if (!html) return '';
    const input = String(html);
    // Remove image and video tags to avoid broken media from anti-hotlink sources.
    return input
        .replace(/<img\b[^>]*>/gi, '')
        .replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, '')
        .replace(/<video\b[^>]*\/>/gi, '');
}

export function resolveLinuxDoPolicy(env) {
    return {
        maxItems: normalizeMaxItems(env?.LINUXDO_MAX_ITEMS, 2),
        stripMedia: !toBoolean(env?.LINUXDO_KEEP_MEDIA),
    };
}

export function applyLinuxDoPolicy(items, policy = {}) {
    const maxItems = normalizeMaxItems(policy.maxItems, 2);
    const stripMedia = policy.stripMedia !== false;
    let linuxCount = 0;
    const output = [];

    for (const item of items || []) {
        if (!item || typeof item !== 'object') continue;

        if (!isLinuxDoUrl(item.url)) {
            output.push(item);
            continue;
        }

        linuxCount += 1;
        if (linuxCount > maxItems) continue;

        if (!stripMedia || !item.details || typeof item.details.content_html !== 'string') {
            output.push(item);
            continue;
        }

        output.push({
            ...item,
            details: {
                ...item.details,
                content_html: stripMediaTags(item.details.content_html),
            },
        });
    }

    return output;
}

function canonicalizeUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        parsed.hash = '';
        for (const key of [...parsed.searchParams.keys()]) {
            if (/^utm_/i.test(key) || key === 'ref' || key === 'si') {
                parsed.searchParams.delete(key);
            }
        }
        const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
        const query = parsed.searchParams.toString();
        return `${parsed.origin.toLowerCase()}${pathname}${query ? `?${query}` : ''}`;
    } catch {
        return String(url).trim().toLowerCase();
    }
}

function getHostname(url) {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return '';
    }
}

function isEmojiLikeTitle(title) {
    const normalized = String(title ?? '').trim();
    if (!normalized) return false;
    return /^[^\p{L}\p{N}]+$/u.test(normalized);
}

function isLowValueTelegramItem(item) {
    const source = String(item?.source ?? '').toLowerCase();
    const url = String(item?.url ?? '').toLowerCase();
    const title = String(item?.title ?? '').trim();
    const description = String(item?.description ?? '').trim();
    const shortText = title.length + description.length < 40;

    if (source.includes('每日沙雕墙') || url.includes('t.me/woshadiao/')) {
        return true;
    }

    return (source.includes('telegram') || url.includes('t.me/')) && isEmojiLikeTitle(title) && shortText;
}

function isPaperLikeNewsItem(item) {
    const hostname = getHostname(item?.url);
    if (hostname === 'papers.cool' || hostname === 'arxiv.org' || hostname.endsWith('.arxiv.org')) {
        return true;
    }

    const source = String(item?.source ?? '').toLowerCase();
    return source === 'artificial intelligence' || source.includes('arxiv');
}

function isRecursiveDailyFeedItem(item) {
    const source = String(item?.source ?? '').toLowerCase();
    const url = String(item?.url ?? '').toLowerCase();
    const title = String(item?.title ?? '').toLowerCase();

    if (source.includes('ai洞察日报 rss feed') || source.includes('hubtoday')) {
        return true;
    }

    if (url.includes('ai.hubtoday.app') || url.includes('news.aivora.cn')) {
        return true;
    }

    return /\d{4}-\d{2}-\d{2}日刊/.test(title);
}

function isRoundupSocialPost(item) {
    const title = String(item?.title ?? '').toLowerCase();
    const url = String(item?.url ?? '').toLowerCase();
    const source = String(item?.source ?? '').toLowerCase();

    if (!url.includes('x.com') && !url.includes('twitter.com')) {
        return false;
    }

    if (title.includes('ai资讯日报') || title.includes('ai 日报') || title.includes('ai日报')) {
        return true;
    }

    return source.includes('gorden sun') && /日报|日刊/.test(title);
}

export const LOW_EVIDENCE_AI_WORKFLOW_HINT =
    'Placement Hint: This is a low-evidence AI workflow pitch without official, tutorial, course, repo, or reproducible workflow evidence. Keep it out of TOP; at most use it in watch section as unverified, or skip it.';
const DEFAULT_LOW_EVIDENCE_WORKFLOW_FOLO_SOURCE_IDS = ['55447111940354048'];

function parsePolicyIdList(value, fallback = []) {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    const text = String(value || '').trim();
    if (!text) return fallback;
    return text.split(/[,\s|]+/).map((item) => item.trim()).filter(Boolean);
}

function buildQualityPolicyText(input) {
    if (typeof input === 'string') return input;

    return [
        input?.title,
        input?.description,
        input?.source,
        input?.url,
        input?.details?.content_html,
    ].filter(Boolean).join(' ');
}

function hasAiCreatorWorkflowPitch(text) {
    const normalized = String(text || '');
    const hasAiSignal =
        /\b(ai|aigc|chatgpt|gpt|claude|gemini|sora|runway|capcut|cursor|codex)\b/i.test(normalized) ||
        /人工智能|生成式|大模型|剪映/i.test(normalized);
    const hasCreatorWorkflow =
        /短视频|视频|口播|带货|寄拍|自媒体|副业|涨粉|粉丝|矩阵|四平台|多平台|自动发布|工作流|workflow|automation|auto[-\s]?publish|creator|douyin|抖音|快手|小红书|youtube|tiktok/i.test(normalized);
    const hasBigPromise =
        /一天\s*(?:[一二三四五六七八九十\d]+)\s*条|一周\s*万粉|万粉|涨粉|爆粉|全自动|自动化|批量|一键|四平台|多平台|月入|日入|躺赚|被动收入|副业|带货/i.test(normalized);

    return hasAiSignal && hasCreatorWorkflow && hasBigPromise;
}

function hasStrongWorkflowEvidence(text) {
    const normalized = String(text || '');
    const evidenceText = normalized.replace(
        /(?:(?:没有|无|缺少|未提供|没有给出|没给|不是|并非|非官方|未见|看不到|找不到)\s*|\b(?:without|no|not)\b\s*).{0,90}(?:github\.com|gitlab\.com|github|repo(?:sitory)?|代码仓库|源码|工作流文件|配置文件|配置文档|模板下载|下载链接|官方信息|官方发布|官方链接|官方文档|官方教程|课程链接|课程地址|教程链接|视频教程|完整教程|搭建教程|文档|course|tutorial|lesson|docs?)/gi,
        ' '
    );

    return (
        /github\.com\/(?!features\/|topics\/|marketplace\/|blog\/)[^/\s)#?]+\/[^/\s)#?]+/i.test(evidenceText) ||
        /gitlab\.com\/[^/\s)#?]+\/[^/\s)#?]+/i.test(evidenceText) ||
        /huggingface\.co\/spaces\/[^/\s)#?]+\/[^/\s)#?]+/i.test(evidenceText) ||
        /(?:https?:\/\/[^\s)]+\/[^\s)]*(?:docs?|documentation|tutorial|course|lesson|learn|academy|guide|template|workflow|download)[^\s)]*)/i.test(evidenceText) ||
        /开源|代码仓库|源码|repo(?:sitory)?|workflow\s+file|工作流文件|配置文件|配置文档|模板下载|下载链接|官方信息|官方发布|官方链接|官方文档|官方教程|课程链接|课程地址|教程链接|视频教程|完整教程|搭建教程|step[-\s]?by[-\s]?step|official\s+(?:docs?|tutorial|course|guide|release|announcement)|course\s+link|tutorial\s+link|video\s+tutorial/i.test(evidenceText) ||
        /(n8n|dify|coze|make\.com|zapier|ffmpeg|comfyui|剪映|capcut).{0,40}(模板|配置|workflow|工作流|教程|文档|download|下载|repo|仓库)/i.test(evidenceText)
    );
}

export function isLowEvidenceAiWorkflowPitch(input) {
    const text = buildQualityPolicyText(input);
    if (!hasAiCreatorWorkflowPitch(text)) return false;
    return !hasStrongWorkflowEvidence(text);
}

function getFoloSourceId(item) {
    const details = item?.details || {};
    return String(
        details.foloSourceId ||
        details.foloFeedId ||
        details.feedId ||
        details.sourceId ||
        item?.foloSourceId ||
        item?.feedId ||
        item?.sourceId ||
        ''
    ).trim();
}

function shouldApplyLowEvidenceWorkflowPolicy(item, options = {}) {
    const sourceId = getFoloSourceId(item);
    if (!sourceId) return false;
    const targetIds = parsePolicyIdList(
        options.lowEvidenceWorkflowFoloSourceIds,
        DEFAULT_LOW_EVIDENCE_WORKFLOW_FOLO_SOURCE_IDS
    );
    return targetIds.includes(sourceId);
}

function buildDedupKey(item) {
    const normalizedUrl = canonicalizeUrl(item?.url);
    if (normalizedUrl) return normalizedUrl;

    const normalizedTitle = String(item?.title ?? '').trim().toLowerCase();
    const normalizedDate = String(item?.published_date ?? '').slice(0, 10);
    return `${normalizedTitle}::${normalizedDate}`;
}

export function applyNewsSourcePolicy(items, options = {}) {
    const seen = new Set();
    const output = [];

    for (const item of items || []) {
        if (!item || typeof item !== 'object') continue;
        if (isLowValueTelegramItem(item)) continue;
        if (isPaperLikeNewsItem(item)) continue;
        if (isRecursiveDailyFeedItem(item)) continue;
        if (isRoundupSocialPost(item)) continue;

        const dedupKey = buildDedupKey(item);
        if (dedupKey && seen.has(dedupKey)) continue;
        if (dedupKey) seen.add(dedupKey);

        output.push(
            shouldApplyLowEvidenceWorkflowPolicy(item, options) && isLowEvidenceAiWorkflowPitch(item)
                ? {
                    ...item,
                    details: {
                        ...(item.details || {}),
                        lowEvidenceAiWorkflowPitch: true,
                    },
                }
                : item
        );
    }

    return output;
}
