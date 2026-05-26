export function buildDailyGenerationPromptInput(selectedContentItems = [], dailyFunContentItems = []) {
  const primaryItems = (selectedContentItems || []).filter(Boolean);
  const primaryPrompt = `\n\n------\n\n${primaryItems.join("\n\n------\n\n")}\n\n------\n\n`;
  const selectedItemKeys = new Set(primaryItems.map((item) => String(item).trim()).filter(Boolean));
  const funOnlyItems = (dailyFunContentItems || [])
    .filter(Boolean)
    .filter((item) => !selectedItemKeys.has(String(item).trim()));

  if (funOnlyItems.length === 0) {
    return primaryPrompt;
  }

  return [
    primaryPrompt,
    "【AI趣闻专用候选素材】",
    "下面这些素材优先供 `## **😄 AI趣闻**` 使用，目的是让趣闻由模型完整生成，而不是最后靠兜底模板补齐。",
    "不要因为它们出现在这里就塞进 TOP 10；TOP 10 仍按主线素材和评分标准筛选。",
    "写 AI趣闻时必须二次创作短标题，并按 Hook -> What -> Punchline 再开发，不要照搬原文标题、推文正文或项目名长句。",
    "",
    funOnlyItems
      .map((item, index) => [`趣闻候选 ${index + 1}:`, item].join("\n"))
      .join("\n\n------\n\n"),
    "\n------\n\n",
  ].join("\n");
}
