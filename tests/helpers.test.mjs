import test from "node:test";
import assert from "node:assert/strict";

import { escapeHtml } from "../src/helpers.js";

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
