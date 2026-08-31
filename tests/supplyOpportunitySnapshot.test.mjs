import test from "node:test";
import assert from "node:assert/strict";

import {
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

test("parses a fresh bounded supply snapshot", () => {
  const snapshot = parseSupplyOpportunitySnapshot(payload(), {
    now: new Date("2026-08-31T06:45:00Z"),
  });
  assert.equal(snapshot.ageMinutes, 5);
  assert.equal(snapshot.observationAgeMinutes, 10);
  assert.equal(snapshot.stats.availableOfferCount, 3349);
  assert.equal(snapshot.signals[0].product.slug, "chatgpt-plus");
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
  const ok = await loadSupplyOpportunitySnapshot({}, {
    now: new Date("2026-08-31T06:45:00Z"),
    fetchImpl: async () => new Response(JSON.stringify(payload()), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  const failed = await loadSupplyOpportunitySnapshot({}, {
    now: new Date("2026-08-31T06:45:00Z"),
    fetchImpl: async () => new Response("not json", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }),
  });

  assert.equal(ok.error, null);
  assert.equal(ok.snapshot.signals.length, 1);
  assert.equal(failed.snapshot, null);
  assert.match(failed.error, /not JSON/);
});
