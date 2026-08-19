import { extractDailyMarkdownLinks, extractNumberedDailyItems } from "./dailyMarkdownItems.js";

function normalizeSectionUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(String(url).trim());
    let hostname = parsed.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    if (hostname === "twitter.com") hostname = "x.com";
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${hostname}${pathname}`.toLowerCase();
  } catch {
    return String(url).trim().toLowerCase().replace(/\/+$/, "");
  }
}

function normalizeSectionTitle(title) {
  return String(title || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_+=[\]{};:'",.<>/?\\|，。！？、；：“”‘’（）【】《》·—…-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const VOLATILE_DAILY_MEDIA_HOSTS = ["telesco.pe"];
const EDITORIAL_SOURCE_NAMES = new Map([
  ["aibase.com", "AIBase"],
  ["36kr.com", "36氪"],
  ["chinaz.com", "站长之家"],
  ["jiqizhixin.com", "机器之心"],
  ["qbitai.com", "量子位"],
  ["xinzhiyuan.com", "新智元"],
]);

function getNormalizedHostname(url) {
  try {
    return new URL(String(url || "").trim()).hostname
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/^m\./, "");
  } catch {
    return "";
  }
}

export function isVolatileDailyMediaUrl(url) {
  const hostname = getNormalizedHostname(url);
  return VOLATILE_DAILY_MEDIA_HOSTS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

export function isLowValueDailyMediaUrl(url) {
  try {
    const parsed = new URL(String(url || "").trim());
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsed.pathname.toLowerCase();
    const segments = pathname.split("/").filter(Boolean);
    const basename = segments.at(-1) || "";

    if (hostname === "pbs.twimg.com" && segments.includes("profile_images")) {
      return true;
    }

    if (segments.some((segment) => /^(?:avatar|avatars|profile|profile-images|profile_images|logo|logos|icon|icons|favicon)$/.test(segment))) {
      return true;
    }

    return (
      /(?:^|[-_])(?:avatar|logo|favicon|icon)(?:[-_.]|$)/i.test(basename) ||
      /_normal(?:\.[a-z0-9]+)?$/i.test(basename)
    );
  } catch {
    return false;
  }
}

export function isUsableDailyMediaUrl(url) {
  return Boolean(url) && !isVolatileDailyMediaUrl(url) && !isLowValueDailyMediaUrl(url);
}

function transformDailyProse(markdown, transform) {
  const content = String(markdown || "");
  const protectedPattern = /```[\s\S]*?```|`[^`\r\n]+`|https?:\/\/[^\s)>"']+/g;
  let output = "";
  let cursor = 0;

  for (const match of content.matchAll(protectedPattern)) {
    output += transform(content.slice(cursor, match.index));
    output += match[0];
    cursor = match.index + match[0].length;
  }

  return output + transform(content.slice(cursor));
}

export function normalizeDailyChinesePunctuation(markdown) {
  return transformDailyProse(markdown, (text) => text
    .replace(
      /([\u3400-\u9fff])(\*{0,2}),(?=(?:\*{0,2})?[\u3400-\u9fffA-Za-z0-9])/g,
      "$1$2，"
    )
    .replace(
      /([A-Za-z0-9])(\*{0,2}),(?=(?:\*{0,2})?[\u3400-\u9fff])/g,
      "$1$2，"
    ));
}

export function normalizeMisleadingDailySourceLabels(markdown) {
  return String(markdown || "").replace(
    /\[([^\]\r\n]+)\]\((https?:\/\/[^\s)]+)(\s+"[^"]*")?\)/g,
    (fullMatch, label, url, optionalTitle = "", offset, content) => {
      if (offset > 0 && content[offset - 1] === "!") return fullMatch;
      if (!/(?:官方|官网)/.test(label)) return fullMatch;

      const sourceName = EDITORIAL_SOURCE_NAMES.get(getNormalizedHostname(url));
      if (!sourceName) return fullMatch;

      return `[${sourceName} 对这项消息的报道](${url}${optionalTitle})`;
    }
  );
}

function isDailySourceTagLinkLabel(label) {
  const compact = String(label || "")
    .normalize("NFKC")
    .replace(/[\s·：:，,。.!！?？、“”‘’（）()【】\[\]]+/g, "");

  return (
    /^(?:AIBase对这项消息的报道|实测录屏帖|独家报道|实测分析帖|技术拆解帖|转发的评测分析|频道整理的消息|频道整理的观察|安装实测帖|点评帖|转发分析帖|官方公告|官方说明|官方页面|官方文档|项目主页|项目仓库)$/i.test(compact) ||
    (compact.length <= 12 && /(?:帖|推文|报道|消息|观察|分析|录屏|公告|说明|页面|文档|主页|仓库)$/i.test(compact)) ||
    /^[\u3400-\u9fffA-Za-z0-9._-]{1,20}(?:官方)?(?:推文|帖子|公告|页面|文档|报道)(?:显示|宣布|介绍|说明|称|指出)$/i.test(compact) ||
    /^[\u3400-\u9fffA-Za-z0-9._-]{1,16}(?:整理|分享|发布|转发|实测|展示)(?:的)?(?:技术细节|实测记录|截图推文|截图|视频|推文|帖子|内容|介绍|消息|分析|演示)$/i.test(compact) ||
    /^[\u3400-\u9fffA-Za-z0-9._-]{1,16}(?:的)?(?:技术细节|实测记录|截图推文|频道消息|报道详情)$/i.test(compact)
  );
}

export function normalizeDailyTopEvidenceLinkLabels(markdown) {
  let output = String(markdown || "");

  for (const item of extractNumberedDailyItems(output)) {
    const sourceLink = item.sourceLink;
    if (!sourceLink || !isDailySourceTagLinkLabel(sourceLink.title)) continue;

    const originalLink = `[${sourceLink.title}](${sourceLink.url})`;
    const factLabel = String(item.title || "").replace(/\s+/g, " ").trim();
    if (!factLabel || !item.block.includes(originalLink)) continue;

    const normalizedBlock = item.block.replace(
      originalLink,
      `[${factLabel}](${sourceLink.url})`
    );
    output = output.replace(item.block, normalizedBlock);
  }

  return output;
}

function countDailyHighlightCharacters(value) {
  return (String(value || "").match(/[A-Za-z0-9\u3400-\u9fff]/g) || []).length;
}

function collectDailyHighlightProtectedRanges(body) {
  return [...String(body || "").matchAll(
    /\*\*[^*\r\n]+\*\*|!\[[^\]]*\]\([^\r\n]*?\)|\[[^\]]+\]\([^\r\n]*?\)|`[^`\r\n]+`|<[^>]+>/g
  )].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function overlapsDailyHighlightRange(start, length, ranges) {
  const end = start + length;
  return ranges.some((range) => start < range.end && end > range.start);
}

function isLowValueDailyHighlight(text) {
  const compact = String(text || "")
    .normalize("NFKC")
    .replace(/[\s。.!！?？、“”‘’]+/g, "");

  return (
    /^(?:宝玉|dotey|作者|博主|网友|开发者|官方|媒体|频道)$/i.test(compact) ||
    /^(?:松了一口气|值得关注|值得注意|意义重大|未来可期|很有意思|太离谱了?|令人兴奋)$/i.test(compact)
  );
}

function collectDailyHighlightCandidates(body, title, protectedRanges) {
  const candidates = [];
  const seen = new Set();

  const addMatches = (pattern, priority) => {
    for (const match of String(body || "").matchAll(pattern)) {
      const leadingWhitespace = match[0].search(/\S/);
      const text = match[0].trim();
      const index = match.index + Math.max(0, leadingWhitespace);
      const visibleLength = countDailyHighlightCharacters(text);
      const key = text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
      if (
        !text ||
        visibleLength < 2 ||
        visibleLength > 16 ||
        /(?:从|的|了|为|与|和|及|并|可|在|向|对|把|将)$/.test(text) ||
        seen.has(key) ||
        overlapsDailyHighlightRange(index, text.length, protectedRanges)
      ) {
        continue;
      }
      seen.add(key);
      candidates.push({ index, text, priority, visibleLength });
    }
  };

  addMatches(
    /(?:约|近|超|超过|低于|高于|最高|至少|仅)?\s*\d+(?:\.\d+)?\s*(?:%|％|万|亿|千|百|GB|TB|MB|毫秒|秒|分钟|小时|个月|次|项|类|家|颗(?:星)?|Stars?|Star|吉瓦|GW|美元|元|倍|分|个)/gi,
    0
  );
  addMatches(/(?:MITRE\s+ATT&CK|NIST\s+CSF\s+\d(?:\.\d+)?)/gi, 1);
  addMatches(/(?<![A-Za-z0-9&])\b[A-Z]{2,}(?:\s*[、/]\s*[A-Z]{2,})+\b/g, 1);
  addMatches(
    /(?:无需|不需要)[\u3400-\u9fff]{1,6}(?=就|也|即可|便|，|。|；)/g,
    2
  );
  addMatches(
    /(?:允许|免费|本地|远程|自动|即时|立即|无缝|严格|穷举|修复|降低|提高|重置|覆盖|收录|统一|推翻|找到|干扰|策略性|支持|开放|上线|发布)[\u3400-\u9fff]{1,8}(?=[，。；、：:的而并与或就可尚])/g,
    2
  );
  addMatches(
    /(?:一个|一种|一项|首个|首次|同样|现有|当前|主要|关键|真实|独立|开放|完整|原生|结构化)(?:反例|漏洞|限制|风险|结果|能力|接口|范围|成本|费用|利润|反馈|定价|证明)/g,
    3
  );
  addMatches(/有[\u3400-\u9fff]{1,4}、有[\u3400-\u9fff]{1,4}/g, 3);
  addMatches(
    /(?:\d{4}\s*年(?:\s*\d{1,2}\s*月)?|\d{1,2}\s*月\s*(?:到|至|-)\s*\d{1,2}\s*月)/g,
    4
  );

  const titleTerms = [
    ...(String(title || "").match(/[A-Za-z][A-Za-z0-9.+/-]{2,}/g) || []),
  ].filter((term) => !/^(?:agent|stars?|top)$/i.test(term));
  const chineseEntity = String(title || "").match(
    /^([\u3400-\u9fff]{2,8}?)(?=手机|推出|发布|上线|新增|支持|开放|登上|反思|免费|可|用)/
  )?.[1];
  if (chineseEntity) titleTerms.push(chineseEntity);

  for (const term of titleTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    addMatches(new RegExp(escaped, "gi"), 5);
  }

  return candidates.sort((left, right) =>
    left.priority - right.priority ||
    (left.priority === 2 ? left.visibleLength - right.visibleLength : left.index - right.index)
  );
}

export function ensureDailyTopHighlightDensity(markdown, targetCount = 3) {
  let output = String(markdown || "");
  const target = Math.max(0, Number(targetCount) || 0);

  for (const item of extractNumberedDailyItems(output)) {
    let normalizedBody = item.body.replace(
      /\*\*([^*\r\n]+)\*\*/g,
      (fullMatch, text) => isLowValueDailyHighlight(text) ? text : fullMatch
    );
    const existingHighlights = [...normalizedBody.matchAll(/\*\*([^*\r\n]+)\*\*/g)];
    let needed = target - existingHighlights.length;
    if (needed <= 0) {
      if (normalizedBody !== item.body) {
        output = output.replace(item.block, item.block.replace(item.body, normalizedBody));
      }
      continue;
    }

    const protectedRanges = collectDailyHighlightProtectedRanges(normalizedBody);
    const selected = [];
    for (const candidate of collectDailyHighlightCandidates(normalizedBody, item.title, protectedRanges)) {
      if (needed <= 0) break;
      if (selected.some((entry) =>
        candidate.index < entry.index + entry.text.length &&
        candidate.index + candidate.text.length > entry.index
      )) {
        continue;
      }
      selected.push(candidate);
      needed -= 1;
    }

    if (selected.length === 0) {
      if (normalizedBody !== item.body) {
        output = output.replace(item.block, item.block.replace(item.body, normalizedBody));
      }
      continue;
    }
    for (const candidate of selected.sort((left, right) => right.index - left.index)) {
      normalizedBody = `${normalizedBody.slice(0, candidate.index)}**${candidate.text}**${normalizedBody.slice(candidate.index + candidate.text.length)}`;
    }
    output = output.replace(item.block, item.block.replace(item.body, normalizedBody));
  }

  return output;
}

export function removeVolatileDailyImages(markdown) {
  return String(markdown || "")
    .replace(
      /!\[[^\]]*\]\(\s*(https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\s*\)[ \t]*(?:\r?\n)?/g,
      (imageMarkdown, imageUrl) => isUsableDailyMediaUrl(imageUrl) ? imageMarkdown : ""
    )
    .replace(
      /<img\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>[ \t]*(?:\r?\n)?/gi,
      (imageHtml, imageUrl) => isUsableDailyMediaUrl(imageUrl) ? imageHtml : ""
    )
    .replace(/^###\s+\*{0,2}相关配图\*{0,2}\s*(?=\r?\n(?:##\s|$))/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function removeDailyGenerationMetaNotes(markdown) {
  return String(markdown || "")
    .replace(
      /^\s*(?:今日|本次)?(?:合格\s*)?AI\s*相关素材共\s*\d+\s*条[^\r\n]*(?:实际只能输出|只能输出|最终输出)\s*\d+\s*条[^\r\n]*\r?\n?/gim,
      ""
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeDailyOutputPresentation(markdown) {
  return removeDailyGenerationMetaNotes(
    ensureDailyTopHighlightDensity(
      normalizeDailyTopEvidenceLinkLabels(normalizeDailyChinesePunctuation(
        normalizeMisleadingDailySourceLabels(
          removeVolatileDailyImages(markdown)
        )
      ))
    )
  );
}

function isRepeatedSectionStory(leftTitle, rightTitle) {
  const left = normalizeSectionTitle(leftTitle);
  const right = normalizeSectionTitle(rightTitle);

  if (!left || !right) return false;
  if (left === right) return true;

  if (left.length >= 10 && right.length >= 10) {
    return left.includes(right) || right.includes(left);
  }

  return false;
}

export const DAILY_AIVORA_FAQ_CTA = "需要进一步比较当前公开的 AI 账号或订阅服务时，可查看 [**爱窝啦·AI账号店**](https://www.aivora.cn/)；商品、价格与可用状态以官网实时页面为准。";

const DAILY_FAQ_SECTION_PATTERN = /^##\s*\*{0,2}.*(?:相关问题|常见问题|FAQ).*\*{0,2}\s*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im;
const AIVORA_MENTION_PATTERN = /(?:爱窝啦|爱沃哥|Aivora|aivora\.cn)/i;

function removeAivoraSentences(paragraph) {
  const urls = [];
  const protectedParagraph = String(paragraph || "").replace(/https?:\/\/[^\s)]+/gi, (url) => {
    const index = urls.push(url) - 1;
    return /^https?:\/\/(?:www\.)?aivora\.cn(?:[/?#]|$)/i.test(url)
      ? `__AIVORA_URL_${index}__`
      : `__URL_${index}__`;
  });
  const sentences = protectedParagraph.match(/[^。！？!?]+[。！？!?]?/g) || [];
  return sentences
    .filter((sentence) => !AIVORA_MENTION_PATTERN.test(sentence))
    .join("")
    .replace(/__(?:AIVORA_)?URL_(\d+)__/g, (_, index) => urls[Number(index)] || "")
    .trim();
}

export function normalizeDailyFaqAivoraCta(markdown) {
  return String(markdown || "").replace(DAILY_FAQ_SECTION_PATTERN, (section) => {
    const cleaned = section
      .trim()
      .split(/\n{2,}/)
      .map((paragraph) => AIVORA_MENTION_PATTERN.test(paragraph)
        ? removeAivoraSentences(paragraph)
        : paragraph.trim())
      .filter(Boolean);
    const cleanedSection = cleaned.join("\n\n");
    const answerText = cleanedSection
      .replace(/^#{2,3}\s+.*$/gm, "")
      .replace(/!?\[([^\]]+)\]\([^\s)]+\)/g, "$1")
      .replace(/[*_`>]/g, "")
      .replace(/\s+/g, "")
      .trim();

    if (answerText.length < 30) return cleanedSection;
    return `${cleanedSection}\n\n${DAILY_AIVORA_FAQ_CTA}`;
  });
}

export function stripDailyHeadingCountSuffix(markdown) {
  return String(markdown || "").replace(
    /^(#{1,6}\s+(?:\*\*)?.*?)(?:\s*[\uFF08(]\s*\d+(?:\s*[-~\u2013\u2014]\s*\d+)?\s*\u6761\s*[\uFF09)]\s*)(\*\*)?(\s*)$/gm,
    (_, heading, boldClose = "", trailing = "") => `${heading.trimEnd()}${boldClose}${trailing}`
  );
}

export function sanitizeDuplicateDailySections(markdown) {
  const content = stripDailyHeadingCountSuffix(markdown);
  if (!content) return content;

  const topMatch = content.match(/^##\s*\*\*.*TOP.*\*\*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im);
  if (!topMatch) return content;

  const topLinks = [...topMatch[0].matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)].map((match) => ({
    title: match[1],
    url: normalizeSectionUrl(match[2]),
  }));

  const seenStories = [...topLinks];
  const sectionPatterns = [
    /^##\s*\*\*.*(?:📌|🎯|值得关注|关注).*\*\*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im,
    /^##\s*\*{0,2}.*产品与功能更新.*\*{0,2}\s*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im,
    /^##\s*\*{0,2}.*前沿研究(?:与行业影响)?.*\*{0,2}\s*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im,
    /^##\s*\*{0,2}.*行业(?:变化与个人影响|展望与社会影响).*\*{0,2}\s*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im,
    /^##\s*\*{0,2}.*开源\s*TOP\s*项目.*\*{0,2}\s*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im,
    /^##\s*\*{0,2}.*社媒精选.*\*{0,2}\s*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im,
    /^##\s*\*\*.*(?:😄|😆|AI\s*趣闻|趣闻).*\*\*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im,
  ];

  let sanitized = content;

  for (const pattern of sectionPatterns) {
    sanitized = sanitized.replace(pattern, (section) => {
      const headingMatch = section.match(/^##[^\n]*/);
      if (!headingMatch) return section;

      const heading = headingMatch[0];
      const body = section.slice(heading.length).trim();
      if (!body) return section;

      const chunks = body.split(/\n(?=(?:###\s+|- \*\*|\*\*\[))/g).map((item) => item.trim()).filter(Boolean);
      const keptChunks = [];

      for (const chunk of chunks) {
        const links = [...chunk.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)]
          .filter((match) => match.index == null || chunk[match.index - 1] !== "!")
          .map((match) => ({
            title: match[1],
            url: normalizeSectionUrl(match[2]),
          }));

        if (links.length === 0) {
          keptChunks.push(chunk);
          continue;
        }

        const duplicated = links.some((link) =>
          seenStories.some((story) => {
            if (story.url && link.url && story.url === link.url) return true;
            return isRepeatedSectionStory(story.title, link.title);
          })
        );

        if (duplicated) continue;

        seenStories.push(...links);
        keptChunks.push(chunk);
      }

      if (keptChunks.length === 0) {
        return heading;
      }

      return `${heading}\n\n${keptChunks.join("\n\n")}`;
    });
  }

  return sanitized.replace(/\n{3,}/g, "\n\n").trim();
}

const DAILY_TOP_PROMOTION_SECTION_PATTERN = /^##\s*[^\r\n]*(?:产品与功能更新|前沿研究(?:与行业影响)?|行业(?:变化与个人影响|展望与社会影响)|社媒精选)[^\r\n]*(?:\r?\n|$)[\s\S]*?(?=^##\s+|(?![\s\S]))/gim;

function extractDailyTopPromotionCandidates(markdown, seenUrls) {
  const candidates = [];

  for (const sectionMatch of String(markdown || "").matchAll(DAILY_TOP_PROMOTION_SECTION_PATTERN)) {
    const section = sectionMatch[0];
    const itemPattern = /^###\s+(?!\d+\.)[^\r\n]+(?:\r?\n|$)[\s\S]*?(?=^###\s+|(?![\s\S]))/gm;

    for (const itemMatch of section.matchAll(itemPattern)) {
      const block = itemMatch[0].trim();
      const heading = block.match(/^###\s+([^\r\n]+)/)?.[1]?.trim() || "";
      const body = block.replace(/^###\s+[^\r\n]+(?:\r?\n|$)/, "").trim();
      const sourceLink = extractDailyMarkdownLinks(body)[0];
      const normalizedUrl = normalizeSectionUrl(sourceLink?.url);
      if (!heading || !sourceLink || !normalizedUrl || seenUrls.has(normalizedUrl)) continue;
      if (/^(?:github\.com|gitlab\.com)\//i.test(normalizedUrl)) continue;

      candidates.push({
        block,
        title: heading
          .replace(/^\[([^\]]+)\]\(https?:\/\/[^\s)]+\)$/, "$1")
          .replace(/^\*\*(.+)\*\*$/, "$1")
          .trim(),
        body,
        normalizedUrl,
        highlightCount: (body.match(/\*\*[^*\r\n]+\*\*/g) || []).length,
        mediaCount: (body.match(/!\[[^\]]*\]\([^\n)]+\)|<(?:img|video)\b/gi) || []).length,
      });
      seenUrls.add(normalizedUrl);
    }
  }

  return candidates.sort((left, right) =>
    right.highlightCount - left.highlightCount ||
    right.mediaCount - left.mediaCount
  );
}

export function ensureUniqueDailyTopSources(markdown) {
  const content = String(markdown || "");
  const topMatch = content.match(/^##\s*\*{0,2}.*TOP.*\*{0,2}\s*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im);
  if (!topMatch) return content;

  const topSection = topMatch[0];
  const topHeading = topSection.match(/^##[^\r\n]*/)?.[0] || "";
  const topItems = extractNumberedDailyItems(topSection);
  const seenUrls = new Set();
  const keptItems = [];
  let duplicateCount = 0;

  for (const item of topItems) {
    const normalizedUrl = normalizeSectionUrl(item.url);
    if (normalizedUrl && seenUrls.has(normalizedUrl)) {
      duplicateCount += 1;
      continue;
    }
    if (normalizedUrl) seenUrls.add(normalizedUrl);
    keptItems.push(item);
  }

  if (duplicateCount === 0) return content;

  const promotionCandidates = extractDailyTopPromotionCandidates(content, new Set(seenUrls));
  if (promotionCandidates.length < duplicateCount) {
    return content;
  }

  const promoted = promotionCandidates.slice(0, duplicateCount);
  const rebuiltBlocks = [
    ...keptItems.map((item) => ({ title: item.title, body: item.body.trim() })),
    ...promoted.map((item) => ({ title: item.title, body: item.body })),
  ].map((item, index) => `### ${index + 1}. ${item.title}\n\n${item.body}`.trim());

  let output = content;
  for (const candidate of promoted) {
    output = output.replace(candidate.block, "");
  }
  output = output.replace(topSection, `${topHeading}\n\n${rebuiltBlocks.join("\n\n")}`);

  return output.replace(/\n{3,}/g, "\n\n").trim();
}

function isDailyGithubRepositoryUrl(url) {
  return /^github\.com\/[^/\s]+\/[^/\s]+$/i.test(normalizeSectionUrl(url));
}

export function enforceDailyTopGithubLimit(markdown, maxProjects = 1) {
  const content = String(markdown || "");
  const topMatch = content.match(/^##\s*\*{0,2}.*TOP.*\*{0,2}\s*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im);
  if (!topMatch) return content;

  const topSection = topMatch[0];
  const topHeading = topSection.match(/^##[^\r\n]*/)?.[0] || "";
  const topItems = extractNumberedDailyItems(topSection);
  const allowedProjects = Math.max(0, Number(maxProjects) || 0);
  let projectCount = 0;
  let removedCount = 0;
  const keptItems = [];

  for (const item of topItems) {
    if (isDailyGithubRepositoryUrl(item.url)) {
      projectCount += 1;
      if (projectCount > allowedProjects) {
        removedCount += 1;
        continue;
      }
    }
    keptItems.push(item);
  }

  if (removedCount === 0) return content;

  const rebuiltHeading = topHeading.replace(/\bTOP\s+\d+\b/i, `TOP ${keptItems.length}`);
  const rebuiltBlocks = keptItems.map((item, index) =>
    item.block.trim().replace(/^###\s+\d+\./, `### ${index + 1}.`)
  );
  const rebuiltSection = `${rebuiltHeading}\n\n${rebuiltBlocks.join("\n\n")}`.trim();

  return content
    .replace(topSection, rebuiltSection)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function removeEmptyDailyFunSection(markdown) {
  return String(markdown || "")
    .replace(
      /^##\s*\*\*.*(?:😄|😆|AI\s*趣闻|趣闻).*\*\*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im,
      (section) => {
        const sourceLinks = [...section.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)]
          .filter((match) => match.index == null || section[match.index - 1] !== "!");
        return sourceLinks.length === 0 ? "" : section;
      },
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const OPTIONAL_DAILY_TOPIC_SECTION_PATTERNS = [
  /^##[^\r\n]*产品与功能更新[^\r\n]*(?:\r?\n|$)[\s\S]*?(?=^##\s+|(?![\s\S]))/im,
  /^##[^\r\n]*前沿研究(?:与行业影响)?[^\r\n]*(?:\r?\n|$)[\s\S]*?(?=^##\s+|(?![\s\S]))/im,
  /^##[^\r\n]*行业(?:变化与个人影响|展望与社会影响)[^\r\n]*(?:\r?\n|$)[\s\S]*?(?=^##\s+|(?![\s\S]))/im,
  /^##[^\r\n]*开源\s*TOP\s*项目[^\r\n]*(?:\r?\n|$)[\s\S]*?(?=^##\s+|(?![\s\S]))/im,
  /^##[^\r\n]*社媒精选[^\r\n]*(?:\r?\n|$)[\s\S]*?(?=^##\s+|(?![\s\S]))/im,
];

export function removeEmptyDailyTopicSections(markdown) {
  let content = String(markdown || "");

  for (const pattern of OPTIONAL_DAILY_TOPIC_SECTION_PATTERNS) {
    content = content.replace(pattern, (section) => {
      const sourceLinks = [...section.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)]
        .filter((match) => match.index == null || section[match.index - 1] !== "!");
      return sourceLinks.length === 0 ? "" : section;
    });
  }

  return content.replace(/\n{3,}/g, "\n\n").trim();
}
