import test from "node:test";
import assert from "node:assert/strict";

import { buildDailyPromptSelection } from "../src/dailyPromptSelection.js";

test("buildDailyPromptSelection adds a watch-only hint only after source policy marks a low-evidence workflow pitch", () => {
  const result = buildDailyPromptSelection(
    {
      news: [
        {
          type: "news",
          title: "Claude Code adds a safer planning mode",
          description: "A practical AI coding workflow update for developers.",
          source: "Developer News",
          url: "https://example.com/claude-code-plan",
          published_date: "2026-06-10",
          details: {
            content_html: "<p>Claude Code improved planning for real coding workflows.</p>",
          },
        },
        {
          type: "news",
          title: "用 AI 搭短视频全自动工作流：一天五条，一周万粉",
          description:
            "只展示了一个视频和文案，没有 GitHub、工作流文件、配置文档或官方教程。",
          source: "Folo",
          url: "https://t.me/aigc1024/21018",
          published_date: "2026-06-10",
          details: {
            foloSourceId: "55447111940354048",
            lowEvidenceAiWorkflowPitch: true,
            content_html: "<p>AI 负责生成脚本、配音和剪辑，人负责选品和发布。</p>",
          },
        },
      ],
      project: [],
      socialMedia: [],
      paper: [],
    },
    {
      DAILY_PROMPT_MAX_ITEMS: 2,
      DAILY_PROMPT_NEWS_ITEMS: 2,
      DAILY_PROMPT_PROJECT_ITEMS: 0,
      DAILY_PROMPT_SOCIAL_ITEMS: 0,
      DAILY_PROMPT_PAPER_ITEMS: 0,
    }
  );

  const promptText = result.selectedContentItems.join("\n");
  assert.match(promptText, /一天五条/);
  assert.match(promptText, /Placement Hint: This is a low-evidence AI workflow pitch/);
});
