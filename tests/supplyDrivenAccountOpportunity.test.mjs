import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSupplyDrivenAccountOpportunityMarkdown,
  selectDailySupplySignals,
  selectMerchantCoreProducts,
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
      warrantyPrice: price + 20,
      availableOfferCount: count,
      updatedAt: "2026-08-31T06:35:00Z",
      sortOrder: 1,
      platformSortOrder: 1,
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
    warrantyPrice: price === null ? null : price + 20,
    availableOfferCount: count,
    updatedAt: "2026-08-31T06:35:00Z",
    sortOrder,
    platformSortOrder: 1,
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
  ],
  categories: [
    { id: "chatgpt", name: "ChatGPT", productCount: 3, availableProductCount: 3, availableOfferCount: 677, lowestPrice: 3.3 },
    { id: "claude", name: "Claude", productCount: 2, availableProductCount: 1, availableOfferCount: 49, lowestPrice: 120 },
    { id: "gemini", name: "Gemini", productCount: 1, availableProductCount: 1, availableOfferCount: 233, lowestPrice: 2.58 },
    { id: "grok", name: "Grok", productCount: 1, availableProductCount: 1, availableOfferCount: 80, lowestPrice: 20 },
    { id: "ai-coding", name: "AI 编程", productCount: 1, availableProductCount: 1, availableOfferCount: 15, lowestPrice: 30 },
    { id: "ai-creative", name: "AI 创作与效率", productCount: 1, availableProductCount: 1, availableOfferCount: 7, lowestPrice: 18 },
  ],
};

test("selects a popular opportunity and a risk instead of the first three source rows", () => {
  const selected = selectDailySupplySignals(snapshot);
  assert.equal(selected[0].product.slug, "chatgpt-plus");
  assert.equal(selected[1].product.slug, "chatgpt-pro");
  assert.equal(selected.length, 4);
});

test("builds an available cross-platform merchant board and isolates unavailable products", () => {
  const selected = selectMerchantCoreProducts(snapshot);
  assert.equal(selected.length, 8);
  assert.equal(selected[0].slug, "chatgpt-plus-recharge");
  assert.deepEqual(selected.slice(0, 3).map((item) => item.categoryId), ["chatgpt", "chatgpt", "chatgpt"]);
  assert.ok(new Set(selected.map((item) => item.categoryId)).size >= 6);
  assert.ok(selected.every((item) => item.availableOfferCount > 0));
  assert.deepEqual(selectPausedProducts(snapshot).map((item) => item.slug), ["claude-paused"]);
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

  assert.match(result.markdown, /## 今日经营看板/);
  assert.match(result.markdown, /## 核心商品备货表/);
  assert.match(result.markdown, /## 平台货源地图/);
  assert.match(result.markdown, /## 暂停接单与同类替代/);
  assert.match(result.markdown, /公开报价[\s\S]*3349 条/);
  assert.match(result.markdown, /card-products\/chatgpt-plus/);
  assert.match(result.markdown, /card-products\/claude-pro/);
  assert.match(result.markdown, /claude-paused[\s\S]*当前可购买报价 0 条/);
  assert.match(result.markdown, /profit-calculator/);
  assert.match(result.markdown, /接口只取最新 100 条/);
  assert.doesNotMatch(result.markdown, /## 官方变化与经营影响/);
  assert.doesNotMatch(result.markdown, /Grok 用户转述/);
  const visible = result.markdown.replace(/\]\(https?:\/\/[^)]+\)/g, "]");
  assert.doesNotMatch(visible, /[：—–]/);
  assert.doesNotMatch(visible, /不是.{0,50}而是|并非.{0,50}而是/);
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
  assert.match(result.markdown, /## 官方变化与经营影响/);
});
