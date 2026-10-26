# AI 商机正文质量与阅读体验：2026-10-26

## 范围与基线

- 后端安全工作区：`D:\CodexWorktrees\CloudFlare-AI-Insight-Daily-opportunity-20261026`，基线 `c17c2b135de54b1564600a1a13b425cfa2b06700`。
- 前端安全工作区：`D:\CodexWorktrees\Hextra-AI-Insight-Daily-opportunity-20261026`，基线 `db613297d419ce0b8378a85f8e48414ffbd30d86`。
- 两者均从已核实的 SSH origin/main 新建 `codex/opportunity-editorial-20261026`，未覆盖原分叉目录。
- 最新已发布商机为 2026-10-25，日期内容提交 `0774707c70ef1e09b7f64b559742619f208f7b60`；不是把旧本地稿当线上现状。
- 账号商机已经迁移至 `Aivora-Supply-Radar` / `supply.aivora.cn/opportunities`；现有 Hugo 路径是迁移入口，本轮不修改。
- 不修改或调用主日报生成、来源、FAQ、模型、Key、调度、主日报展示；不修改 BioAI、个人主页与主站。仓库要求主日报完整生成的旧规则，由本次明确“禁止主日报生成”的范围覆盖，改用固定输入及渲染回归。

## 真实链路与问题

`scheduled opportunity -> 缓存来源与 7 天记忆 -> 候选评分/有界证据补充 -> 商机专属 prompt -> 模型初稿 -> 规范化 -> 主站链接白名单 -> 商机校验 -> 最多一次既有 repair -> 合格后 GitHub 提交/目录更新/记忆`。

`handleScheduledDaily`、账号商机分支、共享来源/证据/链接校验均保持原样。只在 `generateOpportunityMarkdown` 的局部规范化步骤接入商机专属适配器。

10 月 25 日原稿出现“用样品问目标用户有本次候选输入未提供付费意向”：共享证据缺口正则误把“有没有付费意向”里的“没有”当成缺证据断言。不能为修一个栏目改全局正则。本轮用现有 Marked AST 仅规范化普通文本中的这类问句，再调用既有证据规范化；保护代码、链接、HTML、公式和 frontmatter。

内容还存在标题长、六组字段反复解释同一事实、未经验证的鱼塘被写成既定痛点、一次性配置被叫成资产的问题。现有证据门槛和字段已够用，不增加栏目、不新增模型润色调用、不改去重或评分。

## 实施顺序

1. 先保存前端完整基线构建；记录受保护文件与固定输入结果。
2. 版本化商机 prompt：缩短标题、判断先行、事实与需求假设分开、样品先于询问、明确验收与停止；沿用现有六字段和发布预算。
3. 增加商机专属 AST 适配器，接真实初稿与 repair 共用的局部保存链路。轻度长句只警告，不增加调用；适配失败回原文，原校验仍决定能否发布。
4. 在商机 masthead 加载独立小样式；全部选择器以 `.ai-opportunity-layout` 为边界，复用当前字体/配色，不改共享 CSS 和 docs 布局。
5. 离线 fixture/mock 验证真实商机生成与校验路径、幂等、保护数据、空文/失败无写入、一次 repair 上限。没有付费生成。
6. 运行既有测试、Hugo 构建；固定主日报 HTML/hash 前后对比；桌面/390px 手机双主题截图，检查 CSS 在主日报命中数为零。
7. 保存样稿、选型、diff 和结果。生产提交/部署单独说明状态；不为上线商机执行会触发主日报/模型探测的工作流。

## 资源选型

| 候选 | 结论 | 项目适配 |
| --- | --- | --- |
| AgriciDaniel/claude-blog | 借鉴 | 先答案后依据、来源与推断分离；不用长文 SEO 模板或多轮润色 |
| ComposioHQ/content-research-writer | 已有替代 | 现有候选证据链和写作内核已经覆盖，不安装第二流程 |
| coreyhaines31/marketingskills | 借鉴 | customer-research 的真实信号、待验证假设、可观察行为；不移植营销口号 |
| op7418/Humanizer-zh | 已有替代 | 现有共享中文写作内核保留，不叠加去 AI 味流程 |
| hardikpandya/stop-slop | 已有替代 | 同上；不另加模型调用 |
| baoyu-format-markdown | 已有替代 | Worker 已内置 Marked；做原文范围编辑，不重排代码/链接 |
| baoyu-markdown-to-html | 不适用 | Hugo/Goldmark 已承担渲染，无须第二次 MD 转 HTML |
| sivan/heti | 已有替代 | 保留成熟日报字体/中文排版，仅增加商机作用域规则 |
| github-markdown-css | 不适用 | 完整 GitHub 皮肤会与 Hextra 双主题冲突 |
| tailwindcss-typography | 已有替代 | 现有正文主题不需要额外构建依赖 |
| doocs/md | 不适用 | 面向编辑/公众号的完整系统不应塞进 Worker/Hugo |
| DavidAnson/markdownlint | 已有替代 | 当前结构/来源发布门槛加针对性测试更适配；不为风格新增拒发点 |

已阅读被借鉴资源的 README、相关 Skill、许可证与依赖说明：claude-blog v2.3.1，commit `354442348815a7f0327077ad89af2c43cf4b4ab4`，MIT，Python 3.11/requirements.lock 的运行时不引入；marketingskills/customer-research v2.0.4，commit `e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b`，MIT，选择的是 Markdown 指令而非工具集成，无 Worker 运行时依赖。仅借鉴方法，未复制上游实现。现有 Marked v15.0.12（MIT）原样复用。

## 回滚与发布边界

新样式只由商机 masthead 引用；删除该引用即可撤回展示。后端撤回商机适配器调用和本次 prompt 即可，不涉及调度、密钥、历史文章或主日报。示例只放 tests/docs 与本地预览，不写入线上 content。最终报告补充具体测试与发布状态，不把 mock 称为真实模型生成或把本地构建称为上线。

## 已完成的后端验收

- 运行 `node --test tests/*.mjs`：504/504 通过，其中本轮新增 7 项顶层测试。
- `tests/helpers/opportunityEditorialDryRun.mjs` 使用 VM 执行实际 `handleScheduledOpportunity`，只替换来源上下文、候选、模型和网络边界；实际 prompt、正文适配、来源白名单、发布校验、repair、dry-run 出口保持真实代码。
- 合格初稿：1 次 mock 模型返回，`opportunityWouldPublish=true`，`opportunityPublished=false`；两个机会通过原发布门槛。
- 初稿不合格、修复合格：2 次 mock；持续不合格及空稿：最多 2 次、无正式提交；无候选：0 次；模型抛错：1 次后退出。
- 全部场景 `network=0`、`writes=0`；没有执行主日报生成。日志中测试模拟的 429/503 不是付费 API 请求。
- CRLF/LF、YAML frontmatter、URL/数字、行内/围栏/缩进代码、HTML/schema、三类公式、回放元信息和幂等测试通过。
- 适配异常或保护片段丢失时原样返回初稿，后续既有发布校验不变；不是吞掉校验错误强行发布。
- 从 `scheduled.js` 精确移除唯一新 import 和商机局部适配块后，与基线内容一致；固定主日报输入的组装结果不变。

## 构建时发现的既有问题

前端常规测试结果 36 通过、1 个构建后可选检查跳过（本轮新增 2 项已包含）。启用 `HUGO_TEST_PUBLIC_DIR` 后，`tests/seo-stage-one.test.cjs` 的合并检查在主页发现 `<h2><figure>` 嵌套；对修改前完整基线构建运行同一检查，亦在同一断言失败。本轮不修主日报内容/图片/模板，只记录这个未通过的既有验收项，不能把它包装成所有 SEO 检查通过。Hugo 构建本身成功。

截图初检另暴露了两个本轮测试环境问题，已修正：Hextra 把标题 id 放在内部 span，商机样式改以 `h2:has(> #直接结论)` 命中实际 DOM；多语言 `contentDir` 优先于 CLI 全局参数，样稿预览改用仅存在 D 盘的语言级 JSON 覆盖配置，未改仓库生产配置。

## 最终页面与隔离验收

- 三种页面各测桌面 1440px/手机 390px、日间/夜间：原始基线、仅展示改进、离线新样稿。12 个商机页面场景，加 4 个主日报 CSS 隔离场景，合计 16 个浏览器检查通过，24 张首屏/正文截图。
- 一 H1、固定 canonical、BlogPosting、两个项目来源链接及下划线、窄屏无横向溢出、摘要桌面双列/手机单列均通过。正文继续继承成熟日报的标题、关键词、证据链接、字体和日夜变量，不安装第二套皮肤。
- 主页、10 月 26 日与 25 日主日报、时间线、账号商机迁移入口、robots、sitemap 共 7 份构建输出与修改前逐字节一致。新增样式未在主日报加载，全部 CSSStyleRule 在主日报 DOM 命中为零。
- 源码快照覆盖 113 个受保护文件；`scheduled.js` 只允许商机局部块及其 import 差异，主日报和账号商机函数不变。
- 基线锁定检查放在一次性验收脚本，不冻结日后合法维护。常规测试只验证商机调用边界、固定主日报组装输入和样式加载边界。
- 浏览器使用本机 D 盘 Camoufox/Playwright。此前 BrowserOS 的视口切换截图出现黑边/陈旧视口，因此这里采用已安装的截图能力备选；没有新增浏览器或 npm 依赖。

证据目录：`D:\CodexReports\opportunity-editorial-20261026`。`verification.json` 保存页面 hash 和逐场景指标；`protected-source.json` 保存源码快照；`actual-handler-dry-run.md/json` 是实际商机 handler 接收 mock 模型结果后的完整输出与检查，不是付费模型实生成。

## 修改文件与复验入口

后端运行时仅 3 处：`src/prompt/aiOpportunityPrompt.js` 的版本化编辑规则、`src/opportunityEditorial.js` 的商机 AST 适配、`src/handlers/scheduled.js` 商机局部规范化调用。没有修改评分、去重、全局校验、主站链接策略、密钥、定时任务或正式发布函数。

后端测试/工具：`tests/opportunityEditorial.test.mjs`、`tests/helpers/opportunityEditorialDryRun.mjs`、`tests/fixtures/opportunityEditorial.md`、`scripts/preview-opportunity-editorial.mjs`、`scripts/verify-opportunity-isolation.mjs`。文档为本文件及 `preview-20261025.md`。

前端运行时仅 2 处：`assets/css/opportunity-reader.css`、`layouts/partials/custom/opportunity-masthead.html`。对应测试/验收为 `tests/opportunityReader.test.cjs`、`scripts/check-opportunity-reader.mjs`，说明见前端 `docs/opportunity-reader-20261026.md`。

所有 Node/Hugo/浏览器命令使用 `Invoke-WithProjectCache.ps1`。复验命令：

```powershell
# 在后端工作区，经 D 盘缓存包装器运行：
node --test tests/*.mjs
node scripts/verify-opportunity-isolation.mjs
node --experimental-vm-modules tests/helpers/opportunityEditorialDryRun.mjs D:\CodexReports\opportunity-editorial-20261026

# 在前端工作区，经同一包装器运行：
node --test tests/*.test.cjs
# 使用现有 Hugo 0.147.9 构建；完整页面复验需要先重建 before/after/sample 三份产物。
```

## 成本、发布与未完成边界

- 本轮真实模型调用 0、正式内容写入 0、推送/部署 0；没有新增调度、运行时包、网络补抓或多轮润色。原初稿加最多一次 repair 不变。
- 新 prompt 仅增加几条栏目编辑规则；额外输入 token 和 AST CPU 尚未做生产计量，不宣称零运行成本。
- 尚未做付费模型实生成和生产部署。不能以 fixture 通过代替真实文稿质量验收，也不能绕开现有主日报构建后检查失败。旧文章和旧 description 不自动重写，线上 10 月 25 日那句语病仍保留在原稿中，本轮仅修未来生成链路并展示离线改写。
- 评分和去重策略原样保留，因此同一交付类型出现频繁的问题并未在此轮完整解决，不夸大本轮效果。下一步应先审阅本地样稿，再在明确的商机模型调用/发布额度内生成一次新预览；复用已有部署流程前，需确认不会触发主日报或模型线路探测。

## 临时产物清理限制

缓存包装器使用进程级 D 盘目录，无全局环境变量修改。报告、样稿与截图已保存到 D 盘报告目录。最后一次清理命令在启动前被工具策略拒绝，未通过其他命令或工具重试。以下本次临时构建目录仍保留，不声称清理完成：

- `D:\CodexCache\runs\opportunity-editorial-20261026-before`
- `D:\CodexCache\runs\opportunity-editorial-20261026-after`
- `D:\CodexCache\runs\opportunity-editorial-20261026-content`
- `D:\CodexCache\runs\opportunity-editorial-20261026-sample`
