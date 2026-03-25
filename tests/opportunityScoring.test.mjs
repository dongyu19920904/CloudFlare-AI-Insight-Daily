import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOpportunityCandidates,
  formatOpportunityCandidatesForPrompt,
  inferOpportunityReplaySignals,
} from "../src/opportunityScoring.js";

test("buildOpportunityCandidates groups raw items into lane-aware topics", () => {
  const candidates = buildOpportunityCandidates({
    news: [
      {
        title: "Cursor 发布新 Agent 模式",
        description: "Cursor Pro 新功能上线，适合配合配置教程售卖",
        source: "AI Base",
        url: "https://example.com/cursor-agent",
        published_date: "2026-03-22",
        details: { content_html: "<p>Cursor Agent 支持更多自动化能力</p>" },
      },
      {
        title: "OpenAI GPT 套餐更新",
        description: "GPT 与 ChatGPT 相关入口变化，中文用户关注低门槛体验",
        source: "机器之心",
        url: "https://example.com/gpt",
        published_date: "2026-03-22",
        details: { content_html: "<p>OpenAI 发布新变化</p>" },
      },
    ],
    socialMedia: [
      {
        title: "大家在讨论 Cursor Pro 如何搭配教程一起卖",
        description: "很多人关注安装说明和环境配置",
        source: "twitter-test",
        url: "https://example.com/cursor-social",
        published_date: "2026-03-22",
        details: { content_html: "<p>Cursor Pro 配合教程更容易成交</p>" },
      },
    ],
  });

  assert.ok(candidates.length >= 2);
  assert.equal(candidates[0].id, "cursor");
  assert.equal(candidates[0].preferredLane, "bundle");
  assert.match(candidates[0].scoreText, /货盘匹配/);
});

test("formatOpportunityCandidatesForPrompt renders top candidates for the prompt", () => {
  const candidates = buildOpportunityCandidates({
    news: [
      {
        title: "OpenClaw 接入微信插件",
        description: "适合代配置和跑通服务",
        source: "量子位",
        url: "https://example.com/openclaw",
        published_date: "2026-03-22",
        details: { content_html: "<p>OpenClaw 新增插件接入能力</p>" },
      },
    ],
  });

  const output = formatOpportunityCandidatesForPrompt(candidates);

  assert.match(output, /综合分/);
  assert.match(output, /优先卖法/);
  assert.match(output, /编排提醒/);
  assert.match(output, /商品化角度/);
  assert.match(output, /更适合成交给/);
  assert.match(output, /你能交付/);
  assert.match(output, /更适合发到/);
  assert.match(output, /不要主写/);
  assert.match(output, /支撑素材/);
  assert.match(output, /OpenClaw/);
});

test("concrete release topics outrank noisy token-demand chatter", () => {
  const candidates = buildOpportunityCandidates({
    news: [
      {
        title: "有人发帖求 Claude token，情绪很上头",
        description: "求 token、快不行了、想继续用 Opus",
        source: "即刻",
        url: "https://example.com/claude-token",
        published_date: "2026-03-22",
        details: { content_html: "<p>求 token</p>" },
      },
      {
        title: "OpenClaw 上线微信插件并放出 SDK",
        description: "支持接入、上线插件、开发者可以快速跑通",
        source: "Twitter",
        url: "https://github.com/example/openclaw-sdk",
        published_date: "2026-03-22",
        details: { content_html: "<p>release sdk plugin</p>" },
      },
    ],
  });

  assert.ok(candidates.length >= 2);
  const concreteIds = candidates.slice(0, 2).map((candidate) => candidate.id);
  const claudeIndex = candidates.findIndex((candidate) => candidate.id === "claude");

  assert.ok(concreteIds.includes("openclaw") || concreteIds.includes("workflow"));
  assert.ok(claudeIndex >= 1);
});

test("formatOpportunityCandidatesForPrompt no longer forces an account opportunity into view when services dominate", () => {
  const candidates = buildOpportunityCandidates({
    news: [
      {
        title: "OpenClaw 微信插件接入更新",
        description: "release sdk plugin wechat integration",
        source: "Twitter",
        url: "https://github.com/example/openclaw-sdk",
        published_date: "2026-03-22",
        details: { content_html: "<p>release sdk plugin wechat integration</p>" },
      },
      {
        title: "Browser Use automation template 发布",
        description: "automation workflow template launch",
        source: "GitHub",
        url: "https://github.com/example/browser-use-template",
        published_date: "2026-03-22",
        details: { content_html: "<p>workflow template release</p>" },
      },
      {
        title: "MCP integration workflow 发布",
        description: "plugin integration sdk release",
        source: "AI Base",
        url: "https://example.com/workflow",
        published_date: "2026-03-22",
        details: { content_html: "<p>plugin integration sdk</p>" },
      },
      {
        title: "Claude 新入口变动",
        description: "Claude Opus 账号入口变化，适合低门槛体验",
        source: "机器之心",
        url: "https://example.com/claude-account",
        published_date: "2026-03-22",
        details: { content_html: "<p>Claude update release</p>" },
      },
    ],
  });

  const output = formatOpportunityCandidatesForPrompt(candidates);

  assert.doesNotMatch(output, /Claude/);
  assert.match(output, /OpenClaw|workflow/);
});

test("gpt topics can shift from account packaging to bundle when template evidence is stronger", () => {
  const candidates = buildOpportunityCandidates({
    news: [
      {
        title: "GPT 写作模板包更新",
        description: "GPT skills template release with writing scenarios and style examples",
        source: "GitHub",
        url: "https://example.com/gpt-template",
        published_date: "2026-03-25",
        details: { content_html: "<p>gpt template skills prompt writing workflow</p>" },
      },
      {
        title: "ChatGPT 风格模板合集上线",
        description: "chatgpt template bundle for product copy and social posts",
        source: "AI Base",
        url: "https://example.com/chatgpt-style",
        published_date: "2026-03-25",
        details: { content_html: "<p>chatgpt style template pack</p>" },
      },
    ],
  });

  const gptCandidate = candidates.find((candidate) => candidate.id === "gpt");

  assert.ok(gptCandidate);
  assert.equal(gptCandidate.preferredLane, "bundle");
});

test("supporting items prefer concrete evidence over noisy demand chatter", () => {
  const candidates = buildOpportunityCandidates({
    news: [
      {
        title: "Claude 新入口开放",
        description: "Claude 有明确入口变化，适合做账号入口",
        source: "AI Base",
        url: "https://example.com/claude-update",
        published_date: "2026-03-22",
        details: { content_html: "<p>release update support</p>" },
      },
    ],
    socialMedia: [
      {
        title: "求 Claude token，我快不行了",
        description: "token token token",
        source: "即刻",
        url: "https://example.com/claude-noise",
        published_date: "2026-03-22",
        details: { content_html: "<p>求 token 快不行了</p>" },
      },
    ],
  });

  const claudeCandidate = candidates.find((candidate) => candidate.id === "claude");

  assert.ok(claudeCandidate);
  assert.match(claudeCandidate.supportingItems[0].title, /Claude 新入口开放/);
});

test("buyer-facing outcome signals are preserved ahead of community heat in prompt formatting", () => {
  const candidates = buildOpportunityCandidates({
    news: [
      {
        title: "字幕提取模板上线",
        description: "支持一键提取字幕并整理成文档，适合做内容处理搭售包",
        source: "GitHub",
        url: "https://example.com/subtitle-template",
        published_date: "2026-03-22",
        details: { content_html: "<p>template release subtitle extract content workflow</p>" },
      },
      {
        title: "模板项目突破 20K stars",
        description: "GitHub 很火，开发者都在讨论",
        source: "X",
        url: "https://github.com/example/hot-project",
        published_date: "2026-03-22",
        details: { content_html: "<p>github stars stars stars developers discuss</p>" },
      },
    ],
  });

  const output = formatOpportunityCandidatesForPrompt(candidates);

  assert.match(output, /字幕提取/);
  assert.match(output, /不要主写/);
});

test("inferOpportunityReplaySignals extracts yesterday main topic hints from markdown", () => {
  const signals = inferOpportunityReplaySignals(`
## 今日主推
### 微信里直接出改写和总结，这套 Claude 更好卖

今天最值得试卖的，是 Claude 账号 + 微信即用技能包。
`);

  assert.ok(signals.matchedRuleIds.includes("claude"));
  assert.ok(signals.matchedTerms.includes("claude"));
});

test("buildOpportunityCandidates downranks yesterday main topic to reduce back-to-back repetition", () => {
  const input = {
    news: [
      {
        title: "Claude 更新了新的内容处理入口",
        description: "Claude 账号 + 模板包更适合今天继续卖",
        source: "AI Base",
        url: "https://example.com/claude-repeat-1",
        published_date: "2026-03-25",
        details: { content_html: "<p>claude release template content workflow</p>" },
      },
      {
        title: "Claude 写作模板包继续更新",
        description: "claude skills template release for writers",
        source: "X",
        url: "https://example.com/claude-repeat-2",
        published_date: "2026-03-25",
        details: { content_html: "<p>claude skills template</p>" },
      },
      {
        title: "OpenClaw 微信跑通包有新接入方案",
        description: "openclaw 微信 agent release integration support",
        source: "Twitter",
        url: "https://example.com/openclaw-fresh",
        published_date: "2026-03-25",
        details: { content_html: "<p>openclaw wechat plugin integration release</p>" },
      },
    ],
  };

  const withoutPenalty = buildOpportunityCandidates(input);
  const withPenalty = buildOpportunityCandidates(
    input,
    undefined,
    {
      previousMainTopicSignals: {
        matchedRuleIds: ["claude"],
        matchedTerms: ["claude", "skills"],
        primaryLane: "account",
      },
    }
  );

  assert.equal(withoutPenalty[0].id, "claude");
  assert.notEqual(withPenalty[0].id, "claude");
  const penalizedClaude = withPenalty.find((candidate) => candidate.id === "claude");
  assert.ok(penalizedClaude.replayPenalty > 0);
});
