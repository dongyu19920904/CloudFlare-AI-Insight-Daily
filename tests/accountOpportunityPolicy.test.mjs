import test from "node:test";
import assert from "node:assert/strict";

import { accountOpportunityPlaybook } from "../src/accountOpportunityPlaybook.js";
import {
  assessAccountOpportunityEvidence,
  deriveAccountOpportunityDimensions,
  insertAccountOpportunityAivoraLink,
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
