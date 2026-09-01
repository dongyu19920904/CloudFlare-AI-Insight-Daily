import { classifyOpportunityEvidence } from "./opportunityEvidence.js";

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

function cleanArticleText(value, maxLength = 900) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\bout_of_stock\s*→\s*in_stock\b/gi, "缺货转为有货")
    .replace(/\bin_stock\s*→\s*out_of_stock\b/gi, "有货转为缺货")
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

export function selectDailySupplySignals(snapshot, limit = 2) {
  const candidates = [...(snapshot?.signals || [])]
    .filter((signal) =>
      signal?.product?.slug &&
      signal?.product?.productUrl &&
      CORE_CATEGORY_IDS.includes(signal.product.categoryId)
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

function relatedIndustrySection(candidates, products) {
  const candidate = (candidates || []).find((item) => candidateMatchesProducts(item, products));
  const source = candidate?.supportingItems?.find((item) => {
    try {
      return new URL(item?.url).protocol === "https:" &&
        classifyOpportunityEvidence(item, item?.type).isPrimary;
    } catch {
      return false;
    }
  });
  if (!candidate || !source) return [];
  const label = cleanArticleText(source.title || source.source || "官方来源", 120)
    .replace(/[\[\]()]/g, "");
  return [
    "",
    "## 一条相关官方变化",
    "",
    `[${label}](${source.url})与今天的商品直接相关。先核对套餐、额度、地区、登录或售后说明是否改变，再更新商品页和客服话术。货源金额与库存仍以当天快照和原始页面为准。`,
  ];
}

function newSellerFirstOrderMarkdown(product) {
  const cost = resolveMerchantCostReference(product);
  const calculatorUrl = profitCalculatorUrl(product, cost.referencePrice);
  const anomalyNote = cost.abnormalLowestPrice
    ? `目录最低价 ${formatMoney(cost.lowestPrice)} 与明确质保参考 ${formatMoney(cost.warrantyPrice)} 严重倒挂，日报没有把最低价当作成本。`
    : `当前成本口径为${cost.label} ${formatMoney(cost.referencePrice)}，付款前仍要核对同规格货源。`;
  return [
    `### [${cleanArticleText(product.name, 100)}](${product.productUrl})`,
    "",
    `- **成本口径** ${anomalyNote}`,
    `- **为什么选它** 当前有 ${product.availableOfferCount} 条可购买报价，便于准备至少两个同规格来源。报价数量只代表供给，不代表今天一定有人购买。`,
    `- **利润入口** [把 ${formatMoney(cost.referencePrice)} 带入利润计算器](${calculatorUrl})，再填写自己的实际售价、支付费、退款损耗、售后和获客成本。`,
    "- **按这个顺序做**",
    "  1. 打开标准商品页，从同规格报价中准备两个仍有货的来源，逐个核对账号形态、期限、登录、交付和质保。",
    "  2. 用自己的真实售价计算保本价。计算结果没有正利润时不要发布。",
    "  3. 商品说明只写已经核验的规格。收到订单后再次检查库存，再采购交付。",
    "- **第一单门槛** 已有可触达的买家或销售入口，至少两个同规格来源仍有效，售后和退款边界能够写清。少一项都先观察。",
    "- **停止条件** 找不到同规格替代、原始页失效、实际售价低于保本价，或无法承担一次退款损耗时停止接单。",
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

function oldMerchantMarkdown(product, signal) {
  const cost = resolveMerchantCostReference(product);
  const calculatorUrl = profitCalculatorUrl(product, cost.referencePrice);
  const evidence = cost.abnormalLowestPrice
    ? `最低价 ${formatMoney(cost.lowestPrice)} 已隔离，待复核成本采用 ${formatMoney(cost.referencePrice)}。`
    : `可复核成本 ${formatMoney(cost.referencePrice)}，当前可购买报价 ${product.availableOfferCount} 条。`;
  return [
    `### ${oldMerchantAction(signal, product)}，[${cleanArticleText(product.name, 100)}](${product.productUrl})`,
    "",
    `- **当前盘面** ${evidence}`,
    `- **开盘动作** ${signal ? cleanArticleText(signal.sellerAction, 420) : "核对现有订单所用规格和同源库存，再用今天的成本重算保本价。"}`,
    `- **核价入口** [用日报成本重新计算](${calculatorUrl})。只用自己的真实成交价作比较。`,
    `- **停止条件** ${signal ? cleanArticleText(signal.stopCondition, 420) : "同源库存失效、替代成本超过当前售价，或交付与售后边界不清楚时暂停。"}`,
  ].join("\n");
}

function signalMarkdown(signal) {
  const product = signal.product;
  const cost = resolveMerchantCostReference(product);
  const calculatorUrl = profitCalculatorUrl(product, cost.referencePrice);
  const title = cost.abnormalLowestPrice
    ? `异常低价待核 ${cleanArticleText(product.name, 100)}`
    : `${cleanArticleText(signal.label, 60)} ${cleanArticleText(product.name, 100)}`;
  const evidence = cost.abnormalLowestPrice
    ? `目录最低价 ${formatMoney(cost.lowestPrice)} 与明确质保参考 ${formatMoney(cost.warrantyPrice)} 严重倒挂，最低价没有进入成本计算。`
    : cleanArticleText(signal.evidence, 520);
  const action = cost.abnormalLowestPrice
    ? "暂停使用最低价接单，打开商品页核对规格、原始来源和质保以后再决定。"
    : cleanArticleText(signal.sellerAction, 520);
  return [
    `### ${title}`,
    "",
    `- **异动证据** [打开 ${cleanArticleText(product.name, 100)} 标准商品页](${product.productUrl})。${evidence}`,
    `- **经营动作** ${action}`,
    `- **成本口径** [按 ${formatMoney(cost.referencePrice)} 重新核算](${calculatorUrl})。这个金额仍需回到同规格原始货源复核。`,
    `- **停止条件** ${cleanArticleText(signal.stopCondition)}`,
  ].join("\n");
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

function selectOldMerchantActions(coreProducts, signals, anomalousProducts = [], limit = 3) {
  const selected = [];
  const seen = new Set();
  const add = (product, signal = null) => {
    if (!product?.slug || seen.has(product.slug) || selected.length >= limit) return;
    seen.add(product.slug);
    selected.push({ product, signal });
  };
  for (const product of anomalousProducts) add(product);
  for (const signal of signals) add(signal.product, signal);
  for (const product of coreProducts) add(product);
  return selected;
}

export function buildSupplyDrivenAccountOpportunityMarkdown({
  dateStr,
  snapshot,
  industryCandidates = [],
}) {
  const products = snapshotProducts(snapshot);
  const coreProducts = selectMerchantCoreProducts(snapshot, 4);
  const anomalousProducts = selectAnomalousPriceProducts(snapshot, 1);
  const pausedProducts = selectPausedProducts(snapshot, 3 - anomalousProducts.length);
  const selectedSignals = selectDailySupplySignals(snapshot, 2);
  if (!coreProducts.length) throw new Error("no usable merchant products for the daily");
  if (!selectedSignals.length) throw new Error("no usable supply signals for the daily");
  const lead = coreProducts[0];
  const leadCost = resolveMerchantCostReference(lead);
  const oldMerchantActions = selectOldMerchantActions(coreProducts, selectedSignals, anomalousProducts, 3);
  const stats = snapshot.stats;
  const changeCount = stats.recentChangeCountCapped
    ? `至少 ${stats.recentChangeCount} 条，接口只取最新 ${stats.recentChangeCount} 条`
    : `${stats.recentChangeCount} 条`;
  const metadata = {
    entity: `supply:${lead.slug}:merchant-daily`,
    businessModel: "supply-merchant-daily-v3",
    deliveryType: "merchant-opening-and-closing-sheet",
    commercialSignature: `supply:merchant:${lead.slug}:${dateStr}`,
    offerFamily: `supply:${lead.slug}`,
    preferredLane: "account",
  };
  const officialProducts = [...new Map([
    ...coreProducts,
    ...selectedSignals.map((signal) => signal.product),
  ].map((product) => [product.slug, product])).values()];
  const holdItems = [
    ...anomalousProducts.map((product) => ({ type: "anomaly", product })),
    ...pausedProducts.map((product) => ({ type: "paused", product })),
  ];
  const allowedSupplyUrls = [...new Set([
    snapshot.source,
    ...products.flatMap((product) => [
      product.productUrl,
      product.profitCalculatorUrl,
      profitCalculatorUrl(product, resolveMerchantCostReference(product).referencePrice),
    ]),
  ].filter(Boolean))];

  return {
    markdown: [
      "## 今日能不能做",
      "",
      `- **经营结论** 新手今天只验证 [${cleanArticleText(lead.name, 100)}](${lead.productUrl})。先核对两个同规格来源，再按 ${formatMoney(leadCost.referencePrice)} 填入自己的真实成本。没有现成买家入口时不囤货。`,
      `- **数据时间** 快照生成于 ${formatShanghaiTime(snapshot.generatedAt)}，最近有效货源观察记录于 ${formatShanghaiTime(snapshot.latestObservedAt)}。`,
      "- **全局停止** 原始货源失效、规格无法对齐、交付与退款边界不清楚，或者自己的实际售价低于保本价时停止接单。",
      "",
      "## 新手第一单",
      "",
      newSellerFirstOrderMarkdown(lead),
      "",
      "## 老商家开盘单",
      "",
      "先处理下面三项，再检查自己的待交付订单。没有列出的商品继续按原规则经营，不因日报自动扩量。",
      "",
      oldMerchantActions.map(({ product, signal }) => oldMerchantMarkdown(product, signal)).join("\n\n"),
      "",
      "## 今日货源证据",
      "",
      `数据来自[实时货源商机台](${snapshot.source})，下面的数字属于同一次快照。`,
      "",
      `- **标准商品** ${stats.productCount} 个，其中 ${stats.availableProductCount} 个当前存在可购买报价。`,
      `- **公开报价** ${stats.availableOfferCount} 条，只代表可比较货源，不代表销量或需求。`,
      `- **货源异动** 最近 24 小时 ${changeCount}。`,
      `- **低供给观察** ${stats.lowSupplyProductCount} 个，报价少也可能来自需求不足。`,
      "- **完整盘面** 平台分类、全部异动和当前库存留在实时商机台，日报不重复抄一遍。",
      "",
      "## 今日关键异动",
      "",
      selectedSignals.map(signalMarkdown).join("\n\n"),
      "",
      "## 暂停和异常清单",
      "",
      holdItems.length
        ? holdItems.map((item) => item.type === "anomaly"
          ? anomalousProductMarkdown(item.product)
          : pausedProductMarkdown(item.product, products)).join("\n")
        : "当前没有发现达到隔离门槛的极端低价，核心目录也没有新增完全缺货商品。付款前仍要再次打开原始页面。",
      "",
      "## 收盘复盘",
      "",
      "- **记录真实结果** 写下每款商品的询问数、成交数、实际成交规格和成交价。没有询问也要记录。",
      "- **核算真实损耗** 用实际采购成本重算毛利，并记录交付失败、退款、补发和售后耗时。",
      "- **决定明天动作** 只有真实毛利为正、交付稳定并且货源仍可复核时才扩大。其余商品维持小量或暂停。",
      ...relatedIndustrySection(industryCandidates, officialProducts),
      "",
      `<!-- opportunity-replay: ${JSON.stringify(metadata)} -->`,
    ].join("\n"),
    selectedSignals,
    coreProducts,
    pausedProducts,
    anomalousProducts,
    oldMerchantActions,
    allowedSupplyUrls,
  };
}
