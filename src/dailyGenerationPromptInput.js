function isDailyWatchOnlyPromptItem(item) {
  const text = String(item || "");
  return (
    /Placement Hint:\s*This is a welfare\/freebie item/i.test(text) ||
    /Placement Hint:\s*This is a low-evidence AI workflow pitch/i.test(text)
  );
}

export function buildDailyGenerationPromptInput(selectedContentItems = [], dailyFunContentItems = []) {
  const allPrimaryItems = (selectedContentItems || []).filter(Boolean);
  const watchOnlyItems = allPrimaryItems.filter((item) => isDailyWatchOnlyPromptItem(item));
  const primaryItems = allPrimaryItems.filter((item) => !isDailyWatchOnlyPromptItem(item));
  const primaryPrompt = `\n\n------\n\n${primaryItems.join("\n\n------\n\n")}\n\n------\n\n`;
  const selectedItemKeys = new Set(allPrimaryItems.map((item) => String(item).trim()).filter(Boolean));
  const funOnlyItems = (dailyFunContentItems || [])
    .filter(Boolean)
    .filter((item) => !selectedItemKeys.has(String(item).trim()));

  const promptParts = [primaryPrompt];

  if (watchOnlyItems.length > 0) {
    promptParts.push([
      "【值得关注专用候选素材】",
      "下面这些素材带有福利/羊毛/免费额度/优惠属性，只能作为 `## **📌 值得关注**` 里的提醒，最多选 1 条。",
      "Some candidates may be AI workflow pitches without official, tutorial, course, repo, or reproducible evidence rather than freebies; they are also watch-only and must not enter TOP.",
      "严禁把这些素材写进 `## **🔥 重磅 TOP 10**`，即使它们有图片、热度或 AI 关键词也不例外。",
      "如果你无法把它写成一条简短提醒，就直接不用它，不要为了凑数放进 TOP。",
      "",
      watchOnlyItems
        .map((item, index) => [`值得关注候选 ${index + 1}:`, item].join("\n"))
        .join("\n\n------\n\n"),
      "\n------\n\n",
    ].join("\n"));
  }

  if (funOnlyItems.length > 0) {
    promptParts.push([
      "【AI趣闻专用候选素材】",
      "下面这些素材是专门留给 `## **😄 AI趣闻**` 的候选。只要这里有可用素材，就必须先选 1 条写完整趣闻，不要省略。",
      "只有当这些候选全是论文/融资/政策/公司通稿，且没有人物、用户、工具动作或反常结果时，才可以省略整个 AI趣闻栏目。",
      "不要因为它们出现在这里就塞进 TOP 10；TOP 10 仍按主线素材和评分标准筛选。",
      "写 AI趣闻时必须二次创作短标题，并按 Hook -> What -> Punchline 再开发，不要照搬原文标题、推文正文或项目名长句。",
      "",
      funOnlyItems
        .map((item, index) => [`趣闻候选 ${index + 1}:`, item].join("\n"))
        .join("\n\n------\n\n"),
      "\n------\n\n",
    ].join("\n"));
  }

  return promptParts.join("\n");
}
