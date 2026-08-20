import test from "node:test";
import assert from "node:assert/strict";

import {
  countUsableDailyMedia,
  ensureDailyMediaCoverage,
  repairDailyMediaReferences,
} from "../src/dailyMediaCoverage.js";

function candidate(index, imageUrl) {
  return {
    title: `AI 新闻 ${index}`,
    url: `https://example.com/news-${index}`,
    placeholders: [`![image](${imageUrl})`],
  };
}

test("ensureDailyMediaCoverage inserts only source-matched media beside each item", () => {
  const markdown = `## **🔥 今日焦点 TOP 10**

### 1. 第一条 AI 新闻

**第一条有更新。** [第一条新闻披露了新能力](https://example.com/news-1)。

![已有画面](https://cdn.example.com/one.jpg "已有画面")

### 2. 第二条 AI 新闻

**第二条有更新。** [第二条新闻展示了运行画面](https://example.com/news-2)。

### 3. 第三条 AI 新闻

**第三条有更新。** [第三条新闻列出了测试结果](https://example.com/news-3)。

## **❓ 相关问题**

### 工具怎么用？

[第二条新闻](https://example.com/news-2)也回答了这个问题。`;
  const result = ensureDailyMediaCoverage(markdown, [
    candidate(1, "https://cdn.example.com/one.jpg"),
    candidate(2, "https://cdn.example.com/two.jpg"),
    candidate(3, "https://cdn.example.com/three.jpg"),
  ]);

  assert.equal(result.targetCount, 3);
  assert.equal(result.insertedCount, 2);
  assert.equal(result.usableMediaCount, 3);
  assert.equal(countUsableDailyMedia(result.markdown), 3);
  assert.match(result.markdown, /AI 新闻 2\]\(https:\/\/cdn\.example\.com\/two\.jpg "AI 新闻 2"\)/);
  assert.match(result.markdown, /AI 新闻 3\]\(https:\/\/cdn\.example\.com\/three\.jpg "AI 新闻 3"\)/);
  assert.equal(result.markdown.match(/cdn\.example\.com\/two\.jpg/g)?.length, 1);
});

test("ensureDailyMediaCoverage ignores profile avatars and does not create a gallery", () => {
  const markdown = `## **🔥 今日焦点 TOP 10**

### 1. 一条 AI 新闻

**功能更新了。** [开发者展示了新交互](https://x.com/dev/status/1)。`;
  const result = ensureDailyMediaCoverage(markdown, [{
    title: "开发者头像",
    url: "https://x.com/dev/status/1",
    placeholders: ["![avatar](https://pbs.twimg.com/profile_images/123/dev_normal.jpg)"],
  }]);

  assert.equal(result.insertedCount, 0);
  assert.equal(result.targetCount, 0);
  assert.doesNotMatch(result.markdown, /相关配图|profile_images/);
});

test("repairDailyMediaReferences restores exact source images in non-TOP sections", () => {
  const markdown = `## **◉ 社媒精选**

### RSS 阅读站调用费

[原帖披露了调用费用](https://x.com/vista8/status/1)。

![费用截图](https://pbs.twimg.com/media/wrong-id.jpg "费用截图")

### 手机控制电脑

[原帖展示了跨端控制](https://x.com/op7418/status/2)。

![控制截图](https://pbs.twimg.com/media/phone?format=jpg\\u0026#x26;name=orig "控制截图")`;
  const result = repairDailyMediaReferences(markdown, [
    {
      title: "RSS 阅读站调用费",
      url: "https://x.com/vista8/status/1",
      placeholders: ["![Tweet Image](https://pbs.twimg.com/media/exact-cost.jpg)"],
    },
    {
      title: "手机控制电脑",
      url: "https://x.com/op7418/status/2",
      placeholders: ["![Tweet Image](https://pbs.twimg.com/media/exact-phone?format=jpg&#x26;name=orig)"],
    },
  ]);

  assert.equal(result.correctedCount, 2);
  assert.equal(result.removedCount, 0);
  assert.match(result.markdown, /exact-cost\.jpg/);
  assert.match(result.markdown, /exact-phone\?format=jpg&name=orig/);
  assert.doesNotMatch(result.markdown, /wrong-id|\\u0026|#x26/);
});

test("ensureDailyMediaCoverage restores two source-backed social images after the global target is met", () => {
  const topItems = Array.from({ length: 6 }, (_, index) => `### ${index + 1}. TOP 新闻 ${index + 1}

[来源](https://example.com/top-${index + 1})。

![TOP 图片](https://cdn.example.com/top-${index + 1}.jpg "TOP 图片")`).join("\n\n");
  const markdown = `## **🔥 今日焦点 TOP 10**

${topItems}

## **◉ 社媒精选**

### RSS 阅读站调用费

[原帖披露了调用费用](https://x.com/vista8/status/1)。

![费用截图](https://pbs.twimg.com/media/exact-cost.jpg "费用截图")

### 手机控制电脑

[原帖展示了跨端控制](https://x.com/op7418/status/2)。`;
  const result = ensureDailyMediaCoverage(markdown, [
    ...Array.from({ length: 6 }, (_, index) => ({
      title: `TOP 新闻 ${index + 1}`,
      url: `https://example.com/top-${index + 1}`,
      placeholders: [`![TOP 图片](https://cdn.example.com/top-${index + 1}.jpg)`],
    })),
    {
      title: "RSS 阅读站调用费",
      url: "https://x.com/vista8/status/1",
      placeholders: ["![费用截图](https://pbs.twimg.com/media/exact-cost.jpg)"],
    },
    {
      title: "手机控制电脑",
      url: "https://x.com/op7418/status/2",
      placeholders: ["![控制截图](https://pbs.twimg.com/media/exact-phone.jpg)"],
    },
  ]);

  assert.equal(result.targetCount, 6);
  assert.equal(result.insertedCount, 1);
  assert.equal(result.usableMediaCount, 8);
  assert.match(result.markdown, /exact-phone\.jpg "手机控制电脑"/);
  assert.match(result.markdown, /exact-phone\.jpg "手机控制电脑"\)\n\n$/);
});
