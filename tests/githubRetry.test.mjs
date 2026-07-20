import test from "node:test";
import assert from "node:assert/strict";

import { callGitHubApi } from "../src/github.js";

const env = {
  GITHUB_TOKEN: "test-token",
  GITHUB_REPO_OWNER: "owner",
  GITHUB_REPO_NAME: "repo",
  GITHUB_API_RETRY_MAX: "1",
  GITHUB_API_RETRY_BASE_MS: "0",
};

test("GitHub API retries a transient 503 response", async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ message: "temporarily unavailable" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ sha: "abc123" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await callGitHubApi(env, "/contents/daily/test.md");

  assert.equal(calls, 2);
  assert.equal(result.sha, "abc123");
});

test("GitHub API does not retry a permanent 404 response", async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ message: "Not Found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(
    callGitHubApi(env, "/contents/missing.md"),
    /failed: 404 - Not Found/
  );
  assert.equal(calls, 1);
});
