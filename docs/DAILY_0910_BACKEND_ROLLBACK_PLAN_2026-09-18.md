# 2026-09-18 后端回退与自动日报验收方案

## 核实结论

- 9 月 9 日和 10 日日报都由后端提交 `ea78b401f63ad00807f79ead6bfd181f6ed987e5` 对应的 Worker 生成；生产后端开始本次工作时仍为 `6cd9b783f4ab53d573fede6182d9e2f2225e095b`。
- 直接部署旧版会超过 Cloudflare 免费版 Worker 的 64 个变量上限。回退以 `2b650d1` 为可部署基线：生成代码保持旧版，只把 32 项静态设置收进代码默认值，45 项运行绑定继续放在 `wrangler.toml`。等价检查覆盖 77 项设置，Cron、KV 等绑定没有变化。
- 前端历史文章不回退。9 月 18 日现稿保留；9 月 19 日只有在同素材自动试点合格且生产 Worker 部署成功后，才由 Worker 自动重生成，不手改 Markdown。

## 最小修改范围

1. 将 `src/`、相关测试与 `wrangler.toml` 恢复到上述旧版生成基线，保留当前部署工作流和运维文档。
2. 只修复隔离试点实际复现的系统边界：
   - 新闻中的直接 GitHub 仓库链接不能绕过 GitHub Trending Daily 来源限制；
   - 标题没有明确 AI 信号的影视内容和纯移动框架迁移不进入候选；
   - 同一 Jev 或 Claude Code Projects 事件在进入模型前去重；
   - 定性来源不得扩写成精确数字，厂商、媒体和用户自述保留归属；
   - 裸 URL 不参与自动高亮，并清除 URL 内误插入的 Markdown 符号；
   - GitHub 日榜只证明当天受关注及输入给出的星标数据，不能在没有来源支持时写成当天发布、上线或开放。
3. 不增加采集、模型调用阶段、重试次数或发布失败条件，不改商机、账号商机、BioAI 和前端样式。

## 隔离试点记录

- [试点 35321224834](https://github.com/dongyu19920904/CloudFlare-AI-Insight-Daily/actions/runs/35321224834)：9 月 18 日固定缓存，未发布。TOP 10 正文中位数 151 字，无不足 80 字条目；发现非 AI 影视、无来源数字和裸 URL 高亮问题。
- [试点 35413575921](https://github.com/dongyu19920904/CloudFlare-AI-Insight-Daily/actions/runs/35413575921)：修复上述边界后，TOP 10 中位数 107.5 字，无不足 80 字条目；发现 Jev 同一事件由两个来源重复占位。
- [试点 35414003971](https://github.com/dongyu19920904/CloudFlare-AI-Insight-Daily/actions/runs/35414003971)：使用 9 月 19 日固定缓存，`dailyWouldPublish=true`、`dailyPublished=false`。TOP 10 正文中位数 146.5 字，无不足 80 字条目；同日线上现稿中位数 81 字且有 4 条不足 80 字。事件重复已消失，仍发现纯 React Native 迁移混入以及 GitHub Trending 被写成当天“正式开放”。
- [试点 35414548400](https://github.com/dongyu19920904/CloudFlare-AI-Insight-Daily/actions/runs/35414548400)：前两项问题已经消失，但 Jev 的媒体稿、即刻梳理和社媒实测仍跨候选通道重复。根因是事件键只检查标题首行，且社媒补位只按 URL 和文本指纹去重。修正为在完整素材中识别事件，并让新闻、TOP 备用、社媒预留和趣闻共用已占事件集合。
- [试点 35414913434](https://github.com/dongyu19920904/CloudFlare-AI-Insight-Daily/actions/runs/35414913434)：Jev 只保留一条，前述问题均未复发；继续发现 ChatGPT 提交 GitHub PR 以两种标题跨 TOP 和社媒重复，以及 FAQ 在没有官方输入时补写支付、地区、权限和额度。增加对应事件键，并要求 FAQ 缺少官方证据时改问其它可回答问题。
- 最后一轮只修正上述两个边界并继续使用相同 9 月 19 日缓存。自动稿须同时通过发布校验和人工事实、来源、图文、可读性检查，才进入生产部署。

## 测试与发布

- 当前全量 Node 测试 377/377 通过，Worker 配置等价检查 77/77 通过。
- 试点 Worker 使用不可变预览版本和 `dryRun=1`，不得写前端仓库。
- 验收通过后，删除一次性试点工作流，正常推送到后端 `main` 并等待现有部署流程完成；随后调用现有恢复工作流重生成 9 月 19 日，核对前端提交和站点部署。
- 回滚本次后端发布时使用普通 `git revert`，不 reset、不强推、不覆盖旧目录。
