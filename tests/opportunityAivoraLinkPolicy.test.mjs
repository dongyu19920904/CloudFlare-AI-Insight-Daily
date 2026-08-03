import test from "node:test";
import assert from "node:assert/strict";

import {
  AIVORA_BRAND_NAME,
  AIVORA_HOME_URL,
  buildAivoraOpportunityLinkPolicy,
  sanitizeOpportunityAivoraLinks,
  validateOpportunityAivoraLinks,
} from "../src/opportunityAivoraLinkPolicy.js";

test("Aivora opportunity policy only allows the canonical homepage after sitemap verification", () => {
  const policy = buildAivoraOpportunityLinkPolicy({
    sitemapXml: `<?xml version="1.0"?><urlset><url><loc>https://www.aivora.cn/</loc></url><url><loc>https://www.aivora.cn/products/example</loc></url></urlset>`,
    homepageHtml: `<html><head><link rel="canonical" href="https://www.aivora.cn/"></head></html>`,
    homepageStatus: 200,
  });

  assert.deepEqual(policy.allowedUrls, [AIVORA_HOME_URL]);
  assert.equal(policy.homepageAllowed, true);
});

test("invalid and stale Aivora links are stripped without deleting their text", () => {
  const input = `相关时可看 [旧商品](https://www.aivora.cn/products/expired)，也可访问 [Aivora](https://www.aivora.cn/)。`;
  const result = sanitizeOpportunityAivoraLinks(
    input,
    { allowedUrls: [AIVORA_HOME_URL] },
    { maxLinks: 1 }
  );

  assert.match(result.markdown, /旧商品/);
  assert.doesNotMatch(result.markdown, /products\/expired/);
  assert.match(
    result.markdown,
    new RegExp(`\\[${AIVORA_BRAND_NAME}\\]\\(https:\\/\\/www\\.aivora\\.cn\\/\\)`)
  );
  assert.equal(result.removedCount, 1);
  assert.equal(result.keptCount, 1);
});

test("Aivora opportunity validation rejects non-whitelisted URLs and wrong brand text", () => {
  const result = validateOpportunityAivoraLinks(
    `[爱窝啦](https://www.aivora.cn/products/expired)`,
    { allowedUrls: [AIVORA_HOME_URL] },
    { maxLinks: 1 }
  );

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /实时 sitemap/);
  assert.match(result.issues.join(" | "), /品牌名/);
});

