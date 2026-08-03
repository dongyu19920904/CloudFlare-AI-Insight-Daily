import test from "node:test";
import assert from "node:assert/strict";

import {
  assessOpportunityEvidence,
  classifyOpportunityCommercialPattern,
  classifyOpportunityEvidence,
  deriveOpportunityEntityKey,
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
