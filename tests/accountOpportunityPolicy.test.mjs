import test from "node:test";
import assert from "node:assert/strict";

import { accountOpportunityPlaybook } from "../src/accountOpportunityPlaybook.js";
import {
  assessAccountOpportunityEvidence,
  deriveAccountOpportunityDimensions,
  insertAccountOpportunityAivoraLink,
  normalizeAccountOpportunityObservationMarkdown,
  qualifyAccountOpportunityCandidates,
} from "../src/accountOpportunityUtils.js";

function makeCandidate(overrides = {}) {
  return {
    id: "gpt-account",
    entityKey: "name:chatgpt",
    label: "OpenAI 账号与订阅信号",
    score: 72,
    preferredLane: "account",
    productAngle: "核对套餐和购买边界",
    buyerHint: "正在比较套餐的买家",
    deliveryHint: "官方套餐 FAQ",
    avoidLeadHint: "不要编造价格",
    afterSalesRisk: "中",
    supportingItems: [
      {
        type: "news",
        title: "OpenAI updates ChatGPT subscription quota",
        description: "OpenAI released an update to subscription quota and plan limits",
        source: "OpenAI official",
        url: "https://openai.com/news/subscription-quota-update",
        evidence: {
          tier: "primary",
          isPrimary: true,
          reason: "官方来源",
          independentKey: "openai.com",
        },
      },
    ],
    ...overrides,
  };
}

test("account evidence rejects ordinary model news without an account signal", () => {
  const candidate = makeCandidate({
    supportingItems: [
      {
        type: "news",
        title: "OpenAI releases a new reasoning model",
        description: "The model launched with better benchmark results",
        source: "OpenAI official",
        url: "https://openai.com/news/new-reasoning-model",
        evidence: {
          tier: "primary",
          isPrimary: true,
          reason: "官方来源",
          independentKey: "openai.com",
        },
      },
    ],
  });

  const assessment = assessAccountOpportunityEvidence(candidate);
  assert.equal(assessment.eligible, false);
  assert.match(assessment.gaps.join("\n"), /没有账号、订阅、API、支付、额度/);
});

test("account evidence accepts a primary subscription or quota change", () => {
  const assessment = assessAccountOpportunityEvidence(makeCandidate());

  assert.equal(assessment.eligible, true);
  assert.equal(assessment.officialCount, 1);
  assert.equal(assessment.strength, "中");
});

test("account replay rejects the same product entity from the previous seven days", () => {
  const result = qualifyAccountOpportunityCandidates(
    [makeCandidate()],
    accountOpportunityPlaybook,
    {
      entities: [
        {
          key: "name:chatgpt",
          entity: "name:chatgpt",
          section: "account-opportunity",
          date: "2026-08-04",
        },
      ],
      commercialSignatures: [],
      titles: [],
    }
  );

  assert.equal(result.candidates.length, 0);
  assert.match(result.rejectedCandidates[0].rejectionReasons.join("\n"), /同一产品或项目实体/);
});

test("account observation fallback publishes a weak clue only as observation", () => {
  const result = qualifyAccountOpportunityCandidates(
    [
      makeCandidate({
        supportingItems: [
          {
            type: "news",
            title: "ChatGPT subscription quota update discussed by users",
            description: "Users report a possible subscription quota change that still needs official confirmation",
            source: "Community report",
            url: "https://example.com/chatgpt-quota-clue",
            evidence: {
              tier: "trusted-media",
              isPrimary: false,
              reason: "待官方核验的线索",
              independentKey: "example.com",
            },
          },
        ],
      }),
    ],
    accountOpportunityPlaybook,
    null,
    { allowObservationFallback: true }
  );

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].observationOnly, true);
  assert.equal(result.candidates[0].confidence, "低");
  assert.notEqual(result.candidates[0].xianyuToday, "是");
  assert.equal(result.stats.strictQualified, 0);
  assert.equal(result.stats.observationFallback, 1);
});

test("account observation fallback does not bypass seven-day entity replay", () => {
  const result = qualifyAccountOpportunityCandidates(
    [makeCandidate()],
    accountOpportunityPlaybook,
    {
      entities: [
        {
          key: "name:chatgpt",
          entity: "name:chatgpt",
          section: "account-opportunity",
          date: "2026-08-04",
        },
      ],
    },
    { allowObservationFallback: true }
  );

  assert.equal(result.candidates.length, 0);
  assert.equal(result.stats.observationFallback, 0);
});

test("account replay signature includes supply, pain, and action dimensions", () => {
  const dimensions = deriveAccountOpportunityDimensions(
    makeCandidate(),
    accountOpportunityPlaybook
  );

  assert.equal(dimensions.supplyForm, "official-subscription");
  assert.equal(dimensions.buyerPain, "plan-selection");
  assert.equal(dimensions.actionType, "faq-or-offer-review");
  assert.equal(
    dimensions.accountReplaySignature,
    "account:official-subscription:plan-selection:faq-or-offer-review"
  );
});

test("Aivora account link is inserted only from an allowed policy", () => {
  const markdown = `## 今日可执行

### 核对套餐说明

- **不能承诺与停止：** 不承诺额度长期不变；没有真实询问就停止。`;
  const denied = insertAccountOpportunityAivoraLink(markdown, {
    allowedUrls: [],
    suggestedUrl: "https://www.aivora.cn/",
  });
  const allowed = insertAccountOpportunityAivoraLink(markdown, {
    allowedUrls: ["https://www.aivora.cn/"],
    suggestedUrl: "https://www.aivora.cn/",
  });

  assert.equal(denied.inserted, false);
  assert.equal(allowed.inserted, true);
  assert.match(allowed.markdown, /爱窝啦·AI账号店/);
  assert.equal((allowed.markdown.match(/aivora\.cn/g) || []).length, 1);
});

test("account observation normalization fixes the hard-signal boundary and missing judgment", () => {
  const normalized = normalizeAccountOpportunityObservationMarkdown(`## 今日硬信号

- 社区称额度已经变化。

## 今日可执行

### 观察：核对社区线索

- **证据与可信度：** [社区线索](https://example.com/clue)；可信度：低。`);

  assert.doesNotMatch(normalized, /社区称额度已经变化/);
  assert.match(
    normalized,
    /今天没有取得可由官方页面确认的账号、价格、额度或政策新变化；不新增商品。/
  );
  assert.match(normalized, /\*\*判断：\*\* 今天只有待核验线索/);
});
