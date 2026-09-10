import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDailyTopEvidenceLinkLabels } from "../src/dailySectionSanitizer.js";
import { extractDailyMarkdownLinks } from "../src/dailyMarkdownItems.js";

const page = (body) => `## **🔥 今日焦点 TOP 10**\n\n### 1. 不能被塞回正文的测试新闻标题\n\n${body}`;
const visible = (text) => text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1").replace(/\*\*/g, "");

const cases = [
  ["an uncertain complete clause", "[报道](https://example.com/a)显示，暂不能证明该模型已经开放。仍需验证。", "报道显示，[暂不能证明该模型已经开放](https://example.com/a)"],
  ["a qualified personal test", "[作者的实测记录](https://example.com/b)：在这次测试中排版没有改变，其他文件未测试。", "作者的实测记录：[在这次测试中排版没有改变](https://example.com/b)"],
  ["a complete clause from an overlong link", "[研究者使用两个公开的数据集测试了这个系统，结果仅适用于这些样本，尚未验证其他环境](https://example.com/c)。", "[研究者使用两个公开的数据集测试了这个系统](https://example.com/c)"],
  ["a sentence without a short clause", "[这个非常长的产品英文名称ExampleExtendedProductName支持多种设备之间的长期数据同步](https://example.com/d)。", null],
  ["an already concise factual link", "研究者[只在两份文档中测试](https://example.com/e)了这个系统。", null],
  ["a standalone source", "[作者的实测记录](https://example.com/f)。下一句不能挪到上一句。", null],
  ["a following source link", "[报道](https://example.com/g)显示，[模型只开放了邀请测试](https://example.com/h)。", null],
  ["inline code", "`[报道](https://example.com/i)显示，模型仅开放了邀请测试。`", null],
  ["escaped Markdown", "\\[报道](https://example.com/escaped)显示，模型仅开放了邀请测试。", null],
  ["indented code", "    [报道](https://example.com/indented)显示，模型仅开放了邀请测试。", null],
  ["fenced code", "```md\n[报道](https://example.com/j)显示，模型仅开放了邀请测试。\n```", null],
  ["HTML", '<div>[报道](https://example.com/k)显示，模型仅开放了邀请测试。</div>', null],
  ["an optional link title", '[报道](https://example.com/l "证据")显示，模型仅开放了邀请测试。', null],
  ["a parenthesized URL", "[报道](https://example.com/wiki/Test_(model))显示，模型仅开放了邀请测试。", null],
  ["no crossing a line boundary", "[报道](https://example.com/m)显示，\n模型仅开放了邀请测试。", null],
];

for (const [name, body, expected] of cases) {
  test(`evidence link preserves words and URLs for ${name}`, () => {
    const before = page(body);
    const after = normalizeDailyTopEvidenceLinkLabels(before);
    assert.equal(visible(after), visible(before));
    assert.deepEqual(extractDailyMarkdownLinks(after).map((link) => link.url), extractDailyMarkdownLinks(before).map((link) => link.url));
    assert.equal(normalizeDailyTopEvidenceLinkLabels(after), after, "normalization is idempotent");
    assert.ok(!after.includes("[不能被塞回正文的测试新闻标题]"));
    if (expected) assert.ok(after.includes(expected), after);
    else assert.equal(after, before);
  });
}

test("an identical image link before the source link is never rewritten", () => {
  const image = "![报道](https://example.com/shared)";
  const before = page(`${image}\n\n[报道](https://example.com/shared)显示，模型仅开放了邀请测试。`);
  const after = normalizeDailyTopEvidenceLinkLabels(before);
  assert.ok(after.includes(image));
  assert.ok(after.includes("报道显示，[模型仅开放了邀请测试](https://example.com/shared)"));
  assert.equal(visible(after), visible(before));
});

test("non-TOP sections and repeated source URLs are not rewritten globally", () => {
  const source = "[报道](https://example.com/a)显示，模型仅开放了邀请测试。";
  const section = `\n\n## **◉ 社媒精选**\n\n### 非编号的社媒条目\n\n${source}`;
  const after = normalizeDailyTopEvidenceLinkLabels(page(source) + section);
  assert.ok(after.endsWith(section));
});
