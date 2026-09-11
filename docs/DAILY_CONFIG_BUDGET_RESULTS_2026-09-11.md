# 日报配置等值精简结果

## 已交付

- 代码提交：`65751a45445194d9bcf29c4bb06f81931b17cb7b`。
- 原始分叉目录未修改；使用 `D:/GitHub/_worktrees/daily-config-budget-20260911` 独立工作区，通过原 SSH remote 非强制推送。
- 32 项固定非敏感配置移入代码默认值，TOML 文本变量从 77 降到 45。环境变量显式配置仍优先，不删除密钥、不改变绑定对象。
- 上次部署报告总变量 85，由此推算另有 8 项部署端变量；若这些项不变，本次总量应为 53。成功日志确认 45 项文本绑定，未独立枚举密钥数量。

## 文件与范围

| 文件 | 修改 |
| --- | --- |
| `src/workerConfig.js` | 保存 32 项原值，统一合并默认配置；无新增网络调用 |
| `src/index.js` | 增加 import，在 scheduled、fetch 各加入一行配置合并 |
| `wrangler.toml` | 删除已迁移的 32 项，其余值不变 |
| `tests/workerConfig.test.mjs` | 6 项新增测试，覆盖配置类型、覆盖语义、绑定、定时和 HTTP 入口 |
| `scripts/check-worker-config-equivalence.py` | 用标准 TOML 解析器逐项比对迁移前后值与类型，并比较其余所有配置节 |
| 本方案及结果文档 | 记录部署、预览、回滚和边界 |

本轮未改提示词、正文规则、UI、cron、API 路线、模型、来源列表或发布目标。本次部署同时包含此前已提交但被变量上限阻挡的内容修复，因此新预览与旧预览的文字变化不能归因于配置搬迁。

## 验证

1. `npm test`：478/478 通过，0 失败、0 跳过。包括原有主日报、商机、账号商机与失败隔离回归。
2. `python scripts/check-worker-config-equivalence.py`：旧配置全部 77 项的键、值、类型等价；triggers、KV 等其他 TOML 配置节完全不变。
3. `git diff --check`：通过。
4. 原 GitHub Actions 部署成功，Worker 打包成功，启动时间日志为 6 ms。
5. 定时表达式仍为 `50 0 * * *` 和 `0,12,20,50 1 * * *`。

部署运行：https://github.com/dongyu19920904/CloudFlare-AI-Insight-Daily/actions/runs/34563533526

Worker 版本：`f33e26fd-22fd-498a-8e74-853cf2078a30`。

## 真实试生成

试跑日期 `2026-09-10`，沿用上次样本日期，明确传入 `dry_run=true`。运行耗时 **3 分 33 秒**。

运行：https://github.com/dongyu19920904/CloudFlare-AI-Insight-Daily/actions/runs/34563667714

预览文件：`D:/GitHub/_artifacts/daily-config-budget-20260911/daily-preview.md`。

完整机器报告：`D:/GitHub/_artifacts/daily-config-budget-20260911/trigger-final.json`。

结果：

- `dailyGenerated=true`、`dailyValidationPassed=true`、`dailyWouldPublish=true`。
- `dailyDryRun=true`、`dailyPublished=false`。
- TOP 10、开源 2 条、社媒 3 条；媒体检查识别 10 个可用媒体，不等于逐张浏览器实看验证。
- 趣闻独立生成成功并插入；本次初稿/修复稿没有被招募营销规则移除的趣闻。
- 同样复用缓存素材：news 50、project 20；去重后 news 40、project 19，与上次试跑一致。
- 正文模型 token 上限仍为 4096。
- 未运行商机和账号商机正式生成。
- 试跑前后线上 `content/cn/2026-09/2026-09-10.md` SHA 均为 `722d0078aab811179340bba9d9334398a836b179`，原稿未被覆盖。

## 内容观察与未完成验证

配置问题已解决，不能据此宣布内容质量全面达标：

- 有改善：AlphaGenome 正文和摘要明确区分预测与实验验证。
- 仍有警告：8/86 个句子超过 55 字，最长 84 字；3 个 TOP 条目的短关键词高亮不足。上次样本为 6/98 个长句、5 个 TOP 高亮不足，两项并非同时改善。
- 趣闻只引社媒，却直接宣布攻克数学难题；这需要进一步核对原始论文及结论范围，不能仅凭程序校验视为事实已经核实。本轮未做全面事实核验。
- 个别正文仍有空泛、生硬句子，例如 OpenGL 条目的“这次测试保住了排版”，Gemini 条目没有提供具体新功能。不要把这份预览直接替换线上好内容。
- 本机访问 `https://news.aivora.cn/` 两次连接超时，未取得可用 HTTP 状态；这只能说明本次本机连通性验证失败，不能证明网站宕机。未修改前端，不做无关 UI/SEO 改动。
- 真实 dry-run 验证了 HTTP 入口和主日报生成链路；新的下一次自动 cron 尚未发生，不能保证上游 API 永不失败。

## 成本、缓存与回滚

配置搬迁不新增模型请求、抓取请求或定时任务。一次 dry-run 有正常生成成本；不能用一次耗时推断长期成本变化。临时运行目录由 D 盘缓存 wrapper 清理，共享缓存保留；预览保存在 D 盘 artifacts 中供复核。

上一成功运行版本：`a226132c-e7fc-4817-96d0-78830de642af`。如出现运行回归，可按原 Cloudflare 流程回滚 Worker 版本。若回滚旧内容提交，应保留本次配置精简；直接恢复 85 个变量的配置重新部署会再次触及限制。本轮未执行回滚。
