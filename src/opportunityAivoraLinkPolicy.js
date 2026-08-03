import { getFromKV, storeInKV } from "./kv.js";

export const AIVORA_BRAND_NAME = "爱窝啦·AI账号店";
export const AIVORA_HOME_URL = "https://www.aivora.cn/";

const AIVORA_SITEMAP_URL = "https://www.aivora.cn/sitemap.xml";
const CACHE_KEY_PREFIX = "opportunity-aivora-link-policy";

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
  fetchedAt = new Date().toISOString(),
} = {}) {
  const sitemapUrls = parseAivoraSitemapUrls(sitemapXml);
  const homepageCanonical = extractCanonicalFromHtml(homepageHtml);
  const homepageAllowed =
    sitemapUrls.includes(AIVORA_HOME_URL) &&
    Number(homepageStatus) >= 200 &&
    Number(homepageStatus) < 300 &&
    homepageCanonical === AIVORA_HOME_URL;

  return {
    fetchedAt,
    sitemapUrl: AIVORA_SITEMAP_URL,
    allowedUrls: homepageAllowed ? [AIVORA_HOME_URL] : [],
    homepageAllowed,
    sitemapUrlCount: sitemapUrls.length,
  };
}

export async function loadAivoraOpportunityLinkPolicy(
  env,
  dateStr,
  options = {}
) {
  const fetchImpl = options.fetchImpl || fetch;
  const cacheKey = `${CACHE_KEY_PREFIX}:${dateStr || "current"}`;

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

    const homepageResponse = await fetchImpl(AIVORA_HOME_URL, {
      headers: { Accept: "text/html" },
    });
    const homepageHtml = homepageResponse.ok ? await homepageResponse.text() : "";
    policy = buildAivoraOpportunityLinkPolicy({
      sitemapXml,
      homepageHtml,
      homepageStatus: homepageResponse.status,
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

