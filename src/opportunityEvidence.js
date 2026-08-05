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
  "minimax.io",
  "cursor.com",
  "perplexity.ai",
  "x.ai",
  "arxiv.org",
];

const DEVELOPER_SETUP_DELIVERY_TYPES = new Set([
  "integration",
  "deployment-setup",
  "result-service",
]);

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

export function isOfficialOpportunityUrl(value) {
  const parsed = safeUrl(value);
  if (!parsed) return false;
  return OFFICIAL_HOST_SUFFIXES.some((suffix) =>
    isHostOrSubdomain(parsed.hostname, suffix)
  );
}

export function isTrustedOpportunityMediaUrl(value) {
  const parsed = safeUrl(value);
  return Boolean(parsed && TRUSTED_MEDIA_HOSTS.has(normalizeHostname(parsed.hostname)));
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

export function deriveOpportunityOfferFamily({
  businessModel = "",
  deliveryType = "",
  preferredLane = "",
  label = "",
  productAngle = "",
  deliveryHint = "",
  supportingItems = [],
} = {}) {
  const text = [
    label,
    productAngle,
    deliveryHint,
    ...(supportingItems || []).map((item) => getEvidenceText(item)),
  ].join(" ");
  const hasGithubProject = (supportingItems || []).some((item) =>
    Boolean(normalizeGithubProjectUrl(item?.url))
  );

  if (
    businessModel === "access-resale" ||
    deliveryType === "account-access" ||
    preferredLane === "account"
  ) {
    return "account-access";
  }
  if (deliveryType === "migration") return "migration-service";
  if (deliveryType === "monitoring") return "monitoring-service";
  if (deliveryType === "content-production") return "content-production";
  if (deliveryType === "data-research") return "data-research";
  if (deliveryType === "training-guidance") return "training-guidance";
  if (deliveryType === "template-pack") return "reusable-digital-delivery";
  if (
    deliveryType === "integration" ||
    deliveryType === "deployment-setup" ||
    (hasGithubProject && DEVELOPER_SETUP_DELIVERY_TYPES.has(deliveryType))
  ) {
    return "developer-tool-setup";
  }
  if (deliveryType === "automation-workflow") return "workflow-automation";
  if (/部署|安装|配置|接入|集成|跑通|deploy|install|setup|integrat/i.test(text)) {
    return "developer-tool-setup";
  }
  if (businessModel === "digital-product" || preferredLane === "bundle") {
    return "reusable-digital-delivery";
  }
  return "result-delivery";
}

function decodeHtmlUrls(html) {
  return String(html || "")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&");
}

export function extractOfficialOpportunityLinksFromHtml(html, sourceUrl = "") {
  const decoded = decodeHtmlUrls(html);
  const source = safeUrl(sourceUrl);
  const sourceHost = normalizeHostname(source?.hostname);
  const urls = [];
  const seen = new Set();

  for (const match of decoded.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)) {
    const raw = String(match[0] || "").replace(/[),.;\]]+$/g, "");
    const parsed = safeUrl(raw);
    if (!parsed) continue;
    const hostname = normalizeHostname(parsed.hostname);
    if (hostname === sourceHost || !isOfficialOpportunityUrl(parsed.href)) continue;
    const canonical = canonicalizeOpportunityEvidenceUrl(parsed.href);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    urls.push(canonical);
  }

  return urls;
}

async function fetchOpportunityEvidence(url, fetchImpl, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort("opportunity-evidence-timeout"),
    Math.max(1000, Number.parseInt(options.timeoutMs, 10) || 8000)
  );

  try {
    return await fetchImpl(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: options.accept || "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "User-Agent": "Aivora-AI-Opportunity/1.0",
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function addEvidenceRecord(recordsBySourceUrl, sourceUrl, record) {
  const key = canonicalizeOpportunityEvidenceUrl(sourceUrl);
  if (!key) return;
  recordsBySourceUrl[key] = record;
}

export async function buildOpportunityEvidenceEnrichment(
  candidates = [],
  {
    fetchImpl = fetch,
    githubToken = "",
    maxGithubRequests = 4,
    maxTrustedMediaRequests = 2,
    timeoutMs = 8000,
  } = {}
) {
  const recordsBySourceUrl = {};
  const stats = {
    githubRequests: 0,
    trustedMediaRequests: 0,
    officialLinksFound: 0,
    failures: 0,
  };
  const uniqueItems = [];
  const seenUrls = new Set();

  for (const candidate of candidates || []) {
    for (const item of candidate?.supportingItems || []) {
      const key = canonicalizeOpportunityEvidenceUrl(item?.url);
      if (!key || seenUrls.has(key)) continue;
      seenUrls.add(key);
      uniqueItems.push(item);
    }
  }

  const githubItems = uniqueItems
    .filter((item) => normalizeGithubProjectUrl(item?.url))
    .slice(0, Math.max(0, maxGithubRequests));
  const mediaItems = uniqueItems
    .filter((item) => isTrustedOpportunityMediaUrl(item?.url))
    .slice(0, Math.max(0, maxTrustedMediaRequests));

  for (const item of githubItems) {
    const projectKey = normalizeGithubProjectUrl(item.url);
    const repository = String(projectKey || "").replace(/^github\.com\//, "");
    if (!repository) continue;
    stats.githubRequests += 1;

    try {
      const response = await fetchOpportunityEvidence(
        `https://api.github.com/repos/${repository}`,
        fetchImpl,
        {
          timeoutMs,
          accept: "application/vnd.github+json",
          headers: githubToken ? { Authorization: `Bearer ${githubToken}` } : {},
        }
      );
      if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
      const metadata = await response.json();
      const license = String(metadata?.license?.spdx_id || "未声明");
      const archived = Boolean(metadata?.archived);
      const updatedAt = String(metadata?.updated_at || "未知");
      addEvidenceRecord(recordsBySourceUrl, item.url, {
        checked: true,
        kind: "github-api",
        summary: `GitHub API 核验：license=${license}，archived=${archived ? "是" : "否"}，updated_at=${updatedAt}`,
        evidenceItems: [],
      });
    } catch (error) {
      stats.failures += 1;
      addEvidenceRecord(recordsBySourceUrl, item.url, {
        checked: false,
        kind: "github-api",
        error: error?.message || String(error),
        evidenceItems: [],
      });
    }
  }

  for (const item of mediaItems) {
    stats.trustedMediaRequests += 1;
    try {
      const response = await fetchOpportunityEvidence(item.url, fetchImpl, { timeoutMs });
      if (!response.ok) throw new Error(`media page returned ${response.status}`);
      const html = await response.text();
      const officialLinks = extractOfficialOpportunityLinksFromHtml(html, item.url).slice(0, 3);
      stats.officialLinksFound += officialLinks.length;
      addEvidenceRecord(recordsBySourceUrl, item.url, {
        checked: true,
        kind: "trusted-media-outbound-links",
        summary: officialLinks.length > 0
          ? `可信媒体原文提取到 ${officialLinks.length} 个官方或原项目外链`
          : "已检查可信媒体原文，本次未提取到可确认的官方或原项目外链",
        evidenceItems: officialLinks.map((url) => {
          const parsed = safeUrl(url);
          const normalizedItem = {
            type: "project",
            title: `${normalizeHostname(parsed?.hostname)} 官方或原项目页面`,
            description: "该链接由可信媒体原文直接引用；它只证明对应官方或原项目页面存在，其他商业判断仍需验证。",
            plainText: "",
            source: "可信媒体原文中的官方外链",
            url,
            publishedDate: item.publishedDate || "",
            searchText: `${item.searchText || ""} ${url}`.toLowerCase(),
          };
          return {
            ...normalizedItem,
            evidence: classifyOpportunityEvidence(normalizedItem, "project"),
          };
        }),
      });
    } catch (error) {
      stats.failures += 1;
      addEvidenceRecord(recordsBySourceUrl, item.url, {
        checked: false,
        kind: "trusted-media-outbound-links",
        error: error?.message || String(error),
        evidenceItems: [],
      });
    }
  }

  return { recordsBySourceUrl, stats };
}
