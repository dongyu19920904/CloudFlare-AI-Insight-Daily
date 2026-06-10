import test from "node:test";
import assert from "node:assert/strict";

import { buildDailyGenerationPromptInput } from "../src/dailyGenerationPromptInput.js";

test("buildDailyGenerationPromptInput isolates low-evidence AI workflow pitches to watch-only candidates", () => {
  const normalItem = [
    "News Title: Claude Code adds a safer planning mode",
    "Published: 2026-06-10",
    "Url: https://example.com/claude-code-plan",
    "Content Summary: Claude Code improved planning for real coding workflows.",
  ].join("\n");
  const lowEvidencePitch = [
    "News Title: AI batch video workflow: five posts a day and ten thousand followers a week",
    "Published: 2026-06-10",
    "Url: https://t.me/aigc1024/21091",
    "Content Summary: The post only shows a video and copywriting, without GitHub, workflow files, configuration docs or official links.",
    "Placement Hint: This is a low-evidence AI workflow pitch. Keep it out of TOP; at most use it in watch section as unverified, or skip it.",
  ].join("\n");

  const promptInput = buildDailyGenerationPromptInput([normalItem, lowEvidencePitch], []);
  const watchOnlyMarker = "Some candidates may be AI workflow pitches without official";
  const primaryBlock = promptInput.split(watchOnlyMarker)[0];
  const watchOnlyBlock = promptInput.split(watchOnlyMarker)[1] || "";

  assert.match(primaryBlock, /Claude Code adds a safer planning mode/);
  assert.doesNotMatch(primaryBlock, /ten thousand followers a week/);
  assert.match(watchOnlyBlock, /ten thousand followers a week/);
  assert.match(watchOnlyBlock, /low-evidence AI workflow pitch/);
});
