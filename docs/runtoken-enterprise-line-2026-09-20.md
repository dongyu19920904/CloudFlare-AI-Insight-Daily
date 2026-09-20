# 企业模型线路切换（2026-09-20）

## 范围与配置

本次调整 AI 日报与 BioAI 两个 Worker 的 Anthropic 模型调用配置。货源和日报前端没有独立模型调用入口，私钥不写入前端。

- Anthropic 兼容接口：`https://www.runtoken.ai/v1/messages`。
- 平台：`ANTHROPIC`；主模型：`claude-sonnet-5`；备选模型：`claude-opus-4-8`。
- `ACCOUNT_MERCHANT_EDITORIAL_MODEL` 配置也统一为主模型。当前基线没有读取此覆盖项的独立调用代码，不把配置探测冒充商机全文生成验收。
- `svip-think` 是用户指定的供应商侧分组。项目不猜测分组请求头；请求成功不能单独证明供应商的计费分组或底层模型身份。
- OpenAI 自动回退显式关闭；Gemini 沿用现有关闭状态。保留两个 Claude 模型的回退和原有重试规则。
- 不调整日报 4096 token 上限、内容提示词、定时任务、发布校验、栏目隔离或前端。

## 密钥与部署

密钥只放在 GitHub Actions 的 `RUNTOKEN_API_KEY` Secret 和 Cloudflare Worker Secrets。两个 Worker 只更新 `ANTHROPIC_API_KEY` 与 `ANTHROPIC_BACKUP_API_KEY`；已有 OpenAI/Gemini Secret 保持原状且不会参与本次验证。

沿用 AI 日报的 `deploy-worker.yml`：先用项目客户端进行四个微型探测，再用 Wrangler `--secrets-file` 部署 AI 日报并更新两个 Anthropic Secret。BioAI 当前配置有 124 个变量，超过 Cloudflare Free 的 64 个绑定上限，因此手动勾选 `sync_bioai` 时只用 `secret bulk` 原位更新现有 Worker 的 Anthropic 端点、模型和 Key，不上传 Worker 代码。部署后调用 AI Worker 的四个鉴权探测，再用 BioAI 的现有项目方案接口确认实际走了模型而不是服务端兜底。其他 Worker Secrets 保持原状；临时文件在执行结束后删除，仓库中不包含真实密钥。

## 验证标准

1. 主模型、备选模型分别通过普通调用和流式调用。
2. 模拟主模型 429 时，即使残留 OpenAI key，也直接走指定 Claude 备选。
3. 探测只接受固定请求和预定义路由，每次最多 256 输出 token，禁止备用模型掩盖被测模型故障。
4. `/testModelConnection` 只接受 POST 和 `x-test-trigger-secret`，未授权不调用模型；不读取货源，不写 KV，不提交文章。
5. 全部 Node 测试、`git diff --check`、Wrangler 打包 dry-run 通过。
6. GitHub Actions 部署后 AI Worker 四路调用通过，BioAI 接口返回 `model` 或 `backup-model`。探测成功仅证明接口可用，不代表完成整篇日报生成或内容质量验收。

普通 AI 日报部署会增加八个小型模型请求（部署前、后各四个）；手动勾选 `sync_bioai` 时再增加一个 BioAI 验证请求。平常 Cron 不增加额外调用。实际收费与分组需以供应商账单为准；本次不触发生产日报生成。

## 回滚

切换前代码基线：`75d0f6b5326433fbc72aeb817df1d6b853bb685c`。

切换前 Worker 版本：`8874b760-270b-4da3-aaf4-229655e3a387`，对应部署运行 `35431367136`。

需要回滚时，在受权 Cloudflare 环境将部署恢复到该 Worker 版本，并核对其配套密钥、端点和模型。不要只撤销端点代码却继续注入新供应商密钥；若重新部署旧代码，必须同时恢复匹配的凭据并重新做微型探测。未保存旧密钥明文，也未撤销供应商侧旧密钥。
