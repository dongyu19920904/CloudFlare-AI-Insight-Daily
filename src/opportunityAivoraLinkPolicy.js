import { getFromKV, storeInKV } from "./kv.js";

export const AIVORA_BRAND_NAME = "爱窝啦·AI账号店";
export const AIVORA_HOME_URL = "https://www.aivora.cn/";

const AIVORA_SITEMAP_URL = "https://www.aivora.cn/sitemap.xml";
const CACHE_KEY_PREFIX = "opportunity-aivora-link-policy";
const DIRECT_ENTRY_PATTERN =
  /账号|账户|订阅|会员|入口|额度|续费|席位|account|subscription|membership|renew|seat|coding plan/i;
const SEMANTIC_RULES = [
  { match: /chatgpt|openai|\bgpt\b/i, tokens: ["chatgpt", "openai", "gpt"] },
  { match: /claude|anthropic|sonnet|opus/i, tokens: ["claude", "anthropic", "sonnet", "opus"] },
  { match: /cursor/i, tokens: ["cursor"] },
  { match: /gemini|google ai/i, tokens: ["gemini", "google"] },
  { match: /minimax/i, tokens: ["minimax"] },
  { match: /中转|api\s*(?:key|额度)|token/i, tokens: ["zhong-zhuan", "api", "token"] },
];

function canonicalizeAivoraUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname !== "aivora.cn") return "";
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `https://www.aivora.cn${pathname}`;
  } catch {
    return "";
  }
}

export function parseAivoraSitemapUrls(xml) {
  const urls = [];
  for (const match of String(xml || "").matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
    const canonical = canonicalizeAivoraUrl(match[1]);
    if (canonical) urls.push(canonical);
  }
  return [...new Set(urls)];
}

function extractCanonicalFromHtml(html) {
  const match = String(html || "").match(
    /<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>|<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i
  );
  return canonicalizeAivoraUrl(match?.[1] || match?.[2] || "");
}

export function buildAivoraOpportunityLinkPolicy({
  sitemapXml = "",
  homepageHtml = "",
  homepageStatus = 0,
  verifiedPages = [],
  suggestedUrl = "",
  fetchedAt = new Date().toISOString(),
} = {}) {
  const sitemapUrls = parseAivoraSitemapUrls(sitemapXml);
  const homepageCanonical = extractCanonicalFromHtml(homepageHtml);
  const homepageAllowed =
    sitemapUrls.includes(AIVORA_HOME_URL) &&
    Number(homepageStatus) >= 200 &&
    Number(homepageStatus) < 300 &&
    homepageCanonical === AIVORA_HOME_URL;
  const verifiedUrls = (verifiedPages || [])
    .filter((page) => {
      const canonical = canonicalizeAivoraUrl(page?.canonical || "");
      const url = canonicalizeAivoraUrl(page?.url || "");
      return (
        url &&
        sitemapUrls.includes(url) &&
        Number(page?.status) >= 200 &&
        Number(page?.status) < 300 &&
        canonical === url
      );
    })
    .map((page) => canonicalizeAivoraUrl(page.url));
  const allowedUrls = [
    ...(homepageAllowed ? [AIVORA_HOME_URL] : []),
    ...verifiedUrls,
  ];
  const canonicalSuggestedUrl = canonicalizeAivoraUrl(suggestedUrl);

  return {
    fetchedAt,
    sitemapUrl: AIVORA_SITEMAP_URL,
    allowedUrls: [...new Set(allowedUrls)],
    suggestedUrl:
      canonicalSuggestedUrl && allowedUrls.includes(canonicalSuggestedUrl)
        ? canonicalSuggestedUrl
        : "",
    homepageAllowed,
    sitemapUrlCount: sitemapUrls.length,
  };
}

export function buildAivoraOpportunityLinkIntent(candidates = []) {
  const text = (candidates || [])
    .flatMap((candidate) => [
      candidate?.label,
      candidate?.productAngle,
      candidate?.deliveryHint,
      ...(candidate?.supportingItems || []).flatMap((item) => [
        item?.title,
        item?.description,
        item?.plainText,
      ]),
    ])
    .filter(Boolean)
    .join(" ");
  if (!DIRECT_ENTRY_PATTERN.test(text)) {
    return { eligible: false, tokens: [], cacheKey: "none" };
  }

  const tokens = [
    ...new Set(
      SEMANTIC_RULES.filter((rule) => rule.match.test(text)).flatMap(
        (rule) => rule.tokens
      )
    ),
  ];
  return {
    eligible: tokens.length > 0,
    tokens,
    cacheKey: tokens.join("-") || "none",
  };
}

function selectSemanticSitemapUrls(sitemapUrls, intent, limit = 2) {
  if (!intent?.eligible || !Array.isArray(intent.tokens)) return [];
  return (sitemapUrls || [])
    .filter((url) => url !== AIVORA_HOME_URL)
    .map((url) => {
      const path = new URL(url).pathname.toLowerCase();
      const score = intent.tokens.reduce(
        (total, token) => total + (path.includes(String(token).toLowerCase()) ? 1 : 0),
        0
      );
      return { url, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.url.localeCompare(right.url))
    .slice(0, Math.max(0, limit))
    .map((item) => item.url);
}

export async function loadAivoraOpportunityLinkPolicy(
  env,
  dateStr,
  options = {}
) {
  const fetchImpl = options.fetchImpl || fetch;
  const intent = options.intent || { eligible: false, tokens: [], cacheKey: "none" };
  if (!intent.eligible) {
    return {
      fetchedAt: new Date().toISOString(),
      sitemapUrl: AIVORA_SITEMAP_URL,
      allowedUrls: [],
      suggestedUrl: "",
      homepageAllowed: false,
      sitemapUrlCount: 0,
      skippedForRelevance: true,
      cacheHit: false,
    };
  }
  const cacheKey = `${CACHE_KEY_PREFIX}:${dateStr || "current"}:${intent.cacheKey || "direct"}`;

  if (env?.DATA_KV && !options.skipCache) {
    try {
      const cached = await getFromKV(env.DATA_KV, cacheKey);
      if (cached?.allowedUrls) return { ...cached, cacheHit: true };
    } catch (error) {
      console.warn(`[OpportunityLinkPolicy] Failed to read cache: ${error.message}`);
    }
  }

  let policy = buildAivoraOpportunityLinkPolicy();
  try {
    const sitemapResponse = await fetchImpl(AIVORA_SITEMAP_URL, {
      headers: { Accept: "application/xml,text/xml;q=0.9,*/*;q=0.1" },
    });
    if (!sitemapResponse.ok) {
      throw new Error(`sitemap returned ${sitemapResponse.status}`);
    }
    const sitemapXml = await sitemapResponse.text();
    const sitemapUrls = parseAivoraSitemapUrls(sitemapXml);

    const homepageResponse = await fetchImpl(AIVORA_HOME_URL, {
      headers: { Accept: "text/html" },
    });
    const homepageHtml = homepageResponse.ok ? await homepageResponse.text() : "";
    const semanticUrls = selectSemanticSitemapUrls(
      sitemapUrls,
      intent,
      options.maxSemanticPageChecks || 2
    );
    const verifiedPages = [];
    for (const url of semanticUrls) {
      try {
        const response = await fetchImpl(url, { headers: { Accept: "text/html" } });
        const html = response.ok ? await response.text() : "";
        verifiedPages.push({
          url,
          status: response.status,
          canonical: extractCanonicalFromHtml(html),
        });
      } catch (error) {
        console.warn(`[OpportunityLinkPolicy] Failed to verify ${url}: ${error.message}`);
      }
    }
    const verifiedSuggestedUrl = verifiedPages.find(
      (page) => page.status >= 200 && page.status < 300 && page.canonical === page.url
    )?.url;
    policy = buildAivoraOpportunityLinkPolicy({
      sitemapXml,
      homepageHtml,
      homepageStatus: homepageResponse.status,
      verifiedPages,
      suggestedUrl: verifiedSuggestedUrl || AIVORA_HOME_URL,
    });
  } catch (error) {
    policy = {
      ...policy,
      error: error?.message || String(error),
    };
  }

  if (env?.DATA_KV) {
    try {
      await storeInKV(env.DATA_KV, cacheKey, policy, 86400);
    } catch (error) {
      console.warn(`[OpportunityLinkPolicy] Failed to store cache: ${error.message}`);
    }
  }

  return { ...policy, cacheHit: false };
}

export function insertOpportunityAivoraLink(markdown, policy = {}) {
  const suggestedUrl = canonicalizeAivoraUrl(policy.suggestedUrl || "");
  if (!suggestedUrl || !(policy.allowedUrls || []).includes(suggestedUrl)) {
    return { markdown: String(markdown || ""), inserted: false };
  }
  if (containsAivoraLink(markdown)) {
    return { markdown: String(markdown || ""), inserted: false };
  }

  const line = `- **相关工具入口：** 这个验证确实需要对应账号或订阅时，可核对[${AIVORA_BRAND_NAME}](${suggestedUrl})当前公开页面；先确认用途和交付边界，不要为了验证先囤账号。`;
  const content = String(markdown || "");
  const riskLine = /^-\s*\*\*风险与停止[:：]\*\*.*$/m;
  if (riskLine.test(content)) {
    return {
      markdown: content.replace(riskLine, (match) => `${match}\n${line}`),
      inserted: true,
    };
  }

  return { markdown: content, inserted: false };
}

function isAivoraUrl(value) {
  return Boolean(canonicalizeAivoraUrl(value));
}

export function containsAivoraLink(markdown) {
  return /https?:\/\/(?:www\.)?aivora\.cn(?:\/|\b)/i.test(String(markdown || ""));
}

export function sanitizeOpportunityAivoraLinks(
  markdown,
  policy = {},
  { maxLinks = 1 } = {}
) {
  const allowed = new Set((policy.allowedUrls || []).map(canonicalizeAivoraUrl));
  let kept = 0;
  let removed = 0;

  const sanitized = String(markdown || "").replace(
    /\[([^\]]+)\]\((https?:\/\/(?:www\.)?aivora\.cn[^\s)]*)\)/gi,
    (full, label, url) => {
      const canonical = canonicalizeAivoraUrl(url);
      if (!canonical || !allowed.has(canonical) || kept >= maxLinks) {
        removed += 1;
        return label;
      }

      kept += 1;
      return `[${AIVORA_BRAND_NAME}](${canonical})`;
    }
  );

  return {
    markdown: sanitized,
    keptCount: kept,
    removedCount: removed,
  };
}

export function validateOpportunityAivoraLinks(
  markdown,
  policy = {},
  { maxLinks = 1 } = {}
) {
  const allowed = new Set((policy.allowedUrls || []).map(canonicalizeAivoraUrl));
  const links = [
    ...String(markdown || "").matchAll(
      /\[([^\]]+)\]\((https?:\/\/(?:www\.)?aivora\.cn[^\s)]*)\)/gi
    ),
  ].map((match) => ({ label: match[1], url: canonicalizeAivoraUrl(match[2]) }));
  const issues = [];

  if (links.length > maxLinks) {
    issues.push(`AI 商机主站链接超过 ${maxLinks} 个`);
  }

  for (const link of links) {
    if (!allowed.has(link.url)) {
      issues.push(`AI 商机包含未通过实时 sitemap 校验的主站链接: ${link.url || "无效URL"}`);
    }
    if (link.label !== AIVORA_BRAND_NAME) {
      issues.push(`AI 商机主站品牌名必须写作“${AIVORA_BRAND_NAME}”`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    linkCount: links.length,
  };
}

