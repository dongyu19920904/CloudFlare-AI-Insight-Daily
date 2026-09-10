import { classifyOpportunityEvidence } from "./opportunityEvidence.js";
import { isOfficialAccountOpportunityUrl } from "./accountOpportunityUtils.js";

const OPPORTUNITY_KINDS = new Set(["restock", "price_drop", "supply_gap"]);
const RISK_KINDS = new Set(["stockout", "price_rise", "crowded"]);
const CORE_CATEGORY_IDS = ["chatgpt", "claude", "gemini", "grok", "ai-coding", "ai-creative"];
const CATEGORY_ORDER = [
  "chatgpt",
  "claude",
  "gemini",
  "grok",
  "ai-coding",
  "ai-creative",
  "email",
  "verification",
  "social",
  "api-payment",
  "other",
];
const ABNORMAL_LOW_PRICE_RATIO = 0.05;
const MIN_OFFERS_FOR_PRICE_ANOMALY = 5;
const MATERIAL_PRICE_CHANGE_RATIO = 0.02;
const DAILY_MEMORY_DAYS = 7;
const FIRST_SALE_GUIDE_URL = "https://supply.aivora.cn/guide/first-sale";
const REPLAY_METADATA_PATTERN = /<!--\s*opportunity-replay\s*:\s*(\{[^\n]*\})\s*-->/i;

function safeReplayMetadata(markdown) {
  const match = String(markdown || "").match(REPLAY_METADATA_PATTERN);
  if (!match) return {};
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}

function uniqueStrings(values, limit = 50) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean))].slice(0, limit);
}

function normalizeDailyTitle(value) {
  return String(value || "")
    .replace(/\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}月\d{1,2}日|\d{4}\/\d{1,2}\/\d{1,2}/g, "")
    .replace(/爱窝啦|AI\s*账号(?:商家经营|商机)?日报/gi, "")
    .replace(/[\s｜|·，。！？!?、\-_/]+/g, "")
    .toLowerCase();
}

export function normalizeSupplyDailyLines(markdown) {
  const visible = String(markdown || "")
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(REPLAY_METADATA_PATTERN, "")
    .replace(/https?:\/\/[^)\s]+/g, "链接")
    .replace(/\d+(?:\.\d+)?/g, "数值");
  return uniqueStrings(visible.split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean), 200);
}

function inferVisibleActionKeys(markdown) {
  const keys = [];
  for (const match of String(markdown || "").matchAll(
    /^###\s+\d+\.\s+([^\n[]+)\[[^\]]+\]\(https:\/\/supply\.aivora\.cn\/card-products\/([a-z0-9-]+)\)/gim,
  )) {
    const title = match[1];
    const kind = /暂停新增接单/.test(title) ? "paused"
      : /暂停按最低价/.test(title) ? "anomaly"
        : /准备替代/.test(title) ? "stockout"
          : /恢复接单/.test(title) ? "restock"
            : /重新核价/.test(title) ? "price_change"
              : "current";
    keys.push(`${kind}:${match[2]}`);
  }
  return uniqueStrings(keys);
}

export function extractSupplyDrivenAccountOpportunityMemory(markdown, fallbackDate = "") {
  const source = String(markdown || "");
  const replay = safeReplayMetadata(source);
  const title = String(source.match(/^title:\s*(.+)$/m)?.[1] || replay.editionTitle || "")
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2");
  const leadProductSlug = String(
    replay.leadProductSlug ||
    source.match(/^###\s+\[[^\]]+\]\(https:\/\/supply\.aivora\.cn\/card-products\/([a-z0-9-]+)\)/m)?.[1] ||
    "",
  ).trim() || null;
  const referenceCost = Number(replay.referenceCost);
  const sourceCount = Number(replay.verifiedSourceCount);
  const specFromDraft = String(replay.copyDraft || "").match(/已核验分组[　\s]+([^\n]+)/)?.[1] || "";
  const featuredProductSlugs = uniqueStrings([
    ...(replay.featuredProductSlugs || []),
    ...[...source.matchAll(/https:\/\/supply\.aivora\.cn\/card-products\/([a-z0-9-]+)/gi)]
      .map((match) => match[1]),
  ]);
  return {
    date: String(replay.reportDate || fallbackDate || source.match(/^date:\s*(\d{4}-\d{2}-\d{2})/m)?.[1] || ""),
    title,
    normalizedTitle: normalizeDailyTitle(title),
    dailyFocusKey: String(replay.dailyFocusKey || "").trim(),
    noveltyKind: String(replay.noveltyKind || "").trim(),
    leadProductSlug,
    referenceCost: Number.isFinite(referenceCost) && referenceCost > 0 ? referenceCost : null,
    verifiedSourceCount: Number.isFinite(sourceCount) ? Math.max(0, Math.floor(sourceCount)) : 0,
    verifiedSpecLabel: String(replay.verifiedSpecLabel || specFromDraft).trim(),
    featuredProductSlugs,
    actionKeys: uniqueStrings([...(replay.actionKeys || []), ...inferVisibleActionKeys(source)]),
    signalKeys: uniqueStrings(replay.signalKeys || []),
    normalizedLines: normalizeSupplyDailyLines(source),
  };
}

function cleanArticleText(value, maxLength = 900) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\bout_of_stock\s*→\s*in_stock\b/gi, "缺货转为有货")
    .replace(/\bin_stock\s*→\s*out_of_stock\b/gi, "有货转为缺货")
    .replace(/同源库存/g, "原货源的当前库存")
    .replace(/同规格/g, "规格一致")
    .replace(/可复核成本/g, "能回原始页面确认的进货参考")
    .replace(/成本口径/g, "进货参考")
    .replace(/保本价/g, "不亏钱所需的最低售价")
    .replace(/[：:]/g, "，")
    .replace(/[—–]/g, "，")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function positiveMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function formatMoney(value) {
  return positiveMoney(value) !== null ? `¥${Number(value).toFixed(2)}` : "暂无可复核成本";
}

function formatShanghaiTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "等待新快照";
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}年${parts.month}月${parts.day}日 ${parts.hour}时${parts.minute}分`;
}

function categoryRank(product) {
  const rank = CATEGORY_ORDER.indexOf(product?.categoryId);
  return rank >= 0 ? rank : CATEGORY_ORDER.length;
}

function merchantPriority(product) {
  if (product?.categoryId !== "chatgpt") return 0;
  const text = `${product?.name || ""} ${product?.slug || ""}`.toLowerCase();
  if (/chatgpt\s*plus|chatgpt-plus/.test(text)) return 600;
  if (/chatgpt\s*pro\s*20|chatgpt-pro-20/.test(text)) return 560;
  if (/chatgpt\s*pro|chatgpt-pro/.test(text)) return 540;
  if (/chatgpt\s*go|chatgpt-go/.test(text)) return 500;
  if (/chatgpt\s*(team|business)|chatgpt-(team|business)/.test(text)) return 460;
  if (/chatgpt/.test(text)) return 420;
  return 0;
}

function productOrder(a, b) {
  const available = Number(b.availableOfferCount > 0) - Number(a.availableOfferCount > 0);
  if (available !== 0) return available;
  const category = categoryRank(a) - categoryRank(b);
  if (category !== 0) return category;
  const priority = merchantPriority(b) - merchantPriority(a);
  if (priority !== 0) return priority;
  const aSort = Number(a.sortOrder) > 0 ? Number(a.sortOrder) : 999999;
  const bSort = Number(b.sortOrder) > 0 ? Number(b.sortOrder) : 999999;
  if (aSort !== bSort) return aSort - bSort;
  if (a.availableOfferCount !== b.availableOfferCount) {
    return b.availableOfferCount - a.availableOfferCount;
  }
  return String(a.name || "").localeCompare(String(b.name || ""), "zh-CN");
}

function snapshotProducts(snapshot) {
  const products = Array.isArray(snapshot?.products) && snapshot.products.length
    ? snapshot.products
    : (snapshot?.signals || []).map((signal) => signal.product);
  const unique = new Map();
  for (const product of products) {
    if (product?.slug && product?.productUrl && !unique.has(product.slug)) {
      unique.set(product.slug, product);
    }
  }
  return [...unique.values()].sort(productOrder);
}

export function resolveMerchantCostReference(product) {
  const lowestPrice = positiveMoney(product?.lowestPrice);
  const warrantyPrice = positiveMoney(product?.warrantyPrice);
  const availableOfferCount = Math.max(0, Number(product?.availableOfferCount) || 0);
  const abnormalLowestPrice = Boolean(
    lowestPrice !== null &&
    warrantyPrice !== null &&
    availableOfferCount >= MIN_OFFERS_FOR_PRICE_ANOMALY &&
    lowestPrice < warrantyPrice * ABNORMAL_LOW_PRICE_RATIO
  );
  const referencePrice = abnormalLowestPrice
    ? warrantyPrice
    : lowestPrice ?? warrantyPrice;

  return {
    referencePrice,
    lowestPrice,
    warrantyPrice,
    abnormalLowestPrice,
    label: abnormalLowestPrice
      ? "异常最低价已隔离，暂用明确质保报价"
      : lowestPrice !== null
        ? "目录最低公开报价"
        : warrantyPrice !== null
          ? "明确质保报价"
          : "暂无可复核成本",
  };
}

function profitCalculatorUrl(product, referencePrice) {
  try {
    const url = new URL(product.profitCalculatorUrl);
    if (positiveMoney(referencePrice) !== null) {
      url.searchParams.set("cost", Number(referencePrice).toFixed(2));
    } else {
      url.searchParams.delete("cost");
    }
    return url.toString();
  } catch {
    return product.profitCalculatorUrl;
  }
}

export function selectMerchantCoreProducts(snapshot, limit = 4) {
  const products = snapshotProducts(snapshot).filter((product) =>
    product.availableOfferCount > 0 &&
    CORE_CATEGORY_IDS.includes(product.categoryId) &&
    resolveMerchantCostReference(product).referencePrice !== null &&
    !resolveMerchantCostReference(product).abnormalLowestPrice
  );
  const selected = [];
  const seen = new Set();
  const add = (product) => {
    if (!product?.slug || seen.has(product.slug) || selected.length >= limit) return;
    seen.add(product.slug);
    selected.push(product);
  };

  products.filter((product) => product.categoryId === "chatgpt").slice(0, 2).forEach(add);
  for (const categoryId of CORE_CATEGORY_IDS.slice(1)) {
    add(products.find((product) => product.categoryId === categoryId));
  }
  products.forEach(add);
  return selected;
}

export function selectPausedProducts(snapshot, limit = 3) {
  return snapshotProducts(snapshot)
    .filter((product) =>
      product.availableOfferCount === 0 && CORE_CATEGORY_IDS.includes(product.categoryId)
    )
    .slice(0, Math.max(0, limit));
}

export function selectAnomalousPriceProducts(snapshot, limit = 3) {
  return snapshotProducts(snapshot)
    .filter((product) =>
      CORE_CATEGORY_IDS.includes(product.categoryId) &&
      resolveMerchantCostReference(product).abnormalLowestPrice
    )
    .slice(0, Math.max(0, limit));
}

function popularityScore(signal) {
  const text = `${signal.product?.name || ""} ${signal.product?.platform || ""}`.toLowerCase();
  if (/chatgpt\s*plus/.test(text)) return 700;
  if (/chatgpt\s*pro/.test(text)) return 660;
  if (/chatgpt|openai/.test(text)) return 620;
  if (/claude/.test(text)) return 560;
  if (/gemini|google ai/.test(text)) return 520;
  if (/grok/.test(text)) return 480;
  if (/cursor|kiro|windsurf/.test(text)) return 420;
  return 100;
}

function signalScore(signal) {
  const kindScore = {
    restock: 320,
    price_drop: 300,
    stockout: 290,
    price_rise: 260,
    supply_gap: 160,
    crowded: 120,
  }[signal.kind] || 0;
  const sortPenalty = Math.min(200, Number(signal.product?.sortOrder || 0));
  const anomalyBoost = resolveMerchantCostReference(signal.product).abnormalLowestPrice ? 350 : 0;
  return popularityScore(signal) + kindScore + anomalyBoost - sortPenalty;
}

function signalMemoryKey(signal) {
  const kind = String(signal?.kind || "change");
  const slug = String(signal?.product?.slug || "unknown");
  const observation = String(signal?.observedAt || signal?.sourceUrl || signal?.id || "current");
  return `${kind}:${slug}:${observation}`;
}

function genericSignalMemoryKey(signal) {
  return `${String(signal?.kind || "change")}:${String(signal?.product?.slug || "unknown")}`;
}

function recentMemoryItems(recentDailyMemory = []) {
  return (Array.isArray(recentDailyMemory) ? recentDailyMemory : []).slice(0, DAILY_MEMORY_DAYS);
}

function recentSignalKeys(recentDailyMemory = []) {
  return new Set(recentMemoryItems(recentDailyMemory)
    .flatMap((item) => [...(item?.signalKeys || []), ...(item?.actionKeys || [])])
    .map((value) => String(value || "").trim())
    .filter(Boolean));
}

function signalWasUsed(signal, recentDailyMemory = []) {
  const used = recentSignalKeys(recentDailyMemory);
  return used.has(signalMemoryKey(signal)) || used.has(genericSignalMemoryKey(signal));
}

export function selectDailySupplySignals(snapshot, limit = 2, options = {}) {
  const recentDailyMemory = options.recentDailyMemory || [];
  const candidates = [...(snapshot?.signals || [])]
    .filter((signal) =>
      signal?.product?.slug &&
      signal?.product?.productUrl &&
      CORE_CATEGORY_IDS.includes(signal.product.categoryId) &&
      !signalWasUsed(signal, recentDailyMemory)
    )
    .sort((a, b) => signalScore(b) - signalScore(a));
  const selected = [];
  const seen = new Set();
  const add = (signal) => {
    const slug = signal?.product?.slug;
    if (!slug || seen.has(slug) || selected.length >= limit) return;
    seen.add(slug);
    selected.push(signal);
  };

  add(candidates.find((signal) => resolveMerchantCostReference(signal.product).abnormalLowestPrice));
  add(candidates.find((signal) => OPPORTUNITY_KINDS.has(signal.kind)));
  add(candidates.find((signal) => RISK_KINDS.has(signal.kind)));
  for (const signal of candidates) add(signal);
  return selected;
}

function candidateMatchesProducts(candidate, products) {
  const candidateText = [
    candidate?.label,
    candidate?.entityKey,
    ...(candidate?.supportingItems || []).flatMap((item) => [item?.title, item?.description, item?.source]),
  ].join(" ").toLowerCase();
  return products.some((product) => {
    const productText = `${product.name} ${product.platform}`.toLowerCase();
    const brand = [
      "chatgpt", "openai", "claude", "anthropic", "gemini", "google ai",
      "grok", "cursor", "kiro", "windsurf", "perplexity", "suno", "icloud",
    ].find((term) => productText.includes(term));
    if (!brand || !candidateText.includes(brand)) return false;
    const tier = ["plus", "pro", "team", "business", "enterprise", "year"]
      .find((term) => productText.includes(term));
    if (tier) return candidateText.includes(tier);
    return /账号|账户|订阅|价格|额度|政策|地区|登录|注册|验证|account|subscription|plan|price|quota|limit|policy|region|login|verification|email/.test(candidateText);
  });
}

function relatedIndustryLine(candidates, products) {
  const candidate = (candidates || []).find((item) => candidateMatchesProducts(item, products));
  const source = candidate?.supportingItems?.find((item) => {
    try {
      return new URL(item?.url).protocol === "https:" &&
        isOfficialAccountOpportunityUrl(item?.url) &&
        classifyOpportunityEvidence(item, item?.type).isPrimary;
    } catch {
      return false;
    }
  });
  if (!candidate || !source) return null;
  const label = cleanArticleText(source.title || source.source || "官方来源", 120)
    .replace(/[\[\]()]/g, "");
  return `- **相关官方变化** [${label}](${source.url})与今天的商品直接相关。先核对套餐、额度、地区、登录或售后说明，再更新商品页。货源金额与库存仍以当天快照和原始页面为准。`;
}

function verifiedSourceCount(product) {
  return Math.max(0, Number(product?.verifiedSourceCount) || 0);
}

function verifiedOfferCount(product) {
  return Math.max(0, Number(product?.verifiedOfferCount) || 0);
}

function resolveNewSellerCostReference(product) {
  const price = positiveMoney(product?.verifiedReferencePrice);
  return {
    ...resolveMerchantCostReference(product),
    referencePrice: price,
    label: price === null
      ? "同一规格组暂无可确认价格"
      : `已核验“${cleanArticleText(product.verifiedSpecLabel, 120)}”组内的最低公开报价`,
  };
}

export function selectNewSellerProduct(snapshot, options = {}) {
  return selectNewSellerDecision(snapshot, options).product;
}

function eligibleNewSellerProducts(snapshot) {
  return snapshotProducts(snapshot).filter((product) => {
    const cost = resolveMerchantCostReference(product);
    const starterCost = resolveNewSellerCostReference(product);
    return product.availableOfferCount > 0 &&
      product.verificationScope !== 'aggregate-only' &&
      CORE_CATEGORY_IDS.includes(product.categoryId) &&
      cost.referencePrice !== null &&
      !cost.abnormalLowestPrice &&
      starterCost.referencePrice !== null &&
      verifiedSourceCount(product) >= 2 &&
      verifiedOfferCount(product) >= 2 &&
      cleanArticleText(product.verifiedSpecLabel, 120) &&
      product.productUrl &&
      product.profitCalculatorUrl;
  });
}

function latestLeadMemory(product, recentDailyMemory) {
  return recentMemoryItems(recentDailyMemory)
    .find((item) => item?.leadProductSlug === product.slug) || null;
}

function productOpportunitySignal(product, snapshot, recentDailyMemory) {
  return [...(snapshot?.signals || [])]
    .filter((signal) =>
      signal?.product?.slug === product.slug &&
      ["restock", "price_drop"].includes(signal.kind) &&
      !signalWasUsed(signal, recentDailyMemory)
    )
    .sort((a, b) => signalScore(b) - signalScore(a))[0] || null;
}

function starterNovelty(product, snapshot, recentDailyMemory) {
  const history = recentMemoryItems(recentDailyMemory);
  const previous = latestLeadMemory(product, history);
  const cost = resolveNewSellerCostReference(product).referencePrice;
  const signal = productOpportunitySignal(product, snapshot, history);
  if (!history.length) {
    return {
      kind: "baseline",
      rank: 100,
      focusKey: `starter:baseline:${product.slug}`,
      text: "这是建立近七期经营记忆后的首个合格商品，后续会按真实变化决定是否继续推荐。",
      signal: null,
    };
  }
  if (!previous) {
    return {
      kind: "first_verified",
      rank: 500,
      focusKey: `starter:first-verified:${product.slug}`,
      text: `${cleanArticleText(product.name, 100)} 近七期没有作为新手主推，今天首次通过库存、规格和多站点核验。`,
      signal,
    };
  }
  if (signal) {
    const label = signal.kind === "restock" ? "恢复供货" : "可核实降价";
    return {
      kind: signal.kind,
      rank: signal.kind === "price_drop" ? 460 : 440,
      focusKey: `starter:${signalMemoryKey(signal)}`,
      text: `${cleanArticleText(product.name, 100)} 出现一条近七期没有使用过的${label}记录，先复核原始页面再决定是否试卖。`,
      signal,
    };
  }
  if (
    positiveMoney(previous.referenceCost) !== null &&
    positiveMoney(cost) !== null &&
    previous.verifiedSpecLabel &&
    previous.verifiedSpecLabel === product.verifiedSpecLabel
  ) {
    const ratio = (cost - previous.referenceCost) / previous.referenceCost;
    if (Math.abs(ratio) >= MATERIAL_PRICE_CHANGE_RATIO) {
      const direction = ratio < 0 ? "下降" : "上涨";
      return {
        kind: ratio < 0 ? "material_price_drop" : "material_price_rise",
        rank: ratio < 0 ? 420 : 260,
        focusKey: `starter:material-price:${product.slug}:${Number(cost).toFixed(2)}`,
        text: `${cleanArticleText(product.name, 100)} 的同组进货参考比上次主推${direction} ${Math.abs(ratio * 100).toFixed(1)}%，需要重新计算真实售价能否覆盖全部成本。`,
        signal: null,
      };
    }
  }
  if (verifiedSourceCount(product) > Number(previous.verifiedSourceCount || 0)) {
    return {
      kind: "source_increase",
      rank: 380,
      focusKey: `starter:source-increase:${product.slug}:${verifiedSourceCount(product)}`,
      text: `${cleanArticleText(product.name, 100)} 的可复核货源站从 ${Number(previous.verifiedSourceCount || 0)} 个增加到 ${verifiedSourceCount(product)} 个，今天可以重新比较备选来源。`,
      signal: null,
    };
  }
  return null;
}

export function selectNewSellerDecision(snapshot, options = {}) {
  const recentDailyMemory = recentMemoryItems(options.recentDailyMemory || []);
  const usedFocusKeys = new Set(recentDailyMemory
    .map((item) => item?.dailyFocusKey)
    .filter(Boolean));
  const candidates = eligibleNewSellerProducts(snapshot)
    .map((product, index) => ({
      product,
      index,
      novelty: starterNovelty(product, snapshot, recentDailyMemory),
    }))
    .filter((item) => item.novelty && !usedFocusKeys.has(item.novelty.focusKey))
    .sort((a, b) => b.novelty.rank - a.novelty.rank || a.index - b.index);
  const selected = candidates[0] || null;
  return selected
    ? { product: selected.product, ...selected.novelty }
    : { product: null, kind: "no_fresh_opportunity", rank: 0, focusKey: "", text: "", signal: null };
}

function sourceNames(product) {
  return [...new Set((product?.verifiedSourceNames || [])
    .map((item) => cleanArticleText(item, 80))
    .filter(Boolean))];
}

function copyDraft(product) {
  if (!product) return "";
  return [
    `商品名称　${cleanArticleText(product.name, 100)}`,
    `已核验分组　${cleanArticleText(product.verifiedSpecLabel, 120)}`,
    "商品规格　请继续填写你在两个货源页面核对一致的名称、期限和账号形态",
    "交付方式　请填写你已经核验并能完成的交付方式和时间",
    "售后范围　请填写你真实能承担的退款、补发和协助范围",
    "购买提醒　付款前再次确认库存，货源失效或规格变化时暂停接单",
  ].join("\n");
}

const OPERATION_MISSIONS = [
  {
    id: "pending-order-stock",
    title: "逐单复核待交付库存",
    action: "打开待交付订单，只检查每一单原货源是否仍能购买，不能购买的先暂停承诺交付时间。",
    stop: "原货源缺货并且没有规格一致的替代来源时停止接单。",
  },
  {
    id: "backup-source",
    title: "补一条可用备用货源",
    action: "为目标商品找一个规格一致的备用来源，记下期限、交付和售后差异。",
    stop: "第二个来源的规格或售后对不上时，不把它当成备用货源。",
  },
  {
    id: "real-margin",
    title: "用真实成交价重算一单",
    action: "把最近一单真实售价、手续费、退款损耗和售后成本填进利润计算器。",
    stop: "真实成本填不全时不扩大接单量。",
  },
  {
    id: "after-sales-boundary",
    title: "把售后边界写清楚",
    action: "核对目标商品能承担的退款、补发和协助范围，只保留自己能兑现的文字。",
    stop: "供应商售后说明不清或自己无法承担时暂停发布。",
  },
  {
    id: "listing-spec",
    title: "清理一个规格不明的商品说明",
    action: "逐项补齐期限、地区、账号形态和交付方式，缺一项就保持下架。",
    stop: "两个原始货源页面的规格无法对齐时停止。",
  },
];

function dateRotationIndex(dateStr, length) {
  const value = Number(String(dateStr || "").replace(/\D/g, "")) || 0;
  return length > 0 ? value % length : 0;
}

function rotate(items, offset) {
  if (!items.length) return [];
  const index = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(index), ...items.slice(0, index)];
}

function selectOperationalMission({
  dateStr,
  products,
  coreProducts,
  pausedProducts,
  anomalousProducts,
  recentDailyMemory,
}) {
  const usedFocusKeys = new Set(recentMemoryItems(recentDailyMemory)
    .map((item) => item?.dailyFocusKey)
    .filter(Boolean));
  const targets = [...new Map([
    ...pausedProducts,
    ...anomalousProducts,
    ...coreProducts,
    ...products,
  ].filter((product) => product && CORE_CATEGORY_IDS.includes(product.categoryId)).map((product) => [product.slug, product])).values()];
  const beginnerMissions = OPERATION_MISSIONS.filter((mission) => !['pending-order-stock', 'real-margin'].includes(mission.id));
  const missions = rotate(beginnerMissions, dateRotationIndex(dateStr, beginnerMissions.length));
  const rotatedTargets = rotate(targets, dateRotationIndex(dateStr, Math.max(1, targets.length)));
  for (const mission of missions) {
    for (const product of rotatedTargets) {
      const focusKey = `operations:${mission.id}:${product.slug}`;
      if (!usedFocusKeys.has(focusKey)) {
        return { ...mission, product, focusKey };
      }
    }
  }
  const mission = missions[0] || OPERATION_MISSIONS[0];
  const product = rotatedTargets[0] || null;
  return {
    ...mission,
    product,
    focusKey: `operations:${mission.id}:${product?.slug || "catalog"}`,
  };
}

function oneLookMarkdown(product, novelty, mission) {
  if (!product) {
    const targetLink = mission?.product
      ? `[${cleanArticleText(mission.product.name, 100)}](${mission.product.productUrl})`
      : `[实时商机台](https://supply.aivora.cn/opportunities)`;
    return [
      "- **今天能不能做** 今日不建议上新。当前没有商品同时满足新证据和新手试卖门槛。",
      `- **今天新在哪里** 今天没有新的可验证试卖机会。改做“${mission.title}”，目标是 ${targetLink}。`,
      `- **现在做什么** ${mission.action}`,
      `- **最重要的停止条件** ${mission.stop}`,
      "- **一句解释** 可复核进货价就是你能回到原始货源页面再次确认的当前价格。",
    ].join("\n");
  }
  const cost = resolveNewSellerCostReference(product);
  const calculatorUrl = profitCalculatorUrl(product, cost.referencePrice);
  const names = sourceNames(product);
  const sourceText = names.length
    ? `按“${cleanArticleText(product.verifiedSpecLabel, 120)}”这一组核到 ${verifiedSourceCount(product)} 个不同货源站，例如 ${names.slice(0, 2).join("、")}。`
    : `按“${cleanArticleText(product.verifiedSpecLabel, 120)}”这一组核到 ${verifiedSourceCount(product)} 个不同货源站。`;
  return [
    `### [${cleanArticleText(product.name, 100)}](${product.productUrl})`,
    "",
    "- **今天能不能做** 可以做一次低成本试卖，不囤货，也不保证成交。",
    `- **今天新在哪里** ${cleanArticleText(novelty?.text, 260)}`,
    `- **当前进货参考** ${formatMoney(cost.referencePrice)}。这是${cost.label}，付款前还要打开原始页面确认。`,
    `- **为什么只选它** ${sourceText}本次同规格组核到 ${verifiedOfferCount(product)} 条可购买报价；整个商品页共有 ${product.availableOfferCount} 条不同规格报价。报价多只说明容易比较货源，不代表销量高。`,
    `- **开始按钮** [开始今天的任务](${product.productUrl})，核完货源后再[带入进货参考算利润](${calculatorUrl})。`,
    "- **最重要的停止条件** 两个货源站的商品名称、期限、账号形态、交付方式或售后范围对不上时停止。",
    "- **一句解释** 进货参考是当前可以回原始页面确认的价格，不是最终采购成本，也不代表你应该卖多少。",
  ].join("\n");
}

function newSellerStepsMarkdown(product, mission) {
  if (!product) {
    const target = mission?.product;
    const targetLink = target
      ? `[${cleanArticleText(target.name, 100)}](${target.productUrl})`
      : `[实时商机台](https://supply.aivora.cn/opportunities)`;
    return [
      `今天没有新的合格试卖商品。完成“${mission.title}”后收盘。`,
      "",
      `1. 打开 ${targetLink}，只处理今天这一个目标。`,
      `2. ${mission.action}`,
      `3. ${mission.stop} 收盘时记录检查结果。`,
      "",
      `[第一次试卖需要完整流程时，打开卖家指南](${FIRST_SALE_GUIDE_URL})。`,
    ].join("\n");
  }
  const cost = resolveNewSellerCostReference(product);
  const calculatorUrl = profitCalculatorUrl(product, cost.referencePrice);
  const names = sourceNames(product).slice(0, 2);
  const sourceInstruction = names.length >= 2
    ? `先核对 ${names.join(" 和 ")}，再从商品页补查其他同组来源。`
    : "在商品页核对至少两个不同货源站。";
  return [
    "今天只完成这一次小量验证。任何停止条件出现都不要继续。",
    "",
    `1. [打开 ${cleanArticleText(product.name, 100)} 的同组报价](${product.productUrl})，只核对“${cleanArticleText(product.verifiedSpecLabel, 120)}”。`,
    `2. ${sourceInstruction}确认期限、账号形态、交付和售后都一致。`,
    `3. [把 ${formatMoney(cost.referencePrice)} 带入利润计算器](${calculatorUrl})。`,
    "4. 填写你自己的售价、手续费、退款损耗、售后成本和获客成本，未填完整前不判断利润。",
    "5. 复制下面的商品说明草稿。收到订单后再次检查库存，交付完成再填写收盘结果。",
    "",
    `[需要从零开始时，先看完整试卖指南](${FIRST_SALE_GUIDE_URL})。`,
    "",
    "### 可复制商品说明草稿",
    "",
    ...copyDraft(product).split("\n").map((line) => `> ${line}`),
  ].join("\n");
}

function oldMerchantAction(signal, fallbackProduct) {
  const product = signal?.product || fallbackProduct;
  const cost = resolveMerchantCostReference(product);
  if (cost.abnormalLowestPrice) return "暂停按最低价核算";
  if (signal?.kind === "stockout") return "准备替代货源";
  if (signal?.kind === "price_drop" || signal?.kind === "price_rise") return "重新核价";
  if (signal?.kind === "restock") return "复核恢复接单";
  if (product.availableOfferCount <= 5) return "只做小量验证";
  return "复核后继续接单";
}

function pausedProductMarkdown(product, products) {
  const replacement = products
    .filter((item) => item.categoryId === product.categoryId && item.availableOfferCount > 0)
    .sort(productOrder)[0];
  const replacementText = replacement
    ? `可以改看同类的[${cleanArticleText(replacement.name, 100)}](${replacement.productUrl})，两者规格不同的地方要重新核对。`
    : "当前没有可验证的同类替代，继续暂停新增接单。";
  return `- **[${cleanArticleText(product.name, 100)}](${product.productUrl})** 当前可购买报价为 0。暂停按旧库存新增接单。${replacementText}`;
}

function anomalousProductMarkdown(product) {
  const cost = resolveMerchantCostReference(product);
  return `- **[${cleanArticleText(product.name, 100)}](${product.productUrl})** 目录最低价 ${formatMoney(cost.lowestPrice)} 与明确质保参考 ${formatMoney(cost.warrantyPrice)} 严重倒挂。日报已隔离最低价，付款前核对规格、来源和质保。`;
}

function merchantActionPriority(item) {
  if (item.type === "paused") return 1000;
  if (item.type === "anomaly") return 900;
  if (item.signal?.kind === "stockout") return 850;
  if (item.signal?.kind === "price_rise") return 800;
  if (item.signal?.kind === "price_drop") return 760;
  if (item.signal?.kind === "restock") return 720;
  return 100 + merchantPriority(item.product);
}

function merchantActionKey(product, signal, type) {
  if (signal) return signalMemoryKey(signal);
  return `${type}:${product?.slug || "unknown"}`;
}

function merchantActionWasUsed(product, signal, type, recentDailyMemory) {
  const exact = merchantActionKey(product, signal, type);
  const generic = signal ? genericSignalMemoryKey(signal) : exact;
  return recentMemoryItems(recentDailyMemory).some((item) => {
    const keys = uniqueStrings([...(item?.actionKeys || []), ...(item?.signalKeys || [])]);
    return keys.includes(exact) || keys.includes(generic);
  });
}

function selectOldMerchantActions(
  coreProducts,
  signals,
  anomalousProducts = [],
  pausedProducts = [],
  limit = 3,
  options = {},
) {
  const recentDailyMemory = recentMemoryItems(options.recentDailyMemory || []);
  const candidates = [];
  const seen = new Set();
  const add = (product, signal = null, type = "current") => {
    if (
      !product?.slug ||
      seen.has(product.slug) ||
      merchantActionWasUsed(product, signal, type, recentDailyMemory)
    ) return;
    seen.add(product.slug);
    candidates.push({
      product,
      signal,
      type,
      actionKey: merchantActionKey(product, signal, type),
    });
  };
  for (const product of pausedProducts) add(product, null, "paused");
  for (const product of anomalousProducts) add(product, null, "anomaly");
  for (const signal of signals.filter((item) => ["stockout", "price_rise", "price_drop", "restock"].includes(item.kind))) {
    add(signal.product, signal, "change");
  }
  for (const product of coreProducts) add(product);
  return candidates
    .sort((a, b) => merchantActionPriority(b) - merchantActionPriority(a))
    .slice(0, Math.max(0, limit));
}

function oldMerchantMarkdown(item, index, leadProduct = null) {
  const { product, signal, type } = item;
  const isLeadReference = leadProduct?.slug === product.slug;
  const cost = isLeadReference
    ? resolveNewSellerCostReference(leadProduct)
    : resolveMerchantCostReference(product);
  let evidence;
  let action;
  let stop;
  if (type === "paused") {
    evidence = "当前可购买报价为 0。";
    action = "先检查待交付订单是否使用这个商品，有订单就找同类替代并重新核价，没有替代就暂停接单。";
    stop = "找不到仍有货且规格一致的替代来源时立即停单。";
  } else if (type === "anomaly") {
    evidence = `目录最低价 ${formatMoney(cost.lowestPrice)} 与明确质保报价 ${formatMoney(cost.warrantyPrice)} 严重倒挂，最低价已隔离。`;
    action = "不要按最低价报价，先回原始页面确认商品规格、来源和质保。";
    stop = "无法解释极端价差或质保内容不清楚时暂停。";
  } else if (signal) {
    const source = signal.sourceUrl ? ` [查看原始货源](${signal.sourceUrl})。` : "";
    if (isLeadReference) {
      const change = signal.kind === "restock" ? "一个原货源由缺货变为有货"
        : signal.kind === "stockout" ? "一个原货源由有货变为缺货"
          : signal.kind === "price_rise" ? "一个原货源记录涨价"
            : signal.kind === "price_drop" ? "一个原货源记录降价"
              : "一个原货源记录发生变化";
      evidence = `${change}，记录于 ${formatShanghaiTime(signal.observedAt)}。${source}这是单条来源变化，上方已核验的同规格分组与进货参考仍是本页核价依据。`;
      action = "回看上方唯一建议，先重新核对同规格组，再处理已有订单。";
      stop = "原始来源与上方分组的期限、地区、账号形态或交付方式不一致时停止。";
    } else {
      evidence = `${cleanArticleText(signal.evidence, 420)} 记录于 ${formatShanghaiTime(signal.observedAt)}。${source}`;
      action = cleanArticleText(signal.sellerAction, 420);
      stop = cleanArticleText(signal.stopCondition, 420);
    }
  } else {
    evidence = `当前可购买报价 ${product.availableOfferCount} 条，进货参考 ${formatMoney(cost.referencePrice)}。`;
    action = "检查待交付订单使用的货源是否仍有货，再用自己的真实成交价重算不亏钱所需的最低售价。";
    stop = "替代成本超过实际售价，或交付与售后范围说不清时暂停。";
  }
  const calculator = positiveMoney(cost.referencePrice) === null
    ? ""
    : ` [重新算一遍](${profitCalculatorUrl(product, cost.referencePrice)})。`;
  const actionTitle = type === "paused"
    ? "暂停新增接单"
    : type === "anomaly"
      ? "暂停按最低价核算"
      : oldMerchantAction(signal, product);
  return [
    `### ${index + 1}. ${actionTitle} [${cleanArticleText(product.name, 100)}](${product.productUrl})`,
    "",
    `- **发生了什么** ${evidence}`,
    `- **现在先做** ${action}${calculator}`,
    `- **何时停止** ${stop}`,
  ].join("\n");
}

function chineseMonthDay(dateStr) {
  const match = String(dateStr || "").match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!match) return String(dateStr || "");
  return `${Number(match[1])}月${Number(match[2])}日`;
}

function buildEditionIdentity({ dateStr, lead, novelty, mission, oldMerchantActions }) {
  let headline;
  if (lead) {
    const name = cleanArticleText(lead.name, 72);
    const cost = resolveNewSellerCostReference(lead).referencePrice;
    if (novelty.kind === "first_verified") {
      headline = `今天换测 ${name}`;
    } else if (["price_drop", "material_price_drop"].includes(novelty.kind)) {
      headline = `${name} 进货参考降到 ${formatMoney(cost)}`;
    } else if (novelty.kind === "restock") {
      headline = `${name} 恢复供货，先做小量验证`;
    } else if (novelty.kind === "source_increase") {
      headline = `${name} 可核货源增加到 ${verifiedSourceCount(lead)} 家`;
    } else if (novelty.kind === "material_price_rise") {
      headline = `${name} 成本升到 ${formatMoney(cost)}，先重算`;
    } else {
      headline = `今天先验证 ${name}`;
    }
  } else {
    const freshAction = oldMerchantActions[0];
    if (freshAction?.signal?.kind === "stockout") {
      headline = `${cleanArticleText(freshAction.product.name, 72)} 出现断货，先保已有订单`;
    } else if (freshAction?.signal?.kind === "price_rise") {
      headline = `${cleanArticleText(freshAction.product.name, 72)} 涨价，今天先重算`;
    } else if (freshAction?.type === "anomaly") {
      headline = `${cleanArticleText(freshAction.product.name, 72)} 低价异常，暂停核算`;
    } else {
      const target = mission.product ? ` ${cleanArticleText(mission.product.name, 60)}` : "";
      headline = `今天不追新，先用${target || "现有订单"}做${mission.title}`;
    }
  }
  return {
    headline,
    pageTitle: `${headline}｜${chineseMonthDay(dateStr)} AI 账号商机日报`,
  };
}

export function buildSupplyDrivenAccountOpportunityMarkdown({
  dateStr,
  snapshot,
  industryCandidates = [],
  recentDailyMemory = [],
}) {
  const products = snapshotProducts(snapshot);
  const coreProducts = selectMerchantCoreProducts(snapshot, 4);
  const starterDecision = selectNewSellerDecision(snapshot, { recentDailyMemory });
  const lead = starterDecision.product;
  const anomalousProducts = selectAnomalousPriceProducts(snapshot, 1);
  const pausedProducts = selectPausedProducts(snapshot, 3 - anomalousProducts.length);
  const selectedSignals = selectDailySupplySignals(snapshot, 3, { recentDailyMemory });
  if (!products.length) throw new Error("no usable merchant products for the daily");
  const leadCost = lead ? resolveNewSellerCostReference(lead) : null;
  const oldMerchantActions = selectOldMerchantActions(
    coreProducts,
    selectedSignals,
    anomalousProducts,
    pausedProducts,
    3,
    { recentDailyMemory },
  );
  const mission = selectOperationalMission({
    dateStr,
    products,
    coreProducts,
    pausedProducts,
    anomalousProducts,
    recentDailyMemory,
  });
  const focusKey = lead ? starterDecision.focusKey : mission.focusKey;
  const comparableSignals = selectedSignals.filter((signal) =>
    ["restock", "stockout", "price_drop", "price_rise"].includes(signal.kind)
  );
  const allComparableSignals = [...(snapshot?.signals || [])].filter((signal) =>
    ["restock", "stockout", "price_drop", "price_rise"].includes(signal.kind)
  );
  const hasComparableHistory = allComparableSignals.length > 0;
  const stats = snapshot.stats;
  const changeCount = stats.recentChangeCountCapped
    ? `至少 ${stats.recentChangeCount} 条，接口只取最新 ${stats.recentChangeCount} 条`
    : `${stats.recentChangeCount} 条`;
  const edition = buildEditionIdentity({
    dateStr,
    lead,
    novelty: starterDecision,
    mission,
    oldMerchantActions,
  });
  const metadata = {
    entity: lead ? `supply:${lead.slug}:merchant-daily` : "supply:no-starter-product:merchant-daily",
    businessModel: "supply-merchant-daily-v3",
    deliveryType: "merchant-opening-and-closing-sheet",
    commercialSignature: `supply:merchant:${focusKey}`,
    reportDate: dateStr,
    editionTitle: edition.pageTitle,
    dailyFocusKey: focusKey,
    noveltyKind: starterDecision.kind,
    noveltyText: lead ? starterDecision.text : `今天没有新的可验证试卖机会，改做${mission.title}。`,
    offerFamily: lead ? `supply:${lead.slug}` : "supply:pause",
    preferredLane: "account",
    decision: lead ? "trial" : "pause",
    leadProductSlug: lead?.slug || null,
    leadProductName: lead?.name || null,
    referenceCost: leadCost?.referencePrice ?? null,
    verifiedSourceCount: lead ? verifiedSourceCount(lead) : 0,
    verifiedSourceNames: lead ? sourceNames(lead).slice(0, 3) : [],
    verifiedSpecLabel: lead?.verifiedSpecLabel || "",
    productUrl: lead?.productUrl || null,
    calculatorUrl: lead ? profitCalculatorUrl(lead, leadCost.referencePrice) : null,
    sourceGeneratedAt: snapshot.generatedAt,
    sourceObservedAt: snapshot.latestObservedAt,
    copyDraft: copyDraft(lead),
    featuredProductSlugs: uniqueStrings([
      lead?.slug,
      ...oldMerchantActions.map((item) => item.product.slug),
      ...pausedProducts.map((product) => product.slug),
      ...anomalousProducts.map((product) => product.slug),
    ].filter(Boolean)),
    actionKeys: uniqueStrings(oldMerchantActions.map((item) => item.actionKey)),
    signalKeys: uniqueStrings(selectedSignals.map(signalMemoryKey)),
  };
  const officialProducts = [...new Map([
    ...(lead ? [lead] : []),
    ...selectedSignals.map((signal) => signal.product),
  ].map((product) => [product.slug, product])).values()];
  const holdItems = [
    ...anomalousProducts.map((product) => ({ type: "anomaly", product })),
    ...pausedProducts.map((product) => ({ type: "paused", product })),
  ];
  const relatedIndustry = relatedIndustryLine(industryCandidates, officialProducts);
  const decisionLine = lead
    ? `${cleanArticleText(starterDecision.text, 180)} 只试卖 [${cleanArticleText(lead.name, 100)}](${lead.productUrl})，不囤货。`
    : `今日不建议上新。近七期没有新增的价格、库存、规格或来源证据，今天改做${mission.title}。`;
  const firstAction = lead
    ? `[点击这里开始今天的任务](${lead.productUrl})。`
    : mission.product
      ? `[点击这里处理 ${cleanArticleText(mission.product.name, 80)}](${mission.product.productUrl})。`
      : `[点击这里检查已有订单和实时库存](${snapshot.source})。`;
  const biggestRisk = anomalousProducts.length
    ? "极端低价可能来自规格、交付或售后不同，已经从新手推荐中隔离。"
    : pausedProducts.length
      ? "部分核心商品没有可购买报价，继续按旧库存接单可能无法交付。"
      : "付款前库存和价格仍会变化，实际售价没有覆盖退款与售后时会亏损。";
  const allowedSupplyUrls = [...new Set([
    snapshot.source,
    FIRST_SALE_GUIDE_URL,
    ...(lead ? [profitCalculatorUrl(lead, leadCost.referencePrice)] : []),
    ...products.flatMap((product) => [
      product.productUrl,
      product.profitCalculatorUrl,
      profitCalculatorUrl(product, resolveMerchantCostReference(product).referencePrice),
    ]),
  ].filter(Boolean))];

  return {
    markdown: [
      "## 今天一句话",
      "",
      `- **今天建议** ${decisionLine}`,
      `- **现在点击** ${firstAction}`,
      `- **最大风险** ${biggestRisk}`,
      `- **数据时间** 页面生成于 ${formatShanghaiTime(snapshot.generatedAt)}，最近货源记录为 ${formatShanghaiTime(snapshot.latestObservedAt)}。`,
      "",
      "## 选择你的阅读方式",
      "",
      "- **一眼看懂** 只看今天能不能做、唯一建议和停止条件。",
      "- **新手照做** 从选商品到收盘，最多六步。",
      "- **老手看盘** 先看缺货、异常价格和最近 24 小时变化。",
      "",
      "## 一眼看懂",
      "",
      oneLookMarkdown(lead, starterDecision, mission),
      "",
      "## 新手今天照着做",
      "",
      newSellerStepsMarkdown(lead, mission),
      "",
      "## 老商家今天看这三项",
      "",
      comparableSignals.length > 0
        ? `今天有 ${comparableSignals.length} 个近七期没有使用过的连续快照变化。先处理下面最多三项。`
        : hasComparableHistory
          ? "快照里有可比较的历史变化，但这些变化已经在近七期日报使用过，今天不重复当作新信号。"
          : "今天没有可比较的连续历史快照。下面只列当前库存和价格风险，不显示涨跌。",
      "",
      oldMerchantActions.length
        ? oldMerchantActions.map((item, index) => oldMerchantMarkdown(item, index, lead)).join("\n\n")
        : `当前没有新的核心商品异动。今天只做“${mission.title}”。${mission.action}`,
      "",
      "## 今天暂停什么",
      "",
      holdItems.length
        ? holdItems.map((item) => item.type === "anomaly"
          ? anomalousProductMarkdown(item.product)
          : pausedProductMarkdown(item.product, products)).join("\n")
        : "当前没有发现达到隔离门槛的极端低价，核心目录也没有完全缺货商品。付款前仍要再次打开原始页面。",
      "",
      "## 数据和判断依据",
      "",
      `- **同一次货源记录** 数据来自[实时货源商机台](${snapshot.source})。标准商品 ${stats.productCount} 个，其中 ${stats.availableProductCount} 个当前有可购买报价。`,
      `- **公开报价** 当前 ${stats.availableOfferCount} 条，只代表可以比较的货源，不代表销量、询问或需求。`,
      `- **最近变化** 最近 24 小时 ${changeCount}；低供给观察 ${stats.lowSupplyProductCount} 个。`,
      "- **普通中文解释** 进货参考是能回原始页面确认的价格；不亏钱所需的最低售价要加上手续费、退款、售后和获客成本；异常低价隔离是暂时不让可疑最低价进入推荐。",
      "- **有效性** 原始页面、库存或规格任何一项失效，这条建议立即失效。",
      ...(relatedIndustry ? [relatedIndustry] : []),
      "",
      "## 收盘填写结果",
      "",
      "- **今天询问和成交** 询问数〔待填写〕，成交数〔待填写〕，实际成交价〔待填写〕。",
      "- **实际成本和损耗** 采购成本〔待填写〕，退款或补发〔待填写〕，售后耗时〔待填写〕。",
      "- **明天怎么做** 只有真实利润为正、交付稳定且货源仍有效时才考虑增加；其他情况维持小量或暂停。",
      "",
      `<!-- opportunity-replay: ${JSON.stringify(metadata)} -->`,
    ].join("\n"),
    selectedSignals,
    coreProducts,
    pausedProducts,
    anomalousProducts,
    oldMerchantActions,
    leadProduct: lead,
    starterDecision,
    dailyFocusKey: focusKey,
    pageTitle: edition.pageTitle,
    pageDescription: lead
      ? `${starterDecision.text} 当前进货参考 ${formatMoney(leadCost.referencePrice)}，付款前再次确认库存。`
      : `今天没有新的可验证试卖机会。日报安排${mission.title}，并保留缺货和异常价格提醒。`,
    recentDailyMemory,
    hasComparableHistory,
    freshComparableSignalCount: comparableSignals.length,
    allowedSupplyUrls,
  };
}
