import test from "node:test";
import assert from "node:assert/strict";

import {
  applyNewsSourcePolicy,
  isLowEvidenceAiWorkflowPitch,
} from "../src/sourcePolicies.js";

test("isLowEvidenceAiWorkflowPitch flags high-promise AI video workflow posts without build evidence", () => {
  const june8Post = {
    type: "news",
    title: "用 AI 搭短视频全自动工作流：一天五条，一周万粉",
    description: "这条内容展示了一个完整的全自动短视频生产线，从寄拍推单到口播带货，AI 负责内容生成，人负责选品和发布。",
    source: "Folo",
    url: "https://t.me/aigc1024/21018",
    details: {
      content_html: "<p>只展示了视频和文案，没有详细搭建教程、工作流文件或官方链接。</p>",
    },
  };

  const june10Post = {
    type: "news",
    title: "AI 批量视频工作流实战：四步从文案到四平台自动发布",
    description: "AI 提取或生成文案并过滤违禁词，克隆声音和形象对口型，自动剪辑配音配乐，最后一键推送到四个平台。",
    source: "Folo",
    url: "https://t.me/aigc1024/21091",
    details: {
      content_html: "<p>核心变化是整条产出链都能跑批量，但没有给出可复现配置。</p>",
    },
  };

  assert.equal(isLowEvidenceAiWorkflowPitch(june8Post), true);
  assert.equal(isLowEvidenceAiWorkflowPitch(june10Post), true);
});

test("isLowEvidenceAiWorkflowPitch keeps AI workflow posts with reproducible evidence", () => {
  const reproducibleWorkflow = {
    type: "news",
    title: "AI 短视频自动化工作流开源：从脚本到剪映配置",
    description: "作者给出了 GitHub 仓库、n8n workflow 文件、剪映配置和完整搭建教程。",
    source: "Folo",
    url: "https://example.com/ai-video-workflow",
    details: {
      content_html: '<p>GitHub: https://github.com/example/ai-video-workflow，包含 workflow 文件和 step-by-step 文档。</p>',
    },
  };

  assert.equal(isLowEvidenceAiWorkflowPitch(reproducibleWorkflow), false);
});

test("isLowEvidenceAiWorkflowPitch keeps posts with official tutorial or course evidence", () => {
  const officialCourseWorkflow = {
    type: "news",
    title: "AI 批量视频工作流实战：从文案到多平台自动发布",
    description: "作者给出了官方教程、课程链接和完整配置步骤，读者可以按课程页面复现。",
    source: "Official Academy",
    url: "https://example.com/academy/ai-video-workflow-course",
    details: {
      content_html: '<p>官方课程链接：https://example.com/academy/ai-video-workflow-course，教程链接：https://example.com/docs/ai-video-workflow。</p>',
    },
  };

  assert.equal(isLowEvidenceAiWorkflowPitch(officialCourseWorkflow), false);
});

test("isLowEvidenceAiWorkflowPitch still flags posts that say they lack official or course evidence", () => {
  const unofficialPitch = {
    type: "news",
    title: "AI 短视频全自动工作流：一天五条，一周万粉",
    description: "这不是官方发布，也没有课程链接、教程链接或可复现配置。",
    source: "Folo",
    url: "https://t.me/aigc1024/21018",
    details: {
      content_html: "<p>只放了演示视频和文案，没有官方信息。</p>",
    },
  };

  assert.equal(isLowEvidenceAiWorkflowPitch(unofficialPitch), true);
});

test("applyNewsSourcePolicy marks low-evidence AI workflow pitches for downstream placement", () => {
  const [marked] = applyNewsSourcePolicy([
    {
      type: "news",
      title: "用 AI 搭短视频全自动工作流：一天五条，一周万粉",
      description: "只放了视频和文案，没有工作流文件。",
      source: "Folo",
      url: "https://t.me/aigc1024/21018",
      details: {
        content_html: "<p>演示视频。</p>",
      },
    },
  ]);

  assert.equal(marked.details.lowEvidenceAiWorkflowPitch, true);
});
