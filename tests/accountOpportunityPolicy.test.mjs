import test from "node:test";
import assert from "node:assert/strict";

import { accountOpportunityPlaybook } from "../src/accountOpportunityPlaybook.js";
import {
  assessAccountOpportunityEvidence,
  assessAccountOpportunityMarketScope,
  buildRejectedAccountOpportunityDigest,
  deriveAccountOpportunityDimensions,
  insertAccountOpportunityAivoraLink,
  isOfficialAccountOpportunityUrl,
  normalizeAccountOpportunityHardSignalLinks,
  normalizeAccountOpportunityObservationMarkdown,
  qualifyAccountOpportunityCandidates,
  updateAccountOpportunityHomeIndexContent,
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

test("account opportunity playbook restores an overseas account-first offer", () => {
  assert.equal(
    accountOpportunityPlaybook.outputRules.requireAccountLikeOpportunityInTodayCanSell,
    true
  );
  assert.match(accountOpportunityPlaybook.businessProfile.editorialRule, /哪款账号、订阅或账号搭售商品/);
  assert.match(
    accountOpportunityPlaybook.productLanes.find((lane) => lane.id === "bundle")?.description || "",
    /不独立主推泛教程/
  );
  assert.ok(
    accountOpportunityPlaybook.strategyKernel.supplyForms.includes("账号加教程或售后说明")
  );
  assert.ok(!accountOpportunityPlaybook.strategyKernel.supplyForms.includes("教程资料"));
});

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

test("actionable profile keeps a traceable overseas feature signal without inventing an official account change", () => {
  const candidate = makeCandidate({
    supportingItems: [
      {
        type: "news",
        title: "Claude Code adds a project workflow",
        description: "Anthropic documents a new Claude Code workflow for developers",
        source: "Anthropic",
        url: "https://www.anthropic.com/news/claude-code-workflow",
        evidence: {
          tier: "primary",
          isPrimary: true,
          reason: "产品原始来源",
          independentKey: "anthropic.com",
        },
      },
    ],
  });
  const result = qualifyAccountOpportunityCandidates(
    [candidate],
    accountOpportunityPlaybook,
    {
      entities: [{ key: "name:chatgpt", section: "account-opportunity" }],
      commercialSignatures: [
        {
          key: "account:official-subscription:plan-selection:faq-or-offer-review",
          section: "account-opportunity",
        },
      ],
    },
    {
      requireOfficialChange: false,
      enforceMinimumScore: false,
      enforceReplayDimensions: false,
      dedupeCandidateSignatures: false,
      allowObservationFallback: false,
    }
  );

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].accountEvidence.officialChangeEligible, false);
  assert.equal(result.candidates[0].evidenceEligible, true);
  assert.equal(result.candidates[0].xianyuToday, "是");
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

test("account market scope accepts supported overseas AI products", () => {
  const assessment = assessAccountOpportunityMarketScope(makeCandidate());

  assert.equal(assessment.eligible, true);
  assert.equal(assessment.scope, "overseas");
});

test("GitHub Copilot pages are official but arbitrary repositories are not", () => {
  assert.equal(
    isOfficialAccountOpportunityUrl("https://github.com/features/copilot/plans"),
    true
  );
  assert.equal(
    isOfficialAccountOpportunityUrl("https://github.com/example/copilot-price-rumor"),
    false
  );
});

test("account market scope rejects domestic AI products even with primary evidence", () => {
  const domestic = makeCandidate({
    id: "pricing-quota",
    entityKey: "name:deepseek",
    label: "价格、额度与套餐变化信号",
    supportingItems: [
      {
        type: "news",
        title: "DeepSeek updates API pricing and quota",
        description: "DeepSeek released an API pricing and quota update",
        source: "DeepSeek official",
        url: "https://api-docs.deepseek.com/quick_start/pricing",
        evidence: {
          tier: "primary",
          isPrimary: true,
          reason: "官方来源",
          independentKey: "deepseek.com",
        },
      },
    ],
  });
  const result = qualifyAccountOpportunityCandidates(
    [domestic],
    accountOpportunityPlaybook,
    null,
    { allowObservationFallback: true }
  );

  assert.equal(result.candidates.length, 0);
  assert.equal(result.stats.rejectedForMarketScope, 1);
  assert.match(
    result.rejectedCandidates[0].rejectionReasons.join("\n"),
    /国内 AI 产品不属于海外账号商机经营范围/
  );
});

test("domestic comparison stories cannot enter by mentioning an overseas product", () => {
  const comparison = makeCandidate({
    entityKey: "name:deepseek",
    supportingItems: [
      {
        type: "news",
        title: "DeepSeek API 涨价，对比 Claude 套餐",
        description: "DeepSeek announced an API pricing update and compared it with Claude",
        source: "Trusted media",
        url: "https://example.com/deepseek-vs-claude",
        evidence: {
          tier: "trusted-media",
          isPrimary: false,
          reason: "媒体线索",
          independentKey: "example.com",
        },
      },
    ],
  });
  const scope = assessAccountOpportunityMarketScope(comparison);
  const result = qualifyAccountOpportunityCandidates(
    [comparison],
    accountOpportunityPlaybook,
    null,
    { allowObservationFallback: true }
  );

  assert.equal(scope.scope, "domestic");
  assert.equal(result.candidates.length, 0);
  assert.equal(result.stats.observationFallback, 0);
});

test("account rule labels cannot turn a domestic media story into an overseas candidate", () => {
  const domesticStory = makeCandidate({
    id: "claude-account",
    entityKey: "title:梁文锋 告别价格屠夫",
    label: "Claude 账号与订阅信号",
    supportingItems: [
      {
        type: "news",
        title: "梁文锋，告别价格屠夫",
        description: "DeepSeek 涨价后，用户还能买账吗？",
        source: "36氪",
        url: "https://www.36kr.com/p/3928804830804097",
        evidence: {
          tier: "trusted-media",
          isPrimary: false,
          reason: "媒体线索",
          independentKey: "36kr.com",
        },
      },
    ],
  });
  const scope = assessAccountOpportunityMarketScope(domesticStory);
  const result = qualifyAccountOpportunityCandidates(
    [domesticStory],
    accountOpportunityPlaybook,
    null,
    { allowObservationFallback: true }
  );

  assert.equal(scope.scope, "domestic");
  assert.equal(result.candidates.length, 0);
  assert.equal(result.stats.rejectedForMarketScope, 1);
  assert.equal(result.stats.observationFallback, 0);
});

test("mixed domestic and overseas media stories do not establish an overseas trigger", () => {
  const mixedStory = makeCandidate({
    id: "claude-account",
    entityKey: "title:ai价格变化",
    label: "Claude 账号与订阅信号",
    supportingItems: [
      {
        type: "news",
        title: "AI 价格变化",
        description: "Claude 与 DeepSeek 的价格被放在一起比较",
        source: "Trusted media",
        url: "https://example.com/ai-price-comparison",
        evidence: {
          tier: "trusted-media",
          isPrimary: false,
          reason: "媒体线索",
          independentKey: "example.com",
        },
      },
    ],
  });

  const scope = assessAccountOpportunityMarketScope(mixedStory);

  assert.equal(scope.eligible, false);
  assert.equal(scope.scope, "mixed");
  assert.match(scope.gaps.join("\n"), /无法确认主实体/);
});

test("rejected digest omits domestic and unknown products", () => {
  const digest = buildRejectedAccountOpportunityDigest([
    makeCandidate({
      entityKey: "name:deepseek",
      rejectionReasons: ["国内 AI 产品不属于海外账号商机经营范围"],
      supportingItems: [
        {
          title: "DeepSeek API 调价",
          url: "https://example.com/deepseek",
        },
      ],
    }),
    makeCandidate({ rejectionReasons: ["缺少官方页面"] }),
  ]);

  assert.doesNotMatch(digest, /DeepSeek/);
  assert.match(digest, /OpenAI updates ChatGPT subscription quota/);
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
  const normalized = normalizeAccountOpportunityObservationMarkdown(`## 30 秒结论

- 多出来的摘要段落。
- **今天发生什么：** 社区称有变化。

## 今日硬信号

- 社区称额度已经变化。

## 今日可执行

### 观察：核对额度变化

- **证据与可信度：** [社区线索称额度已经翻倍](https://example.com/clue)；有人转述套餐为 20 美元；不得承诺登录稳定；仍缺官方确认。`);

  assert.equal(
    normalized.match(/^- \*\*(?:今天发生什么|今天做什么|最大风险)：\*\*/gm)?.length,
    3
  );
  assert.doesNotMatch(normalized, /社区称额度已经变化/);
  assert.match(
    normalized,
    /今天没有取得可由官方页面确认的海外 AI 账号、价格、额度或政策新变化；不新增商品。/
  );
  assert.match(normalized, /^### 观察：核对一条海外账号线索，不新增商品$/m);
  assert.match(normalized, /证据与可信度：\*\* 待核验线索：/);
  const sensitiveClauses = normalized
    .split(/\r?\n|[。；;]/)
    .filter((clause) => /美元|价格|额度|配额|套餐|支付|地区|登录|政策|条款/.test(clause));
  assert.ok(
    sensitiveClauses.every((clause) =>
      /没有取得|没有|尚无|尚未|未获|未确认|待核验|仍缺|缺少官方|不承诺|不能确认|无法确认|不新增/.test(clause)
    )
  );
  assert.match(normalized, /\*\*判断：\*\* 今天只有待核验线索/);
});

test("account hard-signal normalization removes unsourced extras when a sourced signal exists", () => {
  const normalized = normalizeAccountOpportunityHardSignalLinks(`## 今日硬信号

- [原项目证明工作流存在](https://example.com/project)。
- 社区还讨论了套餐变化。
这是一段没有来源的补充说明。

## 今日可执行

### 写一页教程`);

  assert.match(normalized, /原项目证明工作流存在/);
  assert.doesNotMatch(normalized, /社区还讨论了套餐变化/);
  assert.doesNotMatch(normalized, /没有来源的补充说明/);
  assert.match(normalized, /## 今日可执行/);
});

test("account hard-signal normalization rebuilds a bounded signal from a body link", () => {
  const normalized = normalizeAccountOpportunityHardSignalLinks(`## 今日硬信号

- 社区讨论了一种海外 AI 工具用法。

## 今日可执行

### 写一页教程

- **证据与可信度：** [原项目展示了工作流](https://github.com/example/project)；可信度：中。`);

  assert.match(
    normalized,
    /\[候选来源展示的海外 AI 工具线索\]\(https:\/\/github\.com\/example\/project\)/
  );
  assert.match(normalized, /不证明账号、价格、额度或政策变化，相关事实仍待官方确认/);
  assert.doesNotMatch(normalized, /社区讨论了一种海外 AI 工具用法/);
});

test("account opportunity home is renamed to the merchant operating daily without changing its route type", () => {
  const current = `---
linkTitle: AI账号商机
title: 爱窝啦 AI 账号商机
type: account-opportunity
breadcrumbs: false
description: "旧说明"
---

旧正文`;
  const updated = updateAccountOpportunityHomeIndexContent(current, "新正文", "2026-08-31");

  assert.match(updated, /linkTitle: AI账号商机日报/);
  assert.match(updated, /title: 爱窝啦 AI 账号商家经营日报/);
  assert.match(updated, /type: account-opportunity/);
  assert.match(updated, /\{\{< latest-account-opportunity >\}\}/);
  assert.doesNotMatch(updated, /旧正文/);
});
