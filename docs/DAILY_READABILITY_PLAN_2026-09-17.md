# 日报阅读体验最小修正

固定样本：何夕 2026-09-16、2026-09-15；爱窝啦 2026-09-17。HTML/CSS 缓存在 `D:/CodexCache/daily-readability-20260917`。

## 基线核实

- 原后端 main 为 b405186，有 12 个未提交文件；原前端 main 为 a4fa154，有 1 个未提交文件。均保留。
- SSH fetch 后，后端 main 为 a7c6d45a260074ea133ec33b63a3856201516791，没有回退后的提交；前端 main 为 67e7a244b9e5f4819e42693a789ae95f15c855c1。
- 分别从上述远端创建 `D:/GitHub/{CloudFlare,Hextra}-AI-Insight-Daily-readability-20260917`，分支 `codex/daily-readability-20260917`，创建时 clean。
- remote 保留原 HTTPS origin/upstream；本任务 fetch/push 使用用户指定的 SSH URL，不更改旧目录配置。
- 线上文章已缓存；代码部署 SHA 仍需 Actions/线上产物佐证，不能用远端 HEAD 代替部署证明。

## 观察与实施范围

同行以行内事件句承载标题，短链接承载一个完整事实，正文接具体细节。本站 H3 之后强制再写黄色短结论，重复占位。后处理强凑三处高亮，动词正则能选中“提高时”。聚合稿被要求合并所有角度，导致一条出现多个无关事件。以上先改写作规则，CSS 只辅助。

1. `src/prompt/summarizationPromptStepZero.js`、`src/dailyGenerationPromptInput.js` 与 scheduled 的日报 repair：复用简短规则，短事件标题，首句补新事实，一事一条、默认一段；短句不设逐句硬字数、不凑句数；完整事实链接优先约 5–12 字，可必要放宽；高亮通常 1–3 处，不强凑。
2. `src/dailySectionSanitizer.js`：先小样复现，再移除自动候选补高亮，仅清除明确低价值标记；保留正文、数字单位、URL 和图片。
3. `src/dailyWritingQuality.js`：取消高亮数量下限与句数下限引发的修复，不增加发布硬门槛；保留长句群等诊断及原有修复次数。
4. 摘要提示词只在存在直接冲突时修改。前端 `assets/css/custom.css` 仅做日报范围 H3/首段间距、日间深色重点与链接层级调整；不改字体、路由、模板解析或图片代理。
5. 相关 Node 回归测试；完整 Node 测试、Hugo 0.147.9 构建；相同日期原素材完整不发布试点，人工核对来源与图文；桌面/390px、明暗四组浏览器检查。

## 边界、发布与回滚

不恢复已撤销提交，不改采集、Cron、API、商机、BioAI 或主站；不增加生成阶段、模型调用或重试次数。无真实趣闻就省略。保留品牌、三句摘要、TOP10 目标及原栏目；证据不足不凑稿。不默认覆盖已发布 9 月 17 日正文。

验证合格后用 SSH 普通提交推送，通过原 GitHub Actions 部署。若原素材/凭据受阻，明确说明试点未完成，不以手工稿冒充生成成功。回滚仅 revert 本次提交后按原流程部署，不 reset、不 force push、不重复历史回退。
