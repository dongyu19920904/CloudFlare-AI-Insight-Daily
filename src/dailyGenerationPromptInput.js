import {
  DAILY_OPEN_SOURCE_MIN,
  DAILY_SOCIAL_MIN,
  DAILY_SOCIAL_TARGET,
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

function classifyDailyPromptItem(item) {
  const text = String(item || "");
  if (/^Project Name:/m.test(text)) return "project";
  if (/^socialMedia Post/m.test(text)) return "socialMedia";
  if (/^Papers Title:/m.test(text)) return "paper";
  if (/^News Title:/m.test(text)) return "news";
  return "other";
}

function allocateDailyPromptItems(items = []) {
  const primaryItems = (items || []).filter(Boolean);
  const buckets = {
    project: primaryItems.filter((item) => classifyDailyPromptItem(item) === "project"),
    socialMedia: primaryItems.filter((item) => classifyDailyPromptItem(item) === "socialMedia"),
    paper: primaryItems.filter((item) => classifyDailyPromptItem(item) === "paper"),
    news: primaryItems.filter((item) => classifyDailyPromptItem(item) === "news"),
  };
  let reserveBudget = Math.max(0, primaryItems.length - DAILY_TOP_TARGET);
  const reserveCounts = {
    project: 0,
    socialMedia: 0,
    paper: 0,
    news: 0,
  };
  const reserveOne = (sourceType, limit) => {
    if (reserveBudget <= 0 || reserveCounts[sourceType] >= Math.min(buckets[sourceType].length, limit)) {
      return;
    }
    reserveCounts[sourceType] += 1;
    reserveBudget -= 1;
  };

  // First create distinct sections, then use any remaining surplus to make them richer.
  reserveOne("project", DAILY_OPEN_SOURCE_MIN);
  reserveOne("socialMedia", DAILY_SOCIAL_MIN);
  if (buckets.paper.length > 0) {
    reserveOne("paper", 1);
  } else {
    reserveOne("news", 2);
  }
  reserveOne("project", DAILY_OPEN_SOURCE_MIN);
  reserveOne("socialMedia", DAILY_SOCIAL_MIN);
  reserveOne("news", 2);

  const reserved = {
    project: buckets.project.slice(0, reserveCounts.project),
    socialMedia: buckets.socialMedia.slice(0, reserveCounts.socialMedia),
    paper: buckets.paper.slice(0, reserveCounts.paper),
    news: reserveCounts.news > 0 ? buckets.news.slice(-reserveCounts.news) : [],
  };
  const reservedItems = new Set(Object.values(reserved).flat());

  return {
    topItems: primaryItems.filter((item) => !reservedItems.has(item)),
    reserved,
    counts: {
      project: buckets.project.length,
      socialMedia: buckets.socialMedia.length,
      paper: buckets.paper.length,
      news: buckets.news.length,
    },
  };
}

function getDailyPromptItemUrl(item) {
  return String(item || "").match(/^Url:\s*(https?:\/\/\S+)/im)?.[1]?.trim().toLowerCase() || "";
}

function dedupeDailyPromptItemsByUrl(items = []) {
  const seenUrls = new Set();
  const seenUnlinkedItems = new Set();

  return (items || []).filter((item) => {
    const normalizedItem = String(item || "").trim();
    if (!normalizedItem) return false;

    const url = getDailyPromptItemUrl(normalizedItem);
    if (url) {
      if (seenUrls.has(url)) return false;
      seenUrls.add(url);
      return true;
    }

    if (seenUnlinkedItems.has(normalizedItem)) return false;
    seenUnlinkedItems.add(normalizedItem);
    return true;
  });
}

function getDailySocialFingerprint(item) {
  const content = String(item || "").match(/^Content:\s*(.+)$/im)?.[1] || "";
  return content
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "")
    .slice(0, 120);
}

function getDailyPromptItemFingerprint(item) {
  const text = String(item || "");
  const title = text.match(/^(?:Project Name|News Title|Papers Title):\s*(.+)$/im)?.[1]
    || text.match(/^Content:\s*(.+)$/im)?.[1]
    || "";
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "")
    .slice(0, 120);
}

function selectSupplementalDailySocialItems(
  selectedContentItems,
  dailyFunContentItems,
  reservedSocialItems
) {
  const needed = Math.max(0, DAILY_SOCIAL_TARGET - reservedSocialItems.length);
  if (needed === 0) return [];

  const selectedKeys = new Set(
    (selectedContentItems || []).map((item) => String(item).trim()).filter(Boolean)
  );
  const seenUrls = new Set(reservedSocialItems.map(getDailyPromptItemUrl).filter(Boolean));
  const seenFingerprints = new Set(
    reservedSocialItems.map(getDailySocialFingerprint).filter(Boolean)
  );
  const supplementalItems = [];

  for (const item of dailyFunContentItems || []) {
    const normalizedItem = String(item || "").trim();
    if (!normalizedItem || selectedKeys.has(normalizedItem) || isDailyPromptHiddenItem(normalizedItem)) continue;
    if (classifyDailyPromptItem(normalizedItem) !== "socialMedia") continue;

    const url = getDailyPromptItemUrl(normalizedItem);
    const fingerprint = getDailySocialFingerprint(normalizedItem);
    if ((url && seenUrls.has(url)) || (fingerprint && seenFingerprints.has(fingerprint))) continue;

    supplementalItems.push(normalizedItem);
    if (url) seenUrls.add(url);
    if (fingerprint) seenFingerprints.add(fingerprint);
    if (supplementalItems.length >= needed) break;
  }

  return supplementalItems;
}

function selectSupplementalDailyTopBackupItems(
  selectedContentItems,
  dailyFunContentItems,
  supplementalSocialItems,
  topItemCount,
  limit = 5
) {
  if (topItemCount < DAILY_TOP_TARGET - 2 || limit <= 0) return [];

  const excludedItems = new Set(
    [...(selectedContentItems || []), ...(supplementalSocialItems || [])]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  );
  const seenUrls = new Set(
    (selectedContentItems || []).map(getDailyPromptItemUrl).filter(Boolean)
  );
  const seenFingerprints = new Set(
    (selectedContentItems || []).map(getDailyPromptItemFingerprint).filter(Boolean)
  );
  const backupItems = [];

  for (const item of dailyFunContentItems || []) {
    const normalizedItem = String(item || "").trim();
    if (!normalizedItem || excludedItems.has(normalizedItem) || isDailyPromptHiddenItem(normalizedItem)) continue;
    if (classifyDailyPromptItem(normalizedItem) === "project") continue;

    const url = getDailyPromptItemUrl(normalizedItem);
    const fingerprint = getDailyPromptItemFingerprint(normalizedItem);
    if ((url && seenUrls.has(url)) || (fingerprint && seenFingerprints.has(fingerprint))) continue;

    backupItems.push(normalizedItem);
    if (url) seenUrls.add(url);
    if (fingerprint) seenFingerprints.add(fingerprint);
    if (backupItems.length >= limit) break;
  }

  return backupItems;
}

export function getDailyPromptAllocationStats(selectedContentItems = [], dailyFunContentItems = []) {
  const dedupedSelectedItems = dedupeDailyPromptItemsByUrl(selectedContentItems);
  const primaryItems = dedupedSelectedItems
    .filter(Boolean)
    .filter((item) => !isDailyWatchOnlyPromptItem(item))
    .filter((item) => !isDailyPromptHiddenItem(item));
  const allocation = allocateDailyPromptItems(primaryItems);
  const supplementalSocialItems = selectSupplementalDailySocialItems(
    dedupedSelectedItems,
    dailyFunContentItems,
    allocation.reserved.socialMedia
  );
  const supplementalTopBackupItems = selectSupplementalDailyTopBackupItems(
    dedupedSelectedItems,
    dailyFunContentItems,
    supplementalSocialItems,
    allocation.topItems.length
  );
  const topCapacityFillCount = Math.min(
    supplementalTopBackupItems.length,
    Math.max(0, DAILY_TOP_TARGET - allocation.topItems.length)
  );

  return {
    topItems: allocation.topItems.length + topCapacityFillCount,
    reservedProjectItems: allocation.reserved.project.length,
    reservedSocialItems: allocation.reserved.socialMedia.length + supplementalSocialItems.length,
    reservedPaperItems: allocation.reserved.paper.length,
    reservedNewsItems: allocation.reserved.news.length,
  };
}

export function countDailyTopEligiblePromptItems(selectedContentItems = [], dailyFunContentItems = []) {
  return getDailyPromptAllocationStats(selectedContentItems, dailyFunContentItems).topItems;
}

export function buildDailyGenerationPromptInput(selectedContentItems = [], dailyFunContentItems = []) {
  const allSelectedItems = dedupeDailyPromptItemsByUrl(selectedContentItems);
  const allPrimaryItems = allSelectedItems.filter((item) => !isDailyPromptHiddenItem(item));
  const watchOnlyItems = allPrimaryItems.filter((item) => isDailyWatchOnlyPromptItem(item));
  const primaryItems = allPrimaryItems.filter((item) => !isDailyWatchOnlyPromptItem(item));
  const allocation = allocateDailyPromptItems(primaryItems);
  const supplementalSocialItems = selectSupplementalDailySocialItems(
    allSelectedItems,
    dailyFunContentItems,
    allocation.reserved.socialMedia
  );
  const supplementalTopBackupItems = selectSupplementalDailyTopBackupItems(
    allSelectedItems,
    dailyFunContentItems,
    supplementalSocialItems,
    allocation.topItems.length
  );
  const socialSectionItems = [...allocation.reserved.socialMedia, ...supplementalSocialItems];
  const requiredTopBackupItems = Math.max(0, DAILY_TOP_TARGET - allocation.topItems.length);
  const promotedTopBackupItems = supplementalTopBackupItems.slice(0, requiredTopBackupItems);
  const replacementTopBackupItems = supplementalTopBackupItems.slice(promotedTopBackupItems.length);
  const topCandidateItems = [...allocation.topItems, ...promotedTopBackupItems];
  const { project: projectCount, socialMedia: socialCount, paper: paperCount, news: newsCount } = allocation.counts;
  const openSourceReserve = allocation.reserved.project.length;
  const socialReserve = socialSectionItems.length;
  const socialTopLimit = Math.max(0, socialCount - allocation.reserved.socialMedia.length);
  const sectionBudget = [
    "【栏目候选预算】",
    `本次主素材共有：新闻 ${newsCount} 条、GitHub 当日日榜项目 ${projectCount} 个、社媒原帖 ${socialCount} 条、论文 ${paperCount} 篇。`,
    `已经为开源 TOP 项目单独预留 ${openSourceReserve} 个 GitHub 候选；它们只准写入后面的开源专用区。`,
    `已经为社媒精选单独预留 ${socialReserve} 条社媒候选；今日焦点最多使用 ${socialTopLimit} 条社媒。`,
    `已从补位池提取 ${promotedTopBackupItems.length} 条，与原主候选组成 ${topCandidateItems.length} 条明确 TOP 候选；下面的 TOP 候选必须逐条使用，每条只生成一次。`,
    `另有 ${replacementTopBackupItems.length} 条去重替换素材，只在明确 TOP 候选发生同源拆分或重复时替换。`,
    `另为产品/行业栏目预留 ${allocation.reserved.news.length} 条新闻，为前沿研究预留 ${allocation.reserved.paper.length} 篇论文；专用区素材不得提前写进今日焦点。`,
    `在完成以上预留后，再从剩余候选中写满今日焦点 TOP ${DAILY_TOP_TARGET}；不得重复使用同一事件。`,
    `TOP 候选已经过程序化 AI 相关性筛选；如果其中仍有明显泛生活内容，只能用去重替换素材替换。明确 TOP 候选达到 ${DAILY_TOP_TARGET} 条时必须逐条写满 ${DAILY_TOP_TARGET} 条，不得凭主观判断自行减为 6-9 条；只有明确候选确实不足时才按实际数量输出，且不得挪用专用区素材凑数。`,
    "候选编号、筛选数量、淘汰原因和补位过程只用于内部选择，绝不能写进最终正文。",
  ].join("\n");
  const numberedTopCandidates = topCandidateItems
    .map((item, index) => [`TOP 候选 ${index + 1}:`, item].join("\n"))
    .join("\n\n------\n\n");
  const primaryPrompt = `\n\n${sectionBudget}\n\n【今日焦点候选素材】\n下面每个明确 TOP 候选都必须在今日焦点中一对一生成一条；不得丢弃，也不得挪到后面的专业栏目。即使一个候选是聚合稿并提到多件事，也必须合并成一条，不能拆分。\n\n${numberedTopCandidates}\n\n------\n\n`;
  const selectedItemKeys = new Set(allSelectedItems.map((item) => String(item).trim()).filter(Boolean));
  const selectedItemUrls = new Set(allSelectedItems.map(getDailyPromptItemUrl).filter(Boolean));
  const supplementalSocialKeys = new Set(supplementalSocialItems);
  const supplementalTopBackupKeys = new Set(supplementalTopBackupItems);
  const funOnlyItems = (dailyFunContentItems || [])
    .filter(Boolean)
    .filter((item) => !isDailyPromptHiddenItem(item))
    .filter((item) => !selectedItemKeys.has(String(item).trim()))
    .filter((item) => {
      const url = getDailyPromptItemUrl(item);
      return !url || !selectedItemUrls.has(url);
    })
    .filter((item) => !supplementalSocialKeys.has(String(item).trim()))
    .filter((item) => !supplementalTopBackupKeys.has(String(item).trim()));

  const promptParts = [primaryPrompt];

  if (replacementTopBackupItems.length > 0) {
    promptParts.push([
      "【今日焦点去重替换素材】",
      `下面 ${replacementTopBackupItems.length} 条素材只用于替换今日焦点中的同源重复，不是额外加条目。`,
      `同一个 Source URL 在今日焦点最多出现一次；聚合文章也只能生成一条。发生重复时保留最重要的一条，再从这里补足 TOP ${DAILY_TOP_TARGET}。`,
      "没有发生重复时不要使用；未被用于替换的素材不得出现在其他正文栏目，也不得超过目标条数。",
      "",
      replacementTopBackupItems
        .map((item, index) => [`去重备用 ${index + 1}:`, item].join("\n"))
        .join("\n\n------\n\n"),
      "\n------\n\n",
    ].join("\n"));
  }

  if (allocation.reserved.project.length > 0) {
    promptParts.push([
      "【开源 TOP 项目专用候选素材】",
      `下面 ${allocation.reserved.project.length} 个项目已从今日焦点候选中移出，只能写进 \`## **⌘ 开源 TOP 项目**\`。`,
      "每个候选各写一条，标题保留 owner/repo，正文说明用途、当日热度和适用人群；不得省略，也不得挪回今日焦点。",
      "",
      allocation.reserved.project
        .map((item, index) => [`开源候选 ${index + 1}:`, item].join("\n"))
        .join("\n\n------\n\n"),
      "\n------\n\n",
    ].join("\n"));
  }

  if (socialSectionItems.length > 0) {
    promptParts.push([
      "【社媒精选专用候选素材】",
      `下面 ${socialSectionItems.length} 条原帖已从今日焦点或趣闻候选中移出，只能写进 \`## **◉ 社媒精选**\`。`,
      "每条候选各写一条，提炼实测、观点或现场信号；不得省略，也不得挪回今日焦点。",
      "",
      socialSectionItems
        .map((item, index) => [`社媒候选 ${index + 1}:`, item].join("\n"))
        .join("\n\n------\n\n"),
      "\n------\n\n",
    ].join("\n"));
  }

  if (allocation.reserved.news.length > 0) {
    promptParts.push([
      "【产品与行业栏目专用候选素材】",
      "下面新闻已从今日焦点候选中移出。按内容分别写进产品与功能更新或行业变化与个人影响，每条素材只能使用一次。",
      "",
      allocation.reserved.news
        .map((item, index) => [`栏目新闻候选 ${index + 1}:`, item].join("\n"))
        .join("\n\n------\n\n"),
      "\n------\n\n",
    ].join("\n"));
  }

  if (allocation.reserved.paper.length > 0) {
    promptParts.push([
      "【前沿研究专用候选素材】",
      "下面论文已从今日焦点候选中移出，只能写进 `## **🧪 前沿研究**`，说明结论、证据边界和实际影响。",
      "",
      allocation.reserved.paper
        .map((item, index) => [`研究候选 ${index + 1}:`, item].join("\n"))
        .join("\n\n------\n\n"),
      "\n------\n\n",
    ].join("\n"));
  }

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
