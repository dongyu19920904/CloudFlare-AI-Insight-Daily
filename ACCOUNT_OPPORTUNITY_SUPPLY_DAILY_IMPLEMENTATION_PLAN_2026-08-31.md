# 爱窝啦实时货源驱动账号商机日报实施方案

日期：2026-08-31（Asia/Shanghai）

## 1. 目标

把 `news.aivora.cn/account-opportunity/` 从新闻驱动的账号行业解读，改成 Supply Radar 实时快照驱动的卖家工作日报。行业信息降为辅助证据。日报每天给出可复核商品、当前货源盘面、卖家动作、利润核算入口和停止条件。

## 2. 涉及仓库

### Aivora-Supply-Radar

负责生产只读、版本化、限量的商机快照。

### CloudFlare-AI-Insight-Daily

负责加载快照、选择当天货源、生成确定性 Markdown、执行发布校验和提交前端。

### Hextra-AI-Insight-Daily

继续承载生成后的 Markdown。保留现有 canonical、Article/Breadcrumb、日期、robots、sitemap 和主题样式，不修改模板结构。

## 3. Phase A：货源快照数据契约

新增 `GET /api/opportunities/snapshot`。

响应字段如下。

```json
{
  "schemaVersion": 1,
  "source": "https://supply.aivora.cn/opportunities",
  "generatedAt": "ISO-8601",
  "latestObservedAt": "ISO-8601 or null",
  "stats": {
    "productCount": 49,
    "availableProductCount": 47,
    "availableOfferCount": 3349,
    "recentChangeCount": 100,
    "lowSupplyProductCount": 7
  },
  "signals": [],
  "categories": []
}
```

每个 signal 只包含公开、有限字段。

- kind、tone、label、title、evidence。
- buyerAction、sellerAction、stopCondition。
- observedAt。
- product slug、name、platform、最低价、质保价、可购买报价数、更新时间和排序字段。
- 标准商品链接和预填成本的利润计算器链接。

接口要求：

- `force-dynamic`。
- `Cache-Control: public, max-age=60, stale-while-revalidate=300`。
- 不接受外部 URL 或任意查询参数。
- 不输出数据库密钥、管理信息或用户信息。
- 数据失败返回 500，不影响其他页面。

## 4. Phase B：日报 Worker 安全加载器

新增 `src/supplyOpportunitySnapshot.js`。

职责：

- 默认只读取 `https://supply.aivora.cn/api/opportunities/snapshot`。
- URL 必须为 HTTPS 且主机在允许名单。
- 8 秒超时。
- Content-Length 和实际正文均限制在 512 KiB 内。
- 只接受 `schemaVersion=1`。
- 验证数字、时间、signal 数量、商品 slug 和链接。
- `generatedAt` 超过 120 分钟视为快照传输过旧；`latestObservedAt` 表示最后一次货源异动，不要求两小时内一定发生变化，但超过 7 天时视为数据源失联。日报同时公开这两个时间，不能把最后异动时间写成本次查询时间。
- 失败返回结构化原因，不抛出到 AI 日报主体。
- 把成功、失败、快照年龄和信号数写入 `debugInfo`，不写密钥。

## 5. Phase C：确定性日报渲染器

新增 `src/supplyDrivenAccountOpportunity.js`。

主要函数：

- `selectDailySupplySignals(snapshot)`。
- `findRelatedIndustryCandidate(signals, candidates)`。
- `buildSupplyDrivenAccountOpportunityMarkdown(...)`。

选择策略：

1. 优先 ChatGPT、Claude、Gemini、Grok 和 AI 编程等核心分类。
2. 优先连续快照确认的补货、断货、明显涨跌价。
3. 至少选择一个风险信号；没有风险信号时再补第二个机会信号。
4. 每天最多三个标准商品。
5. 低供给只表示供给少，正文必须提示需求仍待验证。

渲染策略：

- 盘面数字和货源行动完全由代码生成。
- 不让模型改写金额、数量、时间或 URL。
- 每个行动包含六个固定字段。
- 行业候选只在品牌、具体套餐或账号交易字段与选中商品明确匹配，并且链接属于官方或原项目来源时保留一条；媒体转述和同公司但不同产品的更新不进入正文。
- 没有匹配候选时输出固定边界说明，不调用模型凑内容。
- 使用 `supply.aivora.cn` 商品和利润计算器链接，不插入失效的主站博客 URL。

## 6. Phase D：接入计划任务

修改 `handleScheduledAccountOpportunity`。

- 读取原新闻上下文的同时加载 Supply Radar 快照。
- 将快照和新闻候选传入生成函数。
- 快照有效时走 `supply-snapshot-v1` 路径，不调用 Anthropic。
- 快照无效时保留现有 `pre-0803-actionable-overseas-v1` 路径。
- dry-run 返回生成后的 Markdown 和快照诊断，不提交 GitHub。
- 生产发布仍只提交账号商机页面、月索引和栏目首页。

## 7. Phase E：发布校验

新增实时货源版校验规则。

- 必须包含六个新章节。
- 今日货源结论必须恰好三条。
- 实时货源盘面必须引用货源商机页。
- 每个行动必须有六组字段。
- 每个行动必须引用标准商品页面。
- 商品链接只能来自快照允许集合。
- 日报动作数量为 1 至 3。
- 今日三步恰好三条。
- 禁止建议具体卖家售价、编造销量、利润率、需求、稳定性或收益。
- `www.aivora.cn` 链接仍受 sitemap 和数量限制。
- `supply.aivora.cn` 链接作为货源证据单独校验，不占主站商品链接配额。

GitHub publication validator 自动识别“实时货源盘面”并使用新校验器，历史页面继续使用旧校验器。

## 8. Phase F：回归测试

### Supply Radar

- 快照序列化只输出允许字段。
- 商品与利润链接使用 HTTPS 正式域名。
- 信号和分类数量有上限。
- 原 Dashboard 测试继续通过。

### AI Daily Worker

- 加载器拒绝 HTTP、未知主机、超大响应、错误 schema 和过期快照。
- 快照有效时生成实时货源版 Markdown。
- 没有行业匹配时不引用无关新闻。
- 选择结果包含热门机会和风险信号。
- 快照失败时保留旧生成路径。
- 发布校验拒绝缺少商品链接、利润核算或停止条件的正文。
- 旧账号商机校验测试继续通过。

## 9. Phase G：dry-run 和发布

顺序固定如下。

1. 运行 Supply Radar test、typecheck、lint、Cloudflare build。
2. 推送 Supply Radar 任务分支并等待 CI。
3. 快进 `main`，通过现有精确 SHA 流程发布 Supply V2。
4. 在线验证快照接口字段、大小、缓存头和数据时间。
5. 运行 AI Daily Worker 单元测试和 Wrangler dry-run。
6. 推送 Worker 任务分支，再快进 `main` 触发一次 Worker 部署。
7. 通过专用 workflow 对 2026-08-31 执行 account-opportunity dry-run。
8. 检查 Markdown 的商品数、快照时间、货源链接、利润链接、重复和安全边界。
9. 仅在 dry-run 全部通过后，对 2026-08-31 执行一次强制生产更新。
10. 等待 Hextra Pages 部署，验证线上正文和栏目首页。
11. 以桌面和约 390px 手机视口检查日间、夜间、溢出、链接与 canonical。

## 10. Cloudflare 成本变化

- 新增一次小型 JSON GET，响应目标小于 100 KiB。
- 使用 60 秒边缘缓存，不增加货源同步频率。
- 快照有效时账号商机正文不调用 Anthropic，预计每天减少一次生成调用，repair 也随之消失。
- AI 日报和普通 AI 商机的模型配置、token 上限和定时任务保持不变。

## 11. 回滚

### Supply Radar

- `git revert <snapshot endpoint commit>`。
- Cloudflare Worker 回滚到发布前版本。
- 接口回滚不影响货源主页面。

### AI Daily Worker

- `git revert <supply-driven daily commit>`。
- Worker 回滚到发布前版本。
- 快照加载失败本身也会自动走旧行业版生成链路。

### 前端内容

- 生成文件由 Worker 单独提交，可对当天 Markdown 的生成提交执行 `git revert`。
- 栏目首页使用 latest shortcode，无需手工修改历史路由。

## 12. 发布阻断条件

出现以下任一情况不得生产触发。

- 快照接口不是 HTTPS 或返回过期数据。
- 标准商品、可售报价或异动数字为负数或缺失。
- 正文没有标准商品链接。
- 商品行动引用快照之外的货源 URL。
- 货源页或利润计算器返回非 200。
- 发布校验失败。
- Hugo 构建失败。
- 修改可能阻塞 AI 日报主体。
