import test from "node:test";
import assert from "node:assert/strict";

import {
  handleMediaProxy,
  parseMediaProxyTarget,
} from "../src/handlers/mediaProxy.js";

test("parseMediaProxyTarget rejects non-twitter hosts", () => {
  const requestUrl = new URL(
    "https://example.com/mediaProxy?url=" +
      encodeURIComponent("https://example.com/video.mp4")
  );

  const result = parseMediaProxyTarget(requestUrl);

  assert.equal(result.status, 400);
  assert.equal(result.error, "Unsupported media host.");
});

test("handleMediaProxy forwards range headers and preserves partial content headers", async () => {
  const originalFetch = global.fetch;

  global.fetch = async (url, options) => {
    assert.equal(url, "https://video.twimg.com/ext_tw_video/test.mp4");
    assert.equal(options.method, "GET");
    assert.equal(options.headers.get("range"), "bytes=0-99");

    return new Response("video-bytes", {
      status: 206,
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
        "Content-Length": "100",
        "Content-Range": "bytes 0-99/1000",
        "Content-Type": "video/mp4",
      },
    });
  };

  try {
    const request = new Request(
      "https://worker.example/mediaProxy?url=" +
        encodeURIComponent("https://video.twimg.com/ext_tw_video/test.mp4"),
      {
        headers: {
          Range: "bytes=0-99",
        },
      }
    );

    const response = await handleMediaProxy(request);

    assert.equal(response.status, 206);
    assert.equal(response.headers.get("accept-ranges"), "bytes");
    assert.equal(response.headers.get("content-range"), "bytes 0-99/1000");
    assert.equal(response.headers.get("content-type"), "video/mp4");
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(await response.text(), "video-bytes");
  } finally {
    global.fetch = originalFetch;
  }
});
