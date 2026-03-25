import { stripHtml } from "./helpers.js";
import {
  getOpportunityLaneById,
  opportunityPlaybook,
} from "./opportunityPlaybook.js";

const SOURCE_TYPE_SIGNAL = {
  news: 7,
  project: 8,
  socialMedia: 6,
  paper: 3,
};

const CHANGE_SIGNAL_PATTERN =
  /上线|发布|更新|开放|支持|接入|新增|推出|灰度|涨价|降价|发售|开源|launch|release|update|pricing|quota|support/i;
const CONCRETE_PRODUCT_SIGNAL_PATTERN =
  /上线|发布|更新|开放|支持|接入|新增|推出|灰度|开源|sdk|plugin|插件|workflow|模板|template|github|release|launch|integration/i;
const BUYER_OUTCOME_SIGNAL_PATTERN =
  /字幕|翻译|整理|提取|总结|写作|内容|提效|上手|跑通|配置|接入微信|微信|私聊|公众号|自动回复|客服|答疑|安装说明|模板交付|录屏|截图|场景|体验|低门槛/i;
const COMMUNITY_HEAT_SIGNAL_PATTERN =
  /github|star|stars|安装量|热议|刷屏|开发者|repo|issue|pull request|commit/i;
const NOISY_DEMAND_PATTERN =
  /token|求|快不行|有没有风险|假如|如果|转发了|转发 @|instagram|ins\b|哈哈|bro|meme|吐槽/i;

function isNoisyItem(item) {
  return NOISY_DEMAND_PATTERN.test(item?.searchText || "");
}

function hasConcreteSignal(item) {
  return CONCRETE_PRODUCT_SIGNAL_PATTERN.test(item?.searchText || "");
}

function hasBuyerOutcomeSignal(item) {
  return BUYER_OUTCOME_SIGNAL_PATTERN.test(item?.searchText || "");
}

function hasCommunityHeatSignal(item) {
  return (
    COMMUNITY_HEAT_SIGNAL_PATTERN.test(item?.searchText || "") ||
    /github\.com/i.test(item?.url || "")
  );
}

function isCommunityHeatOnlyItem(item) {
  return hasCommunityHeatSignal(item) && !hasBuyerOutcomeSignal(item);
}

function truncate(text, maxChars = 220) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}…`;
}

function toOpportunityItem(item, sourceType) {
  const plainText = truncate(stripHtml(item?.details?.content_html || ""));
  const searchText = [
    item?.title || "",
    item?.description || "",
    item?.source || "",
    plainText,
  ]
    .join(" ")
    .toLowerCase();

  return {
    type: sourceType,
    title: String(item?.title || "").trim(),
    description: truncate(item?.description || ""),
    plainText,
    source: String(item?.source || "").trim(),
    url: String(item?.url || "").trim(),
    publishedDate: String(item?.published_date || "").trim(),
    searchText,
  };
}

function findBestRuleForItem(item, playbook) {
  let bestRule = null;
  let bestMatchedTerms = [];

  for (const rule of playbook.topicRules) {
    const matchedTerms = rule.match.filter((term) =>
      item.searchText.includes(String(term).toLowerCase())
    );

    if (matchedTerms.length === 0) continue;

    if (!bestRule || matchedTerms.length > bestMatchedTerms.length) {
      bestRule = rule;
      bestMatchedTerms = matchedTerms;
    }
  }

  if (!bestRule) return null;

  return {
    rule: bestRule,
    matchedTerms: [...new Set(bestMatchedTerms)],
  };
}

function getLaneDimensionScores(laneId, playbook) {
  const lane = getOpportunityLaneById(laneId, playbook);
  return (
    lane?.scoringProfile || {
      catalogFit: 20,
      standardDelivery: 12,
      lowPriceLeadGen: 8,
      upsellFit: 6,
    }
  );
}

function isAccountCandidate(candidate) {
  return candidate?.preferredLane === "account";
}

function isAccountLikeCandidate(candidate) {
  return candidate?.preferredLane === "account" || candidate?.preferredLane === "bundle";
}

function getLaneProductHints(laneId) {
  if (laneId === "account") {
    return {
      productAngle: "低门槛体验账号或账号搭售商品",
      buyerHint: "想花小钱先用上、但不想自己折腾入口和配置的人",
      deliveryHint: "账号入口、登录说明、基础上手、常用场景清单",
      channelHint: "群里、朋友圈、商品页",
      titleHint: "先写使用结果或场景，再写账号名",
      avoidLeadHint: "不要把官方价格、参数、技术热议写成标题主卖点。",
    };
  }

  if (laneId === "bundle") {
    return {
      productAngle: "账号搭售包、配置包或场景包",
      buyerHint: "已经有工具入口，但不会配置、不会用、想直接拿结果的人",
      deliveryHint: "账号、安装说明、场景教程、截图或录屏",
      channelHint: "商品页、社群、私聊",
      titleHint: "先写场景结果或交付动作，再写工具名",
      avoidLeadHint: "不要把模板名、项目名、GitHub 数据直接写成商品标题。",
    };
  }

  return {
    productAngle: "代配置、代接入或跑通服务",
    buyerHint: "想直接跑通、不想自己排错和折腾的小白用户",
    deliveryHint: "代配置、跑通测试、交付说明、答疑",
    channelHint: "私聊、社群、朋友圈",
    titleHint: "先写交付动作和结果，再写工具名",
    avoidLeadHint: "不要把 SDK、协议名、开发者热闹写成标题核心。",
  };
}

function getEditorialHint(candidate) {
  if (candidate?.preferredLane === "account") {
    return "优先把它写成可直接购买的账号入口或账号搭售商品，不要先讲行业讨论。";
  }

  if (candidate?.preferredLane === "bundle") {
    return "先写买家能拿到什么结果，再写它是搭售包，不要把它写成纯教程包。";
  }

  return "先写你帮用户跑通什么，再写技术背景；除非账号或搭售机会很弱，否则不要占满今日可卖。";
}

function selectPromptCandidates(candidates, playbook) {
  const maxCandidates = playbook.outputRules.maxPromptCandidates || 4;
  const selectedCandidates = [...(candidates || [])].slice(0, maxCandidates);

  if (
    selectedCandidates.length === 0 ||
    !playbook.outputRules.requireAccountLikeOpportunityInTodayCanSell
  ) {
    return selectedCandidates;
  }

  if (selectedCandidates.some(isAccountCandidate)) {
    return selectedCandidates;
  }

  const allCandidates = candidates || [];
  const accountFallback = allCandidates.find(
    (candidate, index) => index >= selectedCandidates.length && isAccountCandidate(candidate)
  );

  if (accountFallback) {
    selectedCandidates[selectedCandidates.length - 1] = accountFallback;
    return selectedCandidates;
  }

  if (selectedCandidates.some(isAccountLikeCandidate)) {
    return selectedCandidates;
  }

  const accountLikeFallback = allCandidates.find(
    (candidate, index) =>
      index >= selectedCandidates.length && isAccountLikeCandidate(candidate)
  );

  if (accountLikeFallback) {
    selectedCandidates[selectedCandidates.length - 1] = accountLikeFallback;
  }

  return selectedCandidates;
}

function scoreClearChange(items) {
  const sourceDiversity = new Set(items.map((item) => item.type)).size;
  const itemCount = items.length;
  const concreteSignals = items.filter((item) =>
    CONCRETE_PRODUCT_SIGNAL_PATTERN.test(item.searchText)
  ).length;
  const buyerOutcomeSignals = items.filter((item) =>
    hasBuyerOutcomeSignal(item)
  ).length;
  const noisySignals = items.filter((item) =>
    NOISY_DEMAND_PATTERN.test(item.searchText)
  ).length;
  const communityHeatOnlySignals = items.filter((item) =>
    isCommunityHeatOnlyItem(item)
  ).length;
  const githubSignals = items.filter((item) =>
    /github\.com|docs\.|release|sdk/i.test(item.url || "")
  ).length;
  const changeSignal = items.some((item) => CHANGE_SIGNAL_PATTERN.test(item.searchText))
    ? 5
    : 0;

  const score =
    5 +
    Math.min(itemCount, 3) * 2 +
    sourceDiversity * 3 +
    concreteSignals * 3 +
    buyerOutcomeSignals * 3 +
    githubSignals * 2 +
    changeSignal -
    noisySignals * 4 -
    communityHeatOnlySignals * 3;

  return Math.max(4, Math.min(25, score));
}

function scoreSupportingItem(item, matchedTerms) {
  const sourceSignal = SOURCE_TYPE_SIGNAL[item.type] || 0;
  const matchedTermSignal = matchedTerms.length * 3;
  const changeSignal = CHANGE_SIGNAL_PATTERN.test(item.searchText) ? 2 : 0;
  const concreteSignal = hasConcreteSignal(item) ? 3 : 0;
  const buyerOutcomeSignal = hasBuyerOutcomeSignal(item) ? 4 : 0;
  const communityHeatPenalty = isCommunityHeatOnlyItem(item) ? 4 : 0;
  const noisePenalty = isNoisyItem(item) ? 6 : 0;
  return (
    sourceSignal +
    matchedTermSignal +
    changeSignal +
    concreteSignal +
    buyerOutcomeSignal -
    communityHeatPenalty -
    noisePenalty
  );
}

function summarizeScoreBreakdown(scores) {
  return [
    `货盘匹配 ${scores.catalogFit}`,
    `明确变化 ${scores.clearChange}`,
    `标准交付 ${scores.standardDelivery}`,
    `低价引流 ${scores.lowPriceLeadGen}`,
    `搭售空间 ${scores.upsellFit}`,
  ].join(" / ");
}

function normalizeReplaySignalText(text) {
  return String(text || "").toLowerCase();
}

export function inferOpportunityReplaySignals(
  markdown,
  playbook = opportunityPlaybook
) {
  const normalized = normalizeReplaySignalText(markdown);
  if (!normalized) {
    return {
      matchedRuleIds: [],
      matchedTerms: [],
      primaryLane: null,
    };
  }

  const rankedRules = playbook.topicRules
    .map((rule) => {
      const matchedTerms = rule.match.filter((term) =>
        normalized.includes(String(term).toLowerCase())
      );

      return {
        rule,
        matchedTerms,
      };
    })
    .filter((item) => item.matchedTerms.length > 0)
    .sort((a, b) => b.matchedTerms.length - a.matchedTerms.length)
    .slice(0, 2);

  if (rankedRules.length === 0) {
    return {
      matchedRuleIds: [],
      matchedTerms: [],
      primaryLane: null,
    };
  }

  return {
    matchedRuleIds: rankedRules.map((item) => item.rule.id),
    matchedTerms: [...new Set(rankedRules.flatMap((item) => item.matchedTerms))],
    primaryLane: rankedRules[0]?.rule?.preferredLane || null,
  };
}

function getPreviousTopicPenalty(candidate, replaySignals) {
  if (!candidate || !replaySignals) {
    return { penalty: 0, reason: "" };
  }

  const matchedRuleIds = new Set(replaySignals.matchedRuleIds || []);
  const matchedTerms = new Set(
    (replaySignals.matchedTerms || []).map((term) => String(term).toLowerCase())
  );
  const candidateTerms = (candidate.matchedTerms || []).map((term) =>
    String(term).toLowerCase()
  );

  if (matchedRuleIds.has(candidate.id)) {
    return {
      penalty: 18,
      reason: "昨日主推同一主题降权",
    };
  }

  const hasSharedTerms = candidateTerms.some((term) => matchedTerms.has(term));
  if (hasSharedTerms) {
    return {
      penalty: 10,
      reason: "昨日主推相近主题降权",
    };
  }

  return { penalty: 0, reason: "" };
}

function buildCandidateFromGroup(group, playbook, replaySignals = null) {
  const preferredLane = getOpportunityLaneById(group.rule.preferredLane, playbook);
  const secondaryLane = getOpportunityLaneById(group.rule.secondaryLane, playbook);
  const laneHints = getLaneProductHints(group.rule.preferredLane);
  const laneScores = getLaneDimensionScores(group.rule.preferredLane, playbook);
  const clearChange = scoreClearChange(group.items);

  const scores = {
    catalogFit: laneScores.catalogFit,
    clearChange,
    standardDelivery: laneScores.standardDelivery,
    lowPriceLeadGen: laneScores.lowPriceLeadGen,
    upsellFit: laneScores.upsellFit,
  };

  const baseScore = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const rankedItems = [...group.items]
    .sort(
      (a, b) =>
        scoreSupportingItem(b, group.matchedTerms) -
        scoreSupportingItem(a, group.matchedTerms)
    );
  const cleanSupportingItems = rankedItems
    .filter((item) => !isNoisyItem(item) || hasConcreteSignal(item))
    .slice(0, 3);
  const supportingItems =
    cleanSupportingItems.length > 0 ? cleanSupportingItems : rankedItems.slice(0, 3);
  const replayPenalty = getPreviousTopicPenalty(
    {
      id: group.rule.id,
      matchedTerms: [...group.matchedTerms],
    },
    replaySignals
  );
  const score = Math.max(0, baseScore - replayPenalty.penalty);
  const scoreText = replayPenalty.penalty
    ? `${summarizeScoreBreakdown(scores)} / ${replayPenalty.reason} -${replayPenalty.penalty}`
    : summarizeScoreBreakdown(scores);

  return {
    id: group.rule.id,
    label: group.rule.label,
    score,
    baseScore,
    replayPenalty: replayPenalty.penalty,
    replayPenaltyReason: replayPenalty.reason,
    scores,
    scoreText,
    preferredLane: preferredLane?.id || group.rule.preferredLane,
    preferredLaneName: preferredLane?.name || group.rule.preferredLane,
    secondaryLane: secondaryLane?.id || group.rule.secondaryLane,
    secondaryLaneName: secondaryLane?.name || group.rule.secondaryLane,
    sellFormats: preferredLane?.sellFormats || [],
    matchedTerms: [...group.matchedTerms],
    recommendation: group.rule.defaultAdvice,
    productAngle: group.rule.productAngle || laneHints.productAngle,
    buyerHint: group.rule.buyerHint || laneHints.buyerHint,
    deliveryHint: group.rule.deliveryHint || laneHints.deliveryHint,
    channelHint: group.rule.channelHint || laneHints.channelHint,
    titleHint: group.rule.titleHint || laneHints.titleHint,
    avoidLeadHint: group.rule.avoidLeadHint || laneHints.avoidLeadHint,
    supportingItems,
    sourceTypes: [...new Set(group.items.map((item) => item.type))],
  };
}

export function buildOpportunityCandidates(
  allUnifiedData,
  playbook = opportunityPlaybook,
  options = {}
) {
  const groups = new Map();

  for (const [sourceType, items] of Object.entries(allUnifiedData || {})) {
    for (const rawItem of items || []) {
      const item = toOpportunityItem(rawItem, sourceType);
      if (!item.title && !item.description && !item.plainText) continue;

      const ruleMatch = findBestRuleForItem(item, playbook);
      if (!ruleMatch) continue;

      const existingGroup = groups.get(ruleMatch.rule.id) || {
        rule: ruleMatch.rule,
        items: [],
        matchedTerms: new Set(),
      };

      existingGroup.items.push(item);
      for (const term of ruleMatch.matchedTerms) {
        existingGroup.matchedTerms.add(term);
      }

      groups.set(ruleMatch.rule.id, existingGroup);
    }
  }

  return [...groups.values()]
    .map((group) =>
      buildCandidateFromGroup(
        {
          ...group,
          matchedTerms: [...group.matchedTerms],
        },
        playbook,
        options.previousMainTopicSignals || null
      )
    )
    .sort((a, b) => b.score - a.score);
}

export function formatOpportunityCandidatesForPrompt(
  candidates,
  playbook = opportunityPlaybook
) {
  const visibleCandidates = selectPromptCandidates(candidates, playbook);

  if (visibleCandidates.length === 0) {
    return "今天没有命中明显高分主题。请只输出 1 个偏观察向的机会，不要硬凑。";
  }

  return visibleCandidates
    .map((candidate, index) => {
      const supportingItemsText = candidate.supportingItems
        .map((item, itemIndex) => {
          const line = item.url
            ? `${itemIndex + 1}. [${item.title || item.source}](${item.url})`
            : `${itemIndex + 1}. ${item.title || item.source}`;

          return [
            line,
            `   - 类型: ${item.type} | 来源: ${item.source || "未知"} | 日期: ${
              item.publishedDate || "未知"
            }`,
            `   - 摘要: ${item.description || item.plainText || "无"}`,
          ].join("\n");
        })
        .join("\n");

      return [
        `### ${index + 1}. ${candidate.label}`,
        `- 综合分: ${candidate.score}/100`,
        `- 优先卖法: ${candidate.preferredLaneName}`,
        `- 备选卖法: ${candidate.secondaryLaneName}`,
        `- 编排提醒: ${getEditorialHint(candidate)}`,
        `- 商品化角度: ${candidate.productAngle}`,
        `- 更适合成交给: ${candidate.buyerHint}`,
        `- 你能交付: ${candidate.deliveryHint}`,
        `- 更适合发到: ${candidate.channelHint}`,
        `- 标题写法: ${candidate.titleHint}`,
        `- 不要主写: ${candidate.avoidLeadHint}`,
        `- 推荐写法: ${candidate.recommendation}`,
        `- 建议形式: ${candidate.sellFormats.join("、") || "按热点灵活处理"}`,
        `- 命中关键词: ${candidate.matchedTerms.join("、") || "无"}`,
        `- 评分拆解: ${candidate.scoreText}`,
        `- 支撑素材:\n${supportingItemsText}`,
      ].join("\n");
    })
    .join("\n\n");
}
