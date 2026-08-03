import test from "node:test";
import assert from "node:assert/strict";

import { validateOpportunityPublication } from "../src/publishValidation.js";

function buildOpportunityMarkdown(sourceUrl = "https://github.com/example/video-workflow") {
  return `# 今日 AI 商机

## 直接结论
今天只验证一个小样，不先做完整产品。
- **做不做：** 做一次小样验证。
- **先验证：** 五位目标用户是否愿意给真实素材。
- **何时停：** 五人都没有意愿就停。

## 今日主推
### 给内容团队交付一支可验收样片
原项目已经可以复现，但付费需求还没有被证明，因此只做一次小样验证。
- **可验证信号：** 原项目发布了视频内容工作流。
- **证据来源：** [官方仓库：证明项目代码与工作流可核验](${sourceUrl})
- **可信度：** 中
- **目标鱼塘与笨办法：** 小内容团队仍靠多人手工传脚本和素材。
- **最小交付：** 一支三镜头样片和实际成本记录，不含长期代运营。
- **48小时验证：** 给五位目标用户看样片并询问是否愿意提供真实脚本试做。
- **第一单：** 固定一个脚本、三镜头和一次修改，以可播放样片验收。
- **复购或资产：** 重复需求出现后再沉淀配置和错误库，否则只是一次性单。
- **证据缺口：** 没有真实付费证据。
- **售后与合规风险：** 中，需要核对素材版权和许可边界。
- **停止条件：** 无法复现、成本不可控或五位用户都无意愿。

## 本周小试
今天没有第二个达到证据门槛的机会，不凑数。

## 今天别碰
今天没有额外需要点名的高风险方向。

## 今日三步
- **今天确认：** 核对许可边界。
- **今天制作：** 做一支三镜头样片。
- **今天询价：** 问五位目标用户是否愿意拿真实脚本试做。`;
}

test("opportunity publication accepts an allowlisted primary source", () => {
  const sourceUrl = "https://github.com/example/video-workflow";
  const result = validateOpportunityPublication({
    markdown: buildOpportunityMarkdown(sourceUrl),
    allowedSourceUrls: [sourceUrl],
    sourceEvidence: [{ url: sourceUrl, isPrimary: true }],
  });

  assert.equal(result.ok, true, result.issues.join("\n"));
  assert.equal(result.opportunityCount, 1);
});

test("opportunity publication rejects a source URL invented outside the candidate set", () => {
  const result = validateOpportunityPublication({
    markdown: buildOpportunityMarkdown("https://invented.example.com/source"),
    allowedSourceUrls: ["https://github.com/example/video-workflow"],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /合格候选之外的来源链接/);
});

test("a rejected candidate cannot be promoted into the main opportunity", () => {
  const qualifiedUrl = "https://github.com/example/qualified-workflow";
  const rejectedUrl = "https://github.com/example/replayed-workflow";
  const result = validateOpportunityPublication({
    markdown: buildOpportunityMarkdown(rejectedUrl),
    allowedSourceUrls: [qualifiedUrl],
    allowedRejectedSourceUrls: [rejectedUrl],
    sourceEvidence: [
      { url: qualifiedUrl, isPrimary: true },
      { url: rejectedUrl, isPrimary: true },
    ],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /合格候选之外的来源链接/);
});

test("the avoid section may cite only a rejected candidate", () => {
  const qualifiedUrl = "https://github.com/example/video-workflow";
  const rejectedUrl = "https://t.me/example/repeated-pitch";
  const markdown = buildOpportunityMarkdown(qualifiedUrl).replace(
    "今天没有额外需要点名的高风险方向。",
    `[重复工作流：证明它只有社交转述](${rejectedUrl}) 仍缺少原项目证据。`
  );
  const result = validateOpportunityPublication({
    markdown,
    allowedSourceUrls: [qualifiedUrl],
    allowedRejectedSourceUrls: [rejectedUrl],
    sourceEvidence: [{ url: qualifiedUrl, isPrimary: true }],
  });

  assert.equal(result.ok, true, result.issues.join("\n"));
});

test("a named avoid item must cite its rejected source", () => {
  const qualifiedUrl = "https://github.com/example/video-workflow";
  const rejectedUrl = "https://t.me/example/repeated-pitch";
  const markdown = buildOpportunityMarkdown(qualifiedUrl).replace(
    "今天没有额外需要点名的高风险方向。",
    "这个批量视频方向目前只有社交转述，先不要投入。"
  );
  const result = validateOpportunityPublication({
    markdown,
    allowedSourceUrls: [qualifiedUrl],
    allowedRejectedSourceUrls: [rejectedUrl],
    sourceEvidence: [{ url: qualifiedUrl, isPrimary: true }],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /今天别碰.*引用被拒候选来源/);
});

test("the avoid section cannot name an item when no rejected candidate exists", () => {
  const qualifiedUrl = "https://github.com/example/video-workflow";
  const markdown = buildOpportunityMarkdown(qualifiedUrl).replace(
    "今天没有额外需要点名的高风险方向。",
    "这个批量视频方向目前证据不足，先不要投入。"
  );
  const result = validateOpportunityPublication({
    markdown,
    allowedSourceUrls: [qualifiedUrl],
    allowedRejectedSourceUrls: [],
    sourceEvidence: [{ url: qualifiedUrl, isPrimary: true }],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /没有被拒候选.*不得点名/);
});

test("opportunity publication rejects unsupported universal market claims", () => {
  const sourceUrl = "https://github.com/example/video-workflow";
  const markdown = buildOpportunityMarkdown(sourceUrl).replace(
    "小内容团队仍靠多人手工传脚本和素材。",
    "目标用户不缺，每个人都会为这项服务付费。"
  );
  const result = validateOpportunityPublication({
    markdown,
    allowedSourceUrls: [sourceUrl],
    sourceEvidence: [{ url: sourceUrl, isPrimary: true }],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /禁止模式/);
});

test("opportunity publication rejects an unproven willingness-to-pay headline", () => {
  const sourceUrl = "https://github.com/example/video-workflow";
  const markdown = buildOpportunityMarkdown(sourceUrl).replace(
    "### 给内容团队交付一支可验收样片",
    "### 给内容团队交付样片——卡在剪辑的人愿意直接花钱跳过"
  );
  const result = validateOpportunityPublication({
    markdown,
    allowedSourceUrls: [sourceUrl],
    sourceEvidence: [{ url: sourceUrl, isPrimary: true }],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /禁止模式/);
});

test("opportunity publication rejects generic crowd claims and invented time estimates", () => {
  const sourceUrl = "https://github.com/example/video-workflow";
  const markdown = buildOpportunityMarkdown(sourceUrl).replace(
    "原项目已经可以复现，但付费需求还没有被证明，因此只做一次小样验证。",
    "这是用户的共同烦恼，而且预计 1-2 小时就能跑通。"
  );
  const result = validateOpportunityPublication({
    markdown,
    allowedSourceUrls: [sourceUrl],
    sourceEvidence: [{ url: sourceUrl, isPrimary: true }],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /禁止模式/);
});

test("a GitHub repository root cannot be labeled as a direct license page", () => {
  const sourceUrl = "https://github.com/example/video-workflow";
  const markdown = buildOpportunityMarkdown(sourceUrl).replace(
    "官方仓库：证明项目代码与工作流可核验",
    "项目的 LICENSE 文件"
  );
  const result = validateOpportunityPublication({
    markdown,
    allowedSourceUrls: [sourceUrl],
    sourceEvidence: [{ url: sourceUrl, isPrimary: true }],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /仓库首页描述成 LICENSE/);
});

test("opportunity publication rejects an overlong main item", () => {
  const sourceUrl = "https://github.com/example/video-workflow";
  const repeated = "重复背景不帮助用户做决定。".repeat(90);
  const markdown = buildOpportunityMarkdown(sourceUrl).replace(
    "原项目已经可以复现，但付费需求还没有被证明，因此只做一次小样验证。",
    repeated
  );
  const result = validateOpportunityPublication({
    markdown,
    allowedSourceUrls: [sourceUrl],
    sourceEvidence: [{ url: sourceUrl, isPrimary: true }],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /今日主推.*过长/);
});

test("opportunity publication rejects an overlong action section", () => {
  const sourceUrl = "https://github.com/example/video-workflow";
  const repeated = "继续重复背景并不能帮助今天行动。".repeat(55);
  const markdown = buildOpportunityMarkdown(sourceUrl).replace(
    "- **今天制作：** 做一支三镜头样片。",
    `- **今天制作：** ${repeated}`
  );
  const result = validateOpportunityPublication({
    markdown,
    allowedSourceUrls: [sourceUrl],
    sourceEvidence: [{ url: sourceUrl, isPrimary: true }],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /今日三步.*过长/);
});

test("opportunity publication requires primary evidence for policy and license claims", () => {
  const mediaUrl = "https://www.jiqizhixin.com/articles/example";
  const result = validateOpportunityPublication({
    markdown: buildOpportunityMarkdown(mediaUrl),
    allowedSourceUrls: [mediaUrl],
    sourceEvidence: [{ url: mediaUrl, isPrimary: false }],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /必须引用官方或原项目来源/);
});

test("opportunity publication rejects non-whitelisted Aivora links", () => {
  const sourceUrl = "https://github.com/example/video-workflow";
  const markdown = `${buildOpportunityMarkdown(sourceUrl)}\n\n[爱窝啦](https://www.aivora.cn/products/expired)`;
  const result = validateOpportunityPublication({
    markdown,
    allowedSourceUrls: [sourceUrl],
    sourceEvidence: [{ url: sourceUrl, isPrimary: true }],
    aivoraLinkPolicy: { allowedUrls: ["https://www.aivora.cn/"] },
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /实时 sitemap|品牌名/);
});
