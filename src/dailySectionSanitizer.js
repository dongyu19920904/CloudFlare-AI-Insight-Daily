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

export function removeVolatileDailyImages(markdown) {
  return String(markdown || "")
    .replace(
      /!\[[^\]]*\]\(\s*(https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\s*\)[ \t]*(?:\r?\n)?/g,
      (imageMarkdown, imageUrl) => isVolatileDailyMediaUrl(imageUrl) ? "" : imageMarkdown
    )
    .replace(
      /<img\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>[ \t]*(?:\r?\n)?/gi,
      (imageHtml, imageUrl) => isVolatileDailyMediaUrl(imageUrl) ? "" : imageHtml
    )
    .replace(/^###\s+\*{0,2}相关配图\*{0,2}\s*(?=\r?\n(?:##\s|$))/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeDailyOutputPresentation(markdown) {
  return normalizeDailyChinesePunctuation(
    normalizeMisleadingDailySourceLabels(
      removeVolatileDailyImages(markdown)
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
