import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSupplyDrivenAccountOpportunityMarkdown,
  selectDailySupplySignals,
} from "../src/supplyDrivenAccountOpportunity.js";

function signal({ kind, name, slug, tone = "opportunity", price = 10, count = 5 }) {
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

const snapshot = {
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
};

test("selects a popular opportunity and a risk instead of the first three source rows", () => {
  const selected = selectDailySupplySignals(snapshot);
  assert.equal(selected[0].product.slug, "chatgpt-plus");
  assert.equal(selected[1].product.slug, "chatgpt-pro");
  assert.equal(selected.length, 3);
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

  assert.match(result.markdown, /## 实时货源盘面/);
  assert.match(result.markdown, /可购买报价共 3349 条/);
  assert.match(result.markdown, /card-products\/chatgpt-plus/);
  assert.match(result.markdown, /profit-calculator/);
  assert.match(result.markdown, /接口只取最新 100 条/);
  assert.match(result.markdown, /不用无关新闻填充/);
  assert.doesNotMatch(result.markdown, /Grok 用户转述/);
  const visible = result.markdown.replace(/\]\(https?:\/\/[^)]+\)/g, "]");
  assert.doesNotMatch(visible, /[：—–]/);
  assert.doesNotMatch(visible, /不是.{0,50}而是|并非.{0,50}而是/);
});
