function normalizeDateLabel(reportDate) {
  return typeof reportDate === "string" && reportDate.trim()
    ? reportDate.trim()
    : "today";
}

function hashString(input) {
  let hash = 0;
  for (const char of String(input || "")) {
    hash = (hash * 31 + char.charCodeAt(0)) % 2147483647;
  }
  return hash;
}

export function pickDailyCreativityModes(playbook, reportDate, count = 3) {
  const modes = playbook?.outputRules?.creativityModes || [];
  if (modes.length === 0) return [];

  const targetCount = Math.min(Math.max(count, 1), modes.length);
  const seed = hashString(normalizeDateLabel(reportDate));
  const startIndex = seed % modes.length;
  const selectedModes = [];
  const usedIndexes = new Set();

  let offset = 0;
  while (selectedModes.length < targetCount) {
    const index = (startIndex + offset) % modes.length;
    if (!usedIndexes.has(index)) {
      usedIndexes.add(index);
      selectedModes.push(modes[index]);
    }
    offset += 1;
  }

  return selectedModes;
}

export function buildDailyCreativityBrief(
  playbook,
  reportDate,
  options = {}
) {
  const issueLabel = options.issueLabel || "AI商机";
  const sectionLabels = options.sectionLabels || ["今日主推", "本周可试"];
  const modes = pickDailyCreativityModes(
    playbook,
    reportDate,
    playbook?.outputRules?.dailyCreativityModeCount || 3
  );

  if (modes.length === 0) {
    return [
      "### 今日创意卖法模式",
      "- 今天不要只写最稳妥的老套路。",
      "- 至少保留一个带点反常识的方向，但必须能落到今天就能试卖的商品或服务。",
    ].join("\n");
  }

  return [
    "### 今日创意卖法模式",
    `- ${issueLabel} 今天优先从下面 ${modes.length} 种模式里挑角度，不要整篇只写一种老卖法。`,
    ...modes.map((mode) =>
      [
        `- **${mode.label}**：${mode.summary}`,
        `  - 怎么赚钱：${mode.monetizationHint}`,
        `  - 新手起手：${mode.starterMove}`,
        `  - 别写成：${mode.avoid}`,
      ].join("\n")
    ),
    "",
    "### 今日执行约束",
    `- ${sectionLabels[0]} 和 ${sectionLabels[1]} 不能写成同一种卖法模式，至少要换一个角度。`,
    "- 至少保留一个“看起来有点反常识，但今天就能先试挂、试发、试卖”的方向。",
    "- 脑洞必须落到具体交付上：模板包、跑通包、筛选服务、迁移包、组合体验包这类都可以。",
    "- 先写买家今天能拿到的结果，再写工具名和热点，不要把脑洞写成空想。",
  ].join("\n");
}
