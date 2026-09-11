# 日报事实检查与针对性修复结果

日期：2026-09-11。结论：本轮防错修复已部署，完整生成链路可运行；最后一次预览结构合格，但人工内容审核仍有未通过项，未覆盖线上日报。

## 隔离与范围

- 工作区：`D:/GitHub/_worktrees/daily-fact-repair-20260911`。
- 分支：`codex/daily-fact-repair-20260911`；基线：`cd86f54ca50e7602002efc6d2308133ca824d981`。
- 没有覆盖原前后端目录中的分叉和未提交改动。通过原 SSH remote 非强制推送，沿 GitHub Actions 原流程部署。
- 未改前端、Cron、模型、信息源配置、商机任务或主站。未新增环境变量、网络核验请求或模型调用步骤。

## 原因与修复

1. 原来源绑定检查要求多个特定英文词和竞争来源，只有 Cursor 一个实体词的标题可能漏检。新增明确 Codex/ChatGPT 与 Cursor 相反产品证据检查；只隔离错配单条及其图片，保留比较、集成和不明确来源。
2. 正文和摘要模型会把性能价格比改写成成本降幅。替换现有提示词约束；在“成本低一半”和正文“每美元性能领先 50%”同时出现时，中性化标题，保留原数据，不自行计算新百分比。
3. 社交转述的收购金额在强化提示词后仍进入实际试稿。针对仅有社交证据的收购/融资条目，清掉精确交易金额，保留链接和其他数字。此规则不是完整事实核验，尤其不代表收购完成状态已获证实。
4. 免费额度绕过建议在真实试稿中重复出现。段落级删除清 Cookie/换浏览器继续获取免费额度的行动句，保留负面警告、其他事实及其中的来源 URL。
5. 独立趣闻使用单独提示词，不能只修改正文 prompt。同步强化真实反差、体验归属、第三人称边界；模型仍可能输出不够有趣的素材，尚未解决选材问题。

## 文件与 Diff

相对基线的代码、测试和方案合计：8 文件，262 行增加、10 行删除；本结果文档另计。

| 文件 | 变更 |
| --- | --- |
| `src/dailySourceBinding.js` | 明确产品错配隔离、窄范围金额/额度句清理、成本标题中性化 |
| `src/prompt/summarizationPromptStepZero.js` | 替换事实归属、数字口径、交易证据、体验和风险边界规则 |
| `src/prompt/summarizationPromptStepThree.js` | 摘要保留实体和统计口径，不夸大交易金额 |
| `src/dailyFunSection.js` | 独立趣闻提示词补充真实归属和趣味门槛 |
| `src/handlers/scheduled.js` | 仅增加 2 行清理结果调试记录，无路由改动 |
| `tests/dailySourceBinding.test.mjs` | 错配、误删边界、金额、额度句、标题、幂等与证据 URL 回归 |
| `tests/dailyFactBoundaries.test.mjs` | 正文、摘要与独立趣闻提示词约束测试 |
| `docs/DAILY_FACT_REPAIR_PLAN_2026-09-11.md` | 本轮最小修复方案和边界 |

## 验证与三轮试稿

- 最终完整 `npm test`：494 通过，0 失败，0 跳过，约 28.8 秒。`git diff --check` 通过。
- 配置等价检查：77 项设置值与类型均不变，45 个文本绑定 + 32 个代码默认值；其他 TOML 部分不变。
- 所有本地测试和下载经进程级 D 盘缓存包装器运行，临时目录自动清理；共享依赖缓存保留。原始试稿属于验证产物，保留在 D 盘。
- 本轮未修改前端，不声称已执行 Hugo 构建、浏览器图片渲染或全部来源 URL 复核。

| 真实 dry-run | 用时 | 结果与仍有的问题 |
| --- | --- | --- |
| [34580203801](https://github.com/dongyu19920904/CloudFlare-AI-Insight-Daily/actions/runs/34580203801) | 3 分 8 秒 | 生成成功；产品名改善，但虚构金额和额度绕过句仍出现，促成本轮确定性清理 |
| [34581190839](https://github.com/dongyu19920904/CloudFlare-AI-Insight-Daily/actions/runs/34581190839) | 2 分 56 秒 | 实际隔离两条 Cursor/Codex 错配、清理金额及额度句；TOP 剩 9，成本标题仍混淆，趣闻偏弱 |
| [34582355236](https://github.com/dongyu19920904/CloudFlare-AI-Insight-Daily/actions/runs/34582355236) | 4 分 57 秒 | TOP 10、开源 2、社媒 2、趣闻 1；生成与既有结构校验通过，人工事实审核仍未全通过 |

最后一轮原始文件（没有人工修改试稿）：

- `D:/GitHub/_artifacts/daily-fact-repair-20260911-verified/daily-preview.md`
- `D:/GitHub/_artifacts/daily-fact-repair-20260911-verified/trigger-final.json`

最后一轮 `dailyGenerated=true`、`dailyWouldPublish=true`、`dailyPublished=false`、`dailyValidationPassed=true`，repair 被采用。清理记录显示初稿删除额度绕过句和 70 亿美元金额，repair 再次删除额度绕过句。该轮本身没有触发产品隔离或成本标题修正，不能将它们说成在该轮被拦截；产品隔离见第二轮，成本标题修正有真实失败样本单测。

结构校验仍提示：93 句中 9 句超过 55 字，P90 为 52、最长 87。`dailyWouldPublish` 仅表示现有机器发布门槛，不代表人工事实审核通过。

## 最后试稿的未通过项

- 趣闻仍是深度搜索工具偏好介绍，反差与趣味不足，不能说已生成优秀趣闻。
- 将 Stripe/OpenRouter 写成“完成收购”，而本轮查到的 [Stripe 官方公告](https://stripe.com/newsroom/news/stripe-agrees-to-acquire-openrouter)只证明签署收购协议；清除金额不等于解决交易状态。
- Codex Pro 条目中的“Tibo 创始人”、手动重置额度预测没有充分证据。订阅边界应依照 [OpenAI 官方 Pro 说明](https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers)，不能根据论坛扩展人物身份或供应政策。
- Gemini FAQ 的“无需额外订阅”、Suno 30 美元的计费周期、视频对比结论，以及乔布斯“预判全部兑现”等，尚未完成官方或原始证据核对，不能作为已核实事实交付。
- 第三方 TPU 数字虽然不再写成“成本低一半”，仍需分别核对性能/美元与 token 成本的测算条件；不能认为同一来源中所有指标可直接互换。
- 图片 URL 和媒体与原文的一致性未在本轮浏览器逐张实测。没有因此替换任何图片。

以上问题未通过增加硬性整篇拦截处理。不要用本预览覆盖线上好内容，也不要把确定性正则称为全面事实审核器。后续应优先对强政策/价格/交易事实引入可追溯的原始证据、去掉来源未支持的增写，并改善趣闻选材；另立小范围方案，避免不断新增开关或全站校验。

## 部署、线上与回滚

- 当前代码提交：`39dfe262f6f38ece1118dd1fcc9760c784389628`。
- [部署运行 34582256246](https://github.com/dongyu19920904/CloudFlare-AI-Insight-Daily/actions/runs/34582256246)：成功。
- Worker 版本：`9e0755fa-82a1-4927-a417-629a1c2ace79`。
- Cron 保持 `50 0 * * *` 与 `0,12,20,50 1 * * *`，不调整触发/重试时序。
- [线上 9 月 11 日日报](https://news.aivora.cn/2026-09/2026-09-11/)未覆盖；前端 Markdown blob 在试跑前后均为 `49632a2a6e6553b5c9d5771ea9e0cb71cb746282`。
- 正式 GitHub 写入、前端重建和明日自动 Cron 尚未在本轮重新触发，不能保证明天一定成功。真实 dry-run 已覆盖部署后采集/生成/修复/校验链路，但不等同于正式发布验收。
- 运行成本：无新增模型调用步骤或外部请求；新增段落扫描的 CPU 开销未独立测量。三轮手动预览消耗了现有模型链路额度，不能据生成时长推断具体 token 或费用。
- 回滚本轮时依次 revert `39dfe262f`、`2be37b381`、`985594569`、`5785caba9` 后按原流程部署；不要 reset 原目录，不要撤销此前配置等价精简。原 Worker 回滚参考版本为 `f33e26fd-22fd-498a-8e74-853cf2078a30`，执行前仍需确认部署状态和后续改动。
