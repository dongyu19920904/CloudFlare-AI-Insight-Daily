const DEFAULT_SNAPSHOT_URL = "https://supply.aivora.cn/api/opportunities/snapshot";
const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_SNAPSHOT_AGE_MS = 120 * 60 * 1000;
const MAX_OBSERVATION_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_SIGNALS = 12;
const MAX_CATEGORIES = 20;

const ALLOWED_SNAPSHOT_HOSTS = new Set([
  "supply.aivora.cn",
  "aivora-supply-radar-v2.sabrinamisan090.workers.dev",
  "aivora-supply-radar-v2-preview.sabrinamisan090.workers.dev",
]);

function boundedText(value, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function nullableIsoDate(value) {
  if (value === null) return null;
  const text = boundedText(value, 80);
  const time = Date.parse(text);
  return text && Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function nonNegativeNumber(value, { integer = false, nullable = false } = {}) {
  if (value === null && nullable) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return nullable ? null : 0;
  return integer ? Math.floor(parsed) : parsed;
}

function parseAllowedUrl(value, allowedPaths = []) {
  try {
    const parsed = new URL(String(value || ""));
    if (parsed.protocol !== "https:" || parsed.hostname !== "supply.aivora.cn") return null;
    if (allowedPaths.length && !allowedPaths.some((prefix) => parsed.pathname.startsWith(prefix))) return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseExternalHttpsUrl(value) {
  if (value === null || value === undefined || value === "") return null;
  try {
    const parsed = new URL(String(value));
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseSignal(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const product = value.product;
  if (!product || typeof product !== "object" || Array.isArray(product)) return null;
  const slug = boundedText(product.slug, 100).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const productUrl = parseAllowedUrl(product.productUrl, [`/card-products/${slug}`]);
  const profitCalculatorUrl = parseAllowedUrl(product.profitCalculatorUrl, ["/profit-calculator"]);
  const name = boundedText(product.name, 160);
  if (!name || !productUrl || !profitCalculatorUrl) return null;

  const kind = boundedText(value.kind, 30);
  if (!["restock", "stockout", "price_drop", "price_rise", "supply_gap", "crowded"].includes(kind)) return null;
  const tone = boundedText(value.tone, 30);
  if (!["opportunity", "warning", "watch"].includes(tone)) return null;

  return {
    id: boundedText(value.id, 240) || `${kind}:${slug}`,
    kind,
    tone,
    label: boundedText(value.label, 80),
    title: boundedText(value.title, 240),
    evidence: boundedText(value.evidence, 1000),
    buyerAction: boundedText(value.buyerAction, 700),
    sellerAction: boundedText(value.sellerAction, 700),
    stopCondition: boundedText(value.stopCondition, 700),
    observedAt: nullableIsoDate(value.observedAt),
    sourceUrl: parseExternalHttpsUrl(value.sourceUrl),
    product: {
      slug,
      name,
      platform: boundedText(product.platform, 120),
      lowestPrice: nonNegativeNumber(product.lowestPrice, { nullable: true }),
      warrantyPrice: nonNegativeNumber(product.warrantyPrice, { nullable: true }),
      availableOfferCount: nonNegativeNumber(product.availableOfferCount, { integer: true }),
      updatedAt: nullableIsoDate(product.updatedAt),
      sortOrder: nonNegativeNumber(product.sortOrder, { integer: true }),
      platformSortOrder: nonNegativeNumber(product.platformSortOrder, { integer: true }),
      productUrl,
      profitCalculatorUrl,
    },
  };
}

export function parseSupplyOpportunitySnapshot(value, { now = new Date() } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("snapshot payload is not an object");
  }
  if (value.schemaVersion !== 1) throw new Error("unsupported snapshot schema");
  const source = parseAllowedUrl(value.source, ["/opportunities"]);
  if (!source) throw new Error("snapshot source is not allowed");
  const generatedAt = nullableIsoDate(value.generatedAt);
  const latestObservedAt = nullableIsoDate(value.latestObservedAt);
  if (!generatedAt || !latestObservedAt) throw new Error("snapshot timestamps are missing");

  const nowMs = now.getTime();
  const generatedMs = Date.parse(generatedAt);
  const observedMs = Date.parse(latestObservedAt);
  if (!Number.isFinite(nowMs)) throw new Error("invalid validation time");
  if (generatedMs > nowMs + MAX_FUTURE_SKEW_MS) throw new Error("snapshot is from the future");
  if (nowMs - generatedMs > MAX_SNAPSHOT_AGE_MS) throw new Error("snapshot is stale");
  if (observedMs > nowMs + MAX_FUTURE_SKEW_MS) throw new Error("snapshot is from the future");
  if (nowMs - observedMs > MAX_OBSERVATION_AGE_MS) throw new Error("supply observations are stale");

  const stats = value.stats;
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
    throw new Error("snapshot stats are missing");
  }
  const signals = (Array.isArray(value.signals) ? value.signals : [])
    .slice(0, MAX_SIGNALS)
    .map(parseSignal)
    .filter(Boolean);
  if (!signals.length) throw new Error("snapshot has no usable supply signals");

  const categories = (Array.isArray(value.categories) ? value.categories : [])
    .slice(0, MAX_CATEGORIES)
    .map((category) => ({
      id: boundedText(category?.id, 80),
      name: boundedText(category?.name, 120),
      description: boundedText(category?.description, 300),
      productCount: nonNegativeNumber(category?.productCount, { integer: true }),
      availableProductCount: nonNegativeNumber(category?.availableProductCount, { integer: true }),
      availableOfferCount: nonNegativeNumber(category?.availableOfferCount, { integer: true }),
      lowestPrice: nonNegativeNumber(category?.lowestPrice, { nullable: true }),
    }))
    .filter((category) => category.id && category.name);

  return {
    schemaVersion: 1,
    source,
    generatedAt,
    latestObservedAt,
    ageMinutes: Math.max(0, Math.round((nowMs - generatedMs) / 60000)),
    observationAgeMinutes: Math.max(0, Math.round((nowMs - observedMs) / 60000)),
    stats: {
      productCount: nonNegativeNumber(stats.productCount, { integer: true }),
      availableProductCount: nonNegativeNumber(stats.availableProductCount, { integer: true }),
      availableOfferCount: nonNegativeNumber(stats.availableOfferCount, { integer: true }),
      recentChangeCount: nonNegativeNumber(stats.recentChangeCount, { integer: true }),
      recentChangeCountCapped: Boolean(stats.recentChangeCountCapped),
      lowSupplyProductCount: nonNegativeNumber(stats.lowSupplyProductCount, { integer: true }),
    },
    signals,
    categories,
  };
}

function resolveSnapshotUrl(env = {}) {
  const raw = boundedText(env.SUPPLY_OPPORTUNITY_SNAPSHOT_URL, 500) || DEFAULT_SNAPSHOT_URL;
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:" || !ALLOWED_SNAPSHOT_HOSTS.has(parsed.hostname)) {
    throw new Error("snapshot URL is not allowed");
  }
  return parsed.toString();
}

export async function loadSupplyOpportunitySnapshot(
  env = {},
  { fetchImpl = fetch, now = new Date() } = {},
) {
  let sourceUrl = DEFAULT_SNAPSHOT_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    sourceUrl = resolveSnapshotUrl(env);
    const response = await fetchImpl(sourceUrl, {
      headers: { Accept: "application/json" },
      // Cloudflare Workers supports follow/manual, but not the browser-only
      // redirect:error mode. Manual still lets us reject every 3xx response.
      redirect: "manual",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`snapshot HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!/application\/json/i.test(contentType)) throw new Error("snapshot is not JSON");
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("snapshot response is too large");
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      throw new Error("snapshot response is too large");
    }
    const snapshot = parseSupplyOpportunitySnapshot(JSON.parse(text), { now });
    return { snapshot, sourceUrl, error: null };
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "snapshot request timed out"
      : String(error?.message || error || "snapshot request failed").slice(0, 240);
    return { snapshot: null, sourceUrl, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

export function recordSupplySnapshotDebug(debugInfo, result) {
  const snapshot = result?.snapshot || null;
  debugInfo.accountOpportunitySupplySnapshotLoaded = Boolean(snapshot);
  debugInfo.accountOpportunitySupplySnapshotSource = result?.sourceUrl || DEFAULT_SNAPSHOT_URL;
  debugInfo.accountOpportunitySupplySnapshotError = result?.error || "";
  debugInfo.accountOpportunitySupplySnapshotAgeMinutes = snapshot?.ageMinutes ?? null;
  debugInfo.accountOpportunitySupplyObservationAgeMinutes =
    snapshot?.observationAgeMinutes ?? null;
  debugInfo.accountOpportunitySupplySignalCount = snapshot?.signals?.length || 0;
  debugInfo.accountOpportunitySupplyAvailableOfferCount = snapshot?.stats?.availableOfferCount || 0;
}

export { DEFAULT_SNAPSHOT_URL };
