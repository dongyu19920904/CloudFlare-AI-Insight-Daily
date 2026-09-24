import test from "node:test";
import assert from "node:assert/strict";

import { archiveDailyTelegramImages, extractTelegramDailyImageCandidate } from "../src/dailyTelegramImageArchive.js";
import { buildDailyPromptSelection } from "../src/dailyPromptSelection.js";

const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

function telegramItem(id) {
  return {
    type: "news",
    title: "AI 新闻 " + id,
    url: "https://t.me/aigc1024/" + id,
    published_date: "2026-09-24",
    details: { content_html: '<p>AI 新闻有原图。</p><img src="https://cdn5.telesco.pe/file/' + id + '.jpg">' },
  };
}

function archiveDependencies(options = {}) {
  const uploads = [];
  const existingPaths = options.existingPaths || new Set();
  return {
    uploads,
    dependencies: {
      fetchImage: async (url) => {
        if (options.failPost && url.includes(options.failPost)) throw new Error("image unavailable");
        return new Response(imageBytes, { headers: { "Content-Type": "image/jpeg" } });
      },
      getFileSha: async (_env, path) => existingPaths.has(path) ? "existing-sha" : null,
      putFile: async (_env, path, method, payload) => {
        assert.equal(method, "PUT");
        assert.equal(payload.content, btoa(String.fromCharCode(...imageBytes)));
        uploads.push(path);
      },
    },
  };
}

test("Telegram candidates are kept for archiving without exposing expiring URLs to the prompt", () => {
  const item = telegramItem("24966");
  const selection = buildDailyPromptSelection({ news: [item], project: [], socialMedia: [], paper: [] });
  assert.equal(selection.telegramImageCandidates.length, 1);
  assert.equal(selection.mediaCandidates.length, 0);
  assert.doesNotMatch(selection.selectedContentItems.join("\n"), /telesco\.pe/);
  assert.equal(extractTelegramDailyImageCandidate({ ...item, url: "https://example.com/24966" }), null);
});

test("archives four exact-source images even after six other images", async () => {
  const existing = Array.from({ length: 6 }, (_, index) => [
    "### " + (index + 1) + ". Existing AI story",
    "[Source](https://example.com/" + index + ")",
    "![Existing](https://example.com/" + index + ".jpg)",
  ].join("\n\n")).join("\n\n");
  const posts = ["24966", "24962", "24959", "24955"];
  const late = posts.map((id, index) => "### " + (index + 7) + ". AI story " + id + "\n\n[原帖](https://t.me/aigc1024/" + id + ")。\n\n---").join("\n\n");
  const markdown = "## **🔥 今日焦点 TOP 10**\n\n" + existing + "\n\n" + late;
  const { uploads, dependencies } = archiveDependencies();
  const result = await archiveDailyTelegramImages(
    markdown, posts.map((id) => extractTelegramDailyImageCandidate(telegramItem(id))),
    "2026-09-24", { GITHUB_BRANCH: "main" }, dependencies
  );

  assert.equal(result.attemptedCount, 4);
  assert.equal(result.archivedCount, 4);
  assert.equal(uploads.length, 4);
  for (const id of posts) assert.ok(result.markdown.includes("/images/daily/2026-09-24/telegram-aigc1024-" + id + ".jpg"));
  assert.doesNotMatch(result.markdown, /telesco\.pe/);
  assert.match(result.markdown, /https:\/\/example\.com\/0\.jpg/);
});

test("one failed image does not block another or the daily", async () => {
  const markdown = "## **🔥 今日焦点 TOP 2**\n\n### 1. First AI item\n\n[原帖](https://t.me/aigc1024/24966)。\n\n### 2. Second AI item\n\n[原帖](https://t.me/aigc1024/24962)。";
  const { dependencies } = archiveDependencies({ failPost: "24966" });
  const result = await archiveDailyTelegramImages(markdown, [
    extractTelegramDailyImageCandidate(telegramItem("24966")),
    extractTelegramDailyImageCandidate(telegramItem("24962")),
  ], "2026-09-24", {}, dependencies);

  assert.equal(result.archivedCount, 1);
  assert.doesNotMatch(result.markdown.split("### 2.")[0], /\/images\/daily/);
  assert.match(result.markdown, /telegram-aigc1024-24962\.jpg/);
});

test("multiple GitHub uploads are serialized on the same branch", async () => {
  const posts = ["24966", "24962", "24959"];
  const markdown = "## **🔥 今日焦点 TOP 3**\n\n" + posts.map((id) =>
    "### AI story " + id + "\n\n[原帖](https://t.me/aigc1024/" + id + ")。"
  ).join("\n\n");
  const { dependencies } = archiveDependencies();
  let activeUploads = 0;
  let maxActiveUploads = 0;
  dependencies.putFile = async () => {
    activeUploads += 1;
    maxActiveUploads = Math.max(maxActiveUploads, activeUploads);
    await new Promise((resolve) => setTimeout(resolve, 5));
    activeUploads -= 1;
  };
  const result = await archiveDailyTelegramImages(
    markdown,
    posts.map((id) => extractTelegramDailyImageCandidate(telegramItem(id))),
    "2026-09-24", {}, dependencies
  );
  assert.equal(result.archivedCount, 3);
  assert.equal(maxActiveUploads, 1);
});

test("an existing archive is reused without fetching the expiring URL", async () => {
  const path = "static/images/daily/2026-09-24/telegram-aigc1024-24966.jpg";
  const { uploads, dependencies } = archiveDependencies({ existingPaths: new Set([path]) });
  dependencies.fetchImage = () => { throw new Error("must not fetch original again"); };
  const markdown = "## **🔥 今日焦点 TOP 1**\n\n### 1. AI item\n\n[原帖](https://t.me/aigc1024/24966)。";
  const result = await archiveDailyTelegramImages(markdown, [extractTelegramDailyImageCandidate(telegramItem("24966"))], "2026-09-24", {}, dependencies);

  assert.equal(result.archivedCount, 1);
  assert.equal(uploads.length, 0);
  assert.match(result.markdown, /\/images\/daily\/2026-09-24\/telegram-aigc1024-24966\.jpg/);
});
