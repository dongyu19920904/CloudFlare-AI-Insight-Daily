# 日报续优验证报告

## 完成范围

本轮代码已完成、测试通过并部署。修复“以标题替换链接标签”的确定性缺陷，改善已生成修复稿的长句评分；替换短句示例，保留必要来源归属。没有变更 Cron、抓取来源、模型选择、请求次数配置、发布合格标准、前端、商机或账号商机。

完整预览没有发布。它比上一轮短句指标更好，但存在一个明确错链及错图，不能作为可直接上线的优秀成稿。

## Diff 摘要

- src/dailySectionSanitizer.js：只在 TOP 原有处理范围内移动链接边界，不注入新闻标题；原来的字词和 URL 保留。无法识别完整分句、代码、HTML、复杂链接等情况保留原样。图片不会被同名文字链接误处理。
- src/dailyRepairPolicy.js：长句警告按超长句数量和极长句程度评分，而非恒定 1 分。不会新增生成、重试或发布拦截；有效初稿可继续保留。
- src/prompt/summarizationPromptStepZero.js：短结论、事实、细节、限制分句；用一个完整短句示例替换抽象要求，链接移除标记后也应自然。
- src/handlers/scheduled.js：仅同步 repair 提示字符串，函数其余运行代码未改。
- tests/dailyLinkPreservation.test.mjs：17 个保真与边界用例。
- tests/dailyRepairPolicy.test.mjs：新增长句退化/改善/无效初稿恢复用例。
- tests/dailyNaturalAttribution.test.mjs、tests/summarizationPromptStepZero.test.mjs、tests/scheduledDailySanitization.test.mjs：更新相应规则和旧的标题替换断言。
- docs 下保存方案及本报告。

远端并行账号商机改动按原样合入，不是本轮新增内容。没有强推、重置、覆盖原始分叉目录或上一轮未提交报告。

## 冻结输入验证

输入（合成回归样本，不是新闻）：

```md
### 1. 不能被塞回正文的新闻标题
**测试仍有局限。** [作者的实测记录](https://example.com/test)显示，暂不能证明该模型已经开放。
```

旧处理结果会把链接改为“不能被塞回正文的新闻标题”，产生“新闻标题显示”的语病，并丢失原始归属标签。

新处理结果：

```md
### 1. 不能被塞回正文的新闻标题
**测试仍有局限。** 作者的实测记录显示，[暂不能证明该模型已经开放](https://example.com/test)。
```

可见字词和 URL 不变，否定与不确定性保留；自然表达仍需模型编辑，代码不会靠删词制造假简洁。对于“[原帖](URL)中指出”这类无法安全挪动的句子，宁可保留也不猜一个标题替换。

## 测试与部署

- 最终 npm test：432 项全部通过；本轮新增 18 项，其余新增来自合入的其他任务。
- 4 处 JS 的 node --check、git diff --check 通过。
- scheduled.js 除 repair 提示词外与基线一致；图片、URL、跨段范围、幂等、代码及复杂链接有定向测试。
- 本地测试临时目录使用 D:\CodexCache，包装脚本执行完清理；共享依赖缓存保留。
- 前端没有修改，未重复 Hugo 构建或视觉回归。
- 代码提交：40d7d27c7；包含此修改的部署提交：8c2a7042f。
- 部署成功：https://github.com/dongyu19920904/CloudFlare-AI-Insight-Daily/actions/runs/34452428901。
- Worker 版本：78e67cbe-b60e-4ad5-8065-391bd20612e8。

## 真实不发布预览

运行：https://github.com/dongyu19920904/CloudFlare-AI-Insight-Daily/actions/runs/34452698099。

使用原有工作流，date=2026-09-10、dry_run=true，耗时 3 分 31 秒。使用缓存素材，33 个总候选、19 个选入素材、12 个趣闻候选，与上一轮候选统计一致；这不等于模型生成结果逐字可复现。

- dailyGenerated=true
- dailyValidationPassed=true
- dailyWouldPublish=true
- dailyPublished=false
- dailyRepairAttempted=true，dailyRepairAdopted=true
- dailyRepairMetQualityTargets=false
- 已有的趣闻单独生成分支被执行，没有新增这条调用逻辑
- TOP10、2 条开源、3 条社媒，均完整

完整交付文件（原始预览，不作为正式日报）：

- D:\GitHub\_artifacts\daily-link-readability-20260910\daily-preview.md
- D:\GitHub\_artifacts\daily-link-readability-20260910\trigger-final.json

## 同一指标的对照

| 指标 | 原线上 9/10 Markdown | 上一轮第二次预览 | 本轮完整预览 |
| --- | --- | --- | --- |
| 句子数 | 77 | 70 | 83 |
| 超过 55 字的句子 | 9 | 12 | 7 |
| P90 句长 | 59 | 65 | 52 |
| 最长句 | 83 | 115 | 95 |
| TOP 过短条目 | 0 | 0 | 0 |
| TOP 泛化来源链接 | 0 | 0 | 1 |

本轮已选中的主体修复稿在趣闻补全前为 80 句，5 句超长，P90=51，最长=67。最终趣闻补全后出现更长句，因此最终最长句仍未优于原线上文章。不能仅用主体指标声称整份文章已完全改善。

## 人工审阅与剩余问题

改善：普通条目更常直接讲产品和能力；TokEMS 段落不再先介绍转发者；企业案例保留“企业自述”限定。正文事实短语链接更自然，标题注入的后处理缺陷已由冻结用例确认消除。

仍有一个“原帖”式链接、两条 TOP 高亮不足及七句超长句。这些仍是非阻塞警告，没有通过加硬拦截拖住日报。

明确的内容错误：第 7 条 DeepSeek 路由消息使用了 https://x.com/Gorden_Sun/status/2097635961614270891，该链接在本期素材中对应 Omnii 癌症疫苗消息；该条随后还出现 Omnii 配图。代码本轮不生成或替换 URL，但仅保证 URL 不变并不足以保证新闻与证据正确匹配。后续应针对生成时的新闻实体与 URL 绑定单独排查；本轮不声称该问题已修复，不发布此预览。

此外，数学证明结论、模型状态及个人测试仍需要对原始来源作进一步核验；本轮没有完成每条事实的独立核查。程序校验通过只说明当前自动规则通过，不等同事实全部真实。

## 线上保护与回滚

今天内容地址：https://news.aivora.cn/2026-09/2026-09-10/。

预览前后 content/cn/2026-09/2026-09-10.md 的 GitHub blob SHA 均为 722d0078aab811179340bba9d9334398a836b179，确认没有覆盖线上正文。

新规则已部署，后续生成会使用。单次预览能证明链路跑通，不能保证每次风格和事实均达标。未来既有修复调用的触发频率可能随输出变化，未量化长期 Cloudflare 成本；本轮仅额外执行一次真实预览。

必要时只 revert 40d7d27c7 并按原流程部署，不能回滚合并提交或用旧 Worker 覆盖其他任务的更改。下一步应独立处理来源错配，避免为了完善一处文风不断扩大共享管线的改动。
