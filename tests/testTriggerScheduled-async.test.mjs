import assert from "node:assert/strict";
import { handleTestTriggerScheduled } from "../src/handlers/testTriggerScheduled.js";

const env = {
  TEST_TRIGGER_SECRET: "secret"
};

let waitUntilCalled = false;
const ctx = {
  waitUntil: (promise) => {
    waitUntilCalled = true;
    return promise;
  }
};

let handlerCalls = 0;
const handler = async () => {
  handlerCalls += 1;
  return { success: true };
};

const asyncRequest = new Request("https://example.com/testTriggerScheduled?key=secret");
const asyncResponse = await handleTestTriggerScheduled(asyncRequest, env, ctx, handler);
const asyncBody = await asyncResponse.json();

assert.equal(asyncResponse.status, 202);
assert.equal(asyncBody.async, true);
assert.equal(waitUntilCalled, true);
assert.equal(handlerCalls, 1);

waitUntilCalled = false;
const syncRequest = new Request("https://example.com/testTriggerScheduled?key=secret&sync=1");
const syncResponse = await handleTestTriggerScheduled(syncRequest, env, ctx, handler);
const syncBody = await syncResponse.json();

assert.equal(syncResponse.status, 200);
assert.equal(syncBody.async, false);
assert.equal(handlerCalls, 2);

console.log("testTriggerScheduled async tests passed");
