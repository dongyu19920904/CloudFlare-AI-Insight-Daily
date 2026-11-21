export function extractDailyMarkdownLinks(markdown) {
  const content = String(markdown || "");

  return [...content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)]
    .filter((match) => match.index == null || content[match.index - 1] !== "!")
    .map((match) => ({
      title: match[1].trim(),
      url: match[2].trim(),
    }));
}

// Parse inline destinations without treating balanced URL parentheses as the end of a link.
export function dailyInlineLinkRanges(markdown) {
  const text = String(markdown || '');
  const results = [];
  for (const start of text.matchAll(/!?\[(?:\\[^\r\n]|[^\]\\\r\n])*\]\([ \t]*(?:\r?\n[ \t]*)?/g)) {
    const from = start.index + start[0].length;
    const rest = text.slice(from);
    let consumed = 0;
    let url = '';
    if (rest[0] === '<') {
      const angle = rest.match(/^<([^<>\r\n]+)>/);
      if (!angle) continue;
      consumed = angle[0].length;
      url = angle[1];
    } else {
      let depth = 0;
      for (; consumed < rest.length; consumed++) {
        const char = rest[consumed];
        if (char === '\\' && consumed + 1 < rest.length) { consumed++; continue; }
        if (char === '(') depth++;
        else if (char === ')' && depth === 0) break;
        else if (char === ')') depth--;
        else if (/\s/.test(char)) break;
      }
      if (depth !== 0) continue;
      url = rest.slice(0, consumed);
    }
    const tail = rest.slice(consumed).match(/^(?:(?:[ \t]+|[ \t]*\r?\n[ \t]*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?[ \t]*(?:\r?\n[ \t]*)?\)/);
    if (tail) results.push({ start: start.index, end: from + consumed + tail[0].length,
      url: url.replace(/\\([()])/g, '$1'), image: start[0].startsWith('!') });
  }
  return results;
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
