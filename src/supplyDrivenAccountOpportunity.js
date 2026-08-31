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
const CATEGORY_NAMES = new Map([
  ["chatgpt", "ChatGPT"],
  ["claude", "Claude"],
  ["gemini", "Gemini"],
  ["grok", "Grok"],
  ["ai-coding", "AI 编程"],
  ["ai-creative", "AI 创作与效率"],
  ["email", "邮箱"],
  ["verification", "账号验证辅助"],
  ["social", "社媒与账号"],
  ["api-payment", "API 与支付"],
  ["other", "其他"],
]);

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

function formatMoney(value) {
  return Number.isFinite(value) ? `¥${Number(value).toFixed(2)}` : "暂无可购买报价";
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

export function selectMerchantCoreProducts(snapshot, limit = 8) {
  const products = snapshotProducts(snapshot).filter(
    (product) => product.availableOfferCount > 0 && CORE_CATEGORY_IDS.includes(product.categoryId),
  );
  const selected = [];
  const seen = new Set();
  const add = (product) => {
    if (!product?.slug || seen.has(product.slug) || selected.length >= limit) return;
    seen.add(product.slug);
    selected.push(product);
  };

  for (const categoryId of CORE_CATEGORY_IDS) {
    const quota = categoryId === "chatgpt" ? 3 : 1;
    products.filter((product) => product.categoryId === categoryId).slice(0, quota).forEach(add);
  }
  products.forEach(add);
  return selected;
}

export function selectPausedProducts(snapshot, limit = 5) {
  return snapshotProducts(snapshot)
    .filter((product) => product.availableOfferCount === 0)
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
  return popularityScore(signal) + kindScore - sortPenalty;
}

export function selectDailySupplySignals(snapshot, limit = 4) {
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

    return /账号|账户|订阅|价格|额度|政策|地区|登录|注册|验证|接码|account|subscription|plan|price|quota|limit|policy|region|login|verification|email/.test(candidateText);
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
    "## 官方变化与经营影响",
    "",
    `[${label}](${source.url})与今天备货表中的商品直接相关。先核对它是否改变套餐、额度、地区、登录或售后说明，再更新商品页和客服话术。库存、金额和可购买报价仍以货源快照为准。`,
  ];
}

function coreProductAction(product) {
  if (product.availableOfferCount >= 100) {
    return "可以复核接单，公开报价密集。先比规格、更新时间和售后，避免只靠低价竞争。";
  }
  if (product.availableOfferCount >= 6) {
    return "可以复核接单。采购前确认原始货源仍有库存，再按自己的保本价报价。";
  }
  return "只做小量验证，公开可买报价较少。先准备同类替代，再决定接单量。";
}

function coreProductMarkdown(product) {
  const warranty = Number.isFinite(product.warrantyPrice)
    ? `明确质保参考 ${formatMoney(product.warrantyPrice)}`
    : "暂无明确质保参考";
  return [
    `- **[${cleanArticleText(product.name, 100)}](${product.productUrl})**`,
    `  - 进货参考 ${formatMoney(product.lowestPrice)}，${warranty}，可购买报价 ${product.availableOfferCount} 条。`,
    `  - 今日动作 ${coreProductAction(product)}`,
    `  - [核算这款商品的保本价](${product.profitCalculatorUrl})`,
  ].join("\n");
}

function actionMarkdown(signal) {
  const product = signal.product;
  return [
    `### ${cleanArticleText(signal.label, 60)} ${cleanArticleText(product.name, 120)}`,
    "",
    `- **异动证据** [打开 ${cleanArticleText(product.name, 100)} 标准商品页](${product.productUrl})。${cleanArticleText(signal.evidence)}`,
    `- **采购动作** ${cleanArticleText(signal.sellerAction)}`,
    `- **报价动作** 用[利润计算器](${product.profitCalculatorUrl})重新填写进货、支付、退款损耗、售后和获客成本。实际成交价低于保本价时停止接单。`,
    `- **售后检查** ${cleanArticleText(signal.buyerAction)}`,
    `- **停止条件** ${cleanArticleText(signal.stopCondition)}`,
  ].join("\n");
}

function categoryMarketMarkdown(category, products) {
  const categoryName = CATEGORY_NAMES.get(category.id) || category.name;
  const leaders = products
    .filter((product) => product.categoryId === category.id && product.availableOfferCount > 0)
    .sort(productOrder);
  const leader = leaders[0];
  const leadText = category.id === "verification"
    ? "仅作货源规模观察，不进入本期推荐清单。"
    : leader
      ? `先看[${cleanArticleText(leader.name, 100)}](${leader.productUrl})。`
      : "当前没有可购买代表商品，暂停新增接单。";
  return `- **${cleanArticleText(categoryName, 80)}** ${category.productCount} 个标准商品，${category.availableProductCount} 个可购买，可购买报价 ${category.availableOfferCount} 条，最低参考 ${formatMoney(category.lowestPrice)}。${leadText}`;
}

function pausedProductMarkdown(product, products) {
  const replacement = products
    .filter((item) => item.categoryId === product.categoryId && item.availableOfferCount > 0)
    .sort(productOrder)[0];
  const replacementText = replacement
    ? `可以改看同类的[${cleanArticleText(replacement.name, 100)}](${replacement.productUrl})，两者规格不一定相同，接单前重新核对。`
    : "当前没有可验证的同类替代，继续暂停新增接单。";
  return `- **[${cleanArticleText(product.name, 100)}](${product.productUrl})** 当前可购买报价 0 条。暂停按旧库存新增接单。${replacementText}`;
}

export function buildSupplyDrivenAccountOpportunityMarkdown({
  dateStr,
  snapshot,
  industryCandidates = [],
}) {
  const products = snapshotProducts(snapshot);
  const coreProducts = selectMerchantCoreProducts(snapshot, 8);
  const pausedProducts = selectPausedProducts(snapshot, 5);
  const selectedSignals = selectDailySupplySignals(snapshot, 4);
  if (!coreProducts.length) throw new Error("no usable merchant products for the daily");
  if (!selectedSignals.length) throw new Error("no usable supply signals for the daily");
  const lead = coreProducts[0];
  const stats = snapshot.stats;
  const changeCount = stats.recentChangeCountCapped
    ? `至少 ${stats.recentChangeCount} 条，接口只取最新 ${stats.recentChangeCount} 条`
    : `${stats.recentChangeCount} 条`;
  const categories = [...(snapshot.categories || [])]
    .filter((category) => category?.id && category?.name)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.id) - CATEGORY_ORDER.indexOf(b.id));
  const metadata = {
    entity: `supply:${lead.slug}:merchant-daily`,
    businessModel: "supply-merchant-daily-v2",
    deliveryType: "merchant-operating-sheet",
    commercialSignature: `supply:merchant:${lead.slug}:${dateStr}`,
    offerFamily: `supply:${lead.slug}`,
    preferredLane: "account",
  };
  const officialProducts = [...new Map([
    ...coreProducts,
    ...selectedSignals.map((signal) => signal.product),
  ].map((product) => [product.slug, product])).values()];

  return {
    markdown: [
      "## 今日经营判断",
      "",
      `- **货源状态** 本次快照生成于 ${formatShanghaiTime(snapshot.generatedAt)}，最近有效货源观察记录于 ${formatShanghaiTime(snapshot.latestObservedAt)}。货源雷达收录 ${stats.productCount} 个标准商品，其中 ${stats.availableProductCount} 个当前存在可购买报价。`,
      `- **接单方向** 今天先复核 ${cleanArticleText(lead.name, 120)}，再按核心商品备货表逐项处理。备货表只表示当前有公开可买报价，不代表销量或需求。`,
      "- **停止条件** 商品规格、交付、登录方式、质保或退款边界没有核对清楚，原始货源失效，或者实际成交价低于保本价时停止接单。",
      "",
      "## 今日经营看板",
      "",
      `数据来自[爱窝啦·货源雷达实时商机](${snapshot.source})，所有数字属于同一次快照。`,
      "",
      `- **标准商品** ${stats.productCount} 个，用来统一跨站商品名称和规格入口。`,
      `- **当前可买** ${stats.availableProductCount} 个，完全缺货商品单独放入暂停清单。`,
      `- **公开报价** ${stats.availableOfferCount} 条，只代表可比较的公开货源，不代表销量。`,
      `- **货源异动** 最近 24 小时 ${changeCount}，只采用连续快照能够确认的变化。`,
      `- **低供给观察** ${stats.lowSupplyProductCount} 个，报价少也可能来自需求不足，先小量验证。`,
      "",
      "## 核心商品备货表",
      "",
      "这份清单按平台顺序、当前是否有货和站内商品顺序选出。金额是进货参考，卖家仍需核对具体账号形态、期限、登录和质保。",
      "",
      coreProducts.map(coreProductMarkdown).join("\n"),
      "",
      "## 今日异动与补货",
      "",
      selectedSignals.map(actionMarkdown).join("\n\n"),
      "",
      "## 平台货源地图",
      "",
      categories.map((category) => categoryMarketMarkdown(category, products)).join("\n"),
      "",
      "## 暂停接单与同类替代",
      "",
      pausedProducts.length
        ? pausedProducts.map((product) => pausedProductMarkdown(product, products)).join("\n")
        : "当前快照中的标准商品都至少有 1 条可购买报价。库存仍会变化，付款和接单前要再次打开标准商品页复核。",
      "",
      "## 报价与利润纪律",
      "",
      "- **规格先对齐** 售卖规格与进货规格一致以后再比较金额。日卡、共享、镜像、代充、成品号和不同质保不能混算。",
      `- **成本填完整** 从[${cleanArticleText(lead.name, 100)} 利润计算器](${lead.profitCalculatorUrl})开始，把进货、支付、退款损耗、售后和获客成本全部填入。`,
      "- **质保单独核** 最低进货参考与明确质保参考相差较大时，先查交付和退款边界，不直接按最低价接带质保订单。",
      "- **保本线要执行** 用自己的真实成交价比较保本价。实际成交价低于保本价，或者只能依靠不清楚的规格压价时停止接单。",
      "",
      "## 今日执行单",
      "",
      "- **上架前** 核对商品名、账号形态、期限、可用端、登录方式、验证方式、交付时间、质保和退款说明。",
      `- **采购前** 重新打开[${cleanArticleText(lead.name, 100)} 标准商品页](${lead.productUrl})和原始货源，确认库存与页面说明仍然有效。`,
      "- **收盘后** 记录每款商品的真实询问、成交规格、成交价、交付失败和退款原因，明天再决定扩大、减少或暂停。",
      ...relatedIndustrySection(industryCandidates, officialProducts),
      "",
      `<!-- opportunity-replay: ${JSON.stringify(metadata)} -->`,
    ].join("\n"),
    selectedSignals,
    coreProducts,
    pausedProducts,
    categories,
  };
}

export { CATEGORY_NAMES };
