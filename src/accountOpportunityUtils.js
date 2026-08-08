import { getYearMonth } from "./contentUtils.js";
import {
  AIVORA_BRAND_NAME,
  containsAivoraLink,
} from "./opportunityAivoraLinkPolicy.js";

const FRONT_MATTER_REGEX = /^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/;
const LATEST_ACCOUNT_OPPORTUNITY_SHORTCODE = "{{< latest-account-opportunity >}}";

export const DEFAULT_ACCOUNT_OPPORTUNITY_PAGE_DESCRIPTION =
  "核验 AI 账号、订阅、API、支付、额度与平台政策变化，给卖家当天动作，也给买家清晰的购买风险边界。";

export const DEFAULT_ACCOUNT_OPPORTUNITY_SECTION_DESCRIPTION = `${DEFAULT_ACCOUNT_OPPORTUNITY_PAGE_DESCRIPTION} 只在证据达到门槛时更新。`;
const ACCOUNT_OBSERVATION_HARD_SIGNAL =
  "今天没有取得可由官方页面确认的账号、价格、额度或政策新变化；不新增商品。";

const ACCOUNT_SIGNAL_PATTERN =
  /账号|账户|订阅|套餐|会员|席位|额度|配额|用量限制|价格|涨价|降价|支付|账单|绑卡|地区|登录|认证|封号|封禁|冻结|停用|退役|服务状态|故障|API\s*(?:key|价格|额度|限制)|rate\s*limit|subscription|pricing|quota|billing|payment|region|login|account|suspend|outage/i;
const CONCRETE_CHANGE_PATTERN =
  /上线|发布|更新|开放|新增|调整|变更|修复|涨价|降价|限制|停用|退役|恢复|故障|launch|release|update|change|pricing|limit|retired|deprecated|outage/i;
const ACCOUNT_PRODUCT_OFFICIAL_HOST_SUFFIXES = [
  "openai.com",
  "anthropic.com",
  "claude.com",
  "google.com",
  "ai.google.dev",
  "deepmind.google",
  "microsoft.com",
  "cursor.com",
  "perplexity.ai",
  "x.ai",
  "mistral.ai",
  "minimax.io",
  "meta.com",
];

function normalizeDimension(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}:-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getCandidateEvidenceText(candidate) {
  return [
    candidate?.label,
    candidate?.productAngle,
    candidate?.deliveryHint,
    ...(candidate?.supportingItems || []).flatMap((item) => [
      item?.title,
      item?.description,
      item?.plainText,
      item?.source,
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

function getSupportingEvidenceText(candidate) {
  return (candidate?.supportingItems || [])
    .flatMap((item) => [
      item?.title,
      item?.description,
      item?.plainText,
      item?.source,
    ])
    .filter(Boolean)
    .join(" ");
}

export function isOfficialAccountOpportunityUrl(url) {
  try {
    const hostname = new URL(String(url || "")).hostname.toLowerCase();
    return ACCOUNT_PRODUCT_OFFICIAL_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}

function getAccountReplayRecords(records = []) {
  return (records || []).filter(
    (record) => !record?.section || record.section === "account-opportunity"
  );
}

function getEntitySearchToken(entityKey) {
  const value = String(entityKey || "").toLowerCase();
  const token = value.includes(":") ? value.split(":").slice(1).join(":") : value;
  return token.replace(/[-_:]+/g, " ").trim();
}

export function assessAccountOpportunityEvidence(candidate = {}) {
  const usableItems = (candidate.supportingItems || []).filter(
    (item) => item?.evidence?.tier !== "low"
  );
  const primaryItems = usableItems.filter(
    (item) => item?.evidence?.isPrimary === true
  );
  const officialItems = usableItems.filter((item) =>
    isOfficialAccountOpportunityUrl(item?.url)
  );
  const independentSources = new Set(
    usableItems
      .map((item) => item?.evidence?.independentKey || item?.url || item?.source)
      .filter(Boolean)
  );
  const text = getSupportingEvidenceText(candidate);
  const hasAccountSignal = ACCOUNT_SIGNAL_PATTERN.test(text);
  const hasConcreteChange =
    CONCRETE_CHANGE_PATTERN.test(text) ||
    usableItems.some((item) => item?.type === "project");
  const gaps = [];

  if (primaryItems.length === 0) {
    gaps.push("缺少官方页面、原项目或可复现实证");
  }
  if (!hasAccountSignal) {
    gaps.push("没有账号、订阅、API、支付、额度、地区、登录、政策或服务状态信号");
  }
  if (!hasConcreteChange) {
    gaps.push("没有可确认的当天变化");
  }

  let strength = "低";
  if (officialItems.length > 0 && independentSources.size >= 2) strength = "高";
  else if (primaryItems.length > 0) strength = "中";

  return {
    eligible:
      usableItems.length > 0 &&
      primaryItems.length > 0 &&
      hasAccountSignal &&
      hasConcreteChange,
    strength,
    primaryCount: primaryItems.length,
    officialCount: officialItems.length,
    independentSourceCount: independentSources.size,
    hasAccountSignal,
    hasConcreteChange,
    gaps,
  };
}

export function deriveAccountOpportunityDimensions(
  candidate,
  playbook
) {
  const rule = (playbook?.topicRules || []).find(
    (item) => item.id === candidate?.id
  );
  const supplyForm = normalizeDimension(
    rule?.supplyForm || candidate?.preferredLane || "unknown-supply"
  );
  const buyerPain = normalizeDimension(
    rule?.buyerPain || "unverified-buyer-pain"
  );
  const actionType = normalizeDimension(
    rule?.actionType || "evidence-review"
  );

  return {
    supplyForm,
    buyerPain,
    actionType,
    accountReplaySignature: `account:${supplyForm}:${buyerPain}:${actionType}`,
    accountOfferFamily: `account:${supplyForm}:${actionType}`,
  };
}

export function qualifyAccountOpportunityCandidates(
  candidates = [],
  playbook,
  recentReplayMemory = null,
  options = {}
) {
  const minimumScore = Math.max(
    0,
    Number.parseInt(options.minimumScore, 10) ||
      playbook?.outputRules?.minimumCandidateScore ||
      52
  );
  const recentEntities = new Set(
    getAccountReplayRecords(recentReplayMemory?.entities)
      .map((record) => String(record?.key || record?.entity || "").toLowerCase())
      .filter(Boolean)
  );
  const recentSignatures = new Set(
    getAccountReplayRecords(recentReplayMemory?.commercialSignatures)
      .map((record) =>
        String(record?.key || record?.commercialSignature || "").toLowerCase()
      )
      .filter(Boolean)
  );
  const recentTitles = getAccountReplayRecords(recentReplayMemory?.titles)
    .map((record) => String(record?.title || "").toLowerCase())
    .join(" ");
  const seenEntities = new Set();
  const seenSignatures = new Set();
  const qualified = [];
  const rejected = [];

  for (const candidate of candidates || []) {
    const evidence = assessAccountOpportunityEvidence(candidate);
    const dimensions = deriveAccountOpportunityDimensions(candidate, playbook);
    const entityKey = String(candidate?.entityKey || "").toLowerCase();
    const entityToken = getEntitySearchToken(entityKey);
    const rejectionReasons = [];

    if (!evidence.eligible) {
      rejectionReasons.push(...evidence.gaps);
    }
    if ((candidate?.score || 0) < minimumScore) {
      rejectionReasons.push(`综合分低于账号商机门槛 ${minimumScore}`);
    }
    if (
      entityKey &&
      (recentEntities.has(entityKey) ||
        (entityToken.length >= 3 && recentTitles.includes(entityToken)))
    ) {
      rejectionReasons.push("近 7 天账号商机已经使用同一产品或项目实体");
    }
    if (recentSignatures.has(dimensions.accountReplaySignature)) {
      rejectionReasons.push("近 7 天账号商机已经使用同一供给形态、买家痛点和行动组合");
    }
    if (entityKey && seenEntities.has(entityKey)) {
      rejectionReasons.push("当天账号候选中已经有同一产品或项目实体");
    }
    if (seenSignatures.has(dimensions.accountReplaySignature)) {
      rejectionReasons.push("当天账号候选中行动组合重复");
    }

    const afterSalesRisk =
      candidate.afterSalesRisk === "高" ||
      /第三方|镜像|共享|激活|破解|key|中转/i.test(getCandidateEvidenceText(candidate))
        ? "高"
        : candidate.afterSalesRisk || "中";
    const listingDecision = afterSalesRisk === "高" ? "否" : "观察";
    const assessed = {
      ...candidate,
      ...dimensions,
      businessModel: `account-${dimensions.supplyForm}`,
      deliveryType: dimensions.actionType,
      commercialSignature: dimensions.accountReplaySignature,
      offerFamily: dimensions.accountOfferFamily,
      accountEvidence: evidence,
      evidenceStrength: evidence.strength,
      evidenceEligible: evidence.eligible,
      evidenceGaps: evidence.gaps,
      confidence: evidence.strength,
      xianyuToday: listingDecision,
      afterSalesRisk,
      qualified: rejectionReasons.length === 0,
      rejectionReasons,
    };

    if (assessed.qualified) {
      qualified.push(assessed);
      if (entityKey) seenEntities.add(entityKey);
      seenSignatures.add(dimensions.accountReplaySignature);
    } else {
      rejected.push(assessed);
    }
  }

  const strictRejectedCandidates = [...rejected];
  if (qualified.length === 0 && options.allowObservationFallback) {
    const observationScoreFloor = Math.max(40, minimumScore - 12);
    const observationIndex = rejected.findIndex((candidate) => {
      const hasUsableSource = (candidate.supportingItems || []).some(
        (item) => item?.url && item?.evidence?.tier !== "low"
      );
      const hasReplayBlock = (candidate.rejectionReasons || []).some((reason) =>
        /近 7 天|当天账号候选/.test(reason)
      );
      return (
        candidate.accountEvidence?.hasAccountSignal === true &&
        candidate.accountEvidence?.hasConcreteChange === true &&
        hasUsableSource &&
        (candidate.score || 0) >= observationScoreFloor &&
        !hasReplayBlock
      );
    });

    if (observationIndex >= 0) {
      const rejectedCandidate = rejected.splice(observationIndex, 1)[0];
      qualified.push({
        ...rejectedCandidate,
        observationOnly: true,
        observationReasons: [...rejectedCandidate.rejectionReasons],
        qualified: true,
        rejectionReasons: [],
        confidence:
          rejectedCandidate.accountEvidence?.primaryCount > 0 ? "中" : "低",
        xianyuToday: rejectedCandidate.afterSalesRisk === "高" ? "否" : "观察",
      });
    }
  }

  return {
    candidates: qualified,
    rejectedCandidates: rejected,
    stats: {
      total: (candidates || []).length,
      qualified: qualified.length,
      strictQualified: qualified.filter((candidate) => !candidate.observationOnly).length,
      observationFallback: qualified.filter((candidate) => candidate.observationOnly).length,
      rejected: rejected.length,
      strictRejected: strictRejectedCandidates.length,
      rejectedForEvidence: strictRejectedCandidates.filter((candidate) =>
        candidate.rejectionReasons.some((reason) =>
          /官方|原项目|实证|账号|订阅|API|支付|额度|地区|登录|政策|服务状态|当天变化/.test(reason)
        )
      ).length,
      rejectedForReplay: strictRejectedCandidates.filter((candidate) =>
        candidate.rejectionReasons.some((reason) => /近 7 天|当天账号候选/.test(reason))
      ).length,
    },
  };
}

export function formatAccountOpportunityCandidatesForPrompt(
  candidates = [],
  maxCandidates = 4
) {
  const visibleCandidates = (candidates || []).slice(
    0,
    Math.max(1, Number.parseInt(maxCandidates, 10) || 4)
  );
  if (visibleCandidates.length === 0) {
    return "今天没有通过账号信号、证据和 7 天去重门槛的候选。";
  }

  return visibleCandidates
    .map((candidate, index) => {
      const sources = (candidate.supportingItems || [])
        .map((item, itemIndex) => [
          `${itemIndex + 1}. [${item.title || item.source || "候选来源"}](${item.url})`,
          `   - 来源等级: ${item.evidence?.tier || "unknown"}；${item.evidence?.reason || "未分类"}`,
          `   - 摘要: ${item.description || item.plainText || "无"}`,
        ].join("\n"))
        .join("\n");

      return [
        `### 候选 ${index + 1}：${candidate.label}`,
        ...(candidate.observationOnly
          ? [
              "- 发布模式: 观察；今天没有可由官方页面确认的新变化，不得新增商品",
              `- 观察原因: ${candidate.observationReasons?.join("；") || "官方证据尚未达到发布门槛"}`,
              "- 强制边界: 只能写核验、FAQ 或售后边界动作，不得写今天上架",
            ]
          : []),
        `- 账号证据强度: ${candidate.evidenceStrength}`,
        `- 证据缺口: ${candidate.evidenceGaps.join("；") || "暂无明显缺口"}`,
        `- 供给形态: ${candidate.supplyForm}`,
        `- 买家痛点: ${candidate.buyerPain}`,
        `- 今日行动类型: ${candidate.actionType}`,
        `- 建议上架判断: ${candidate.xianyuToday}`,
        `- 售后风险: ${candidate.afterSalesRisk}`,
        `- 目标买家提示: ${candidate.buyerHint}`,
        `- 可交付提示: ${candidate.deliveryHint}`,
        `- 不能主写: ${candidate.avoidLeadHint}`,
        `- 原始证据:\n${sources || "- 无"}`,
      ].join("\n");
    })
    .join("\n\n");
}

export function normalizeAccountOpportunityObservationMarkdown(markdown) {
  const sourceLines = String(markdown || "").split(/\r?\n/);
  const hardSignalNormalized = [];
  let skippingHardSignalBody = false;

  for (const line of sourceLines) {
    if (/^##\s+今日硬信号(?:\s|$)/.test(line)) {
      hardSignalNormalized.push(line, "", `- ${ACCOUNT_OBSERVATION_HARD_SIGNAL}`, "");
      skippingHardSignalBody = true;
      continue;
    }
    if (skippingHardSignalBody) {
      if (!/^##\s+/.test(line)) continue;
      skippingHardSignalBody = false;
    }
    hardSignalNormalized.push(line);
  }

  const output = [];
  let inActionSection = false;
  for (let index = 0; index < hardSignalNormalized.length; index += 1) {
    const line = hardSignalNormalized[index];
    if (/^##\s+/.test(line)) {
      inActionSection = /^##\s+今日可执行(?:\s|$)/.test(line);
    }
    output.push(line);
    if (!inActionSection || !/^###\s+/.test(line)) continue;

    let blockEnd = index + 1;
    while (
      blockEnd < hardSignalNormalized.length &&
      !/^#{2,3}\s+/.test(hardSignalNormalized[blockEnd])
    ) {
      blockEnd += 1;
    }
    const blockBody = hardSignalNormalized.slice(index + 1, blockEnd).join("\n");
    if (!/^\*\*判断[:：]\*\*\s*\S/m.test(blockBody)) {
      output.push(
        "",
        "**判断：** 今天只有待核验线索，不新增商品，也不把它写成官方变化。"
      );
    }
  }

  return output.join("\n");
}

export function buildRejectedAccountOpportunityDigest(
  candidates = [],
  maxCandidates = 3
) {
  const visibleCandidates = (candidates || []).slice(0, maxCandidates);
  if (visibleCandidates.length === 0) {
    return "今天没有额外需要点名的高风险方向。";
  }

  return visibleCandidates
    .map((candidate) => {
      const source = candidate.supportingItems?.[0];
      const label = source?.title || source?.source || candidate.label;
      const linked = source?.url ? `[${label}](${source.url})` : label;
      return `- ${linked}\n  - 不进入今日可执行的原因: ${candidate.rejectionReasons.join("；") || "未达到发布门槛"}`;
    })
    .join("\n");
}

export function insertAccountOpportunityAivoraLink(markdown, policy = {}) {
  const suggestedUrl = String(policy?.suggestedUrl || "").trim();
  const allowedUrls = new Set(policy?.allowedUrls || []);
  const content = String(markdown || "");
  if (
    !suggestedUrl ||
    !allowedUrls.has(suggestedUrl) ||
    containsAivoraLink(content)
  ) {
    return { markdown: content, inserted: false };
  }

  const boundaryLine = /^-\s*\*\*不能承诺与停止[:：]\*\*.*$/m;
  if (!boundaryLine.test(content)) {
    return { markdown: content, inserted: false };
  }

  const linkLine = `- **相关公开入口：** 只有文章讨论的工具与当前在售页面直接匹配时，才核对[${AIVORA_BRAND_NAME}](${suggestedUrl})；购买前仍以页面当日说明和官方条款为准。`;
  return {
    markdown: content.replace(
      boundaryLine,
      (match) => `${match}\n${linkLine}`
    ),
    inserted: true,
  };
}

export function buildAccountOpportunityPaths(dateStr) {
  const yearMonth = getYearMonth(dateStr);

  return {
    yearMonth,
    rawFilePath: `account-opportunity/${dateStr}.md`,
    pagePath: `content/cn/account-opportunity/${yearMonth}/${dateStr}.md`,
    monthDirectoryIndexPath: `content/cn/account-opportunity/${yearMonth}/_index.md`,
    homePath: "content/cn/account-opportunity/_index.md",
    publicPath: `/account-opportunity/${yearMonth}/${dateStr}/`,
  };
}

function stripFrontMatter(content) {
  return String(content || "").replace(FRONT_MATTER_REGEX, "");
}

function replaceOrInsertFrontMatterLine(frontMatter, field, value) {
  const pattern = new RegExp(`^${field}:\\s*.*$`, "m");

  if (pattern.test(frontMatter)) {
    return frontMatter.replace(pattern, `${field}: ${value}`);
  }

  return frontMatter.replace(/\r?\n---\s*\r?\n$/, `\n${field}: ${value}\n---\n`);
}

function removeFrontMatterLine(frontMatter, field) {
  const pattern = new RegExp(`^${field}:\\s*.*\\r?\\n?`, "m");
  return frontMatter.replace(pattern, "");
}

function buildAccountOpportunityHomeFrontMatter(dateStr, options = {}) {
  const {
    title = "AI账号商机",
    description = DEFAULT_ACCOUNT_OPPORTUNITY_SECTION_DESCRIPTION,
    sectionPrefix = "/account-opportunity",
  } = options;

  return `---
linkTitle: AI账号商机
title: ${title}
type: account-opportunity
breadcrumbs: false
description: "${description}"
sitemap:
  disable: true
cascade:
  type: docs
---
`;
}

export function updateAccountOpportunityHomeIndexContent(
  existingContent,
  sectionContent,
  dateStr,
  options = {}
) {
  const {
    title = "AI账号商机",
    description = DEFAULT_ACCOUNT_OPPORTUNITY_SECTION_DESCRIPTION,
    sectionPrefix = "/account-opportunity",
  } = options;
  const yearMonth = getYearMonth(dateStr);
  const nextPath = `${sectionPrefix}/${yearMonth}/${dateStr}`;

  let frontMatter = "";

  if (existingContent && FRONT_MATTER_REGEX.test(existingContent)) {
    frontMatter = existingContent.match(FRONT_MATTER_REGEX)[0];
    frontMatter = removeFrontMatterLine(frontMatter, "next");
    frontMatter = replaceOrInsertFrontMatterLine(
      frontMatter,
      "type",
      "account-opportunity"
    );
    frontMatter = replaceOrInsertFrontMatterLine(
      frontMatter,
      "description",
      `"${description}"`
    );
  } else {
    frontMatter = buildAccountOpportunityHomeFrontMatter(dateStr, {
      title,
      description,
      sectionPrefix,
    });
  }

  return `${frontMatter.trimEnd()}\n\n${LATEST_ACCOUNT_OPPORTUNITY_SHORTCODE}`;
}
