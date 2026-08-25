import test from "node:test";
import assert from "node:assert/strict";

import {
  AIVORA_BRAND_NAME,
  AIVORA_HOME_URL,
  buildAivoraOpportunityLinkIntent,
  buildAivoraOpportunityLinkPolicy,
  insertOpportunityAivoraLink,
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

test("Aivora link intent is limited to directly related account or subscription opportunities", () => {
  const unrelated = buildAivoraOpportunityLinkIntent([
    {
      label: "小餐饮门店数据整理服务",
      productAngle: "交付一份清洗后的表格",
    },
  ]);
  const related = buildAivoraOpportunityLinkIntent([
    {
      label: "ChatGPT 订阅迁移验证",
      productAngle: "核对账号入口和续费边界",
      preferredLane: "account",
    },
  ]);
  const serviceOnly = buildAivoraOpportunityLinkIntent([
    {
      label: "Claude 开源项目代配置",
      productAngle: "交付一次跑通测试和说明",
      preferredLane: "service",
    },
  ]);

  assert.equal(unrelated.eligible, false);
  assert.equal(related.eligible, true);
  assert.equal(serviceOnly.eligible, false);
  assert.ok(related.tokens.includes("chatgpt"));
});

test("verified sitemap product URL can be inserted once by deterministic code", () => {
  const productUrl = "https://www.aivora.cn/products/chatgpt-current";
  const policy = buildAivoraOpportunityLinkPolicy({
    sitemapXml: `<?xml version="1.0"?><urlset><url><loc>${AIVORA_HOME_URL}</loc></url><url><loc>${productUrl}</loc></url></urlset>`,
    homepageHtml: `<link rel="canonical" href="${AIVORA_HOME_URL}">`,
    homepageStatus: 200,
    verifiedPages: [{ url: productUrl, status: 200, canonical: productUrl }],
    suggestedUrl: productUrl,
  });
  const input = `## 今日主推
### 验证 ChatGPT 订阅迁移
- **风险与停止：** 中；许可边界不清就停。

## 本周小试
今天没有第二个达到证据门槛的机会，不凑数。`;
  const inserted = insertOpportunityAivoraLink(input, policy);

  assert.equal(inserted.inserted, true);
  assert.match(inserted.markdown, new RegExp(`\\[${AIVORA_BRAND_NAME}\\]`));
  assert.equal(
    [...inserted.markdown.matchAll(/https:\/\/www\.aivora\.cn\//g)].length,
    1
  );
});

