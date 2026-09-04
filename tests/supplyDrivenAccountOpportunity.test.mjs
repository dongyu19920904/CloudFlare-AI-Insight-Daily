import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSupplyDrivenAccountOpportunityMarkdown,
  resolveMerchantCostReference,
  selectAnomalousPriceProducts,
  selectDailySupplySignals,
  selectMerchantCoreProducts,
  selectNewSellerProduct,
  selectPausedProducts,
} from "../src/supplyDrivenAccountOpportunity.js";

function signal({ kind, name, slug, tone = "opportunity", price = 10, count = 5 }) {
  const identity = `${name} ${slug}`.toLowerCase();
  const categoryId = identity.includes("chatgpt") ? "chatgpt"
    : identity.includes("claude") ? "claude"
      : identity.includes("gemini") ? "gemini"
        : identity.includes("grok") ? "grok"
          : identity.includes("cursor") ? "ai-coding"
            : identity.includes("suno") ? "ai-creative"
              : "other";
  return {
    id: `${kind}:${slug}`,
    kind,
    tone,
    label: kind === "stockout" ? "断货风险" : "补货恢复",
    title: `${name} 有异动`,
    evidence: "库存状态，out_of_stock → in_stock；连续快照已经确认。",
    buyerAction: "打开详情比较规格。",
    sellerAction: "核验交付以后重新计算成本。",
    stopCondition: "交付不清楚或没有利润时停止。",
    observedAt: "2026-08-31T06:35:00Z",
    product: {
      slug,
      name,
      platform: name.split(" ")[0],
      categoryId,
      categoryName: categoryId,
      lowestPrice: price,
      warrantyPrice: price * 1.2,
      availableOfferCount: count,
      updatedAt: "2026-08-31T06:35:00Z",
      sortOrder: 1,
      platformSortOrder: 1,
      verifiedSourceCount: 2,
      verifiedSourceNames: ["货源甲", "货源乙"],
      verifiedSpecLabel: "代充 · 1个月 · 菲律宾",
      verifiedOfferCount: 3,
      verifiedReferencePrice: price,
      sourceVerificationAt: "2026-08-31T06:40:00Z",
      productUrl: `https://supply.aivora.cn/card-products/${slug}`,
      profitCalculatorUrl: `https://supply.aivora.cn/profit-calculator?product=${slug}&cost=${price}`,
    },
  };
}

function product({ name, slug, categoryId, price, count, sortOrder = 1 }) {
  return {
    slug,
    name,
    platform: categoryId,
    categoryId,
    categoryName: categoryId,
    lowestPrice: price,
    warrantyPrice: price === null ? null : price * 1.2,
    availableOfferCount: count,
    updatedAt: "2026-08-31T06:35:00Z",
    sortOrder,
    platformSortOrder: 1,
    verifiedSourceCount: 2,
    verifiedSourceNames: ["货源甲", "货源乙"],
    verifiedSpecLabel: "代充 · 1个月 · 菲律宾",
    verifiedOfferCount: 3,
    verifiedReferencePrice: price,
    sourceVerificationAt: "2026-08-31T06:40:00Z",
    productUrl: `https://supply.aivora.cn/card-products/${slug}`,
    profitCalculatorUrl: `https://supply.aivora.cn/profit-calculator?product=${slug}&cost=${price ?? ""}`,
  };
}

const snapshot = {
  schemaVersion: 2,
  source: "https://supply.aivora.cn/opportunities",
  generatedAt: "2026-08-31T06:40:00Z",
  latestObservedAt: "2026-08-31T06:35:00Z",
  stats: {
    productCount: 49,
    availableProductCount: 47,
    availableOfferCount: 3349,
    recentChangeCount: 100,
    recentChangeCountCapped: true,
    lowSupplyProductCount: 7,
  },
  signals: [
    signal({ kind: "restock", name: "Gemini Pro", slug: "gemini-pro", price: 2.58, count: 233 }),
    signal({ kind: "restock", name: "ChatGPT 普号", slug: "chatgpt-free", price: 0.2, count: 169 }),
    signal({ kind: "stockout", name: "ChatGPT Pro 20x", slug: "chatgpt-pro", tone: "warning", price: 179, count: 239 }),
    signal({ kind: "restock", name: "ChatGPT Plus 试用订阅", slug: "chatgpt-plus", price: 3.3, count: 220 }),
  ],
  products: [
    product({ name: "ChatGPT Plus 正价代充", slug: "chatgpt-plus-recharge", categoryId: "chatgpt", price: 111, count: 218, sortOrder: 1001 }),
    product({ name: "ChatGPT Plus 试用订阅", slug: "chatgpt-plus", categoryId: "chatgpt", price: 3.3, count: 220, sortOrder: 1002 }),
    product({ name: "ChatGPT Pro 20x", slug: "chatgpt-pro", categoryId: "chatgpt", price: 179, count: 239, sortOrder: 1003 }),
    product({ name: "Claude Pro", slug: "claude-pro", categoryId: "claude", price: 120, count: 49 }),
    product({ name: "Claude 暂停套餐", slug: "claude-paused", categoryId: "claude", price: null, count: 0, sortOrder: 2 }),
    product({ name: "Gemini Pro", slug: "gemini-pro", categoryId: "gemini", price: 2.58, count: 233 }),
    product({ name: "Grok Super", slug: "grok-super", categoryId: "grok", price: 20, count: 80 }),
    product({ name: "Cursor 账号", slug: "cursor-account", categoryId: "ai-coding", price: 30, count: 15 }),
    product({ name: "Suno 账号", slug: "suno-account", categoryId: "ai-creative", price: 18, count: 7 }),
    product({ name: "OpenAI / ChatGPT 接码", slug: "openai-phone-verification", categoryId: "verification", price: 1, count: 12 }),
  ],
  categories: [
    { id: "chatgpt", name: "ChatGPT", productCount: 3, availableProductCount: 3, availableOfferCount: 677, lowestPrice: 3.3 },
    { id: "claude", name: "Claude", productCount: 2, availableProductCount: 1, availableOfferCount: 49, lowestPrice: 120 },
    { id: "gemini", name: "Gemini", productCount: 1, availableProductCount: 1, availableOfferCount: 233, lowestPrice: 2.58 },
    { id: "grok", name: "Grok", productCount: 1, availableProductCount: 1, availableOfferCount: 80, lowestPrice: 20 },
    { id: "ai-coding", name: "AI 编程", productCount: 1, availableProductCount: 1, availableOfferCount: 15, lowestPrice: 30 },
    { id: "ai-creative", name: "AI 创作与效率", productCount: 1, availableProductCount: 1, availableOfferCount: 7, lowestPrice: 18 },
    { id: "verification", name: "接码与验证", productCount: 1, availableProductCount: 1, availableOfferCount: 12, lowestPrice: 1 },
  ],
};

test("selects a popular opportunity and a risk instead of the first three source rows", () => {
  const selected = selectDailySupplySignals(snapshot);
  assert.equal(selected[0].product.slug, "chatgpt-plus");
  assert.equal(selected[1].product.slug, "chatgpt-pro");
  assert.equal(selected.length, 2);
});

test("keeps verification products out of actionable signals", () => {
  const verificationSignal = signal({
    kind: "restock",
    name: "ChatGPT Plus 接码",
    slug: "chatgpt-plus-verification",
    price: 0.31,
    count: 493,
  });
  verificationSignal.product.categoryId = "verification";
  verificationSignal.product.categoryName = "接码与验证";
  const selected = selectDailySupplySignals({
    ...snapshot,
    signals: [verificationSignal, ...snapshot.signals.slice(0, 3)],
  });

  assert.ok(selected.length >= 2);
  assert.ok(selected.every((item) => item.product.categoryId !== "verification"));
});

test("builds a short merchant board and isolates unavailable products", () => {
  const selected = selectMerchantCoreProducts(snapshot);
  assert.equal(selected.length, 4);
  assert.equal(selected[0].slug, "chatgpt-plus-recharge");
  assert.deepEqual(selected.slice(0, 2).map((item) => item.categoryId), ["chatgpt", "chatgpt"]);
  assert.ok(new Set(selected.map((item) => item.categoryId)).size >= 3);
  assert.ok(selected.every((item) => item.availableOfferCount > 0));
  assert.deepEqual(selectPausedProducts(snapshot).map((item) => item.slug), ["claude-paused"]);
});

test("selects one starter product only when two current sources were verified", () => {
  assert.equal(selectNewSellerProduct(snapshot)?.slug, "chatgpt-plus-recharge");
  const oneSource = {
    ...snapshot,
    products: snapshot.products.map((item) => ({
      ...item,
      verifiedSourceCount: item.availableOfferCount > 0 ? 1 : 0,
      verifiedSourceNames: item.availableOfferCount > 0 ? ["唯一货源"] : [],
    })),
  };
  assert.equal(selectNewSellerProduct(oneSource), null);
  const result = buildSupplyDrivenAccountOpportunityMarkdown({
    dateStr: "2026-09-01",
    snapshot: oneSource,
  });
  assert.equal(result.leadProduct, null);
  assert.match(result.markdown, /今日不建议上新/);
  assert.doesNotMatch(result.markdown, /## 一眼看懂[\s\S]*?两个不同货源站，例如/);
});

test("publishes a pause edition when all core products are unavailable", () => {
  const unavailable = {
    ...snapshot,
    products: snapshot.products.map((item) => ({
      ...item,
      availableOfferCount: ["verification", "other"].includes(item.categoryId) ? item.availableOfferCount : 0,
      lowestPrice: ["verification", "other"].includes(item.categoryId) ? item.lowestPrice : null,
      warrantyPrice: null,
      verifiedSourceCount: 0,
      verifiedSourceNames: [],
      verifiedOfferCount: 0,
      verifiedReferencePrice: null,
    })),
    signals: [],
  };
  const result = buildSupplyDrivenAccountOpportunityMarkdown({ dateStr: "2026-09-01", snapshot: unavailable });
  assert.equal(result.leadProduct, null);
  assert.match(result.markdown, /今日不建议上新/);
  assert.match(result.markdown, /当前可购买报价为 0/);
  assert.match(result.markdown, /今天没有可比较的连续历史快照/);
});

test("isolates an extreme lowest price and uses the warranty reference for merchant math", () => {
  const suspicious = product({
    name: "ChatGPT Plus 正价代充",
    slug: "chatgpt-plus-recharge",
    categoryId: "chatgpt",
    price: 1,
    count: 220,
    sortOrder: 1001,
  });
  suspicious.warrantyPrice = 112.11;
  const irrelevantSuspicious = product({
    name: "OpenAI 手机验证",
    slug: "openai-phone-verification",
    categoryId: "verification",
    price: 1,
    count: 200,
    sortOrder: 9001,
  });
  irrelevantSuspicious.warrantyPrice = 100;
  const riskySnapshot = {
    ...snapshot,
    products: [suspicious, irrelevantSuspicious, ...snapshot.products.slice(1)],
  };

  assert.deepEqual(resolveMerchantCostReference(suspicious), {
    referencePrice: 112.11,
    lowestPrice: 1,
    warrantyPrice: 112.11,
    abnormalLowestPrice: true,
    label: "异常最低价已隔离，暂用明确质保报价",
  });
  assert.deepEqual(selectAnomalousPriceProducts(riskySnapshot).map((item) => item.slug), [
    "chatgpt-plus-recharge",
  ]);

  const result = buildSupplyDrivenAccountOpportunityMarkdown({
    dateStr: "2026-09-01",
    snapshot: riskySnapshot,
  });
  assert.notEqual(result.coreProducts[0].slug, "chatgpt-plus-recharge");
  assert.match(result.markdown, /最低价 ¥1\.00[\s\S]{0,80}已隔离/);
  assert.match(result.markdown, /cost=112\.11/);
  assert.ok(result.allowedSupplyUrls.some((url) => url.includes("cost=112.11")));
  assert.doesNotMatch(result.markdown, /cost=1(?:\.00)?(?:&|\))/);
  assert.match(result.markdown, /今天暂停什么[\s\S]*chatgpt-plus-recharge/);
});

test("builds a factual seller daily and drops unrelated industry news", () => {
  const result = buildSupplyDrivenAccountOpportunityMarkdown({
    dateStr: "2026-08-31",
    snapshot,
    industryCandidates: [{
      label: "Grok API 额度线索",
      supportingItems: [{
        title: "Grok 用户转述",
        description: "Grok Bot 关联 X 账号",
        url: "https://x.com/example/status/1",
      }],
    }],
  });

  assert.match(result.markdown, /## 今天一句话/);
  assert.match(result.markdown, /## 选择你的阅读方式/);
  assert.match(result.markdown, /## 一眼看懂/);
  assert.match(result.markdown, /## 新手今天照着做/);
  assert.match(result.markdown, /## 老商家今天看这三项/);
  assert.match(result.markdown, /## 今天暂停什么/);
  assert.match(result.markdown, /## 数据和判断依据/);
  assert.match(result.markdown, /## 收盘填写结果/);
  assert.doesNotMatch(result.markdown, /## 平台货源地图/);
  assert.doesNotMatch(result.markdown, /接码/);
  assert.match(result.markdown, /公开报价[\s\S]*3349 条/);
  assert.match(result.markdown, /card-products\/chatgpt-plus/);
  assert.match(result.markdown, /card-products\/claude-pro/);
  assert.match(result.markdown, /claude-paused[\s\S]*当前可购买报价为 0/);
  assert.match(result.markdown, /profit-calculator/);
  assert.match(result.markdown, /接口只取最新 100 条/);
  assert.doesNotMatch(result.markdown, /## 官方变化与经营影响/);
  assert.doesNotMatch(result.markdown, /Grok 用户转述/);
  assert.equal(result.coreProducts.length, 4);
  assert.equal(result.oldMerchantActions.length, 3);
  assert.ok(result.selectedSignals.length >= 1 && result.selectedSignals.length <= 3);
  const visible = result.markdown.replace(/\]\(https?:\/\/[^)]+\)/g, "]");
  assert.doesNotMatch(visible, /[—–]/);
  assert.doesNotMatch(visible, /不是.{0,50}而是|并非.{0,50}而是/);
});

test("does not invent price movement without comparable snapshots", () => {
  const noHistory = {
    ...snapshot,
    signals: [signal({ kind: "crowded", name: "ChatGPT Plus 正价代充", slug: "chatgpt-plus-recharge", price: 111, count: 218 })],
  };
  const result = buildSupplyDrivenAccountOpportunityMarkdown({ dateStr: "2026-09-01", snapshot: noHistory });
  assert.equal(result.hasComparableHistory, false);
  assert.match(result.markdown, /今天没有可比较的连续历史快照/);
  assert.doesNotMatch(result.markdown, /出现 \d+(?:\.\d+)?% (?:涨价|降价)/);
});

test("prioritizes stockout and significant price changes for experienced sellers", () => {
  const stockout = signal({ kind: "stockout", name: "ChatGPT Pro 20x", slug: "chatgpt-pro", tone: "warning", price: 179, count: 239 });
  const rise = signal({ kind: "price_rise", name: "Claude Pro", slug: "claude-pro", tone: "warning", price: 120, count: 49 });
  const drop = signal({ kind: "price_drop", name: "Gemini Pro", slug: "gemini-pro", price: 2.58, count: 233 });
  const changed = { ...snapshot, signals: [drop, rise, stockout], products: snapshot.products.filter((item) => item.availableOfferCount > 0) };
  const result = buildSupplyDrivenAccountOpportunityMarkdown({ dateStr: "2026-09-01", snapshot: changed });
  assert.equal(result.hasComparableHistory, true);
  assert.equal(result.oldMerchantActions.length, 3);
  assert.deepEqual(result.oldMerchantActions.map((item) => item.signal?.kind), ["stockout", "price_rise", "price_drop"]);
});

test("does not label a general Codex update as direct ChatGPT Plus supply context", () => {
  const result = buildSupplyDrivenAccountOpportunityMarkdown({
    dateStr: "2026-08-31",
    snapshot,
    industryCandidates: [{
      label: "Codex 产品更新",
      supportingItems: [{
        title: "ChatGPT 用户获得一项 Codex 编程更新",
        description: "OpenAI 介绍新的编程能力。",
        url: "https://example.com/codex-update",
      }],
    }],
  });

  assert.doesNotMatch(result.markdown, /## 官方变化与经营影响/);
  assert.doesNotMatch(result.markdown, /example\.com\/codex-update/);
});

test("keeps a direct primary-source ChatGPT Plus account change as context", () => {
  const result = buildSupplyDrivenAccountOpportunityMarkdown({
    dateStr: "2026-08-31",
    snapshot,
    industryCandidates: [{
      label: "ChatGPT Plus 账号政策更新",
      supportingItems: [{
        title: "ChatGPT Plus subscription account policy update",
        description: "The official page changes a ChatGPT Plus account rule.",
        url: "https://openai.com/chatgpt-plus-account-policy",
        source: "OpenAI official",
      }],
    }],
  });

  assert.match(result.markdown, /openai\.com\/chatgpt-plus-account-policy/);
  assert.match(result.markdown, /\*\*相关官方变化\*\*/);
});
