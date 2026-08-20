import test from "node:test";
import assert from "node:assert/strict";

import {
  escapeHtml,
  normalizeMarkdownImageSyntax,
  normalizeMarkdownMediaUrl,
} from "../src/helpers.js";

test("escapeHtml returns an empty string for nullish values", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("escapeHtml converts non-string values before escaping", () => {
  assert.equal(escapeHtml(123), "123");
});

test("escapeHtml escapes HTML special characters", () => {
  assert.equal(
    escapeHtml(`<script a="1">& 'x'</script>`),
    "&lt;script a=&quot;1&quot;&gt;&amp; &#039;x&#039;&lt;/script&gt;"
  );
});

test("normalizeMarkdownImageSyntax separates a model-generated image title from its URL", () => {
  const malformed =
    '![MiniMax H3榜单](https://img.example.com/chart.jpg?format=jpg/interlace,1"MiniMax H3榜单")';

  assert.equal(
    normalizeMarkdownImageSyntax(malformed),
    '![MiniMax H3榜单](https://img.example.com/chart.jpg?format=jpg/interlace,1 "MiniMax H3榜单")'
  );
});

test("normalizeMarkdownImageSyntax leaves valid image Markdown unchanged", () => {
  const valid =
    '![榜单](https://img.example.com/chart.jpg?format=jpg/interlace,1 "榜单")';
  const withoutTitle = '![榜单](https://img.example.com/chart.jpg?format=jpg)';

  assert.equal(normalizeMarkdownImageSyntax(valid), valid);
  assert.equal(normalizeMarkdownImageSyntax(withoutTitle), withoutTitle);
});

test("normalizeMarkdownImageSyntax decodes nested ampersand escapes only in image URLs", () => {
  const malformed =
    '![豆包截图](https://pbs.twimg.com/media/example?format=jpg\\u0026#x26;name=orig "豆包截图")';

  assert.equal(
    normalizeMarkdownImageSyntax(malformed),
    '![豆包截图](https://pbs.twimg.com/media/example?format=jpg&name=orig "豆包截图")'
  );
  assert.equal(normalizeMarkdownMediaUrl("https://example.com/image?x=1&amp;y=2"), "https://example.com/image?x=1&y=2");
  assert.equal(normalizeMarkdownImageSyntax("正文中的 &#x26; 不应被改写"), "正文中的 &#x26; 不应被改写");
});
