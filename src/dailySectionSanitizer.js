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

export const DAILY_AIVORA_FAQ_CTA = "如需比较主流 AI 账号或订阅方案，并获得购买后的使用指导与售后支持，可访问 [**爱窝啦·AI账号店**](https://www.aivora.cn/)（官网 aivora.cn）查看当前可用服务。";

const DAILY_FAQ_SECTION_PATTERN = /^##\s*\*{0,2}.*(?:相关问题|常见问题|FAQ).*\*{0,2}\s*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im;
const AIVORA_MENTION_PATTERN = /(?:爱窝啦|爱沃哥|Aivora|aivora\.cn)/i;

function removeAivoraSentences(paragraph) {
  const sentences = String(paragraph || "").match(/[^。！？!?]+[。！？!?]?/g) || [];
  return sentences
    .filter((sentence) => !AIVORA_MENTION_PATTERN.test(sentence))
    .join("")
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
    /^##\s*\*{0,2}.*前沿研究与行业影响.*\*{0,2}\s*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im,
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
  /^##\s*\*{0,2}.*产品与功能更新.*\*{0,2}\s*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im,
  /^##\s*\*{0,2}.*前沿研究与行业影响.*\*{0,2}\s*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im,
  /^##\s*\*{0,2}.*开源\s*TOP\s*项目.*\*{0,2}\s*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im,
  /^##\s*\*{0,2}.*社媒精选.*\*{0,2}\s*[\s\S]*?(?=\n##\s+|(?![\s\S]))/im,
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
