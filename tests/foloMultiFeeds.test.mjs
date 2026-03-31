import test from "node:test";
import assert from "node:assert/strict";

import FoloMultiFeedsDataSource from "../src/dataSources/folo-multi-feeds.js";

test("FoloMultiFeedsDataSource respects FOLO_NEWS_MAX_IDS and keeps earlier IDs first", async () => {
  const originalFetch = global.fetch;
  const originalRandom = Math.random;
  const requestedIds = [];

  Math.random = () => 0;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    requestedIds.push(body.feedId || body.listId);

    return {
      ok: true,
      async json() {
        return {
          data: [
            {
              entries: {
                id: `entry-${body.feedId || body.listId}`,
                url: `https://example.com/${body.feedId || body.listId}`,
                title: `title-${body.feedId || body.listId}`,
                content: "<p>content</p>",
                publishedAt: new Date().toISOString(),
                author: "tester",
              },
              feeds: {
                title: `feed-${body.feedId || body.listId}`,
              },
            },
          ],
        };
      },
    };
  };

  try {
    const env = {
      FOLO_NEWS_IDS: "id-a,id-b,id-c",
      FOLO_NEWS_ID_TYPE: "feed",
      FOLO_NEWS_FETCH_PAGES: "1",
      FOLO_NEWS_MAX_IDS: "2",
      FOLO_FILTER_DAYS: "2",
      FOLO_DATA_API: "https://example.com/folo",
    };

    await FoloMultiFeedsDataSource.fetch(env, "");

    assert.deepEqual(requestedIds, ["id-a", "id-b"]);
  } finally {
    global.fetch = originalFetch;
    Math.random = originalRandom;
  }
});

test("FoloMultiFeedsDataSource keeps supplemental IDs as add-ons without moving them ahead of primary IDs", async () => {
  const originalFetch = global.fetch;
  const originalRandom = Math.random;
  const requestedIds = [];

  Math.random = () => 0;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    requestedIds.push(body.feedId || body.listId);

    return {
      ok: true,
      async json() {
        return { data: [] };
      },
    };
  };

  try {
    const env = {
      FOLO_NEWS_IDS: "old-a,old-b,old-c,extra-1,extra-2",
      FOLO_NEWS_ID_TYPE: "feed",
      FOLO_NEWS_FETCH_PAGES: "1",
      FOLO_NEWS_MAX_IDS: "4",
      FOLO_NEWS_SUPPLEMENTAL_IDS: "extra-1,extra-2",
      FOLO_FILTER_DAYS: "2",
      FOLO_DATA_API: "https://example.com/folo",
    };

    await FoloMultiFeedsDataSource.fetch(env, "");

    assert.deepEqual(requestedIds, ["old-a", "old-b", "extra-1", "extra-2"]);
  } finally {
    global.fetch = originalFetch;
    Math.random = originalRandom;
  }
});
