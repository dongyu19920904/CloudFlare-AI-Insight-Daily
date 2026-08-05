import test from "node:test";
import assert from "node:assert/strict";

import {
  assessOpportunityEvidence,
  buildOpportunityEvidenceEnrichment,
  classifyOpportunityCommercialPattern,
  classifyOpportunityEvidence,
  deriveOpportunityEntityKey,
  deriveOpportunityOfferFamily,
  extractOfficialOpportunityLinksFromHtml,
} from "../src/opportunityEvidence.js";

test("classifyOpportunityEvidence treats an original GitHub repository as primary and reproducible", () => {
  const evidence = classifyOpportunityEvidence(
    {
      title: "Toonflow video workflow release",
      url: "https://github.com/HBAI-Ltd/Toonflow-app",
      source: "GitHub Trending",
    },
    "project"
  );

  assert.equal(evidence.tier, "primary");
  assert.equal(evidence.isPrimary, true);
  assert.equal(evidence.isReproducible, true);
});

test("classifyOpportunityEvidence keeps social posts as discovery clues", () => {
  const evidence = classifyOpportunityEvidence(
    {
      title: "一天五条一周万粉",
      url: "https://t.me/aigc1024/21018",
      source: "Telegram",
    },
    "socialMedia"
  );

  assert.equal(evidence.tier, "social");
  assert.equal(evidence.isPrimary, false);
});

test("social posts cannot become primary merely by calling themselves official", () => {
  const evidence = classifyOpportunityEvidence(
    {
      title: "官方刚刚发布全自动工作流",
      url: "https://t.me/example/42",
      source: "官方 Telegram",
    },
    "socialMedia"
  );

  assert.equal(evidence.tier, "social");
  assert.equal(evidence.isPrimary, false);
});

test("specified Folo low-evidence workflow pitches remain ineligible", () => {
  const item = {
    title: "AI 全自动短视频工作流",
    description: "一天五条，一周万粉",
    url: "https://t.me/aigc1024/21018",
    source: "Folo",
    type: "news",
    lowEvidenceAiWorkflowPitch: true,
  };
  const evidence = classifyOpportunityEvidence(item, "news");
  const assessment = assessOpportunityEvidence([{ ...item, evidence }]);

  assert.equal(evidence.tier, "low");
  assert.equal(assessment.eligible, false);
  assert.match(assessment.gaps.join(" | "), /官方|实证/);
});

test("candidate evidence requires a concrete outcome as well as a primary source", () => {
  const item = {
    title: "Toonflow 发布视频工作流客户端",
    description: "支持生成视频、脚本和可复现工作流",
    url: "https://github.com/HBAI-Ltd/Toonflow-app",
    source: "GitHub",
    type: "project",
  };
  const assessment = assessOpportunityEvidence([
    { ...item, evidence: classifyOpportunityEvidence(item, "project") },
  ]);

  assert.equal(assessment.eligible, true);
  assert.equal(assessment.strength, "medium");
});

test("entity and commercial fingerprints are stable", () => {
  const item = {
    title: "Toonflow video workflow",
    description: "video content workflow release",
    url: "https://github.com/HBAI-Ltd/Toonflow-app",
    source: "GitHub",
  };

  assert.equal(
    deriveOpportunityEntityKey(item, "github_hot_project"),
    "github:hbai-ltd/toonflow-app"
  );
  assert.equal(
    deriveOpportunityEntityKey(item, "browser_use"),
    "github:hbai-ltd/toonflow-app"
  );
  assert.deepEqual(classifyOpportunityCommercialPattern([item], "service"), {
    businessModel: "result-delivery",
    deliveryType: "automation-workflow",
    commercialSignature: "result-delivery:automation-workflow",
  });
});

test("developer deployment and integration collapse into one reader offer family", () => {
  const deployment = deriveOpportunityOfferFamily({
    businessModel: "productized-service",
    deliveryType: "deployment-setup",
    preferredLane: "service",
    supportingItems: [{ url: "https://github.com/uber/ADR" }],
  });
  const integration = deriveOpportunityOfferFamily({
    businessModel: "productized-service",
    deliveryType: "integration",
    preferredLane: "service",
    supportingItems: [{ url: "https://github.com/ruvnet/ruflo" }],
  });

  assert.equal(deployment, "developer-tool-setup");
  assert.equal(integration, "developer-tool-setup");
});

test("trusted media extraction finds official outbound links", () => {
  const links = extractOfficialOpportunityLinksFromHtml(
    `<a href="https://huggingface.co/MiniMaxAI/H3">模型页</a>
     <script>const api = "https:\\/\\/platform.minimax.io\\/docs";</script>`,
    "https://www.36kr.com/p/example"
  );

  assert.deepEqual(links, [
    "https://huggingface.co/MiniMaxAI/H3",
    "https://platform.minimax.io/docs",
  ]);
});

test("opportunity evidence enrichment stays within GitHub and media request budgets", async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(String(url));
    if (String(url).startsWith("https://api.github.com/")) {
      return new Response(
        JSON.stringify({
          license: { spdx_id: "Apache-2.0" },
          archived: false,
          updated_at: "2026-08-05T00:00:00Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    return new Response(
      `<a href="https://huggingface.co/example/model">official model</a>`,
      { status: 200, headers: { "content-type": "text/html" } }
    );
  };
  const supportingItems = [
    ...Array.from({ length: 5 }, (_, index) => ({
      url: `https://github.com/example/repo-${index}`,
      title: `Repo ${index}`,
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      url: `https://www.36kr.com/p/${index}`,
      title: `Media ${index}`,
    })),
  ];

  const result = await buildOpportunityEvidenceEnrichment(
    [{ supportingItems }],
    { fetchImpl, maxGithubRequests: 4, maxTrustedMediaRequests: 2 }
  );

  assert.equal(result.stats.githubRequests, 4);
  assert.equal(result.stats.trustedMediaRequests, 2);
  assert.equal(requests.length, 6);
  assert.equal(result.stats.failures, 0);
});
