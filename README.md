# 🚀 AI 资讯日报

> 您的每日 AI 信息整合,分析,日报,播客内容生成平台。

**AI 资讯日报** 是一个基于 **Cloudflare Workers** 驱动的内容聚合与生成平台。它每日为您精选 AI 领域的最新动态，包括行业新闻、热门开源项目、前沿学术论文、科技大V社交媒体言论，并通过 **Google Gemini** 模型进行智能处理与摘要生成，最终自动发布到 GitHub Pages 生成 AI 日报。

我们的目标是成为您在瞬息万变的 AI 浪潮中保持领先的得力助手，让您高效获取最有价值的信息。

> [!NOTE]
> 日报前端项目已发布2.0： [Hextra-AI-Insight-Daily](https://github.com/justlovemaki/Hextra-AI-Insight-Daily) ，基于 Hugo 加 Hextra主题 构建。
> 
> 感谢阮一峰老师在[周刊352期](https://www.ruanyifeng.com/blog/2025/06/weekly-issue-352.html)的推荐。
---

## ✨ 核心特性

*   **☁️ 基于 Cloudflare Workers**：部署在强大的边缘网络，兼具高性能、高可用与零服务器维护成本。
*   **🧠 集成 Google Gemini**：利用先进的 AI 模型，自动生成高质量、易于理解的内容摘要。
*   **🔗 优先支持 Folo 订阅源**：只需简单配置，即可轻松接入 [Folo](https://app.follow.is/) 上的任意信息源，实现个性化内容聚合。
*   **🔄 每日自动更新**：通过 GitHub Actions 实现全自动化流程，每日准时为您推送最新鲜的 AI 资讯。
*   **🔧 高度可扩展**：项目架构灵活，不仅限于 AI 领域，您可以轻松定制，将其改造为您专属的任何主题日报。请尽情发挥您的想象力！
*   **🌐 一键发布至 GitHub Pages**：内置完善的发布流程，聚合后的内容可轻松生成静态网站，方便查阅与分享。

---

## 🎯 为谁而生？

无论您是信息的消费者、创造者，还是技术的探索者，「AI 资讯日报」都旨在为您创造独特价值。

### 🧑‍💻 AI 从业者与研究者
> **痛点：** 信息海洋无边无际，筛选关键动态、前沿论文和优质开源项目耗时费力。

**解决方案：**
*   **✅ 自动化精炼：** 为您提炼每日必读核心内容，并由 AI 生成精辟摘要。
*   **⏱️ 聚焦核心：** 在 **5 分钟内**快速掌握行业脉搏，将宝贵时间投入到真正重要的工作与研究中。

### 🎙️ 内容创作者与科技媒体人
> **痛点：** 持续输出高质量内容，却苦于选题枯竭和素材搜集的繁琐。

**解决方案：**
*   **💡 灵感永动机：** 聚合最新资讯，成为您源源不断的灵感源泉。
*   **🚀 内容半成品：** 利用 Gemini 模型生成结构化的**播客/视频口播稿**，稍作修改即可发布，极大提升创作效率。

### 🛠️ 开发者与技术 DIY 爱好者
> **痛点：** 想学习前沿技术栈（Serverless, AI API），但缺少一个完整、有实际价值的项目来练手。

**解决方案：**
*   **📖 绝佳学习范例：** 本项目架构清晰、代码开源，是学习如何整合云服务与 AI 模型的绝佳范例。
*   **🎨 打造个人专属：** 轻松 Fork，通过修改订阅源和 Prompt，将其改造为您个人专属的“Web3 洞察”、“游戏快讯”或“投资摘要”等。

### 🌱 对 AI 充满好奇的终身学习者
> **痛点：** AI 领域术语繁多、技术迭代快，想要跟上时代步伐却感到无从下手。

**解决方案：**
*   **👓 AI 滤镜看世界：** 通过阅读由 AI 精炼和总结后的日报，更轻松、更直观地理解行业动态。
*   **🌉 知识的桥梁：** 助您跨越技术门槛，持续拓宽知识边界，保持与智能时代的同步。

---

## 📸 线上演示与截图

我们提供了多个在线访问地址以及项目成果的播客展示。

### **在线阅读地址：**

#### 💻 网页直达

无需安装任何应用，直接在浏览器中打开，即刻阅读，支持pc和移动端。

*   **唯一主站点 (GitHub Pages)**
    > [https://ai.hubtoday.app/](https://ai.hubtoday.app/)
    >
    > `✅ 推荐` `🚀 访问速度快` 

---

#### 📡 RSS 订阅

将 AI 资讯聚合到您的个人信息流中，高效获取更新。

*   **订阅链接**
    > [https://justlovemaki.github.io/CloudFlare-AI-Insight-Daily/rss.xml](https://justlovemaki.github.io/CloudFlare-AI-Insight-Daily/rss.xml)
    >
    > `⭐ 推荐使用 Feedly, Inoreader, Folo 等现代阅读器订阅`

---

#### 📱 微信公众号

适合移动端阅读，每日推送，不再错过精彩内容。

*   **关注方式**
    > 打开微信，搜索公众号「**何夕2077**」并关注。
    >
    > `💬 欢迎在公众号后台与我们交流`


### **内容成果展示：**

| 🎙️ **小宇宙** | 📹 **抖音** |
| --- | --- |
| [来生小酒馆](https://www.xiaoyuzhoufm.com/podcast/683c62b7c1ca9cf575a5030e)  |   [来生情报站](https://www.douyin.com/user/MS4wLjABAAAAwpwqPQlu38sO38VyWgw9ZjDEnN4bMR5j8x111UxpseHR9DpB6-CveI5KRXOWuFwG)| 
| ![小酒馆](docs/images/sm2.png "img") | ![情报站](docs/images/sm1.png "img") |


### **后台项目截图：**

| 网站首页                               | 日报内容                               | 播客脚本                               |
| -------------------------------------- | -------------------------------------- | -------------------------------------- |
| [![首页](docs/images/main-1.png "首页")](docs/images/main-1.png) | [![日报](docs/images/main-2.png "日报")](docs/images/main-2.png) | [![播客](docs/images/main-3.png "播客")](docs/images/main-3.png) |

---

## 🚀 快速开始

> [!NOTE]
> 本项目优先支持从 [Folo](https://app.follow.is/) 数据源抓取内容。
> 您只需通过F12获取Folo Cookie，并将其配置到项目中即可在线试用。

> [!WARNING]
> 为了保证项目的正常运行，您需要在项目中配置 Folo Cookie。
> Folo Cookie只保留在浏览器，没有安全隐患。

1.  **获取Folo Cookie**
    
    [![cookie](docs/images/folo-0.png "img")](docs/images/folo-0.png)

2.  **[Demo 地址](https://ai-daily-demo.justlikemaki.workers.dev/getContentHtml)**
    * 默认账号密码：root/toor
---

## 📚 更多文档

*   **🛠️ [技术架构与部署指南](docs/DEPLOYMENT.md)**：深入了解项目的工作原理和详细的部署步骤。
*   **🧩 [项目拓展性指南](docs/EXTENDING.md)**：学习如何添加新的数据源、自定义生成内容格式。

---

## 🛠️ 常见问题与开发经验 (Troubleshooting & Best Practices)

### 1. 解决 AI 模型输出"思考过程" (Chain of Thought) 的问题
部分新模型（如 Gemini 2.0/3.0 Preview）会在输出最终结果前包含一段英文思考过程。为了防止这些内容出现在日报中：
*   **代码层处理**：使用正则提取代码块内容，忽略前置文本。
    ```javascript
    // src/helpers.js
    export function removeMarkdownCodeBlock(text) {
        // 提取第一个代码块内的内容，忽略思考过程
        const match = text.trim().match(/```(?:\w*)\s*([\s\S]*?)\s*```/);
        return match ? match[1].trim() : text.trim();
    }
    ```
*   **模型选择**：如果 Prompt 难以控制，可切换至 Claude 系列（如 `claude-opus-4-5`），通常输出更纯净。

### 2. Prompt 编写中的语法陷阱
在 JavaScript 文件中编写 Prompt 时，如果 Prompt 本身包含 Markdown 代码块标记（```），必须进行转义，否则会导致构建失败。
*   ❌ 错误：`return \`请包裹在 ```markdown 中\`;`
*   ✅ 正确：`return \`请包裹在 \`\`\`markdown 中\`;`

### 3. 紧急部署方案
当 GitHub Actions 或 Cloudflare 后台构建因 Git 同步问题卡住时，可直接在本地使用 Wrangler 强制部署：
```bash
npx wrangler deploy
```

### 4. 解决 "Unexpected export" 构建错误
在运行 `wrangler deploy` 时遇到 `Unexpected "export"` 错误，通常是因为**某个函数缺少闭合的大括号 `}`**，导致构建器误将下一个 `export` 语句识别为语法错误。

**常见原因：**
*   函数返回模板字符串后忘记闭合函数体
*   多行模板字符串的结束反引号后缺少 `}`

**快速修复：**
*   **检查函数完整性**：确保每个函数都有配对的 `{` 和 `}`
*   **特别注意模板字符串函数**：在模板字符串结束反引号 `\`` 后必须添加函数闭合括号 `}`
    ```javascript
    // ❌ 错误：缺少闭合括号
    export function buildMonthDirectoryIndex(yearMonth) {
        return `---
    title: ${yearMonth}
    ---
    `;
    // 缺少 }
    
    // ✅ 正确：函数结构完整
    export function buildMonthDirectoryIndex(yearMonth) {
        return `---
    title: ${yearMonth}
    ---
    `;
    }  // 确保有闭合括号
    ```
*   **使用工具检查**：运行 `npm run format` 或 `npx wrangler deploy --dry-run` 提前发现语法问题

### 5. 解决日报内容中链接域名错误的问题

**问题描述：**
生成的日报内容中，链接指向了错误的域名（如 `ai.hubtoday.app`），而实际应该使用正确的域名（如 `news.aivora.cn`）。这会导致：
*   RSS 订阅中的链接无法正确跳转
*   用户点击链接时访问到错误的页面
*   影响日报内容的可用性和用户体验

**问题原因分析：**
1.  **RSS 配置缺失**：`wrangler.toml` 中的 `BOOK_LINK` 环境变量为空字符串或未正确配置，导致 RSS 生成时使用了错误的默认域名
2.  **AI 模型误生成**：AI 模型在生成内容时，可能误将日报页面的内部链接（如 `https://ai.hubtoday.app/2025/01/15/`）作为素材的原始链接输出，而不是使用素材中提供的真实 URL
3.  **缺少链接验证**：内容生成流程中缺少对链接域名的验证和替换机制

**解决方案：**

#### 5.1 更新 RSS 链接配置
在 `wrangler.toml` 中正确配置 `BOOK_LINK` 环境变量：
```toml
[vars]
BOOK_LINK = "https://news.aivora.cn"  # 替换为你的实际域名
```

#### 5.2 添加链接替换函数
在 `src/helpers.js` 中添加自动替换错误域名的函数：
```javascript
/**
 * 替换内容中错误的域名链接
 * @param {string} content - 要处理的内容
 * @param {string} correctDomain - 正确的域名（不含协议）
 * @returns {string} 替换后的内容
 */
export function replaceIncorrectDomainLinks(content, correctDomain) {
    if (!content || !correctDomain) return content;
    
    // 匹配 Markdown 链接格式 [text](url)
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    
    return content.replace(linkPattern, (match, text, url) => {
        try {
            const urlObj = new URL(url);
            // 如果链接指向错误的域名（如 ai.hubtoday.app），替换为正确域名
            if (urlObj.hostname === 'ai.hubtoday.app' || 
                urlObj.hostname === 'news.aivora.cn' && urlObj.pathname.startsWith('/20')) {
                // 保持路径和查询参数不变，只替换域名
                urlObj.hostname = correctDomain;
                return `[${text}](${urlObj.toString()})`;
            }
        } catch (e) {
            // URL 解析失败，保持原样
        }
        return match;
    });
}
```

#### 5.3 在生成流程中应用替换
在 `src/handlers/scheduled.js` 中，在内容生成后应用链接替换：
```javascript
import { replaceIncorrectDomainLinks } from '../helpers.js';

// 在生成内容后
outputOfCall2 = removeMarkdownCodeBlock(outputOfCall2);
outputOfCall2 = convertPlaceholdersToMarkdownImages(outputOfCall2);
// 替换错误的域名链接
outputOfCall2 = replaceIncorrectDomainLinks(
    outputOfCall2, 
    env.BOOK_LINK ? new URL(env.BOOK_LINK).hostname : 'news.aivora.cn'
);
```

#### 5.4 更新 AI Prompt 指示
在 `src/prompt/summarizationPromptStepZero.js` 中明确指示 AI 不要生成内部链接：
```javascript
// 在格式要求中添加：
// **重要**：URL 必须是素材中提供的原始链接，不要生成指向日报页面的内部链接
// （如 https://ai.hubtoday.app/... 或 https://news.aivora.cn/...），
// 这些链接由前端自动处理。
```

**验证方法：**
1.  部署后检查 RSS 输出：访问 `/rss?days=7` 端点，确认链接域名正确
2.  检查生成的日报内容：确认所有链接都指向原始素材 URL，而非日报内部链接
3.  测试链接跳转：点击日报中的链接，确认能正确跳转到原始内容

**注意事项：**
*   此修复只对**新生成的日报**生效
*   对于**已生成的日报**，如需修复，可以：
    *   重新生成这些日报（通过测试端点触发）
    *   或手动批量替换 GitHub 仓库中的文件

### 6. 解决日报无法正常生成的问题

**问题描述：**
定时任务执行后，日报文件未能正常生成，前端网页未显示当日的日报内容。任务可能看起来"成功"完成，但实际上失败了。

**问题原因分析：**

#### 6.1 数据抓取超时（高可能性）
**症状：**
*   定时任务在数据抓取阶段超时
*   Cloudflare Workers 执行时间限制被触发

**原因：**
*   **配置变更影响**：当 `FOLO_NEWS_FETCH_PAGES` 从 1 增加到 2，`MAX_ITEMS_PER_TYPE` 从 50 增加到 80 时：
    *   API 请求次数：27 个 ID × 2 页 = **54 次 API 请求**
    *   预估总抓取时间：54 × (1-3秒 + 0.75秒延迟) ≈ **1.5 - 3.4 分钟**
    *   如果某些 API 响应慢，可能超过 5 分钟，触发 Workers 执行时间限制
*   **Cloudflare Workers 限制**：
    *   免费版：30 秒 CPU 时间（I/O 等待不计入）
    *   付费版：30 分钟总执行时间
    *   Scheduled Events 可能有不同的限制

#### 6.2 错误被静默捕获（高可能性）
**症状：**
*   任务看起来"成功"完成，但实际上失败了
*   没有生成日报文件
*   无法通过任务状态判断是否真的成功

**原因：**
查看 `src/handlers/scheduled.js` 的错误处理：
```javascript
} catch (error) {
    console.error(`[Scheduled] Error:`, error);
    // ⚠️ 注意：这里只是记录错误，没有抛出或返回错误状态
}
```
*   如果任务失败，错误只是被 `console.error` 记录
*   **没有抛出错误**，Cloudflare 可能认为任务"成功"完成
*   无法及时发现任务失败，无法通过重试机制自动恢复

#### 6.3 Prompt 过长导致 AI API 失败（中等可能性）
**症状：**
*   数据抓取成功，但 AI 生成内容失败
*   错误日志可能显示 "Request too large" 或 "Token limit exceeded"

**原因：**
*   Prompt 长度计算：
    *   系统提示词：~2,000 tokens
    *   用户数据：80 条 × 平均 200 tokens/条 = 16,000 tokens
    *   总计：~18,000 tokens
*   如果使用较小的模型（如 gemini-1.5-flash），可能超过输入限制
*   API 超时：`fetchWithTimeout` 设置为 180 秒（3 分钟），如果 prompt 很长，AI 处理时间可能超过 3 分钟

#### 6.4 数据源为空导致跳过生成
**症状：**
*   任务执行但未生成日报
*   日志显示 "No items found. Skipping generation."

**原因：**
*   所有数据源抓取失败或返回空数据
*   `selectedContentItems.length === 0` 时，任务直接跳过生成

**解决方案：**

#### 6.1 临时解决方案（快速恢复）

**方案 A：回滚配置**
```toml
# 在 wrangler.toml 中修改
FOLO_NEWS_FETCH_PAGES = "1"  # 从 2 改回 1
MAX_ITEMS_PER_TYPE = "50"    # 从 80 改回 50
```
*   ✅ 立即生效，风险最低
*   ❌ 数据量减少，可能遗漏一些内容

**方案 B：减少数据源数量**
```toml
# 在 wrangler.toml 中减少 FOLO_NEWS_IDS
# 从 27 个减少到 15-20 个最重要的
FOLO_NEWS_IDS = "156937358802651136,155494251060695040,..."  # 只保留最重要的
```

#### 6.2 改进错误处理

**修改 `src/handlers/scheduled.js`：**
```javascript
} catch (error) {
    console.error(`[Scheduled] Error:`, error);
    // 抛出错误，让 Cloudflare 知道任务失败
    throw error;
}
```

**添加详细日志：**
```javascript
console.log(`[Scheduled] Starting daily automation for ${dateStr}`);
console.log(`[Scheduled] Fetching data...`);
console.log(`[Scheduled] Data fetched: ${Object.keys(allUnifiedData).length} types`);
console.log(`[Scheduled] Total items: ${selectedContentItems.length}`);
console.log(`[Scheduled] Generating content...`);
console.log(`[Scheduled] Success!`);
```

#### 6.3 优化数据抓取策略

1.  **分批抓取**：将多个 ID 分成 2-3 批，每批之间增加延迟
2.  **并行抓取优化**：同时抓取 5 个 ID，完成后再抓取下一批（需要控制并发数）
3.  **增加超时和重试机制**：为每个 API 请求设置合理的超时时间，失败时自动重试（最多 3 次）

#### 6.4 优化 Prompt 长度

1.  **智能截断**：如果数据量过大，优先保留最重要的数据，按发布时间、相关性等排序后截断
2.  **分批处理**：将数据分成多个批次，每批生成部分内容，最后合并
3.  **压缩数据**：在发送给 AI 之前，先对数据进行摘要，只保留关键信息

#### 6.5 检查与验证

**检查 Cloudflare Workers 日志：**
1.  登录 Cloudflare Dashboard
2.  进入 Workers & Pages → 你的 Worker
3.  查看 `Observability → Logs`
4.  查找关键日志：
    *   `[Scheduled] Starting daily automation for YYYY-MM-DD`
    *   `[Scheduled] Fetching data...`
    *   `[Scheduled] Data fetched and stored.`
    *   `[Scheduled] Generating content...`
    *   `[Scheduled] Error:` (如果有错误)

**检查 GitHub 仓库：**
1.  检查 `daily/YYYY-MM-DD.md` 是否存在
2.  检查 `content/cn/YYYY-MM/YYYY-MM-DD.md` 是否存在
3.  检查文件内容是否完整

**手动触发测试：**
```bash
# 访问测试端点
curl "https://your-worker.workers.dev/triggerScheduled?date=2026-01-02"
```

**预防措施：**
*   ✅ 在增加配置值（如 `FOLO_NEWS_FETCH_PAGES`、`MAX_ITEMS_PER_TYPE`）前，先测试执行时间
*   ✅ 定期检查 Cloudflare Workers 日志，及时发现异常
*   ✅ 设置监控告警，任务失败时发送通知
*   ✅ 保持错误处理代码能够正确抛出错误，而不是静默捕获

---

## 🧭 优化修改方案（执行清单）

- **数据源与时效**：在 `wrangler.toml` 维护 `FOLO_NEWS_IDS`（去重追加），按需调整 `FOLO_NEWS_FETCH_PAGES` 与 `FOLO_FILTER_DAYS`；其他来源对应 `HGPAPERS_FETCH_PAGES`、`TWITTER_FETCH_PAGES`、`REDDIT_FETCH_PAGES`。
- **输入上限控制**：用 `MAX_ITEMS_PER_TYPE` 控制每类输入上限，避免热点被截断或素材过少。
- **日报成品化**：提示词仅在 TOP10 允许图片，分类速览/索引禁图；移除"无图/未入 TOP10/覆盖检查"等面向内部的字样。
- **网感风格一致**：日报正文采用 90/00 中文互联网语境（第一人称、情绪价值），但全量索引保持中性可检索。
- **模型与中转切换**：通过 `USE_MODEL_PLATFORM` 切换；Gemini 使用 `GEMINI_API_URL`/`DEFAULT_GEMINI_MODEL`/`GEMINI_STREAM_MODE`/`GEMINI_API_VERSION`，密钥走 `wrangler secret`。
- **部署与排错**：每次改动后重新部署（`npx wrangler deploy` 或控制台），在 `Observability → Logs` 查看抓取与生成日志，确认构建状态为 Success。

---

## 📋 项目优化改动总结

基于用户需求分析，项目进行了以下核心优化，提升日报内容质量和用户体验：

### 🎯 改动概览

| 改动类别 | 具体内容 | 影响文件 | 改动规模 |
|---------|---------|---------|---------|
| **信息源扩展** | Folo信息源从13个扩展到28个 | `wrangler.toml` | 配置更新 |
| **抓取配置优化** | 抓取页数从1页增加到2页，上限从50增加到80 | `wrangler.toml` | 配置更新 |
| **日报内容增强** | 新增AI趣闻、趋势预测、产品推荐板块 | `src/prompt/summarizationPromptStepZero.js` | 提示词扩展 |

---

### 1️⃣ 信息源扩展与配置优化

**目标**：扩大内容覆盖面，提升信息时效性和多样性

**具体改动**：
*   **Folo信息源扩展**：从13个增加到28个，新增包括：
    *   Twitter账号聚合（OpenAI、Sam Altman、Anthropic、Google AI等）
    *   更多AI资讯源（机器之心、量子位、掘金人工智能等）
    *   技术博客（阮一峰网络日志、宝玉的博客等）
*   **抓取配置调整**：
    *   `FOLO_NEWS_FETCH_PAGES`: `1` → `2`（抓取更多历史内容）
    *   `MAX_ITEMS_PER_TYPE`: `50` → `80`（容纳更多信息源内容）

**预期效果**：
*   ✅ 内容覆盖面更广，减少遗漏重要资讯
*   ✅ 信息时效性提升，特别是Twitter/X等实时信息源
*   ✅ 内容多样性增强，涵盖更多视角和观点

---

### 2️⃣ 日报内容结构优化

**目标**：借鉴优秀AI日报，提升可读性和价值

#### 2.1 新增"😄 AI趣闻"板块

**位置**：在"更多动态"之后

**功能**：
*   从当日新闻中筛选最有趣/最幽默的1-2条内容
*   用轻松幽默的语气重述，增加阅读趣味性
*   如果当天没有合适的趣闻，自动省略此板块

**格式示例**：
```markdown
## 😄 AI趣闻（1-2条）

### [某公司AI产品出bug，把猫识别成狗](URL)
今天最离谱的AI新闻：某公司的AI识别系统把一只橘猫识别成了"金毛犬"...
```

#### 2.2 新增"🔮 AI趋势预测"板块

**位置**：在"AI趣闻"之后

**功能**：
*   基于今日新闻和近期动态，预测未来1-3个月AI领域可能发生的重要事件
*   每个预测包含：事件名称、预测时间、预测概率、预测依据
*   概率范围：40%-85%，确保预测合理性

**格式示例**：
```markdown
## 🔮 AI趋势预测（3-5条）

### GPT-5正式发布
- **预测时间**：2025年Q2
- **预测概率**：65%
- **预测依据**：今日新闻[OpenAI正在测试新模型](链接) + 根据历史发布节奏...
```

#### 2.3 优化"❓ 相关问题"板块（SEO/GEO优化）

**改动内容**：
*   FAQ数量：从1-2条扩展到3-5条
*   新增FAQ生成规则：优先选择热门AI工具，支持多角度FAQ
*   新增"🛒 今日推荐产品"板块：基于当日新闻推荐aivora.cn相关产品

**预期效果**：
*   ✅ 提升SEO效果（更多FAQ关键词）
*   ✅ 提升GEO效果（AI搜索引擎更容易推荐aivora.cn）
*   ✅ 直接转化（产品推荐板块）

---

### 3️⃣ 技术实现特点

**核心原则**：最小化改动，最大化效果

*   **只修改提示词和配置**：不修改任何逻辑代码，风险极低
*   **智能自适应**：新板块会根据内容质量自动生成或省略
*   **向后兼容**：现有功能完全不受影响

**修改文件清单**：
*   `wrangler.toml`：3处配置更新
*   `src/prompt/summarizationPromptStepZero.js`：新增约150行提示词

---

### 4️⃣ 预期效果与价值

**短期效果（1周内）**：
*   ✅ 信息源从13个增加到28个，内容更丰富
*   ✅ 日报增加"AI趣闻"板块，提升可读性
*   ✅ 日报增加"AI趋势预测"板块，增加价值
*   ✅ FAQ从1-2条增加到3-5条，SEO效果更好
*   ✅ 增加产品推荐板块，直接转化

**长期价值（1个月后）**：
*   ✅ 用户粘性提升（想看预测是否准确）
*   ✅ SEO排名提升（更多FAQ关键词）
*   ✅ 转化率提升（产品推荐）
*   ✅ 品牌差异化（趣闻+预测，区别于其他日报）

---

### 5️⃣ 相关文档

如需了解更详细的改动细节，可参考：
*   📄 [需求分析与优化方案](docs/需求分析与优化方案.md)
*   📄 [具体修改对比](docs/具体修改对比.md)
*   📄 [最小修改实施方案](docs/最小修改实施方案.md)

---

## ❓为什么生成日报需要手动勾选内容，而不是让 AI 自动筛选

我坚信，AI 是增强人类智慧的强大**工具**，而非**替代品**。

正如**忒修斯之船**的哲学思辨：当船上的木板被逐一替换，它还是原来的船吗？同样，**今天的你和昨天的你在思想与关注点上已有细微不同**。

AI 或许能模仿你过去的喜好，却难以捕捉你此刻的灵感与洞见。

`手动勾选`这一步，正是为了保留这份属于“人”的、不断演进的独特视角。它确保了日报的灵魂-`你的思想和判断力`，始终贯穿其中，让每一份日报都成为你当日思考的真实快照。

当然，我们也完全支持并欢迎社区开发者探索全自动化的实现方式。如果你有更棒的想法，请随时提交 Pull Request！

---

## 💡 项目价值与未来展望

“AI 资讯日报”为 AI 领域的从业者、研究者和爱好者提供了一个**便捷、高效的信息获取渠道**。它将繁琐的信息筛选工作自动化，帮助用户节省宝贵时间，快速掌握**行业动态**与**技术趋势**。

我们对项目的未来充满期待，并计划在以下方向持续探索：

*   **🔌 扩展数据来源**：集成更多垂直领域的 AI 资讯平台、技术博客、Hacker News、Reddit 等，构建更全面的信息网络。
*   **🤖 丰富 AI 能力**：探索除了内容摘要外的更多玩法，如趋势分析报告、技术对比、观点提炼等。
*   **🎨 优化用户体验**：开发功能更完善的前端界面，支持个性化订阅、关键词筛选和历史内容搜索。
*   **🌍 支持多语言**：扩展项目的多语言处理能力，服务全球范围内的 AI 爱好者。
*   **🤝 构建开放生态**：集成更多先进的 AI 模型，并欢迎社区开发者共同贡献，打造一个开放、协作的内容生成平台。

---

## 💬 交流与支持

> **有任何问题请提 [Issue](https://github.com/justlovemaki/CloudFlare-AI-Insight-Daily/issues)**，或许你的问题也能帮助其它有同样困惑的人

<table>
  <tr>
    <td align="center">
      <img src="docs/images/wechat.png" alt="Wechat QR Code" width="150">
      <br>
      <strong>进群讨论</strong>
    </td>
    <td align="center">
      <img src="docs/images/sponsor.png" alt="Sponsor QR Code" width="150">
      <br>
      <strong>赞助留名</strong>
    </td>
  </tr>
</table>

> 欢迎您 Star, Fork 并参与贡献，共同将“AI 资讯日报”打造为更强大的 AI 信息利器！

---

## ⚠️ 免责声明
在使用“AI 资讯日报”项目（以下简称“本项目”）前，请您务必仔细阅读并理解本声明。您对本项目的任何使用行为，即视为您已完全接受本声明的全部内容。

1.  **内容来源与准确性**：本项目聚合的内容主要来自第三方数据源（如 Folo 订阅源）并通过 AI 模型（如 Google Gemini）自动处理生成。我们不保证所有信息的绝对准确性、完整性、及时性或可靠性。所有内容仅供学习、参考和交流之用，不构成任何专业建议（如投资、法律等）。

2.  **版权归属**：本项目尊重并保护知识产权。
    *   所有聚合内容的原始版权归原作者、原网站或相应权利人所有。
    *   本项目仅为非商业性的信息聚合与展示，旨在方便用户学习和研究。
    *   如您认为本项目的内容侵犯了您的合法权益，请立即与我们联系，我们将在核实后第一时间进行删除处理。

3.  **AI 生成内容**：由 AI 模型生成的摘要、分析等内容可能存在错误、偏见或不符合原文意图的情况。请用户在采纳或使用这些信息时，务必结合原文进行审慎判断。对于因依赖 AI 生成内容而导致的任何后果，本项目概不负责。

4.  **技术风险**：本项目基于 Cloudflare Workers、GitHub Pages 等第三方服务运行。我们无法保证这些服务的永久稳定性和可用性。因任何技术故障、网络问题、服务中断或不可抗力导致的损失，本项目不承担任何责任。

5.  **使用风险**：您承诺将合法、合规地使用本项目。任何因您使用不当（如用于商业目的、非法转载、恶意攻击等）而产生的法律责任和风险，均由您自行承担。

6.  **最终解释权**：在法律允许的范围内，本项目团队对本声明拥有最终解释权，并有权根据需要随时进行修改和更新。

## 中转使用与部署确认

**可能原因（本次问题）：** Cloudflare 构建失败或未重新部署时，Worker 会继续运行旧版本代码/变量；重新构建并成功部署后，新配置才会生效。

**中转切换通用步骤：**
1. 修改 `wrangler.toml` 与 Secrets（如 `USE_MODEL_PLATFORM` / `*_API_URL` / `DEFAULT_*_MODEL`）。
2. 重新部署：`npx wrangler deploy`，或在 Cloudflare 控制台点击部署。
3. 在 Deployments/Build logs 确认状态为 **Success**。
4. 需要快速止血时，先切回 `USE_MODEL_PLATFORM = "ANTHROPIC"` 或 `"OPEN"`。

**Gemini 中转参数示例：**
```toml
USE_MODEL_PLATFORM = "GEMINI"
GEMINI_API_URL = "https://<your-proxy>/gemini"
DEFAULT_GEMINI_MODEL = "gemini-3-pro-preview"
GEMINI_STREAM_MODE = "auto"      # or "off"
GEMINI_API_VERSION = "auto"      # v1beta | v1 | noversion
GEMINI_DEBUG = "false"           # 排错时才开启
```


## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=justlovemaki/CloudFlare-AI-Insight-Daily&type=Timeline)](https://www.star-history.com/#justlovemaki/CloudFlare-AI-Insight-Daily&Timeline)