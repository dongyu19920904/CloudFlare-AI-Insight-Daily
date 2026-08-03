import { normalizeGithubProjectUrl } from "./githubTopProjectDedupe.js";

const SOCIAL_HOSTS = new Set([
  "x.com",
  "twitter.com",
  "t.me",
  "reddit.com",
  "www.reddit.com",
  "weibo.com",
  "xiaohongshu.com",
]);

const TRUSTED_MEDIA_HOSTS = new Set([
  "36kr.com",
  "aibase.com",
  "aibase.cn",
  "jiqizhixin.com",
  "qbitai.com",
  "reuters.com",
  "techcrunch.com",
  "theverge.com",
  "wired.com",
]);

const OFFICIAL_HOST_SUFFIXES = [
  "openai.com",
  "anthropic.com",
  "ai.google.dev",
  "blog.google",
  "developers.googleblog.com",
  "deepmind.google",
  "microsoft.com",
  "github.com",
  "huggingface.co",
  "meta.com",
  "mistral.ai",
  "cursor.com",
  "perplexity.ai",
  "x.ai",
  "arxiv.org",
];

const GENERIC_RULE_IDS = new Set([
  "github_hot_project",
  "skills_templates",
  "workflow",
]);

const GENERIC_PRODUCT_WORDS = new Set([
  "ai",
  "agent",
  "agents",
  "app",
  "apps",
  "assistant",
  "automation",
  "code",
  "github",
  "open",
  "project",
  "release",
  "sdk",
  "server",
  "tool",
  "tools",
  "update",
  "workflow",
]);

const ACTIONABLE_OUTCOME_PATTERN =
  /字幕|翻译|整理|提取|总结|写作|客服|销售|内容|视频|图片|脚本|迁移|部署|安装|配置|接入|监测|对比|检索|报告|数据|自动化|工作流|模板|教程|清单|知识库|答疑|交付|demo|deploy|install|integrat|migrat|monitor|report|search|summar|translat|video|workflow/i;

const CONCRETE_CHANGE_PATTERN =
  /上线|发布|更新|开放|支持|接入|新增|推出|修复|涨价|降价|退役|开源|launch|release|update|changelog|pricing|support|deprecated|retired/i;

function safeUrl(value) {
  try {
    return new URL(String(value || "").trim());
  } catch {
    return null;
  }
}

function normalizeHostname(hostname) {
  return String(hostname || "").toLowerCase().replace(/^www\./, "");
}

function isHostOrSubdomain(hostname, suffix) {
  const normalizedHost = normalizeHostname(hostname);
  const normalizedSuffix = normalizeHostname(suffix);
  return (
    normalizedHost === normalizedSuffix ||
    normalizedHost.endsWith(`.${normalizedSuffix}`)
  );
}

function getEvidenceText(item) {
  return [
    item?.title,
    item?.description,
    item?.plainText,
    item?.source,
    item?.searchText,
  ]
    .filter(Boolean)
    .join(" ");
}

export function canonicalizeOpportunityEvidenceUrl(url) {
  const parsed = safeUrl(url);
  if (!parsed) return String(url || "").trim().toLowerCase();

  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ["ref", "ref_src", "si"].includes(key)) {
      parsed.searchParams.delete(key);
    }
  }

  const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  const query = parsed.searchParams.toString();
  return `${parsed.origin.toLowerCase()}${pathname}${query ? `?${query}` : ""}`;
}

export function classifyOpportunityEvidence(item, sourceType = item?.type || "") {
  const url = safeUrl(item?.url);
  const hostname = normalizeHostname(url?.hostname);
  const source = String(item?.source || "").toLowerCase();
  const githubProject = normalizeGithubProjectUrl(item?.url);
  const lowEvidencePitch = Boolean(
    item?.lowEvidenceAiWorkflowPitch || item?.details?.lowEvidenceAiWorkflowPitch
  );

  if (lowEvidencePitch) {
    return {
      tier: "low",
      score: 0,
      isPrimary: false,
      isReproducible: false,
      isSocial: false,
      reason: "指定 Folo 源的工作流宣传缺少官方或可复现实证",
      independentKey: hostname || source || "low-evidence",
    };
  }

  if (githubProject) {
    return {
      tier: "primary",
      score: 10,
      isPrimary: true,
      isReproducible: true,
      isSocial: false,
      reason: "原项目代码仓库可直接核验",
      independentKey: githubProject,
    };
  }

  if (SOCIAL_HOSTS.has(hostname) || sourceType === "socialMedia" || /twitter|telegram|即刻|微博|小红书/.test(source)) {
    return {
      tier: "social",
      score: 2,
      isPrimary: false,
      isReproducible: false,
      isSocial: true,
      reason: "社交线索只能发现需求，不能单独证明产品事实",
      independentKey: hostname || source || "social",
    };
  }

  const officialHost = OFFICIAL_HOST_SUFFIXES.some((suffix) =>
    isHostOrSubdomain(hostname, suffix)
  );
  const explicitlyOfficial = /官方|official|changelog|release notes/i.test(source);
  const documentationPath = /\/(?:blog|changelog|docs?|documentation|releases?|tutorials?|guides?)\b/i.test(
    url?.pathname || ""
  );

  if (
    officialHost ||
    explicitlyOfficial ||
    (sourceType === "project" && hostname) ||
    (documentationPath && hostname && !SOCIAL_HOSTS.has(hostname) && !TRUSTED_MEDIA_HOSTS.has(hostname))
  ) {
    return {
      tier: "primary",
      score: 9,
      isPrimary: true,
      isReproducible: documentationPath || sourceType === "project",
      isSocial: false,
      reason: documentationPath ? "原站文档或发布说明" : "原项目或官方来源",
      independentKey: hostname || source || "primary",
    };
  }

  if (TRUSTED_MEDIA_HOSTS.has(hostname) || /机器之心|量子位|路透|techcrunch|the verge|wired|ai ?base/.test(source)) {
    return {
      tier: "trusted-media",
      score: 6,
      isPrimary: false,
      isReproducible: false,
      isSocial: false,
      reason: "可信媒体二手报道，关键产品事实仍需原始来源",
      independentKey: hostname || source || "trusted-media",
    };
  }

  return {
    tier: "secondary",
    score: 4,
    isPrimary: false,
    isReproducible: false,
    isSocial: false,
    reason: "普通二手来源",
    independentKey: hostname || source || "secondary",
  };
}

export function assessOpportunityEvidence(items = []) {
  const classified = (items || []).map((item) => ({
    item,
    evidence: item?.evidence || classifyOpportunityEvidence(item, item?.type),
  }));
  const usable = classified.filter(({ evidence }) => evidence.tier !== "low");
  const primary = usable.filter(({ evidence }) => evidence.isPrimary);
  const reproducible = usable.filter(({ evidence }) => evidence.isReproducible);
  const trustedMedia = usable.filter(({ evidence }) => evidence.tier === "trusted-media");
  const social = usable.filter(({ evidence }) => evidence.isSocial);
  const independentKeys = new Set(
    usable.map(({ evidence }) => evidence.independentKey).filter(Boolean)
  );
  const combinedText = usable.map(({ item }) => getEvidenceText(item)).join(" ");
  const hasActionableOutcome = ACTIONABLE_OUTCOME_PATTERN.test(combinedText);
  const hasConcreteChange =
    CONCRETE_CHANGE_PATTERN.test(combinedText) ||
    usable.some(({ item }) => item?.type === "project");

  let strength = "low";
  if (primary.length > 0 && independentKeys.size >= 2) strength = "high";
  else if (primary.length > 0 || reproducible.length > 0) strength = "medium";

  const gaps = [];
  if (primary.length === 0) gaps.push("缺少官方发布、原项目或可复现实证");
  if (!hasConcreteChange) gaps.push("没有明确的新变化");
  if (!hasActionableOutcome) gaps.push("尚未证明能交付具体结果");
  if (usable.length > 0 && social.length === usable.length) {
    gaps.push("只有社交转述");
  }

  return {
    strength,
    eligible:
      usable.length > 0 &&
      primary.length > 0 &&
      hasConcreteChange &&
      hasActionableOutcome,
    primaryCount: primary.length,
    reproducibleCount: reproducible.length,
    trustedMediaCount: trustedMedia.length,
    socialCount: social.length,
    independentSourceCount: independentKeys.size,
    lowEvidenceCount: classified.length - usable.length,
    hasActionableOutcome,
    hasConcreteChange,
    gaps,
  };
}

function normalizeEntityText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function deriveOpportunityEntityKey(item, ruleId = "") {
  const githubProject = normalizeGithubProjectUrl(item?.url);
  if (githubProject) return `github:${githubProject.replace(/^github\.com\//, "")}`;

  const explicitName =
    item?.productName ||
    item?.projectName ||
    item?.details?.productName ||
    item?.details?.projectName;
  if (explicitName) return `name:${normalizeEntityText(explicitName).slice(0, 80)}`;

  const title = normalizeEntityText(item?.title);
  const latinToken = title
    .split(" ")
    .find(
      (token) =>
        /^[a-z][a-z0-9.-]{2,}$/i.test(token) &&
        !GENERIC_PRODUCT_WORDS.has(token)
    );
  if (latinToken) return `name:${latinToken}`;

  const url = safeUrl(item?.url);
  const hostname = normalizeHostname(url?.hostname);
  if (hostname && !SOCIAL_HOSTS.has(hostname) && !TRUSTED_MEDIA_HOSTS.has(hostname)) {
    return `host:${hostname}`;
  }

  if (title) return `title:${title.slice(0, 48)}`;
  if (ruleId && !GENERIC_RULE_IDS.has(ruleId)) return `topic:${ruleId}`;
  return ruleId ? `rule:${ruleId}` : "";
}

export function classifyOpportunityCommercialPattern(items = [], preferredLane = "") {
  const text = (items || []).map((item) => getEvidenceText(item)).join(" ");

  let businessModel = "productized-service";
  if (/月费|订阅|会员|持续维护|代运营|监测服务|社群|subscription|monthly|monitoring/i.test(text)) {
    businessModel = "recurring-service";
  } else if (/账号|账户|成品号|卡密|入口|订阅席位|account|seat|license key/i.test(text)) {
    businessModel = "access-resale";
  } else if (/模板|资料包|清单|教程包|知识库|课程|template|playbook|database|course/i.test(text)) {
    businessModel = "digital-product";
  } else if (/内容|视频|文案|脚本|翻译|设计|报告|content|video|copywriting|translation|report/i.test(text)) {
    businessModel = "result-delivery";
  } else if (preferredLane === "bundle") {
    businessModel = "digital-product";
  } else if (preferredLane === "account") {
    businessModel = "access-resale";
  }

  let deliveryType = "result-service";
  if (/迁移|替换|平替|救火|migration|migrate/i.test(text)) {
    deliveryType = "migration";
  } else if (/监测|追踪|预警|monitor|tracking|alert/i.test(text)) {
    deliveryType = "monitoring";
  } else if (/mcp|api|插件|接入|集成|integration|plugin/i.test(text)) {
    deliveryType = "integration";
  } else if (/部署|安装|环境配置|代配置|跑通|deploy|install|setup|configuration/i.test(text)) {
    deliveryType = "deployment-setup";
  } else if (/自动化|工作流|workflow|automation/i.test(text)) {
    deliveryType = "automation-workflow";
  } else if (/视频|口播|图片|文案|脚本|写作|翻译|video|image|copywriting|script|translation/i.test(text)) {
    deliveryType = "content-production";
  } else if (/数据|整理|研究|对比|筛选|报告|database|research|comparison|report/i.test(text)) {
    deliveryType = "data-research";
  } else if (/教程|陪跑|培训|答疑|course|training|coaching|guide/i.test(text)) {
    deliveryType = "training-guidance";
  } else if (/模板|资料包|清单|知识库|template|playbook/i.test(text)) {
    deliveryType = "template-pack";
  } else if (preferredLane === "account") {
    deliveryType = "account-access";
  }

  return {
    businessModel,
    deliveryType,
    commercialSignature: `${businessModel}:${deliveryType}`,
  };
}
