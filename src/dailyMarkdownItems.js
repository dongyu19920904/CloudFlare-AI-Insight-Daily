export function extractDailyMarkdownLinks(markdown) {
  const content = String(markdown || "");

  return [...content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)]
    .filter((match) => match.index == null || content[match.index - 1] !== "!")
    .map((match) => ({
      title: match[1].trim(),
      url: match[2].trim(),
    }));
}

function parseDailyItemHeading(rawHeading) {
  const heading = String(rawHeading || "").trim();
  const linkedHeading = heading.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);

  if (linkedHeading) {
    return {
      title: linkedHeading[1].trim(),
      headingLink: {
        title: linkedHeading[1].trim(),
        url: linkedHeading[2].trim(),
      },
    };
  }

  return {
    title: heading.replace(/^\*\*(.+)\*\*$/, "$1").trim(),
    headingLink: null,
  };
}

export function extractNumberedDailyItems(markdown) {
  const content = String(markdown || "");
  const itemRegex = /^###\s+(\d+)\.\s+([^\r\n]+)(?:\r?\n|$)([\s\S]*?)(?=^###\s+\d+\.\s+|\r?\n##\s+|(?![\s\S]))/gm;
  const items = [];

  for (const match of content.matchAll(itemRegex)) {
    const { title, headingLink } = parseDailyItemHeading(match[2]);
    const body = match[3] || "";
    const bodyLinks = extractDailyMarkdownLinks(body);
    const sourceLink = bodyLinks[0] || headingLink;

    items.push({
      number: Number.parseInt(match[1], 10),
      title,
      body,
      bodyLinks,
      headingLink,
      sourceLink,
      url: sourceLink?.url || "",
      context: `${title}\n${body}`,
      block: match[0],
    });
  }

  return items;
}
