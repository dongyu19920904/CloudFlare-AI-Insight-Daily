import test from "node:test";
import assert from "node:assert/strict";

import {
  applyNewsSourcePolicy,
  isLowEvidenceAiWorkflowPitch,
} from "../src/sourcePolicies.js";

function lowEvidenceWorkflow(overrides = {}) {
  return {
    type: "news",
    title: "用 AI 搭短视频全自动工作流：一天五条，一周万粉",
    description:
      "这条内容展示了一个全自动短视频生产线：AI 生成脚本、配音、剪辑和自动发布，但只放了视频和文案，没有 GitHub、工作流文件、配置文档或官方教程。",
    source: "Folo",
    url: "https://t.me/aigc1024/21018",
    details: {
      content_html: "<p>只有演示视频和文案，没有可复现配置。</p>",
      ...(overrides.details || {}),
    },
    ...overrides,
  };
}

test("isLowEvidenceAiWorkflowPitch flags high-promise AI video workflow posts without build evidence", () => {
  const june8Post = lowEvidenceWorkflow();
  const june10Post = lowEvidenceWorkflow({
    title: "AI 批量视频工作流实战：四步从文案到四平台自动发布",
    description:
      "AI 提取或生成文案并过滤违禁词，克隆声音和形象对口型，自动剪辑配音配乐，最后一键推送到四个平台，但没有给出可复现配置。",
    url: "https://t.me/aigc1024/21091",
  });

  assert.equal(isLowEvidenceAiWorkflowPitch(june8Post), true);
  assert.equal(isLowEvidenceAiWorkflowPitch(june10Post), true);
});

test("isLowEvidenceAiWorkflowPitch keeps AI workflow posts with reproducible evidence", () => {
  const reproducibleWorkflow = lowEvidenceWorkflow({
    title: "AI 短视频自动化工作流开源：从脚本到剪映配置",
    description: "作者给出了 GitHub 仓库、n8n workflow 文件、剪映配置和完整搭建教程。",
    url: "https://example.com/ai-video-workflow",
    details: {
      content_html:
        "<p>GitHub: https://github.com/example/ai-video-workflow, includes workflow file and step-by-step docs.</p>",
    },
  });

  assert.equal(isLowEvidenceAiWorkflowPitch(reproducibleWorkflow), false);
});

test("isLowEvidenceAiWorkflowPitch keeps posts with official tutorial or course evidence", () => {
  const officialCourseWorkflow = lowEvidenceWorkflow({
    title: "AI 批量视频工作流实战：从文案到多平台自动发布",
    description: "作者给出了官方教程、课程链接和完整配置步骤，读者可以按课程页面复现。",
    source: "Official Academy",
    url: "https://example.com/academy/ai-video-workflow-course",
    details: {
      content_html:
        "<p>Official course: https://example.com/academy/ai-video-workflow-course, tutorial: https://example.com/docs/ai-video-workflow.</p>",
    },
  });

  assert.equal(isLowEvidenceAiWorkflowPitch(officialCourseWorkflow), false);
});

test("isLowEvidenceAiWorkflowPitch still flags posts that say they lack official or course evidence", () => {
  const unofficialPitch = lowEvidenceWorkflow({
    description: "这不是官方发布，也没有课程链接、教程链接或可复现配置。",
    details: {
      content_html: "<p>只放了演示视频和文案，没有官方信息。</p>",
    },
  });

  assert.equal(isLowEvidenceAiWorkflowPitch(unofficialPitch), true);
});

test("applyNewsSourcePolicy marks configured Folo low-evidence AI workflow pitches for downstream placement", () => {
  const [marked] = applyNewsSourcePolicy([
    lowEvidenceWorkflow({
      details: {
        foloSourceId: "55447111940354048",
        content_html: "<p>只有演示视频。</p>",
      },
    }),
  ]);

  assert.equal(marked.details.lowEvidenceAiWorkflowPitch, true);
});

test("applyNewsSourcePolicy does not mark low-evidence workflow pitches from other sources", () => {
  const [unmarked] = applyNewsSourcePolicy([
    lowEvidenceWorkflow({
      source: "Developer News",
      url: "https://example.com/ai-workflow-story",
      details: {
        foloSourceId: "other-source",
        content_html: "<p>只有演示视频。</p>",
      },
    }),
  ]);

  assert.equal(unmarked.details.lowEvidenceAiWorkflowPitch, undefined);
});
