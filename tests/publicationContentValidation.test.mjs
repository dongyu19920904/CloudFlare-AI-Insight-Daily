import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function writeGitHubContentResponse(markdown) {
  const dir = mkdtempSync(join(tmpdir(), "publication-content-"));
  const path = join(dir, "page.json");
  writeFileSync(
    path,
    JSON.stringify({
      content: Buffer.from(markdown, "utf-8").toString("base64"),
    }),
    "utf-8"
  );
  return path;
}

test("validate-publication-content accepts a healthy daily page response", () => {
  const pagePath = writeGitHubContentResponse(
    [
      "---",
      "title: AI日报 2026年5月9日",
      "---",
      "",
      "## **今日摘要**",
      "",
      "```",
      "今天 AI 行业的主线是模型产品继续落地，企业工具和开发者生态都在加速，值得优先关注真正能改变工作流的更新。",
      "```",
      "",
      "## ⚡ 快速导航",
      "",
      "- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览",
      "",
      "## **今日AI资讯**",
      "",
      "### **👀 只有一句话**",
      "模型能力正在从演示走向可交付的行业判断。",
      "",
      "### **🔑 3 个关键词**",
      "#模型 #Agent #行业判断",
      "",
      "## **🔥 重磅 TOP 1**",
      "",
      "### 1. [OpenAI 发布新模型能力](https://example.com/openai-model)",
      "这条更新说明模型能力继续向真实产品流动，企业用户更关心稳定性、成本和可集成性，而不仅是参数或跑分。",
      "对于日报来说，这类信息应该放在主线位置，因为它会影响开发者工具、企业采购和普通用户的使用预期。",
      "后续可以继续观察生态工具是否跟进，以及第三方服务是否开始包装成更低门槛的交付方案。",
      "",
      "## **📌 值得关注**",
      "",
      "- **[产品]** [一个补充动态](https://example.com/watch-1) - 这条不是 TOP 的重复来源，但可以帮助读者补充判断。",
      "",
      "## **😄 AI趣闻**",
      "",
      "### [一个轻松但有观察价值的 AI 趣闻](https://example.com/fun-1)",
      "这条内容不重复主线，用更轻一点的角度观察用户如何理解新工具。",
      "",
      "## **❓ 相关问题**",
      "",
      "### 如何体验今天提到的新能力？",
      "",
      "先确认官方入口，再选择适合自己的服务方式。",
      "",
      "**解决方案**：访问 **[爱窝氪 Aivora](https://aivora.cn)** 获取成品账号，降低试错成本。",
    ].join("\n")
  );

  const output = execFileSync(
    "node",
    [".github/scripts/validate-publication-content.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf-8",
      env: {
        ...process.env,
        MODE: "daily",
        TARGET_DATE: "2026-05-09",
        PAGE_RESPONSE_PATH: pagePath,
        MINIMUM_TOP_ITEMS: "1",
      },
    }
  );

  assert.match(output, /::notice title=Publication content validation::/);
  assert.match(output, /ok=true/);
});

test("validate-publication-content fails a malformed daily page response", () => {
  const pagePath = writeGitHubContentResponse("# 今日内容\n\nI can't discuss that.");

  assert.throws(
    () =>
      execFileSync("node", [".github/scripts/validate-publication-content.mjs"], {
        cwd: process.cwd(),
        encoding: "utf-8",
        env: {
          ...process.env,
          MODE: "daily",
          TARGET_DATE: "2026-05-09",
          PAGE_RESPONSE_PATH: pagePath,
        },
      }),
    (error) => {
      assert.match(error.stdout, /::error title=Publication content validation::/);
      return true;
    }
  );
});
