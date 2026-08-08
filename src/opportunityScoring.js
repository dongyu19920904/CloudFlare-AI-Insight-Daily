import { stripHtml } from "./helpers.js";
import { normalizeGithubProjectUrl } from "./githubTopProjectDedupe.js";
import { normalizeOpportunitySourceUrl } from "./opportunityReplayDedupe.js";
import {
  assessOpportunityEvidence,
  canonicalizeOpportunityEvidenceUrl,
  classifyOpportunityCommercialPattern,
  classifyOpportunityEvidence,
  deriveOpportunityOfferFamily,
  deriveOpportunityEntityKey,
} from "./opportunityEvidence.js";
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

const GENERIC_RULE_IDS = new Set([
  "github_hot_project",
  "skills_templates",
  "workflow",
]);
const ACCOUNT_SIGNAL_PATTERN =
  /账号|账户|account|subscription|订阅|会员|套餐|seat|workspace|pro\b|plus\b|login|登录|入口|quota|pricing|price/i;
const BUNDLE_SIGNAL_PATTERN =
  /模板|template|templates|skill|skills|prompt|风格|style|合集|教程|guide|playbook|清单|pack|bundle|示例|案例/i;
const SERVICE_SIGNAL_PATTERN =
  /接入|integration|plugin|plugins|sdk|mcp|代配置|配置|安装|部署|跑通|automation|自动化|agent|微信|飞书|企微|wecom|browser use|computer use/i;

const CHANGE_SIGNAL_PATTERN =
  /上线|发布|更新|开放|支持|接入|新增|推出|灰度|涨价|降价|发售|开源|launch|release|update|pricing|quota|support/i;
const CONCRETE_PRODUCT_SIGNAL_PATTERN =
  /上线|发布|更新|开放|支持|接入|新增|推出|灰度|开源|sdk|plugin|插件|workflow|模板|template|github|release|launch|integration/i;
const BUYER_OUTCOME_SIGNAL_PATTERN =
  /字幕|翻译|整理|提取|总结|写作|内容|提效|上手|跑通|配置|接入微信|微信|私聊|公众号|自动回复|客服|答疑|安装说明|模板交付|录屏|截图|场景|体验|低门槛/i;
const BUSINESS_CONTEXT_SIGNAL_PATTERN =
  /闲鱼|小红书|视频号|公众号|私域|社群|朋友圈|客服|售后|成交|标题|商品|选品|上架|试挂|资料包|模板|sop|教程|话术|卡密|账号|会员|套餐|续费|成品号|镜像|激活器|交付|报价|客户|复购|月费|训练营|陪跑|低价|代配置|代运营|内容|选题|脚本/i;
const PRODUCTIZED_DELIVERY_SIGNAL_PATTERN =
  /sop|模板|资料包|教程|清单|报价单|话术|标题|脚本|配置|部署|跑通|代配置|上手包|交付|表格|知识库|案例|录屏|截图|自动化|私域|客服|售后|发卡|卡密|商品页/i;
const REPEAT_PURCHASE_SIGNAL_PATTERN =
  /复购|月费|会员|社群|订阅|年费|训练营|陪跑|代运营|持续|维护|更新|私域|售后|答疑|资料库/i;
const COMMUNITY_HEAT_SIGNAL_PATTERN =
  /github|star|stars|安装量|热议|刷屏|开发者|repo|issue|pull request|commit/i;
const NOISY_DEMAND_PATTERN =
  /token|求|快不行|有没有风险|假如|如果|转发了|转发 @|instagram|ins\b|哈哈|bro|meme|吐槽/i;
const HIGH_AFTER_SALES_RISK_PATTERN =
  /封号|被封|风控|冻结|ban|suspend|suspended|镜像|mirror|third-party|第三方入口|payment|card|region|country|迁移|账号转移|api key/i;
const LOW_AFTER_SALES_RISK_PATTERN =
  /模板|template|教程|guide|清单|标题|文案|说明|playbook|workflow|prompt|资料包|避坑/i;

function isNoisyItem(item) {
  return NOISY_DEMAND_PATTERN.test(item?.searchText || "");
}

function hasConcreteSignal(item) {
  return CONCRETE_PRODUCT_SIGNAL_PATTERN.test(item?.searchText || "");
}

function hasBuyerOutcomeSignal(item) {
  return BUYER_OUTCOME_SIGNAL_PATTERN.test(item?.searchText || "");
}

function hasBusinessContextSignal(item) {
  return BUSINESS_CONTEXT_SIGNAL_PATTERN.test(item?.searchText || "");
}

function hasProductizedDeliverySignal(item) {
  return PRODUCTIZED_DELIVERY_SIGNAL_PATTERN.test(item?.searchText || "");
}

function hasRepeatPurchaseSignal(item) {
  return REPEAT_PURCHASE_SIGNAL_PATTERN.test(item?.searchText || "");
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

  const normalizedItem = {
    type: sourceType,
    title: String(item?.title || "").trim(),
    description: truncate(item?.description || ""),
    plainText,
    source: String(item?.source || "").trim(),
    url: String(item?.url || "").trim(),
    publishedDate: String(item?.published_date || "").trim(),
    searchText,
    lowEvidenceAiWorkflowPitch: Boolean(
      item?.details?.lowEvidenceAiWorkflowPitch || item?.lowEvidenceAiWorkflowPitch
    ),
    foloSourceId: String(
      item?.details?.foloSourceId ||
        item?.details?.foloFeedId ||
        item?.details?.feedId ||
        item?.details?.sourceId ||
        item?.foloSourceId ||
        item?.feedId ||
        item?.sourceId ||
        ""
    ).trim(),
  };

  return {
    ...normalizedItem,
    evidence: classifyOpportunityEvidence(normalizedItem, sourceType),
  };
}

function getMatchedTermsForRule(item, rule) {
  const haystack = `${item?.searchText || ""} ${String(item?.url || "").toLowerCase()}`;
  return (rule?.match || []).filter((term) =>
    haystack.includes(String(term).toLowerCase())
  );
}

function findBestRuleForItem(item, playbook) {
  const matchedRules = playbook.topicRules
    .map((rule) => {
      const matchedTerms = getMatchedTermsForRule(item, rule);

      return {
        rule,
        matchedTerms,
      };
    })
    .filter((match) => match.matchedTerms.length > 0);

  if (matchedRules.length === 0) return null;

  const specificRules = matchedRules.filter(
    (match) => !GENERIC_RULE_IDS.has(match.rule.id)
  );

  const rankedRules = (specificRules.length > 0 ? specificRules : matchedRules).sort(
    (left, right) => {
      const matchedTermDiff = right.matchedTerms.length - left.matchedTerms.length;
      if (matchedTermDiff !== 0) return matchedTermDiff;

      const matchedLengthDiff =
        right.matchedTerms.reduce((sum, term) => sum + String(term).length, 0) -
        left.matchedTerms.reduce((sum, term) => sum + String(term).length, 0);
      if (matchedLengthDiff !== 0) return matchedLengthDiff;

      return left.rule.id.localeCompare(right.rule.id);
    }
  );

  return {
    rule: rankedRules[0].rule,
    matchedTerms: [...new Set(rankedRules[0].matchedTerms)],
  };
}

function addItemToOpportunityGroup(
  groups,
  rule,
  item,
  matchedTerms = [],
  options = {}
) {
  if (!rule) return;

  const entityKey = deriveOpportunityEntityKey(item, rule.id);
  const groupKey = options.entityAwareGrouping
    ? `${rule.id}:${entityKey || rule.id}`
    : rule.id;
  const existingGroup = groups.get(groupKey) || {
    rule,
    entityKey,
    items: [],
    matchedTerms: new Set(),
  };

  existingGroup.items.push(item);
  for (const term of matchedTerms) {
    existingGroup.matchedTerms.add(term);
  }

  groups.set(groupKey, existingGroup);
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

function getLaneProductHints(laneId, profile = "account") {
  if (profile === "general") {
    if (laneId === "bundle") {
      return {
        productAngle: "可复用的数据、决策或内容交付",
        buyerHint: "正在重复整理、比较或制作同类结果的具体职业与小团队",
        deliveryHint: "一个可验收样品，以及能降低下次交付成本的流程或组件",
        channelHint: "目标用户所在社群、同行私聊或已有客户访谈",
        titleHint: "先写目标用户和可验收结果，再写使用了什么工具",
        avoidLeadHint: "不要把教程、模板或资料库本身当作付费理由。",
      };
    }

    return {
      productAngle: "固定范围、可验收的结果型轻服务",
      buyerHint: "正用手工笨办法完成具体任务、愿意先测试一个小结果的人",
      deliveryHint: "测试环境样品、结果报告、复现说明和明确的不包含项",
      channelHint: "一对一访谈、垂直社群或已有客户",
      titleHint: "先写目标用户、最小交付和验收结果，再写项目名",
      avoidLeadHint: "不要把 stars、框架名或技术热度当成需求证据。",
    };
  }

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

function getEditorialHint(candidate, profile = "account") {
  if (profile === "general") {
    return "先写谁正在用什么笨办法，再写可验收的最小结果、48 小时行为验证和停止条件；不要写成账号上新或行业分析。";
  }

  if (candidate?.preferredLane === "account") {
    return "优先把它写成可直接购买的账号入口或账号搭售商品，不要先讲行业讨论。";
  }

  if (candidate?.preferredLane === "bundle") {
    return "先写买家能拿到什么结果，再写它是搭售包，不要把它写成纯教程包。";
  }

  return "先写你帮用户跑通什么，再写技术背景；除非账号或搭售机会很弱，否则不要占满今日可卖。";
}

function selectPromptCandidates(candidates, playbook, options = {}) {
  const maxCandidates = playbook.outputRules.maxPromptCandidates || 4;
  const sortedCandidates = [...(candidates || [])];
  const selectedCandidates = sortedCandidates.slice(0, maxCandidates);

  if (options.profile === "general") {
    return selectedCandidates;
  }

  if (selectedCandidates.length === 0) {
    return selectedCandidates;
  }

  if (!playbook.outputRules.requireAccountLikeOpportunityInTodayCanSell) {
    const nonAccountCandidates = sortedCandidates.filter(
      (candidate) => !isAccountCandidate(candidate)
    );
    const accountCandidates = sortedCandidates.filter(isAccountCandidate);

    if (nonAccountCandidates.length >= 2) {
      const visibleCandidates = nonAccountCandidates.slice(0, maxCandidates);
      const bestNonAccountScore = nonAccountCandidates[0]?.score || 0;
      const standoutAccountCandidates = accountCandidates.filter(
        (candidate) => candidate.score >= bestNonAccountScore + 8
      );

      for (const candidate of standoutAccountCandidates) {
        if (visibleCandidates.length >= maxCandidates) break;
        visibleCandidates.push(candidate);
      }

      return visibleCandidates.slice(0, maxCandidates);
    }

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
  const businessContextSignals = items.filter((item) =>
    hasBusinessContextSignal(item)
  ).length;
  const productizedDeliverySignals = items.filter((item) =>
    hasProductizedDeliverySignal(item)
  ).length;
  const repeatPurchaseSignals = items.filter((item) =>
    hasRepeatPurchaseSignal(item)
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
    businessContextSignals * 2 +
    productizedDeliverySignals * 3 +
    repeatPurchaseSignals * 2 +
    githubSignals * 2 +
    changeSignal -
    noisySignals * 4 -
    communityHeatOnlySignals * 3;

  return Math.max(4, Math.min(25, score));
}

function scoreSupportingItem(item, matchedTerms) {
  const sourceSignal = SOURCE_TYPE_SIGNAL[item.type] || 0;
  const evidenceSignal = item?.evidence?.score || 0;
  const matchedTermSignal = matchedTerms.length * 3;
  const changeSignal = CHANGE_SIGNAL_PATTERN.test(item.searchText) ? 2 : 0;
  const concreteSignal = hasConcreteSignal(item) ? 3 : 0;
  const buyerOutcomeSignal = hasBuyerOutcomeSignal(item) ? 4 : 0;
  const businessContextSignal = hasBusinessContextSignal(item) ? 3 : 0;
  const productizedDeliverySignal = hasProductizedDeliverySignal(item) ? 4 : 0;
  const repeatPurchaseSignal = hasRepeatPurchaseSignal(item) ? 2 : 0;
  const communityHeatPenalty = isCommunityHeatOnlyItem(item) ? 4 : 0;
  const noisePenalty = isNoisyItem(item) ? 6 : 0;
  const lowEvidencePenalty = item?.lowEvidenceAiWorkflowPitch ? 20 : 0;
  return (
    sourceSignal +
    evidenceSignal +
    matchedTermSignal +
    changeSignal +
    concreteSignal +
    buyerOutcomeSignal +
    businessContextSignal +
    productizedDeliverySignal +
    repeatPurchaseSignal -
    communityHeatPenalty -
    noisePenalty -
    lowEvidencePenalty
  );
}

function getLaneSignalScores(group, profile = "account") {
  const laneSignalScores = {
    account: 0,
    bundle: 0,
    service: 0,
  };

  if (group.rule.preferredLane) {
    laneSignalScores[group.rule.preferredLane] += 6;
  }

  if (group.rule.secondaryLane) {
    laneSignalScores[group.rule.secondaryLane] += 3;
  }

  for (const item of group.items || []) {
    const searchText = item?.searchText || "";

    if (ACCOUNT_SIGNAL_PATTERN.test(searchText)) {
      laneSignalScores.account += 5;
    }

    if (BUNDLE_SIGNAL_PATTERN.test(searchText)) {
      laneSignalScores.bundle += 5;
    }

    if (SERVICE_SIGNAL_PATTERN.test(searchText)) {
      laneSignalScores.service += 5;
    }

    if (hasBuyerOutcomeSignal(item)) {
      laneSignalScores.bundle += 2;
      laneSignalScores.service += 3;
    }

    if (hasBusinessContextSignal(item)) {
      laneSignalScores.bundle += 3;
      laneSignalScores.service += 2;
    }

    if (hasProductizedDeliverySignal(item)) {
      laneSignalScores.bundle += 4;
      laneSignalScores.service += 3;
    }

    if (hasRepeatPurchaseSignal(item)) {
      laneSignalScores.bundle += 2;
      laneSignalScores.service += 2;
    }

    if (hasConcreteSignal(item)) {
      laneSignalScores.bundle += 1;
      laneSignalScores.service += 1;
    }
  }

  if (profile === "general") {
    laneSignalScores.account = Number.NEGATIVE_INFINITY;
    laneSignalScores.bundle += 2;
    laneSignalScores.service += 3;
  }

  return laneSignalScores;
}

function getResolvedLaneOrder(group, profile = "account") {
  const laneSignalScores = getLaneSignalScores(group, profile);
  const rankedLaneIds = Object.keys(laneSignalScores)
    .filter((laneId) => profile !== "general" || laneId !== "account")
    .sort((leftLaneId, rightLaneId) => {
    const scoreDiff = laneSignalScores[rightLaneId] - laneSignalScores[leftLaneId];
    if (scoreDiff !== 0) return scoreDiff;

    if (leftLaneId === group.rule.preferredLane) return -1;
    if (rightLaneId === group.rule.preferredLane) return 1;

    if (leftLaneId === group.rule.secondaryLane) return -1;
    if (rightLaneId === group.rule.secondaryLane) return 1;

    return leftLaneId.localeCompare(rightLaneId);
    });

  return {
    laneSignalScores,
    preferredLaneId: rankedLaneIds[0] || group.rule.preferredLane,
    secondaryLaneId:
      rankedLaneIds.find((laneId) => laneId !== rankedLaneIds[0]) ||
      group.rule.secondaryLane ||
      group.rule.preferredLane,
  };
}

function getLaneSpecificRecommendation(preferredLaneId, rule, profile = "account") {
  if (profile === "general") {
    if (preferredLaneId === "bundle") {
      return "先验证一个具体职业是否愿意为可复用结果付费，再把重复步骤沉淀成数据、流程或组件。";
    }
    return "先在测试环境交付一个固定范围的可验收结果，用访谈、样品、报价或可退意向金验证，不先做大而全服务。";
  }

  if (preferredLaneId === rule.preferredLane) {
    return rule.defaultAdvice;
  }

  if (preferredLaneId === "account") {
    return "这类变化更适合先写成低门槛账号入口，再补基础说明和常用场景。";
  }

  if (preferredLaneId === "bundle") {
    return "这类变化更适合写成模板包、场景包或账号搭售，不要只卖工具名。";
  }

  return "这类变化更适合写成跑通、代配置或交付服务，不要只讲技术热闹。";
}

function getResolvedCandidateLabel(rule, preferredLaneId, profile = "account") {
  if (preferredLaneId === rule.preferredLane) {
    return rule.label;
  }

  const laneLabelById = {
    account: "账号机会",
    bundle: profile === "general" ? "可复用交付机会" : "搭售机会",
    service: profile === "general" ? "结果型服务机会" : "轻服务机会",
  };

  const baseLabel = String(rule.label || "")
    .replace(
      /\s*(账号与搭售机会|账号与工具机会|账号机会|代配置机会|自动化工具机会|技能包 \/ 模板包机会|工作流 \/ 插件接入机会|机会)$/u,
      ""
    )
    .trim();

  return `${baseLabel} ${laneLabelById[preferredLaneId] || "机会"}`.trim();
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

function summarizeEvidenceSources(items) {
  const visibleItems = (items || []).slice(0, 2);
  if (visibleItems.length === 0) return "暂无强证据，只能观察";

  return visibleItems
    .map((item) => {
      const title = item.title || item.source || "未命名素材";
      const source = item.source || item.type || "未知来源";
      return item.url ? `${title}（${source}，${item.url}）` : `${title}（${source}）`;
    })
    .join("；");
}

function inferConfidence(score, supportingItems, evidenceAssessment = null) {
  if (evidenceAssessment?.strength === "high") return "高";
  if (evidenceAssessment?.strength === "medium") return "中";

  const sourceDiversity = new Set((supportingItems || []).map((item) => item.type)).size;
  if (score >= 75 && sourceDiversity >= 2) return "中";
  return "低";
}

function inferAfterSalesRisk(candidateLike, supportingItems) {
  const text = [
    candidateLike?.label || "",
    candidateLike?.productAngle || "",
    candidateLike?.recommendation || "",
    ...(supportingItems || []).map((item) => item.searchText || ""),
  ].join(" ");

  if (HIGH_AFTER_SALES_RISK_PATTERN.test(text)) return "高";
  if (LOW_AFTER_SALES_RISK_PATTERN.test(text)) return "低";
  return candidateLike?.preferredLane === "service" ? "中" : "低";
}

function inferXianyuToday(score, afterSalesRisk, preferredLaneId, supportingItems) {
  const hasConcreteEvidence = (supportingItems || []).some(
    (item) => hasConcreteSignal(item) || hasBuyerOutcomeSignal(item)
  );

  if (afterSalesRisk === "高") return score >= 78 && hasConcreteEvidence ? "观察" : "否";
  if (score >= 62 && hasConcreteEvidence) return "是";
  if (preferredLaneId === "bundle" && score >= 50) return "观察";
  return "观察";
}

function buildTodaySmallestAction(preferredLaneId, candidateLike, profile = "account") {
  if (profile === "general") {
    if (preferredLaneId === "bundle") {
      return `先做一个可验收样品，找 5 位同一类目标用户确认他们现在的笨办法和真实付费行为：${candidateLike.productAngle}`;
    }
    return `先在测试环境复现一次最小结果并记录失败点，再访谈 5 位同一鱼塘用户：${candidateLike.productAngle}`;
  }

  if (preferredLaneId === "account") {
    return `先挂一版低价体验/平替入口标题，写清楚售后边界：${candidateLike.productAngle}`;
  }

  if (preferredLaneId === "bundle") {
    return `先改两版闲鱼标题，配一页上手教程或资料包：${candidateLike.productAngle}`;
  }

  return `先发一版轻服务说明，限定只做试跑、筛选或代配置：${candidateLike.productAngle}`;
}

function normalizeReplaySignalText(text) {
  return String(text || "").toLowerCase();
}

function countReplayRecords(records = [], keyGetter = (record) => record?.key) {
  const counts = new Map();

  for (const record of records || []) {
    const key = String(keyGetter(record) || "").toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return counts;
}

function buildOpportunityReplayLookup(memory) {
  const sourceUrlCounts = countReplayRecords(memory?.sourceUrls);
  const githubProjectCounts = countReplayRecords(memory?.githubProjects);
  const ruleIdCounts = countReplayRecords(memory?.ruleIds, (record) => record?.id || record?.key);
  const laneCounts = countReplayRecords(memory?.lanes, (record) => record?.id || record?.key);
  const termCounts = countReplayRecords(memory?.terms, (record) => record?.term || record?.key);
  const entityCounts = countReplayRecords(memory?.entities, (record) => record?.entity || record?.key);
  const businessModelCounts = countReplayRecords(
    memory?.businessModels,
    (record) => record?.businessModel || record?.key
  );
  const deliveryTypeCounts = countReplayRecords(
    memory?.deliveryTypes,
    (record) => record?.deliveryType || record?.key
  );
  const commercialSignatureCounts = countReplayRecords(
    memory?.commercialSignatures,
    (record) => record?.commercialSignature || record?.key
  );
  const offerFamilyCounts = countReplayRecords(
    memory?.offerFamilies,
    (record) => record?.offerFamily || record?.key
  );

  return {
    sourceUrlCounts,
    githubProjectCounts,
    ruleIdCounts,
    laneCounts,
    termCounts,
    entityCounts,
    businessModelCounts,
    deliveryTypeCounts,
    commercialSignatureCounts,
    offerFamilyCounts,
    isEmpty:
      sourceUrlCounts.size === 0 &&
      githubProjectCounts.size === 0 &&
      ruleIdCounts.size === 0 &&
      laneCounts.size === 0 &&
      termCounts.size === 0 &&
      entityCounts.size === 0 &&
      businessModelCounts.size === 0 &&
      deliveryTypeCounts.size === 0 &&
      commercialSignatureCounts.size === 0 &&
      offerFamilyCounts.size === 0,
  };
}

function getReplaySourceMatch(item, replayLookup) {
  if (!item || !replayLookup || replayLookup.isEmpty) return null;

  const githubKey = normalizeGithubProjectUrl(item.url);
  if (githubKey && replayLookup.githubProjectCounts.has(githubKey)) {
    return { type: "github", key: githubKey };
  }

  const sourceKey = normalizeOpportunitySourceUrl(item.url);
  if (sourceKey && replayLookup.sourceUrlCounts.has(sourceKey)) {
    return { type: "url", key: sourceKey };
  }

  return null;
}

function getWeeklyReplayPenalty(candidate, replayLookup, options = {}) {
  if (!candidate || !replayLookup || replayLookup.isEmpty) {
    return { penalty: 0, reason: "" };
  }

  const reasons = [];
  let penalty = 0;

  const ruleCount = replayLookup.ruleIdCounts.get(String(candidate.id || "").toLowerCase()) || 0;
  if (ruleCount > 0) {
    penalty += Math.min(24, 10 + ruleCount * 4);
    reasons.push("近7天同类商机降权");
  }

  const laneCount = replayLookup.laneCounts.get(String(candidate.preferredLane || "").toLowerCase()) || 0;
  if (laneCount >= 2) {
    penalty += Math.min(8, laneCount * 2);
    reasons.push("近7天同卖法过密");
  }

  const matchedTermCount = (candidate.matchedTerms || []).filter((term) =>
    replayLookup.termCounts.has(String(term).toLowerCase())
  ).length;
  if (matchedTermCount >= 2) {
    penalty += 6;
    reasons.push("近7天关键词相近");
  }

  if (options.includeCommercialDimensions) {
    const businessModelCount =
      replayLookup.businessModelCounts.get(
        String(candidate.businessModel || "").toLowerCase()
      ) || 0;
    if (businessModelCount >= 2) {
      penalty += Math.min(8, businessModelCount * 2);
      reasons.push("近7天同商业模式偏多");
    }

    const deliveryTypeCount =
      replayLookup.deliveryTypeCounts.get(
        String(candidate.deliveryType || "").toLowerCase()
      ) || 0;
    if (deliveryTypeCount >= 2) {
      penalty += Math.min(8, deliveryTypeCount * 2);
      reasons.push("近7天同交付类型偏多");
    }
  }

  return {
    penalty: Math.min(38, penalty),
    reason: reasons.join(" / "),
  };
}

function getReplayHardBlock(candidate, replayLookup) {
  if (!candidate || !replayLookup || replayLookup.isEmpty) return "";

  const entityKey = String(candidate.entityKey || "").toLowerCase();
  if (entityKey && replayLookup.entityCounts.has(entityKey)) {
    return "近7天已经使用同一项目或产品实体";
  }

  const signature = String(candidate.commercialSignature || "").toLowerCase();
  if (signature && replayLookup.commercialSignatureCounts.has(signature)) {
    return "近7天已经使用同一商业模式与交付类型组合";
  }

  const offerFamily = String(candidate.offerFamily || "").toLowerCase();
  if (offerFamily && replayLookup.offerFamilyCounts.has(offerFamily)) {
    return "近7天已经使用同一读者交付家族";
  }

  return "";
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

function applySupplementalOpportunityEvidence(items = [], recordsBySourceUrl = {}) {
  const enrichedItems = [];
  const checks = [];
  const seenUrls = new Set();

  const addItem = (item) => {
    const key = canonicalizeOpportunityEvidenceUrl(item?.url);
    if (!key || seenUrls.has(key)) return;
    seenUrls.add(key);
    enrichedItems.push(item);
  };

  for (const item of items || []) {
    const sourceKey = canonicalizeOpportunityEvidenceUrl(item?.url);
    const record = sourceKey ? recordsBySourceUrl?.[sourceKey] : null;
    const summary = String(record?.summary || "").trim();
    const enrichedItem = summary
      ? {
          ...item,
          description: [item.description, summary].filter(Boolean).join("；"),
          searchText: `${item.searchText || ""} ${summary}`.toLowerCase(),
        }
      : item;
    addItem(enrichedItem);

    if (record) {
      checks.push({
        sourceUrl: item.url,
        checked: Boolean(record.checked),
        kind: record.kind || "",
        summary,
        error: record.error || "",
      });
      for (const evidenceItem of record.evidenceItems || []) {
        addItem(evidenceItem);
      }
    }
  }

  return {
    items: enrichedItems.slice(0, 5),
    checks,
  };
}

function buildCandidateFromGroup(
  group,
  playbook,
  replaySignals = null,
  replayLookup = null,
  options = {}
) {
  const profile = options.profile || "account";
  const laneDecision = getResolvedLaneOrder(group, profile);
  const preferredLane = getOpportunityLaneById(
    laneDecision.preferredLaneId,
    playbook
  );
  const secondaryLane = getOpportunityLaneById(
    laneDecision.secondaryLaneId,
    playbook
  );
  const laneHints = getLaneProductHints(laneDecision.preferredLaneId, profile);
  const laneScores = getLaneDimensionScores(
    laneDecision.preferredLaneId,
    playbook
  );
  const clearChange = scoreClearChange(group.items);
  const useRuleSpecificHints = laneDecision.preferredLaneId === group.rule.preferredLane;

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
    .filter(
      (item) =>
        !item.lowEvidenceAiWorkflowPitch &&
        (!isNoisyItem(item) || hasConcreteSignal(item))
    )
    .slice(0, 3);
  const baseSupportingItems =
    cleanSupportingItems.length > 0 ? cleanSupportingItems : rankedItems.slice(0, 3);
  const supplementalEvidence = applySupplementalOpportunityEvidence(
    baseSupportingItems,
    options.supplementalEvidenceBySourceUrl || {}
  );
  const supportingItems = supplementalEvidence.items;
  const label = getResolvedCandidateLabel(
    group.rule,
    laneDecision.preferredLaneId,
    profile
  );
  const recommendation = getLaneSpecificRecommendation(
    laneDecision.preferredLaneId,
    group.rule,
    profile
  );
  const productAngle = useRuleSpecificHints
    ? group.rule.productAngle || laneHints.productAngle
    : laneHints.productAngle;
  const deliveryHint = useRuleSpecificHints
    ? group.rule.deliveryHint || laneHints.deliveryHint
    : laneHints.deliveryHint;
  const evidenceAssessment = assessOpportunityEvidence(supportingItems);
  const commercialPattern = classifyOpportunityCommercialPattern(
    supportingItems,
    laneDecision.preferredLaneId
  );
  const offerFamily = deriveOpportunityOfferFamily({
    ...commercialPattern,
    preferredLane: laneDecision.preferredLaneId,
    label,
    productAngle,
    deliveryHint,
    supportingItems,
  });
  const replayPenalty = getPreviousTopicPenalty(
    {
      id: group.rule.id,
      matchedTerms: [...group.matchedTerms],
    },
    replaySignals
  );
  const weeklyReplayPenalty = getWeeklyReplayPenalty(
    {
      id: group.rule.id,
      matchedTerms: [...group.matchedTerms],
      preferredLane: laneDecision.preferredLaneId,
      ...commercialPattern,
      offerFamily,
    },
    replayLookup,
    { includeCommercialDimensions: Boolean(options.enforceReplayDimensions) }
  );
  const totalReplayPenalty = replayPenalty.penalty + weeklyReplayPenalty.penalty;
  const replayPenaltyReasons = [
    replayPenalty.reason,
    weeklyReplayPenalty.reason,
  ].filter(Boolean).join(" / ");
  const score = Math.max(0, baseScore - totalReplayPenalty);
  const scoreText = totalReplayPenalty
    ? `${summarizeScoreBreakdown(scores)} / ${replayPenaltyReasons} -${totalReplayPenalty}`
    : summarizeScoreBreakdown(scores);
  const candidateLike = {
    label,
    preferredLane: laneDecision.preferredLaneId,
    productAngle,
    recommendation,
  };
  const afterSalesRisk = inferAfterSalesRisk(candidateLike, supportingItems);
  const confidence = inferConfidence(score, supportingItems, evidenceAssessment);
  const xianyuToday = inferXianyuToday(
    score,
    afterSalesRisk,
    laneDecision.preferredLaneId,
    supportingItems
  );

  return {
    id: group.rule.id,
    entityKey: group.entityKey || deriveOpportunityEntityKey(supportingItems[0], group.rule.id),
    label,
    score,
    baseScore,
    replayPenalty: totalReplayPenalty,
    replayPenaltyReason: replayPenaltyReasons,
    previousMainTopicPenalty: replayPenalty.penalty,
    weeklyReplayPenalty: weeklyReplayPenalty.penalty,
    scores,
    scoreText,
    preferredLane: preferredLane?.id || laneDecision.preferredLaneId,
    preferredLaneName: preferredLane?.name || laneDecision.preferredLaneId,
    secondaryLane: secondaryLane?.id || laneDecision.secondaryLaneId,
    secondaryLaneName: secondaryLane?.name || laneDecision.secondaryLaneId,
    sellFormats: preferredLane?.sellFormats || [],
    matchedTerms: [...group.matchedTerms],
    recommendation,
    evidenceSources: summarizeEvidenceSources(supportingItems),
    evidenceStrength: evidenceAssessment.strength,
    evidenceEligible: evidenceAssessment.eligible,
    evidenceGaps: evidenceAssessment.gaps,
    evidenceAssessment,
    confidence,
    xianyuToday,
    afterSalesRisk,
    todaySmallestAction: buildTodaySmallestAction(
      laneDecision.preferredLaneId,
      candidateLike,
      profile
    ),
    productAngle,
    buyerHint: useRuleSpecificHints
      ? group.rule.buyerHint || laneHints.buyerHint
      : laneHints.buyerHint,
    deliveryHint,
    channelHint: useRuleSpecificHints
      ? group.rule.channelHint || laneHints.channelHint
      : laneHints.channelHint,
    titleHint: useRuleSpecificHints
      ? group.rule.titleHint || laneHints.titleHint
      : laneHints.titleHint,
    avoidLeadHint: useRuleSpecificHints
      ? group.rule.avoidLeadHint || laneHints.avoidLeadHint
      : laneHints.avoidLeadHint,
    laneSignalScores: laneDecision.laneSignalScores,
    ...commercialPattern,
    offerFamily,
    officialEvidenceChecks: supplementalEvidence.checks,
    supportingItems,
    sourceTypes: [...new Set(group.items.map((item) => item.type))],
  };
}

function buildOpportunityCandidatesInternal(
  allUnifiedData,
  playbook = opportunityPlaybook,
  options = {}
) {
  const groups = new Map();
  const replayLookup = buildOpportunityReplayLookup(options.recentReplayMemory);
  const githubHotProjectRule = playbook.topicRules.find(
    (rule) => rule.id === "github_hot_project"
  );

  for (const [sourceType, items] of Object.entries(allUnifiedData || {})) {
    for (const rawItem of items || []) {
      const item = toOpportunityItem(rawItem, sourceType);
      if (!item.title && !item.description && !item.plainText) continue;
      if (getReplaySourceMatch(item, replayLookup)) continue;

      const ruleMatch = findBestRuleForItem(item, playbook);
      if (ruleMatch) {
        addItemToOpportunityGroup(
          groups,
          ruleMatch.rule,
          item,
          ruleMatch.matchedTerms,
          options
        );
      }

      const githubMatchedTerms = getMatchedTermsForRule(item, githubHotProjectRule);
      const isGithubProjectSignal =
        sourceType === "project" &&
        (githubMatchedTerms.length > 0 ||
          /github/i.test(item.source || "") ||
          /github\.com/i.test(item.url || ""));

      if (
        isGithubProjectSignal &&
        (!ruleMatch ||
          (!options.avoidGenericDuplicates &&
            ruleMatch.rule.id !== githubHotProjectRule?.id))
      ) {
        addItemToOpportunityGroup(
          groups,
          githubHotProjectRule,
          item,
          githubMatchedTerms,
          options
        );
      }
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
        options.previousMainTopicSignals || null,
        replayLookup,
        options
      )
    )
    .sort((a, b) => b.score - a.score);
}

export function buildOpportunityCandidateAssessment(
  allUnifiedData,
  playbook = opportunityPlaybook,
  options = {}
) {
  const allCandidates = buildOpportunityCandidatesInternal(
    allUnifiedData,
    playbook,
    options
  );
  const replayLookup = buildOpportunityReplayLookup(options.recentReplayMemory);
  const requireStrongEvidence = Boolean(options.requireStrongEvidence);
  const enforceReplayDimensions = Boolean(options.enforceReplayDimensions);
  const minimumScore = Math.max(
    0,
    Number.parseInt(options.minimumCandidateScore, 10) || 52
  );
  const candidates = [];
  const rejectedCandidates = [];
  const seenEntities = new Set();
  const seenCommercialSignatures = new Set();
  const seenOfferFamilies = new Set();

  for (const candidate of allCandidates) {
    const rejectionReasons = [];

    if (requireStrongEvidence && !candidate.evidenceEligible) {
      rejectionReasons.push(
        candidate.evidenceGaps?.join("；") || "证据不足，不能进入今日商机"
      );
    }

    if (requireStrongEvidence && candidate.score < minimumScore) {
      rejectionReasons.push(`综合分低于发布门槛 ${minimumScore}`);
    }

    if (enforceReplayDimensions) {
      const replayBlock = getReplayHardBlock(candidate, replayLookup);
      if (replayBlock) rejectionReasons.push(replayBlock);
    }

    const entityKey = String(candidate.entityKey || "").toLowerCase();
    if (
      (enforceReplayDimensions || options.dedupeCandidateEntities) &&
      entityKey &&
      seenEntities.has(entityKey)
    ) {
      rejectionReasons.push("当天候选中已经有同一项目或产品实体");
    }

    const signature = String(candidate.commercialSignature || "").toLowerCase();
    if (
      enforceReplayDimensions &&
      signature &&
      seenCommercialSignatures.has(signature)
    ) {
      rejectionReasons.push("当天候选中商业模式与交付类型重复");
    }

    const offerFamily = String(candidate.offerFamily || "").toLowerCase();
    if (
      enforceReplayDimensions &&
      offerFamily &&
      seenOfferFamilies.has(offerFamily)
    ) {
      rejectionReasons.push("当天候选中读者交付家族重复");
    }

    const assessedCandidate = {
      ...candidate,
      qualified: rejectionReasons.length === 0,
      rejectionReasons,
    };

    if (assessedCandidate.qualified) {
      candidates.push(assessedCandidate);
      if (enforceReplayDimensions || options.dedupeCandidateEntities) {
        if (entityKey) seenEntities.add(entityKey);
        if (signature) seenCommercialSignatures.add(signature);
        if (offerFamily) seenOfferFamilies.add(offerFamily);
      }
    } else {
      rejectedCandidates.push(assessedCandidate);
    }
  }

  const strictRejectedCandidates = [...rejectedCandidates];
  if (candidates.length === 0 && options.allowObservationFallback) {
    let observationIndex = rejectedCandidates.findIndex((candidate) => {
      const reasons = candidate.rejectionReasons || [];
      return (
        candidate.evidenceEligible === true &&
        candidate.score >= minimumScore &&
        reasons.length > 0 &&
        reasons.every((reason) =>
          /^近7天已经使用同一(?:商业模式与交付类型组合|读者交付家族)$/.test(reason)
        )
      );
    });

    if (observationIndex < 0) {
      const observationScoreFloor = Math.max(40, minimumScore - 12);
      observationIndex = rejectedCandidates.findIndex((candidate) => {
        const reasons = candidate.rejectionReasons || [];
        const evidence = candidate.evidenceAssessment || {};
        const hasReviewableSource =
          evidence.primaryCount > 0 ||
          evidence.reproducibleCount > 0 ||
          evidence.trustedMediaCount > 0;
        const hasEntityReplay = reasons.some((reason) =>
          /同一项目或产品实体/.test(reason)
        );
        return (
          hasReviewableSource &&
          evidence.hasConcreteChange === true &&
          (candidate.baseScore || candidate.score || 0) >= observationScoreFloor &&
          !hasEntityReplay
        );
      });
    }

    if (observationIndex >= 0) {
      const rejectedCandidate = rejectedCandidates.splice(observationIndex, 1)[0];
      candidates.push({
        ...rejectedCandidate,
        observationOnly: true,
        observationReasons: [...rejectedCandidate.rejectionReasons],
        qualified: true,
        rejectionReasons: [],
        confidence:
          rejectedCandidate.evidenceAssessment?.primaryCount > 0 ||
          rejectedCandidate.evidenceAssessment?.reproducibleCount > 0
            ? "中"
            : "低",
        xianyuToday: "观察",
        todaySmallestAction:
          "先核对候选对应的官方或原项目入口，再访谈 3 位同一鱼塘用户；一手证据和不同需求都未出现前不启动交付。",
      });
    }
  }

  return {
    candidates,
    rejectedCandidates,
    allCandidates,
    stats: {
      total: allCandidates.length,
      qualified: candidates.length,
      strictQualified: candidates.filter((candidate) => !candidate.observationOnly).length,
      observationFallback: candidates.filter((candidate) => candidate.observationOnly).length,
      rejected: rejectedCandidates.length,
      strictRejected: strictRejectedCandidates.length,
      rejectedForEvidence: strictRejectedCandidates.filter((candidate) =>
        candidate.rejectionReasons.some((reason) => /证据|官方|实证|来源/.test(reason))
      ).length,
      rejectedForReplay: strictRejectedCandidates.filter((candidate) =>
        candidate.rejectionReasons.some((reason) => /近7天|当天候选/.test(reason))
      ).length,
    },
  };
}

export function buildOpportunityCandidates(
  allUnifiedData,
  playbook = opportunityPlaybook,
  options = {}
) {
  return buildOpportunityCandidateAssessment(
    allUnifiedData,
    playbook,
    options
  ).candidates;
}

export function formatOpportunityCandidatesForPrompt(
  candidates,
  playbook = opportunityPlaybook,
  options = {}
) {
  const profile = options.profile || "account";
  const visibleCandidates = selectPromptCandidates(candidates, playbook, { profile });

  if (visibleCandidates.length === 0) {
    return "今天没有通过证据与去重门槛的候选。不要编造商机，调用方应跳过本次商机生成。";
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
            `   - 证据等级: ${item.evidence?.tier || "unknown"} | 说明: ${
              item.evidence?.reason || "未分类"
            }`,
            `   - 摘要: ${item.description || item.plainText || "无"}`,
          ].join("\n");
        })
        .join("\n");

      const commonLines = [
        `### ${index + 1}. ${candidate.label}`,
        ...(candidate.observationOnly
          ? [
              "- 发布模式: 观察；它不是新的差异化商机，只用于核验新实体是否值得下周再评估",
              `- 观察原因: ${candidate.observationReasons?.join("；") || "近 7 天同类交付已经出现"}`,
              "- 强制边界: 不得写成今天能卖、立即上架或已经确认付费需求",
            ]
          : []),
        `- 证据来源: ${candidate.evidenceSources}`,
        `- 证据强度: ${candidate.evidenceStrength}`,
        `- 证据缺口: ${candidate.evidenceGaps.join("；") || "暂无明显缺口"}`,
        `- 可信度: ${candidate.confidence}`,
      ];

      if (profile === "general") {
        return [
          ...commonLines,
          `- 读者交付家族: ${candidate.offerFamily}`,
          `- 48 小时验证起手: ${candidate.todaySmallestAction}`,
          `- 售后与合规风险: ${candidate.afterSalesRisk}`,
          `- 综合分: ${candidate.score}/100`,
          `- 优先交付方向: ${candidate.preferredLaneName}`,
          `- 备选交付方向: ${candidate.secondaryLaneName}`,
          `- 机会实体: ${candidate.entityKey}`,
          `- 商业模式: ${candidate.businessModel}`,
          `- 交付类型: ${candidate.deliveryType}`,
          `- 编排提醒: ${getEditorialHint(candidate, profile)}`,
          `- 最小交付角度: ${candidate.productAngle}`,
          `- 目标鱼塘提示: ${candidate.buyerHint}`,
          `- 可验收交付提示: ${candidate.deliveryHint}`,
          `- 验证触达位置: ${candidate.channelHint}`,
          `- 标题写法: ${candidate.titleHint}`,
          `- 不要主写: ${candidate.avoidLeadHint}`,
          `- 推荐写法: ${candidate.recommendation}`,
          `- 支撑素材:\n${supportingItemsText}`,
        ].join("\n");
      }

      return [
        ...commonLines,
        `- 是否今天能挂闲鱼: ${candidate.xianyuToday}`,
        `- 售后风险: ${candidate.afterSalesRisk}`,
        `- 今天最小动作: ${candidate.todaySmallestAction}`,
        `- 综合分: ${candidate.score}/100`,
        `- 优先卖法: ${candidate.preferredLaneName}`,
        `- 备选卖法: ${candidate.secondaryLaneName}`,
        `- 机会实体: ${candidate.entityKey}`,
        `- 商业模式: ${candidate.businessModel}`,
        `- 交付类型: ${candidate.deliveryType}`,
        `- 编排提醒: ${getEditorialHint(candidate, profile)}`,
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
