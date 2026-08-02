import {
  DAILY_OPEN_SOURCE_MIN,
  DAILY_SOCIAL_MIN,
  DAILY_TOP_TARGET,
} from "./dailyContentRules.js";

function isDailyWelfarePromptItem(item) {
  const text = String(item || "");
  return /Placement Hint:\s*This is a welfare\/freebie item/i.test(text);
}

function isDailyLowEvidenceWorkflowPromptItem(item) {
  const text = String(item || "");
  return /Placement Hint:\s*This is a low-evidence AI workflow pitch/i.test(text);
}

function isDailyWatchOnlyPromptItem(item) {
  return false;
}

function isDailyPromptHiddenItem(item) {
  return isDailyWelfarePromptItem(item) || isDailyLowEvidenceWorkflowPromptItem(item);
}

export function countDailyTopEligiblePromptItems(selectedContentItems = []) {
  return (selectedContentItems || [])
    .filter(Boolean)
    .filter((item) => !isDailyWatchOnlyPromptItem(item))
    .filter((item) => !isDailyPromptHiddenItem(item))
    .length;
}

export function buildDailyGenerationPromptInput(selectedContentItems = [], dailyFunContentItems = []) {
  const allSelectedItems = (selectedContentItems || []).filter(Boolean);
  const allPrimaryItems = allSelectedItems.filter((item) => !isDailyPromptHiddenItem(item));
  const watchOnlyItems = allPrimaryItems.filter((item) => isDailyWatchOnlyPromptItem(item));
  const primaryItems = allPrimaryItems.filter((item) => !isDailyWatchOnlyPromptItem(item));
  const projectCount = primaryItems.filter((item) => /^Project Name:/m.test(item)).length;
  const socialCount = primaryItems.filter((item) => /^socialMedia Post/m.test(item)).length;
  const paperCount = primaryItems.filter((item) => /^Papers Title:/m.test(item)).length;
  const newsCount = primaryItems.filter((item) => /^News Title:/m.test(item)).length;
  const openSourceReserve = Math.min(projectCount, DAILY_OPEN_SOURCE_MIN);
  const socialReserve = Math.min(socialCount, DAILY_SOCIAL_MIN);
  const socialTopLimit = Math.max(0, socialCount - socialReserve);
  const sectionBudget = [
    "【栏目候选预算】",
    `本次主素材共有：新闻 ${newsCount} 条、GitHub 当日日榜项目 ${projectCount} 个、社媒原帖 ${socialCount} 条、论文 ${paperCount} 篇。`,
    `先为开源 TOP 项目预留 ${openSourceReserve} 个 GitHub 候选；项目不足 ${DAILY_OPEN_SOURCE_MIN} 个时才按实际数量输出。`,
    `先为社媒精选预留 ${socialReserve} 条社媒候选；今日焦点最多使用 ${socialTopLimit} 条社媒，不能把社媒素材全部提前用掉。`,
    "新闻素材充足时，至少各留 1 条给产品与功能更新、行业变化与个人影响；论文候选存在时至少留 1 篇给前沿研究。",
    `在完成以上预留后，再从剩余候选中写满今日焦点 TOP ${DAILY_TOP_TARGET}；不得重复使用同一事件。`,
  ].join("\n");
  const primaryPrompt = `\n\n${sectionBudget}\n\n------\n\n${primaryItems.join("\n\n------\n\n")}\n\n------\n\n`;
  const selectedItemKeys = new Set(allSelectedItems.map((item) => String(item).trim()).filter(Boolean));
  const funOnlyItems = (dailyFunContentItems || [])
    .filter(Boolean)
    .filter((item) => !isDailyPromptHiddenItem(item))
    .filter((item) => !selectedItemKeys.has(String(item).trim()));

  const promptParts = [primaryPrompt];

  if (watchOnlyItems.length > 0) {
    promptParts.push([
      "【值得关注专用候选素材】",
      "下面这些素材带有福利/羊毛/免费额度/优惠属性，只能作为 `## **📌 值得关注**` 里的提醒，最多选 1 条。",
      "Some candidates may be AI workflow pitches without official, tutorial, course, repo, or reproducible evidence rather than freebies; they are also watch-only and must not enter TOP.",
      `严禁把这些素材写进 \`## **🔥 今日焦点 TOP ${DAILY_TOP_TARGET}**\`，即使它们有图片、热度或 AI 关键词也不例外。`,
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
      "不要因为它们出现在这里就塞进今日焦点；今日焦点仍按主线素材和评分标准筛选。",
      "写 AI趣闻时必须二次创作纯文本短标题，把原始来源链接放在正文真实细节附近，并按 Hook -> What -> Punchline 再开发，不要照搬原文标题、推文正文或项目名长句。",
      "",
      funOnlyItems
        .map((item, index) => [`趣闻候选 ${index + 1}:`, item].join("\n"))
        .join("\n\n------\n\n"),
      "\n------\n\n",
    ].join("\n"));
  }

  return promptParts.join("\n");
}
