import test from "node:test";
import assert from "node:assert/strict";

import { buildOpportunityCandidateAssessment } from "../src/opportunityScoring.js";

const strictOptions = {
  requireStrongEvidence: true,
  enforceReplayDimensions: true,
  entityAwareGrouping: true,
  avoidGenericDuplicates: true,
  minimumCandidateScore: 52,
};

test("strict opportunity assessment keeps a reproducible project and rejects a social-only pitch", () => {
  const assessment = buildOpportunityCandidateAssessment(
    {
      project: [
        {
          title: "Toonflow 发布视频工作流客户端",
          description: "开源视频内容工作流，支持脚本、生成和可复现配置",
          source: "GitHub Trending",
          url: "https://github.com/HBAI-Ltd/Toonflow-app",
          published_date: "2026-08-03",
          details: { content_html: "<p>video content workflow release</p>" },
        },
      ],
      news: [
        {
          title: "用 AI 一天五条视频一周万粉",
          description: "全自动批量视频工作流，只有演示和宣传文案",
          source: "Folo",
          url: "https://t.me/aigc1024/21018",
          published_date: "2026-08-03",
          details: {
            content_html: "<p>AI video automation</p>",
            foloSourceId: "55447111940354048",
            lowEvidenceAiWorkflowPitch: true,
          },
        },
      ],
    },
    undefined,
    strictOptions
  );

  assert.ok(assessment.candidates.some((candidate) =>
    candidate.supportingItems.some((item) => /Toonflow/.test(item.title))
  ));
  assert.ok(assessment.rejectedCandidates.some((candidate) =>
    candidate.rejectionReasons.some((reason) => /官方|实证|证据/.test(reason))
  ));
});

test("strict opportunity assessment rejects media-only product claims", () => {
  const assessment = buildOpportunityCandidateAssessment(
    {
      news: [
        {
          title: "某 AI 工具正式上线自动化工作流",
          description: "媒体称它支持内容整理和自动化交付",
          source: "机器之心",
          url: "https://www.jiqizhixin.com/articles/example",
          published_date: "2026-08-03",
          details: { content_html: "<p>workflow release content automation</p>" },
        },
      ],
    },
    undefined,
    strictOptions
  );

  assert.equal(assessment.candidates.length, 0);
  assert.ok(assessment.rejectedCandidates.length > 0);
  assert.match(
    assessment.rejectedCandidates[0].rejectionReasons.join(" | "),
    /官方|原项目|实证/
  );
});

test("actionable profile keeps a traceable AI signal for a low-cost market test", () => {
  const assessment = buildOpportunityCandidateAssessment(
    {
      news: [
        {
          title: "某 AI 工具发布自动化工作流",
          description: "可信媒体展示了内容整理与自动化交付流程",
          source: "机器之心",
          url: "https://www.jiqizhixin.com/articles/actionable-example",
          published_date: "2026-08-25",
          details: { content_html: "<p>workflow release content automation</p>" },
        },
      ],
    },
    undefined,
    {
      requireStrongEvidence: false,
      enforceReplayDimensions: false,
      entityAwareGrouping: true,
      avoidGenericDuplicates: true,
      dedupeCandidateEntities: true,
    }
  );

  assert.ok(assessment.candidates.length > 0);
  assert.equal(assessment.candidates[0].observationOnly, undefined);
  assert.equal(assessment.rejectedCandidates.length, 0);
});

test("observation fallback keeps a trusted-media change as verification only", () => {
  const assessment = buildOpportunityCandidateAssessment(
    {
      news: [
        {
          title: "某 AI 工具发布自动化内容整理能力",
          description: "可信媒体报道工具新增内容整理与工作流配置能力",
          source: "36氪",
          url: "https://www.36kr.com/p/example-observation",
          published_date: "2026-08-07",
          details: { content_html: "<p>workflow release content automation</p>" },
        },
      ],
    },
    undefined,
    {
      ...strictOptions,
      allowObservationFallback: true,
    }
  );

  assert.equal(assessment.candidates.length, 1);
  assert.equal(assessment.candidates[0].observationOnly, true);
  assert.equal(assessment.candidates[0].confidence, "低");
  assert.equal(assessment.candidates[0].xianyuToday, "观察");
  assert.match(
    assessment.candidates[0].observationReasons.join(" | "),
    /官方|原项目|实证/
  );
});

test("seven-day entity replay blocks the same project even with a new headline", () => {
  const assessment = buildOpportunityCandidateAssessment(
    {
      project: [
        {
          title: "Toonflow 新版本增加内容工作流",
          description: "视频内容自动化与脚本工作流更新",
          source: "GitHub Trending",
          url: "https://github.com/HBAI-Ltd/Toonflow-app/releases/tag/v2",
          published_date: "2026-08-04",
          details: { content_html: "<p>video workflow update</p>" },
        },
      ],
    },
    undefined,
    {
      ...strictOptions,
      recentReplayMemory: {
        entities: [
          {
            key: "github:hbai-ltd/toonflow-app",
            entity: "github:hbai-ltd/toonflow-app",
            date: "2026-08-03",
          },
        ],
      },
    }
  );

  assert.equal(assessment.candidates.length, 0);
  assert.match(
    assessment.rejectedCandidates[0].rejectionReasons.join(" | "),
    /同一项目或产品实体/
  );
});

test("seven-day commercial signature blocks a renamed delivery clone", () => {
  const assessment = buildOpportunityCandidateAssessment(
    {
      project: [
        {
          title: "ClipFactory 发布视频自动化工作流",
          description: "开源视频内容生产工作流和可复现配置",
          source: "GitHub Trending",
          url: "https://github.com/example/clip-factory",
          published_date: "2026-08-04",
          details: { content_html: "<p>video content workflow release</p>" },
        },
      ],
    },
    undefined,
    {
      ...strictOptions,
      recentReplayMemory: {
        commercialSignatures: [
          {
            key: "result-delivery:automation-workflow",
            commercialSignature: "result-delivery:automation-workflow",
            date: "2026-08-03",
          },
        ],
      },
    }
  );

  assert.equal(assessment.candidates.length, 0);
  assert.match(
    assessment.rejectedCandidates[0].rejectionReasons.join(" | "),
    /商业模式与交付类型组合/
  );
});

test("observation fallback keeps evidence but does not relabel a repeated delivery as a new opportunity", () => {
  const assessment = buildOpportunityCandidateAssessment(
    {
      project: [
        {
          title: "ClipFactory 发布视频自动化工作流",
          description: "开源视频内容生产工作流和可复现配置",
          source: "GitHub Trending",
          url: "https://github.com/example/clip-factory",
          published_date: "2026-08-04",
          details: { content_html: "<p>video content workflow release</p>" },
        },
      ],
    },
    undefined,
    {
      ...strictOptions,
      allowObservationFallback: true,
      recentReplayMemory: {
        commercialSignatures: [
          {
            key: "result-delivery:automation-workflow",
            commercialSignature: "result-delivery:automation-workflow",
            date: "2026-08-03",
          },
        ],
      },
    }
  );

  assert.equal(assessment.candidates.length, 1);
  assert.equal(assessment.candidates[0].observationOnly, true);
  assert.equal(assessment.candidates[0].xianyuToday, "观察");
  assert.match(assessment.candidates[0].observationReasons.join("\n"), /商业模式与交付类型组合/);
  assert.equal(assessment.stats.strictQualified, 0);
  assert.equal(assessment.stats.observationFallback, 1);
});

test("observation fallback still blocks the same entity", () => {
  const assessment = buildOpportunityCandidateAssessment(
    {
      project: [
        {
          title: "Toonflow 新版本增加内容工作流",
          description: "视频内容自动化与脚本工作流更新",
          source: "GitHub Trending",
          url: "https://github.com/HBAI-Ltd/Toonflow-app/releases/tag/v2",
          published_date: "2026-08-04",
          details: { content_html: "<p>video workflow update</p>" },
        },
      ],
    },
    undefined,
    {
      ...strictOptions,
      allowObservationFallback: true,
      recentReplayMemory: {
        entities: [
          {
            key: "github:hbai-ltd/toonflow-app",
            entity: "github:hbai-ltd/toonflow-app",
            date: "2026-08-03",
          },
        ],
      },
    }
  );

  assert.equal(assessment.candidates.length, 0);
  assert.equal(assessment.stats.observationFallback, 0);
});

test("seven-day offer family blocks a different developer project with the same reader delivery", () => {
  const assessment = buildOpportunityCandidateAssessment(
    {
      project: [
        {
          title: "Ruflo 发布多智能体接入工具",
          description: "GitHub release supports MCP integration and reproducible configuration",
          source: "GitHub Trending",
          url: "https://github.com/ruvnet/ruflo",
          published_date: "2026-08-05",
          details: { content_html: "<p>integration plugin setup release</p>" },
        },
      ],
    },
    undefined,
    {
      ...strictOptions,
      profile: "general",
      recentReplayMemory: {
        offerFamilies: [
          {
            key: "developer-tool-setup",
            offerFamily: "developer-tool-setup",
            date: "2026-08-04",
            section: "opportunity",
          },
        ],
      },
    }
  );

  assert.equal(assessment.candidates.length, 0);
  assert.match(
    assessment.rejectedCandidates[0].rejectionReasons.join(" | "),
    /读者交付家族/
  );
});

test("one day keeps at most one candidate from the same reader offer family", () => {
  const assessment = buildOpportunityCandidateAssessment(
    {
      project: [
        {
          title: "ADR 安全工具发布部署说明",
          description: "GitHub release for AI agent security deployment and report",
          source: "GitHub Trending",
          url: "https://github.com/uber/ADR",
          published_date: "2026-08-05",
          details: { content_html: "<p>deploy setup report release</p>" },
        },
        {
          title: "Ruflo 发布多智能体接入工具",
          description: "GitHub release supports MCP integration and reproducible configuration",
          source: "GitHub Trending",
          url: "https://github.com/ruvnet/ruflo",
          published_date: "2026-08-05",
          details: { content_html: "<p>integration plugin setup release</p>" },
        },
      ],
    },
    undefined,
    { ...strictOptions, profile: "general" }
  );

  assert.equal(assessment.candidates.length, 1);
  assert.ok(
    assessment.rejectedCandidates.some((candidate) =>
      candidate.rejectionReasons.some((reason) => /读者交付家族重复/.test(reason))
    )
  );
});

