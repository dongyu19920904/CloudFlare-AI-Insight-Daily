export const opportunityPlaybook = {
  businessProfile: {
    coreBusiness: ["AI账号", "AI内容", "轻教程", "代配置"],
    targetUsers: ["中文新手", "低预算用户", "想快速上手AI的人"],
    tone: "务实、直接、偏成交，不写空话",
    editorialRule:
      "先根据当天真实信息源判断机会，再决定最适合写成账号、模板包、跑通包还是轻服务；先写买家愿意付钱的理由，再补当天的新变化。",
  },

  productLanes: [
    {
      id: "account",
      name: "账号类",
      description: "更适合写成低门槛账号入口、低价体验、上手即用的商品。",
      sellFormats: ["单卖账号", "账号+基础教程", "账号+答疑"],
      scoringProfile: {
        catalogFit: 30,
        standardDelivery: 14,
        lowPriceLeadGen: 15,
        upsellFit: 8,
      },
    },
    {
      id: "bundle",
      name: "搭售类",
      description: "更适合写成账号+教程、账号+环境配置、账号+模板包。",
      sellFormats: ["账号+教程", "账号+环境配置", "账号+模板包"],
      scoringProfile: {
        catalogFit: 27,
        standardDelivery: 18,
        lowPriceLeadGen: 12,
        upsellFit: 10,
      },
    },
    {
      id: "service",
      name: "轻服务类",
      description: "更适合写成代配置、代搭建、模板交付、1对1陪跑。",
      sellFormats: ["代配置", "代搭建", "模板交付", "1对1陪跑"],
      scoringProfile: {
        catalogFit: 24,
        standardDelivery: 20,
        lowPriceLeadGen: 9,
        upsellFit: 9,
      },
    },
  ],

  topicRules: [
    {
      id: "gpt",
      label: "GPT / OpenAI 账号机会",
      match: ["openai", "gpt", "chatgpt", "gpt-4", "gpt-5"],
      preferredLane: "account",
      secondaryLane: "bundle",
      defaultAdvice: "优先写成低门槛体验和搭售教程，不要只写概念。",
      productAngle: "低门槛体验账号 + 上手包",
      buyerHint: "想先低成本用上 GPT，但不想自己折腾订阅和入口的中文新手",
      deliveryHint: "账号入口、登录说明、常用场景清单、基础答疑",
      channelHint: "群里、朋友圈、商品页",
      titleHint: "先写能拿到的结果或场景，再写 GPT 账号",
      avoidLeadHint: "不要把模型参数、官方价格、技术名词写成标题主卖点。",
    },
    {
      id: "claude",
      label: "Claude 账号机会",
      match: ["claude", "anthropic", "opus", "sonnet"],
      preferredLane: "account",
      secondaryLane: "bundle",
      defaultAdvice: "更适合写成账号入口、基础教程和售后答疑。",
      productAngle: "Claude 账号 + 内容处理/写作提效搭售",
      buyerHint: "想用 Claude 做写作、翻译、整理内容，但不想自己折腾入口和配置的人",
      deliveryHint: "账号入口、基础上手、常用场景说明、售后答疑",
      channelHint: "群里、朋友圈、商品页",
      titleHint: "先写内容结果或场景，再写 Claude 账号",
      avoidLeadHint: "不要把求 token、stars、安装量当成标题主卖点。",
    },
    {
      id: "cursor",
      label: "Cursor 账号与搭售机会",
      match: ["cursor", "cursor pro", "cursor agent"],
      preferredLane: "account",
      secondaryLane: "bundle",
      defaultAdvice: "既能卖号，也适合顺手搭配安装说明和提效教程。",
      productAngle: "Cursor 账号 + 安装配置 + 提效场景包",
      buyerHint: "想更快开始用 Cursor 提效写代码，但不想折腾安装和配置的人",
      deliveryHint: "账号、安装说明、常用工作流配置、提效示例",
      channelHint: "社群、商品页、朋友圈",
      titleHint: "先写提效场景，再写 Cursor 账号或配置",
      avoidLeadHint: "不要把开发者讨论热度写成唯一卖点。",
    },
    {
      id: "gemini",
      label: "Gemini 账号机会",
      match: ["gemini", "google ai studio", "google gemini"],
      preferredLane: "account",
      secondaryLane: "bundle",
      defaultAdvice: "优先写成低价体验入口，不要把官方价格直接当卖价。",
      productAngle: "Gemini 体验账号 + 基础上手包",
      buyerHint: "想试 Gemini 新能力，但只想先低成本体验的用户",
      deliveryHint: "体验入口、登录说明、基础场景演示",
      channelHint: "商品页、社群、朋友圈",
      titleHint: "先写体验场景，再写 Gemini 入口",
      avoidLeadHint: "不要把官方定价或平台黑话写成商品名。",
    },
    {
      id: "kimi",
      label: "Kimi 账号与工具机会",
      match: ["kimi", "moonshot"],
      preferredLane: "account",
      secondaryLane: "bundle",
      defaultAdvice: "适合写成中文用户上手快、门槛低的入口商品。",
      productAngle: "Kimi 入口账号 + 中文提效小工具",
      buyerHint: "想快速试中文 AI 工具、追求上手快和门槛低的用户",
      deliveryHint: "入口说明、基础场景教程、常用玩法清单",
      channelHint: "商品页、群里、朋友圈",
      titleHint: "先写中文场景结果，再写 Kimi 入口",
      avoidLeadHint: "不要堆模型名和技术词，直接写人能听懂的用途。",
    },
    {
      id: "openclaw",
      label: "OpenClaw / Agent 代配置机会",
      match: ["openclaw", "autoclaw", "clawbot", "agent sdk"],
      preferredLane: "service",
      secondaryLane: "bundle",
      defaultAdvice: "优先写成代配置、跑通服务、安装说明，不要只谈热点。",
      productAngle: "微信跑通版 / 代配置 / 代接入",
      buyerHint: "想把 Agent 用起来、但不想自己配环境和排错的小白",
      deliveryHint: "代配置、跑通测试、截图或录屏说明、基础答疑",
      channelHint: "群里、私聊、朋友圈",
      titleHint: "先写跑通结果或交付动作，再写 OpenClaw 或微信 Agent",
      avoidLeadHint: "不要把 SDK、协议名、开源热度写成标题核心。",
    },
    {
      id: "browser_use",
      label: "Browser Use / 自动化工具机会",
      match: ["browser use", "browser-use", "computer use", "automation"],
      preferredLane: "service",
      secondaryLane: "bundle",
      defaultAdvice: "优先写成跑通服务、模板交付或轻陪跑。",
      productAngle: "自动化跑通服务 / 模板交付包",
      buyerHint: "想自动化做事、但没有时间自己研究配置的用户",
      deliveryHint: "模板交付、配置说明、跑通 demo、陪跑答疑",
      channelHint: "商品页、社群、私聊",
      titleHint: "先写自动化结果，再写工具名",
      avoidLeadHint: "不要只写 framework 名字和技术热闹。",
    },
    {
      id: "skills_templates",
      label: "技能包 / 模板包机会",
      match: ["skills", "skill", "template", "templates", "prompt"],
      preferredLane: "bundle",
      secondaryLane: "service",
      defaultAdvice:
        "优先写成可搭给具体账号或工具用户的模板包、教程包，不要把纯教程包写成唯一主机会。",
      productAngle: "场景模板包 / 配置包 / 教程搭售包",
      buyerHint: "已经有账号或工具，但不会配置、不会用、想直接拿结果的人",
      deliveryHint: "模板包、安装说明、场景示例、截图或录屏",
      channelHint: "商品页、社群、私聊",
      titleHint: "直接写结果或场景，不要只写 skill、template 项目名",
      avoidLeadHint: "不要把 GitHub stars、安装量、项目名直接写进商品标题。",
    },
    {
      id: "workflow",
      label: "工作流 / 插件接入机会",
      match: ["workflow", "plugin", "plugins", "integration", "sdk", "mcp"],
      preferredLane: "service",
      secondaryLane: "bundle",
      defaultAdvice: "优先写成代接入、代配置、标准模板交付。",
      productAngle: "代接入服务 / 标准工作流交付包",
      buyerHint: "想把插件或工作流接起来，但不想自己排错和调试的人",
      deliveryHint: "代接入、配置说明、模板交付、跑通截图",
      channelHint: "私聊、商品页、社群",
      titleHint: "先写交付动作和结果，再写插件或工作流名",
      avoidLeadHint: "不要用 MCP、SDK 这类黑话直接当商品标题。",
    },
  ],

  outputRules: {
    maxPromptCandidates: 4,
    maxPublishedOpportunities: 2,
    maxDigestCandidates: 3,
    maxEvidenceItemsPerCandidate: 2,
    allowWeakDaySingleOpportunity: true,
    requireAccountLikeOpportunityInTodayCanSell: false,
    weakDayLanguage: ["先小范围试发", "先观察", "先低成本验证"],
    requireSections: ["先说结论", "今日主推", "本周可试", "今天别碰", "地图感", "今日动作"],
    offerTiers: ["低价引流款", "标准成交款", "搭售利润款"],
    narrativeRequirement:
      "今日主推和本周可试都先用 1-2 句短段落讲清场景、痛点和结果，再补必要 bullets，不要写成问答表单。",
    requiredOpportunityFields: [
      "适合谁",
      "这钱从哪来",
      "最简单卖法",
      "今天先做哪一步",
      "今天就能发的文案",
      "配图建议",
    ],
    requiredWeeklyTryFields: [
      "适合谁",
      "先怎么试",
      "为什么先别冲太猛",
      "配图建议",
    ],
    requiredActionFields: [
      "先发什么",
      "先录什么",
      "先卖哪一款",
    ],
    titleRule:
      "标题先写结果或场景，再写工具名；不要把项目名、stars、安装量直接写进标题。",
    whyNowRule:
      "“这钱从哪来”先写买家今天为什么会心动，再补当天新变化，控制在 1-2 句。",
    discouragedLeadSignals: ["GitHub stars", "安装量", "技术圈热议", "SDK 名词堆砌"],
    bannedClaims: [
      "不要假装知道闲鱼实时销量、成交量或全网主流售价。",
      "不要把官方定价直接当成卖价。",
      "不要承诺长期绝对稳定或官方授权。",
      "不要把不确定的信息写成确定事实。",
    ],
    bannedPublicPhrases: ["便宜 token", "风险自负", "多用户商业化"],
  },
};

export function getOpportunityLaneById(
  laneId,
  playbook = opportunityPlaybook
) {
  return playbook.productLanes.find((lane) => lane.id === laneId) || null;
}

export function serializeOpportunityPlaybook(playbook = opportunityPlaybook) {
  const business = playbook.businessProfile;
  const lanes = playbook.productLanes
    .map((lane) => {
      return [
        `- ${lane.name}: ${lane.description}`,
        `  - 推荐卖法: ${lane.sellFormats.join("、")}`,
      ].join("\n");
    })
    .join("\n");

  const rules = playbook.topicRules
    .map((rule) => {
      const preferredLane = getOpportunityLaneById(rule.preferredLane, playbook);
      const secondaryLane = getOpportunityLaneById(rule.secondaryLane, playbook);

      return [
        `- ${rule.label}`,
        `  - 命中关键词: ${rule.match.join("、")}`,
        `  - 优先卖法: ${preferredLane?.name || rule.preferredLane}`,
        `  - 备选卖法: ${secondaryLane?.name || rule.secondaryLane}`,
        `  - 写法提醒: ${rule.defaultAdvice}`,
      ].join("\n");
    })
    .join("\n");

  return [
    "### 当前业务",
    `- 核心业务: ${business.coreBusiness.join("、")}`,
    `- 目标用户: ${business.targetUsers.join("、")}`,
    `- 语气: ${business.tone}`,
    `- 编辑原则: ${business.editorialRule}`,
    "",
    "### 可卖方向",
    lanes,
    "",
    "### 热点映射规则",
    rules,
    "",
    "### 输出硬规则",
    `- 今日可卖至少保留 1 条账号或账号搭售方向: ${
      playbook.outputRules.requireAccountLikeOpportunityInTodayCanSell
        ? "是"
        : "否"
    }`,
    `- 参考卖法可自然带出: ${playbook.outputRules.offerTiers.join("、")}，但不要机械写成报价表`,
    `- 弱证据时允许语气: ${playbook.outputRules.weakDayLanguage.join("、")}`,
    `- 叙事要求: ${playbook.outputRules.narrativeRequirement}`,
    `- 每条机会必须包含: ${playbook.outputRules.requiredOpportunityFields.join(
      "、"
    )}`,
    `- 本周可试必须包含: ${playbook.outputRules.requiredWeeklyTryFields.join(
      "、"
    )}`,
    `- 今日动作必须包含: ${playbook.outputRules.requiredActionFields.join(
      "、"
    )}`,
    `- 标题规则: ${playbook.outputRules.titleRule}`,
    `- 今天能卖写法: ${playbook.outputRules.whyNowRule}`,
    `- 不要把这些写成主卖点: ${playbook.outputRules.discouragedLeadSignals.join(
      "、"
    )}`,
    "",
    "### 禁止乱写",
    ...playbook.outputRules.bannedClaims.map((item) => `- ${item}`),
    ...playbook.outputRules.bannedPublicPhrases.map(
      (item) => `- 禁止公开使用措辞: ${item}`
    ),
  ].join("\n");
}
