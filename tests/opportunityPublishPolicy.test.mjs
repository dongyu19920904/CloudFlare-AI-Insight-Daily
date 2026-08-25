import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeOpportunityEvidenceBoundaryLanguage,
  validateOpportunityPublication,
} from "../src/publishValidation.js";

function buildOpportunityMarkdown(sourceUrl = "https://github.com/example/video-workflow") {
  return `## 直接结论
今天只验证一个小样，不先做完整产品。
- **做不做：** 做一次小样验证。
- **先验证：** 五位目标用户是否愿意给真实素材。
- **何时停：** 五人都没有意愿就停。

## 今日主推
### 给内容团队交付一支可验收样片
原项目已经可以复现，但付费需求还没有被证明，因此只做一次小样验证。
- **证据与可信度：** 中；[官方仓库：证明项目代码与工作流可核验](${sourceUrl})；本次候选输入未提供真实付费证据。
- **鱼塘与笨办法：** 待验证假设：小内容团队可能仍靠多人手工传脚本和素材。
- **最小交付：** 一支三镜头样片和实际成本记录，不含长期代运营。
- **48小时验证：** 给五位目标用户看样片并询问是否愿意提供真实脚本试做。
- **第一单与复购：** 固定一个脚本、三镜头和一次修改，以可播放样片验收；重复需求出现后再沉淀配置和错误库，否则只是一次性单。
- **风险与停止：** 中，需要核对素材版权和许可边界；无法复现、成本不可控或五位用户都无意愿就停。

## 本周小试
今天没有第二个达到证据门槛的机会，不凑数。

## 今天别碰
今天没有额外需要点名的高风险方向。

## 今日三步
- **今天确认：** 核对许可边界。
- **今天制作：** 做一支三镜头样片。
- **今天询价：** 问五位目标用户是否愿意拿真实脚本试做。`;
}

function buildOpportunityObservationMarkdown(
  sourceUrl = "https://www.36kr.com/p/example-observation",
  criticalSentence = "待核验线索：媒体提到价格可能调整，仍缺官方确认。"
) {
  return `## 直接结论

- **直接答案：** 今天没有新的差异化商机，不凑数。只核验一条可信媒体线索。
- **做不做：** 不启动新交付，也不把线索写成产品事实。
- **先验证：** 先找官方或原项目入口，再问三位目标用户是否出现不同需求。
- **何时停：** 48 小时仍无一手证据，或三位用户都没有不同需求就停止。

## 今日主推

### 观察：核验媒体线索是否有一手依据

**判断：** 这不是新机会，只是一次证据核验。

- **证据与可信度：** 低；[可信媒体只证明出现了这条线索](${sourceUrl})；${criticalSentence}
- **鱼塘与笨办法：** 待验证假设：小团队可能需要核对这项变化是否影响现有流程。
- **最小交付：** 一页证据和需求核对表，不提供部署或代运营。
- **48小时验证：** 找到官方入口，并访谈三位目标用户是否提出不同验收结果。
- **第一单与复购：** 尚不进入成交阶段；只有一手证据和新需求同时出现才重新评估。
- **风险与停止：** 风险中；没有官方或原项目确认就停止，不把媒体线索换壳成商品。

## 本周小试

今天没有第二个达到证据门槛的机会，不凑数。

## 今天别碰

今天没有额外需要点名的高风险方向。

## 今日三步

- **今天确认：** 核对媒体线索对应的官方入口。
- **今天制作：** 只做一页证据与需求核对表。
- **今天询价：** 问三位目标用户是否出现不同需求。`;
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

test("opportunity observation accepts a bounded trusted-media clue", () => {
  const sourceUrl = "https://www.36kr.com/p/example-observation";
  const result = validateOpportunityPublication({
    markdown: buildOpportunityObservationMarkdown(sourceUrl),
    allowedSourceUrls: [sourceUrl],
    sourceEvidence: [{ url: sourceUrl, tier: "trusted-media", isPrimary: false }],
    observationMode: true,
  });

  assert.equal(result.ok, true, result.issues.join("\n"));
});

test("opportunity observation still rejects an unbounded media price claim", () => {
  const sourceUrl = "https://www.36kr.com/p/example-observation";
  const result = validateOpportunityPublication({
    markdown: buildOpportunityObservationMarkdown(
      sourceUrl,
      "媒体已经确认价格全面上涨。"
    ),
    allowedSourceUrls: [sourceUrl],
    sourceEvidence: [{ url: sourceUrl, tier: "trusted-media", isPrimary: false }],
    observationMode: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /必须引用官方或原项目来源/);
});

test("opportunity publication ignores deterministic replay metadata after the action section", () => {
  const sourceUrl = "https://github.com/example/video-workflow";
  const metadata = Array.from(
    { length: 4 },
    (_, index) =>
      `<!-- opportunity-replay: {"entity":"entity-${index}","businessModel":"service","deliveryType":"sample","commercialSignature":"entity-${index}|service|sample"} -->`,
  ).join("\n");
  const result = validateOpportunityPublication({
    markdown: `${buildOpportunityMarkdown(sourceUrl)}\n\n${metadata}`,
    allowedSourceUrls: [sourceUrl],
    sourceEvidence: [{ url: sourceUrl, isPrimary: true }],
  });

  assert.equal(result.ok, true, result.issues.join("\n"));
});

test("opportunity publication rejects a model-authored H1", () => {
  const sourceUrl = "https://github.com/example/video-workflow";
  const result = validateOpportunityPublication({
    markdown: `# 今日 AI 商机\n\n${buildOpportunityMarkdown(sourceUrl)}`,
    allowedSourceUrls: [sourceUrl],
    sourceEvidence: [{ url: sourceUrl, isPrimary: true }],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /不得输出一级标题/);
});

test("opportunity publication rejects links and extra prose in the three actions", () => {
  const sourceUrl = "https://github.com/example/video-workflow";
  const malformed = buildOpportunityMarkdown(sourceUrl).replace(
    "- **今天确认：** 核对许可边界。",
    `- **今天确认：** 打开[官方仓库](${sourceUrl})核对许可边界。\n这里再解释一段背景。`,
  );
  const result = validateOpportunityPublication({
    markdown: malformed,
    allowedSourceUrls: [sourceUrl],
    sourceEvidence: [{ url: sourceUrl, isPrimary: true }],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /不得附加段落或子列表/);
  assert.match(result.issues.join(" | "), /不得重复来源链接/);
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
    "待验证假设：小内容团队可能仍靠多人手工传脚本和素材。",
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

test("opportunity publication rejects unsupported claims that a media article has no official link", () => {
  const qualifiedUrl = "https://github.com/example/video-workflow";
  const rejectedUrl = "https://www.36kr.com/p/example";
  const markdown = buildOpportunityMarkdown(qualifiedUrl).replace(
    "今天没有额外需要点名的高风险方向。",
    `[36kr 报道](${rejectedUrl})没有指向官方仓库，所以这条一定无法核验。`
  );
  const result = validateOpportunityPublication({
    markdown,
    allowedSourceUrls: [qualifiedUrl],
    allowedRejectedSourceUrls: [rejectedUrl],
    sourceEvidence: [{ url: qualifiedUrl, isPrimary: true }],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /禁止模式/);
});

test("opportunity publication rejects media absence claims and zero-risk license conclusions", () => {
  const sourceUrl = "https://github.com/example/video-workflow";
  const markdown = buildOpportunityMarkdown(sourceUrl)
    .replace(
      "今天没有额外需要点名的高风险方向。",
      "只有媒体转述，无原项目链接或产品演示。"
    )
    .replace(
      "中，需要核对素材版权和许可边界",
      "低，MIT 许可，无授权风险"
    );
  const result = validateOpportunityPublication({
    markdown,
    allowedSourceUrls: [sourceUrl],
    allowedRejectedSourceUrls: ["https://example.com/rejected"],
    sourceEvidence: [{ url: sourceUrl, isPrimary: true }],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /禁止模式/);
});

test("opportunity publication requires evidence gaps to be scoped to candidate input", () => {
  const sourceUrl = "https://github.com/example/video-workflow";
  const markdown = buildOpportunityMarkdown(sourceUrl)
    .replace(
      "本次候选输入未提供真实付费证据。",
      "尚无真实付费证据。"
    )
    .replace(
      "今天没有额外需要点名的高风险方向。",
      "只有融资金额和采访语录，无官方产品主页、GitHub 仓库或可复现演示。"
    );
  const result = validateOpportunityPublication({
    markdown,
    allowedSourceUrls: [sourceUrl],
    allowedRejectedSourceUrls: ["https://example.com/rejected"],
    sourceEvidence: [{ url: sourceUrl, isPrimary: true }],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /禁止模式/);
});

test("opportunity publication rejects duplicate evidence links and unverified no-risk wording", () => {
  const sourceUrl = "https://github.com/example/video-workflow";
  const markdown = buildOpportunityMarkdown(sourceUrl)
    .replace(
      "原项目已经可以复现",
      `[原项目仓库](${sourceUrl})已经可以复现`
    )
    .replace(
      "中，需要核对素材版权和许可边界",
      "低，无已知商标或内容限制"
    );
  const result = validateOpportunityPublication({
    markdown,
    allowedSourceUrls: [sourceUrl],
    sourceEvidence: [{ url: sourceUrl, isPrimary: true }],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join(" | "), /不得重复引用同一个来源链接/);
  assert.match(result.issues.join(" | "), /禁止模式/);
});

test("opportunity evidence normalization scopes model absence claims before validation", () => {
  const sourceUrl = "https://www.36kr.com/p/example";
  const normalized = normalizeOpportunityEvidenceBoundaryLanguage(`## 今日主推
### 验证一个机会
这篇媒体报道没有提供官方产品主页或原项目链接，但可以作为场景线索。
- **证据与可信度：** 中；尚无任何付费记录，没有任何用户原话或询价记录，无已知商标限制。
- **鱼塘与笨办法：** 目前只有项目存在证明，没有买家痛点访谈。
- **风险与停止：** 仍需核对许可。**停止条件：** 五位目标用户均没有付费意向就停。

## 今天别碰
[融资报道](${sourceUrl})——只有融资和采访信息，无官方产品主页或可复现演示。

## 今日三步
- **今天确认：** 先核对。`);

  assert.match(normalized, /本次候选输入未提供付费记录/);
  assert.match(normalized, /本次候选输入未提供用户原话或询价记录/);
  assert.match(normalized, /本次候选输入未提供买家痛点访谈/);
  assert.match(normalized, /停止条件：\*\* 五位目标用户均没有付费意向就停/);
  assert.doesNotMatch(normalized, /均本次候选输入未提供付费意向/);
  assert.match(normalized, /相关商标、内容、依赖与授权边界仍待核对/);
  assert.match(
    normalized,
    /本次候选输入未提供可核验的官方产品或原项目链接，但可以作为场景线索/
  );
  assert.doesNotMatch(normalized, /媒体报道没有提供官方产品主页/);
  assert.match(
    normalized,
    /本次候选输入未提供可核验的官方产品或原项目链接，也未提供可复现的交付证据/
  );
  assert.doesNotMatch(normalized, /只有融资和采访信息，无官方产品主页/);
});

test("opportunity observation normalization bounds every unsupported sensitive clause", () => {
  const normalized = normalizeOpportunityEvidenceBoundaryLanguage(
    `## 今日主推

### 观察：核验媒体提到的价格变化

**判断：** 媒体称价格已经调整；授权范围也有变化；仍缺官方确认。

- **证据与可信度：** [可信媒体只证明出现了这条线索](https://www.36kr.com/p/example)；可信度低。

## 今日三步

- **今天确认：** 只核对官方页面。`,
    { observationMode: true }
  );

  const sensitiveClauses = normalized
    .split(/\r?\n|[。；;]/)
    .filter((clause) => /价格|授权|许可|额度|政策/.test(clause));
  assert.ok(sensitiveClauses.length >= 3);
  assert.ok(
    sensitiveClauses.every((clause) =>
      /没有取得|没有|尚无|尚未|未获|未确认|待核验|仍缺|缺少官方|不承诺|不能确认|无法确认|不启动|不进入/.test(
        clause
      )
    )
  );
  assert.match(normalized, /^### 观察：待核验线索：/m);
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
  const repeated = "重复背景不帮助用户做决定。".repeat(110);
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
    markdown: buildOpportunityMarkdown(mediaUrl).replace(
      "中，需要核对素材版权和许可边界",
      "低，项目采用 MIT 许可，可以直接商业分发"
    ),
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
