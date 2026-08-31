import { classifyOpportunityEvidence } from "./opportunityEvidence.js";

const OPPORTUNITY_KINDS = new Set(["restock", "price_drop", "supply_gap"]);
const RISK_KINDS = new Set(["stockout", "price_rise", "crowded"]);

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

export function selectDailySupplySignals(snapshot, limit = 3) {
  const candidates = [...(snapshot?.signals || [])]
    .filter((signal) => signal?.product?.slug && signal?.product?.productUrl)
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

function candidateMatchesSignals(candidate, signals) {
  const candidateText = [
    candidate?.label,
    candidate?.entityKey,
    ...(candidate?.supportingItems || []).flatMap((item) => [item?.title, item?.description, item?.source]),
  ].join(" ").toLowerCase();
  return signals.some((signal) => {
    const productText = `${signal.product.name} ${signal.product.platform}`.toLowerCase();
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

function relatedIndustryLine(candidates, signals) {
  const candidate = (candidates || []).find((item) => candidateMatchesSignals(item, signals));
  const source = candidate?.supportingItems?.find((item) => {
    try {
      return new URL(item?.url).protocol === "https:" &&
        classifyOpportunityEvidence(item, item?.type).isPrimary;
    } catch {
      return false;
    }
  });
  if (!candidate || !source) {
    return "今天没有找到与上述商品直接对应、且证据足够的新行业变化。日报以实时货源为主，不用无关新闻填充。";
  }
  const label = cleanArticleText(source.title || source.source || "行业来源", 120)
    .replace(/[\[\]()]/g, "");
  return `[${label}](${source.url})与今天选中的货源直接相关。这条材料只用于核对商品说明和售后边界，库存与价格仍以货源快照为准。`;
}

function actionMarkdown(signal) {
  const product = signal.product;
  const warranty = Number.isFinite(product.warrantyPrice)
    ? `明确质保报价最低 ${formatMoney(product.warrantyPrice)}`
    : "暂无明确质保价";
  return [
    `### ${cleanArticleText(signal.label, 60)} ${cleanArticleText(product.name, 120)}`,
    "",
    `- **货源证据** [打开 ${cleanArticleText(product.name, 100)}标准商品页](${product.productUrl})。${cleanArticleText(signal.evidence)}`,
    `- **库存与价格** 当前最低进货参考 ${formatMoney(product.lowestPrice)}，${warranty}，可购买报价 ${product.availableOfferCount} 条。快照观察时间 ${formatShanghaiTime(signal.observedAt || product.updatedAt)}。`,
    `- **买家怎么选** ${cleanArticleText(signal.buyerAction)}`,
    `- **卖家今天做** ${cleanArticleText(signal.sellerAction)}`,
    `- **利润怎么核** 把 ${formatMoney(product.lowestPrice)} 带入[利润计算器](${product.profitCalculatorUrl})，再填写支付费、退款损耗、售后和获客成本。保本价高于实际成交价时停止接单。`,
    `- **风险与停止** ${cleanArticleText(signal.stopCondition)}`,
  ].join("\n");
}

export function buildSupplyDrivenAccountOpportunityMarkdown({
  dateStr,
  snapshot,
  industryCandidates = [],
}) {
  const selectedSignals = selectDailySupplySignals(snapshot, 3);
  if (!selectedSignals.length) throw new Error("no usable supply signals for the daily");
  const lead = selectedSignals[0];
  const stats = snapshot.stats;
  const changeCount = stats.recentChangeCountCapped
    ? `至少 ${stats.recentChangeCount} 条，接口只取最新 ${stats.recentChangeCount} 条`
    : `${stats.recentChangeCount} 条`;
  const metadata = {
    entity: `supply:${lead.product.slug}:${lead.kind}`,
    businessModel: "supply-snapshot",
    deliveryType: "inventory-action",
    commercialSignature: `supply:${lead.kind}:${lead.product.slug}:${dateStr}`,
    offerFamily: `supply:${lead.product.slug}`,
    preferredLane: "account",
  };

  return {
    markdown: [
      "## 今日货源结论",
      "",
      `- **快照** 本次快照生成于 ${formatShanghaiTime(snapshot.generatedAt)}，最近有效货源变化记录于 ${formatShanghaiTime(snapshot.latestObservedAt)}，数据来自[爱窝啦·货源雷达实时商机](${snapshot.source})。`,
      `- **卖家动作** 今天先核验 ${cleanArticleText(lead.product.name, 120)}的规格、交付和售后，再决定小量采购、继续接单或暂停。`,
      "- **最大风险** 最低价可能对应日卡、镜像、反代或短质保商品。规格没有对齐时，任何价差和利润计算都没有参考价值。",
      "",
      "## 实时货源盘面",
      "",
      `本次快照生成于 ${formatShanghaiTime(snapshot.generatedAt)}，最近有效货源变化记录于 ${formatShanghaiTime(snapshot.latestObservedAt)}。货源雷达收录 ${stats.productCount} 个标准商品，其中 ${stats.availableProductCount} 个存在可购买报价。当前可购买报价共 ${stats.availableOfferCount} 条，最近 24 小时有效异动 ${changeCount}，另有 ${stats.lowSupplyProductCount} 个低供给观察商品。渠道数只说明可比较的公开报价数量，不代表销量、需求或交付稳定性。`,
      "",
      "## 今日可执行货源",
      "",
      selectedSignals.map(actionMarkdown).join("\n\n"),
      "",
      "## 行业信号",
      "",
      relatedIndustryLine(industryCandidates, selectedSignals),
      "",
      "## 买家避坑",
      "",
      "- 最低价经常对应不同规格。先核对原始商品名、可用端、登录方式、接码状态、质保时长和退款条件。",
      "- 库存会在两次快照之间变化。付款前重新打开标准商品页和原始渠道，过期截图不能证明现在仍有货。",
      "- 报价多只表示方便比价。选择渠道时还要看更新时间、交付说明和售后边界，不能把渠道数当成销量或可靠性。",
      "",
      "## 今日三步",
      "",
      `- **今天核验** 打开[${cleanArticleText(lead.product.name, 100)}标准商品页](${lead.product.productUrl})，核对规格并复核当前库存。`,
      `- **今天算账** 用[利润计算器](${lead.product.profitCalculatorUrl})填写进货、支付、退款、售后和获客成本，算出自己的保本价。`,
      "- **今天记录** 记录真实询问、成交规格、交付失败和退款原因。没有询问、利润不足或货源不稳时停止放大。",
      "",
      `<!-- opportunity-replay: ${JSON.stringify(metadata)} -->`,
    ].join("\n"),
    selectedSignals,
  };
}
