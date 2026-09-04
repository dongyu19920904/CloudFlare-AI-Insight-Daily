import test from "node:test";
import assert from "node:assert/strict";

import {
  enrichSnapshotWithVerifiedSources,
  loadSupplyOpportunitySnapshot,
  parseSupplyOpportunitySnapshot,
} from "../src/supplyOpportunitySnapshot.js";

function payload(overrides = {}) {
  return {
    schemaVersion: 1,
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
      {
        id: "restock:chatgpt-plus",
        kind: "restock",
        tone: "opportunity",
        label: "补货恢复",
        title: "ChatGPT Plus 出现可购买货源",
        evidence: "库存状态 out_of_stock 到 in_stock",
        buyerAction: "核对规格。",
        sellerAction: "重新算成本。",
        stopCondition: "没有利润就停止。",
        observedAt: "2026-08-31T06:35:00Z",
        sourceUrl: "https://example.com/offer",
        product: {
          slug: "chatgpt-plus",
          name: "ChatGPT Plus 试用订阅",
          platform: "ChatGPT",
          lowestPrice: 3.3,
          warrantyPrice: 44,
          availableOfferCount: 220,
          updatedAt: "2026-08-31T06:35:00Z",
          sortOrder: 1,
          platformSortOrder: 1,
          productUrl: "https://supply.aivora.cn/card-products/chatgpt-plus",
          profitCalculatorUrl: "https://supply.aivora.cn/profit-calculator?product=ChatGPT+Plus&cost=3.30",
        },
      },
    ],
    categories: [],
    ...overrides,
  };
}

function merchantProduct(overrides = {}) {
  return {
    slug: "chatgpt-plus",
    name: "ChatGPT Plus 正价代充",
    platform: "ChatGPT",
    categoryId: "chatgpt",
    categoryName: "ChatGPT",
    lowestPrice: 111,
    warrantyPrice: 112.11,
    availableOfferCount: 220,
    updatedAt: "2026-08-31T06:35:00Z",
    sortOrder: 1001,
    platformSortOrder: 20,
    productUrl: "https://supply.aivora.cn/card-products/chatgpt-plus",
    profitCalculatorUrl: "https://supply.aivora.cn/profit-calculator?product=ChatGPT+Plus&cost=111.00",
    ...overrides,
  };
}

test("parses a fresh bounded supply snapshot", () => {
  const snapshot = parseSupplyOpportunitySnapshot(payload(), {
    now: new Date("2026-08-31T06:45:00Z"),
  });
  assert.equal(snapshot.ageMinutes, 5);
  assert.equal(snapshot.observationAgeMinutes, 10);
  assert.equal(snapshot.stats.availableOfferCount, 3349);
  assert.equal(snapshot.signals[0].product.slug, "chatgpt-plus");
  assert.equal(snapshot.products[0].categoryId, "chatgpt");
});

test("counts distinct current source names without treating offer rows as sources", async () => {
  const parsed = parseSupplyOpportunitySnapshot(payload({
    schemaVersion: 2,
    products: [merchantProduct()],
  }), { now: new Date("2026-08-31T06:45:00Z") });
  const enriched = await enrichSnapshotWithVerifiedSources(parsed, {
    now: new Date("2026-08-31T06:45:00Z"),
    fetchImpl: async () => new Response(JSON.stringify({
      items: [
        { status: "in_stock", price: 111, channel: "货源甲", originalName: "ChatGPT Plus 菲区代充 1个月", url: "https://one.example/item" },
        { status: "in_stock", price: 112, channel: "货源甲", originalName: "ChatGPT Plus 菲区充值 1个月", url: "https://one.example/item-2" },
        { status: "in_stock", price: 113, channel: "货源乙", originalName: "ChatGPT Plus 菲律宾充值 1个月", url: "https://two.example/item" },
        { status: "out_of_stock", price: 80, channel: "货源丙", originalName: "ChatGPT Plus 菲区代充 1个月", url: "https://three.example/item" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }),
  });

  assert.equal(enriched.products[0].verifiedSourceCount, 2);
  assert.deepEqual(enriched.products[0].verifiedSourceNames, ["货源甲", "货源乙"]);
  assert.equal(enriched.products[0].verifiedSpecLabel, "代充 · 1个月 · 菲律宾");
  assert.equal(enriched.signals[0].product.verifiedSourceCount, 2);
});

test("parses the V2 merchant product board while keeping V1 compatibility", () => {
  const v2 = parseSupplyOpportunitySnapshot(payload({
    schemaVersion: 2,
    products: [
      merchantProduct(),
      merchantProduct({
        slug: "claude-pro",
        name: "Claude Pro",
        platform: "Claude",
        categoryId: "claude",
        categoryName: "Claude",
        productUrl: "https://supply.aivora.cn/card-products/claude-pro",
      }),
    ],
  }), { now: new Date("2026-08-31T06:45:00Z") });

  assert.equal(v2.schemaVersion, 2);
  assert.equal(v2.products.length, 2);
  assert.equal(v2.products[1].categoryName, "Claude");
  assert.throws(
    () => parseSupplyOpportunitySnapshot(payload({ schemaVersion: 2, products: [] }), {
      now: new Date("2026-08-31T06:45:00Z"),
    }),
    /no usable merchant products/,
  );
});

test("drops merchant products with untrusted product links", () => {
  assert.throws(
    () => parseSupplyOpportunitySnapshot(payload({
      schemaVersion: 2,
      products: [merchantProduct({ productUrl: "https://example.com/card-products/chatgpt-plus" })],
    }), { now: new Date("2026-08-31T06:45:00Z") }),
    /no usable merchant products/,
  );
});

test("rejects stale and untrusted supply snapshots", () => {
  assert.throws(
    () => parseSupplyOpportunitySnapshot(payload(), { now: new Date("2026-08-31T09:00:00Z") }),
    /stale/,
  );
  assert.throws(
    () => parseSupplyOpportunitySnapshot(payload({ source: "https://example.com/opportunities" }), {
      now: new Date("2026-08-31T06:45:00Z"),
    }),
    /source is not allowed/,
  );
});

test("loads JSON with timeout and response bounds without throwing into the daily", async () => {
  let redirectMode = null;
  const ok = await loadSupplyOpportunitySnapshot({}, {
    now: new Date("2026-08-31T06:45:00Z"),
    fetchImpl: async (_url, options) => {
      redirectMode = options.redirect;
      return new Response(JSON.stringify(payload()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const failed = await loadSupplyOpportunitySnapshot({}, {
    now: new Date("2026-08-31T06:45:00Z"),
    fetchImpl: async () => new Response("not json", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }),
  });

  assert.equal(ok.error, null);
  assert.equal(redirectMode, "manual");
  assert.equal(ok.snapshot.signals.length, 1);
  assert.equal(failed.snapshot, null);
  assert.match(failed.error, /not JSON/);
});
