import test from "node:test";
import assert from "node:assert/strict";

import { callChatAPI } from "../src/chatapi.js";

test("Anthropic 429 falls back to the backup model when OpenAI is unavailable", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedModels = [];

  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    requestedModels.push(payload.model);

    if (payload.model === "claude-sonnet-5") {
      return new Response(JSON.stringify({ error: { message: "token load" } }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      content: [{ type: "text", text: "OK" }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await callChatAPI({
    USE_MODEL_PLATFORM: "ANTHROPIC",
    ANTHROPIC_API_URL: "https://example.test",
    ANTHROPIC_API_KEY: "primary-key",
    DEFAULT_ANTHROPIC_MODEL: "claude-sonnet-5",
    DEFAULT_ANTHROPIC_BACKUP_MODEL: "claude-opus-4-7",
    ANTHROPIC_RETRY_MAX: "0",
  }, "Reply only: OK");

  assert.equal(result, "OK");
  assert.deepEqual(requestedModels, ["claude-sonnet-5", "claude-opus-4-7"]);
});

test("fallback order is Anthropic primary, OpenAI, then Anthropic backup model", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedModels = [];

  globalThis.fetch = async (url, options) => {
    const payload = JSON.parse(options.body);
    requestedModels.push(payload.model);

    if (payload.model === "claude-opus-4-7") {
      return new Response(JSON.stringify({
        content: [{ type: "text", text: "OK" }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    assert.match(String(url), payload.model === "gpt-5.6-sol" ? /chat\/completions$/ : /messages$/);
    return new Response(JSON.stringify({ error: { message: "token load" } }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await callChatAPI({
    USE_MODEL_PLATFORM: "ANTHROPIC",
    ANTHROPIC_API_URL: "https://anthropic.example.test",
    ANTHROPIC_API_KEY: "primary-key",
    DEFAULT_ANTHROPIC_MODEL: "claude-sonnet-5",
    DEFAULT_ANTHROPIC_BACKUP_MODEL: "claude-opus-4-7",
    ANTHROPIC_RETRY_MAX: "0",
    OPENAI_BASE_URL: "https://openai.example.test",
    OPENAI_API_KEY: "openai-key",
    DEFAULT_OPEN_MODEL: "gpt-5.6-sol",
  }, "Reply only: OK");

  assert.equal(result, "OK");
  assert.deepEqual(requestedModels, ["claude-sonnet-5", "gpt-5.6-sol", "claude-opus-4-7"]);
});
