# 爱窝啦 AI 账号商家经营日报 V2 修改方案

日期 2026-08-31

## 一、修改目标

在保留 `/account-opportunity/` 历史路径和 AI 日报主体稳定边界的前提下，把账号商机栏目改成以货源为主的商家经营日报。

本轮交付包括数据合同、确定性正文、发布校验、标题与栏目元数据、测试、dry-run、部署和线上验证。新闻生成链路只作为快照失败时的旧版降级路径，快照有效时不调用模型。

## 二、实施顺序

### 第一步 扩充 Supply Radar 快照

修改 `v2-web/src/lib/supply-opportunity.ts`。

1. 将公开快照升级为 `schemaVersion=2`。
2. 增加最多 80 个标准商品的 `products` 数组。
3. 每个商品输出分类、最低价、质保价、可购买报价数、更新时间、标准商品链接和利润计算器链接。
4. 保持信号和分类数量有上限。
5. 不输出短描述、搜索关键词、数据库主键和内部字段。

修改 `v2-web/src/lib/supply-opportunity.test.ts`。

1. 验证 V2 schema。
2. 验证商品数组包含有货和缺货商品。
3. 验证公开字段白名单和正式 HTTPS 链接。
4. 验证商品数上限。

### 第二步 升级 AI Daily 快照解析器

修改 `src/supplyOpportunitySnapshot.js`。

1. 同时接受 schema 1 和 schema 2。
2. 对 V2 `products` 做 slug、分类、金额、报价数、时间和 URL 白名单解析。
3. schema 1 没有商品数组时，从信号中生成兼容商品集合。
4. schema 2 没有可用商品时拒绝进入 V2 经营日报。
5. debug 增加快照商品数，不记录任何秘密。

修改 `tests/supplyOpportunitySnapshot.test.mjs`，覆盖 V1 兼容、V2 商品解析、未知链接和缺失商品拒绝。

### 第三步 重写经营日报渲染器

修改 `src/supplyDrivenAccountOpportunity.js`。

新增确定性选择函数。

- `selectMerchantCoreProducts`
- `selectPausedProducts`
- `buildCategoryMarketMap`
- `selectDailySupplySignals`

正文改为以下结构。

1. 今日经营判断
2. 今日经营看板
3. 核心商品备货表
4. 今日异动与补货
5. 平台货源地图
6. 暂停接单与同类替代
7. 报价与利润纪律
8. 今日执行单
9. 可选的官方变化与经营影响

渲染要求如下。

- 核心备货表最多 8 个商品，ChatGPT 最多 3 个，其余核心分类优先各取一个。
- 完全缺货商品只能进入暂停清单。
- 异动最多 4 个，至少保留一个风险信号时才增加风险项。
- 商品金额、报价数、时间和 URL 只能来自快照。
- 新闻只保留直接匹配且为官方或原项目来源的一个信号。
- 正文不输出一级标题，不使用模型生成金额和经营结论。

### 第四步 修改发布接入与标题

修改 `src/handlers/scheduled.js`。

1. V2 分支标记改为 `supply-merchant-daily-v2`。
2. 将完整商品链接和利润计算器链接加入允许集合。
3. debug 记录选中的备货商品、暂停商品和异动。
4. 页面标题改为“爱窝啦 AI 账号商家经营日报 日期”。

修改 `src/accountOpportunityUtils.js`。

1. 页面 description 改成面向 AI 账号商家的经营日报说明。
2. 栏目 title 和 linkTitle 改为“AI账号商家经营日报”。
3. 更新已有栏目首页 front matter 时同步 title、linkTitle 和 description。
4. 保留 type、路由、latest shortcode、canonical 与历史内容路径。

### 第五步 重写发布校验

修改 `src/publishValidation.js`。

校验器必须检查以下内容。

- 九个 V2 章节中八个固定章节齐全，官方变化章节可选。
- 今日经营判断恰好三条。
- 核心备货表包含 4 至 8 个当前有货商品。
- 平台货源地图包含快照中的核心分类统计。
- 今日异动与补货包含 1 至 4 个行动。
- 每个行动具有异动证据、采购动作、报价动作、售后检查和停止条件。
- 暂停商品不得混入核心备货表。
- 所有 `supply.aivora.cn` 链接属于快照允许集合。
- 快照统计数字、商品 slug 和分类统计出现在正文。
- 禁止建议售价、虚构销量、虚构需求和收益承诺。

历史页面识别逻辑继续支持旧校验器。

### 第六步 修改工作流断言

修改 `.github/workflows/dry-run-account-opportunity.yml`。

1. 期待 `supply-merchant-daily-v2`。
2. 期待模型调用为 0。
3. 检查核心备货表、平台货源地图、暂停与替代、利润纪律和执行单。
4. 检查至少 4 个平台和至少 6 个商品链接。
5. 继续确认 dry-run 不提交前端。

如生产保证工作流仍依赖旧章节名称，同步修改其内容验证断言，不改变触发和 Secret 处理方式。

### 第七步 本地验证

所有 Node、npm、Wrangler、Hugo 和浏览器命令通过 `project-cache-hygiene` 包装器执行。

Supply Radar 依次运行以下现有命令。

- V2 单元测试
- typecheck
- lint
- production Cloudflare build

AI Daily Worker 依次运行以下现有命令。

- 相关单元测试
- 完整 `npm test`
- Wrangler deploy dry-run

指定 2026-08-31 执行账号商机 dry-run，检查正文商品数、平台覆盖、缺货分区、链接、字数、模型调用和发布校验。

### 第八步 提交和部署

1. Supply Radar 只提交快照合同和测试。
2. 通过 SSH 推送任务分支。
3. 等待 Supply Radar CI 通过后快进 `main`，沿用现有部署工作流。
4. 在线确认 schema 2 和商品数组。
5. AI Daily Worker 只提交 V2 文档、解析器、渲染器、校验、测试和工作流。
6. 通过 SSH 推送任务分支，等待 CI 或本仓库现有检查。
7. 快进 `main`，沿用现有 Worker 部署工作流。
8. 远端 dry-run 通过后，生产任务最多触发一次。

### 第九步 线上验证

验证以下网址。

- `https://supply.aivora.cn/api/opportunities/snapshot`
- `https://news.aivora.cn/account-opportunity/2026-08/2026-08-31/`
- `https://news.aivora.cn/account-opportunity/`

检查状态码、日期、标题、正文结构、标准商品链接、利润链接、canonical、Article 或 BlogPosting schema、Breadcrumb、最新导航和缓存刷新。

使用桌面和约 390 像素手机视口检查日间与夜间模式，确认表格或长链接没有造成页面横向溢出。

## 三、Cloudflare 调用和成本

- 快照仍是每天账号商机任务中的一次 JSON GET。
- V2 预计增加几十 KiB 响应，仍受 512 KiB 上限保护。
- 60 秒边缘缓存和货源同步频率保持不变。
- 快照有效时模型调用继续为 0。
- AI 日报、AI 商机和低成本任务的模型额度不变。

## 四、回滚顺序

1. 对当天前端生成提交执行 `git revert`，恢复上一版 Markdown。
2. 对 AI Daily V2 提交执行 `git revert`，Worker 自动回到 V1 渲染器。
3. 对 Supply Radar schema 2 提交执行 `git revert`，恢复 schema 1。
4. 若 Supply schema 已回滚而 Worker 尚未回滚，V1 兼容解析会继续提供窄版日报。

不使用 reset、rebase、checkout 覆盖或 clean。

## 五、发布阻断条件

出现以下任一情况时不触发生产。

- schema 2 没有标准商品数组。
- 完全缺货商品进入可接单备货表。
- 正文少于 4 个平台或 6 个核心商品。
- 数字、金额或商品链接无法追溯到快照。
- 新闻来源不属于直接对应的官方或原项目来源。
- 单元测试、完整测试、构建或发布校验失败。
- V2 可能阻塞 AI 日报主体。
