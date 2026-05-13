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
