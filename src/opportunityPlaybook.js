export const opportunityPlaybook = {
  businessProfile: {
    coreBusiness: [
      "小行业结果型服务",
      "工具部署与迁移",
      "数据整理与监测",
      "内容产品与可复用资产",
      "轻量自动化与垂直工作流",
      "AI账号与开发工具入口（仅在证据和场景直接相关时）",
    ],
    targetUsers: [
      "中文新手",
      "低预算用户",
      "自由职业者和一人公司",
      "内容创作者与小团队",
      "小行业从业者和个体商家",
      "程序员与独立开发者",
    ],
    tone: "务实、直接、偏成交，不写空话",
    editorialRule:
      "只从当天可核验的一手信号出发，先判断谁正在用笨办法解决什么问题，再决定最小交付物；写清 48 小时验证、第一单、复购资产、证据缺口与停止条件，不为凑数强行制造商机。",
  },

  strategyKernel: {
    formula:
      "先找到持续付费的鱼塘和可验证痛点 -> 用最小结果型交付拿到真实反馈或意向金 -> 把交付过程沉淀成数据、流程、案例和分发 -> 只有能降低边际成本或带来复购时才称为杠杆。",
    buyerPonds: [
      "小行业从业者：已有明确工作任务，却还在复制粘贴、手工整理或反复外包",
      "内容创作者：需要稳定产出可验收结果，而不是再收藏一套提示词",
      "小老板/个体商家：愿意为省时间、少出错和更快成交付费",
      "程序员/独立开发者：愿意为部署、迁移、集成、数据和垂直场景验证付费",
      "AI工具用户：只有在入口、订阅或账号与具体交付直接相关时才作为鱼塘",
    ],
    selectionChecklist: [
      "目标鱼塘是否明确：到底卖给谁，不要写成泛泛 AI 爱好者",
      "证据是否过关：产品状态和关键事实至少有官方发布、原项目或可复现实证",
      "痛点是否高频：今天、这周就会遇到，不是一年一次的概念",
      "交付物是否具体：必须能展示、验收和限定边界，不能只交一堆链接",
      "低成本验证是否成立：48 小时内能拿到访谈、试用、询价或意向金之一",
      "复购或资产是否真实：能否降低下次交付成本、形成分发或持续服务",
      "停止条件是否清楚：什么结果出现时立刻不做，避免沉没成本",
    ],
    offerLadder: [
      "发现：公开拆解一个具体问题和可验证结果，吸引同类用户",
      "验证：小范围访谈、样品或定金，不先做大而全产品",
      "第一单：固定范围、固定验收标准的最小结果型交付",
      "复购：更新、监测、维护、数据或持续结果，而不是强行拉群",
      "资产：把重复步骤沉淀成流程、数据、组件、案例和分发渠道",
    ],
    badOpportunitySignals: [
      "只有热度，没有买家痛点",
      "只有教程标题，没有实际交付链接、步骤或可验证结果",
      "只有 GitHub stars，没有中文新手能拿到的结果",
      "只有社交转述或标题党，没有官方、原项目或可复现链接",
      "只会制造焦虑，但读者不知道 48 小时内该验证什么",
      "售后风险高，还要求卖家承诺长期稳定",
    ],
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
      name: "可复用数字交付",
      description: "只有能重复出售、降低交付成本或形成分发时，才写成模板、数据或内容产品。",
      sellFormats: ["场景数据包", "可复用组件", "结果模板", "对比与决策包"],
      scoringProfile: {
        catalogFit: 27,
        standardDelivery: 18,
        lowPriceLeadGen: 12,
        upsellFit: 10,
      },
    },
    {
      id: "service",
      name: "结果型轻服务",
      description: "按明确范围交付可验收结果，可包含部署、迁移、集成、内容、数据或自动化。",
      sellFormats: ["结果交付", "部署迁移", "数据整理", "轻量自动化"],
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
      id: "github_hot_project",
      label: "GitHub 热门 AI 项目机会",
      match: ["github trending", "github.com"],
      preferredLane: "service",
      secondaryLane: "bundle",
      defaultAdvice:
        "优先把热门项目写成跑通包、部署包、模板包或轻服务，不要只写 stars 和技术圈热闹。",
      productAngle: "跑通包 / 部署包 / 模板包 / 轻服务",
      buyerHint: "看见热门项目很心动，但自己不会安装、不会部署、不会改配置的中文新手",
      deliveryHint: "部署说明、跑通截图、配置模板、轻量答疑或代部署",
      channelHint: "商品页、私聊、社群、朋友圈",
      titleHint: "先写买家拿到的结果，再写这是哪个 GitHub 热门项目",
      avoidLeadHint: "不要把 stars、fork 数、GitHub 排名直接写成商品标题主卖点。",
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
    maxPublishedOpportunities: 4,
    maxDigestCandidates: 3,
    maxEvidenceItemsPerCandidate: 2,
    allowWeakDaySingleOpportunity: false,
    requireAccountLikeOpportunityInTodayCanSell: false,
    requireDistinctCreativityModes: true,
    dailyCreativityModeCount: 3,
    weakDayLanguage: ["证据不足就跳过", "今天不凑数", "先补原始来源"],
    requireSections: ["直接结论", "今日主推", "本周小试", "今天别碰", "今日三步"],
    offerTiers: ["48 小时验证", "固定范围第一单", "复购或资产化"],
    creativityModes: [
      {
        id: "translation",
        label: "信息差翻译型",
        summary: "把英文更新、GitHub 项目或海外玩法翻成中文新手能直接拿来用的小包。",
        monetizationHint: "卖的是省搜索、省踩坑、省翻译时间。",
        starterMove: "先找 5 位目标用户确认他们是否真会为省搜索和翻译时间付费。",
        avoid: "不要只复述项目很火、很多 stars。",
      },
      {
        id: "done_for_you",
        label: "半成品跑通型",
        summary: "把热门工具或工作流卖成“你不用自己折腾，我先帮你跑通”的交付。",
        monetizationHint: "卖的是结果，不是教程本身。",
        starterMove: "先复现一次完整流程并记录时间、成本和失败点，再找目标用户报价。",
        avoid: "不要写成空泛陪跑或大而全定制。",
      },
      {
        id: "comparison",
        label: "对比试错型",
        summary: "不卖单一工具，卖“我替你先试过这几个，直接告诉你怎么选”的试错包。",
        monetizationHint: "卖的是少走弯路和更快决策。",
        starterMove: "先替 3 位目标用户完成一次真实选择，验证他们是否认可这个判断。",
        avoid: "不要写成普通测评文章。",
      },
      {
        id: "niche_slice",
        label: "小行业切片型",
        summary: "把同一个热点切成具体职业或小场景，让小白看到自己能马上用在哪里。",
        monetizationHint: "卖的是具体职业结果，而不是笼统 AI 概念。",
        starterMove: "先访谈一个具体职业的 5 个人，只验证同一个高频任务。",
        avoid: "不要一次覆盖太多行业。",
      },
      {
        id: "migration",
        label: "救火迁移型",
        summary: "当某工具波动、涨价、限流时，卖“今天先别慌，我给你迁过去”的过渡方案。",
        monetizationHint: "卖的是止损、替代和连续可用。",
        starterMove: "先用非关键数据完成一次迁移，记录停机时间、失败点和许可边界。",
        avoid: "不要把所有热点都硬写成救火。",
      },
      {
        id: "odd_combo",
        label: "反常识组合型",
        summary: "把两个原本不会一起卖的东西组合成一单，重点卖“省试错的整套结果”。",
        monetizationHint: "卖的是组合后的新结果，不是单个工具本身。",
        starterMove: "先做一个可验收样品，确认组合后的结果确实优于单个工具。",
        avoid: "不要写成花哨但无法交付的概念套餐。",
      },
    ],
    narrativeRequirement:
      "先用短段落给直接判断，再用六组字段讲清证据与可信度、鱼塘与笨办法、最小交付、48 小时验证、第一单与复购、风险与停止；整篇控制长度，不写成交口号。",
    requiredOpportunityFields: [
      "证据与可信度",
      "鱼塘与笨办法",
      "最小交付",
      "48小时验证",
      "第一单与复购",
      "风险与停止",
    ],
    requiredWeeklyTryFields: [
      "证据来源",
      "目标鱼塘",
      "最小交付",
      "48小时验证",
      "停止条件",
    ],
    requiredActionFields: [
      "今天确认",
      "今天制作",
      "今天询价",
    ],
    titleRule:
      "标题直接写目标用户和可交付结果；不要把 stars、安装量或赚钱承诺写成标题。",
    whyNowRule:
      "开头先说今天出现了什么可验证信号，再说明为什么值得用 48 小时测试，而不是宣称一定能赚钱。",
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

export function serializeOpportunityPlaybook(
  playbook = opportunityPlaybook,
  options = {}
) {
  const profile = options.profile || "account";
  const business = playbook.businessProfile;
  const strategy = playbook.strategyKernel || {};
  const lanes = playbook.productLanes
    .filter((lane) => profile !== "general" || lane.id !== "account")
    .map((lane) => {
      return [
        `- ${lane.name}: ${lane.description}`,
        `  - 推荐卖法: ${lane.sellFormats.join("、")}`,
      ].join("\n");
    })
    .join("\n");

  const rules = playbook.topicRules
    .map((rule) => {
      const resolvedPreferredLaneId =
        profile === "general" && rule.preferredLane === "account"
          ? rule.secondaryLane || "service"
          : rule.preferredLane;
      const preferredLane = getOpportunityLaneById(resolvedPreferredLaneId, playbook);
      const secondaryLane = getOpportunityLaneById(rule.secondaryLane, playbook);
      const label =
        profile === "general" && rule.preferredLane === "account"
          ? `${rule.id.toUpperCase()} 相关变化（仅在能形成具体结果交付时采用）`
          : rule.label;
      const advice =
        profile === "general" && rule.preferredLane === "account"
          ? "不要写账号上新；只在当天证据能触发具体服务、迁移、数据或可复用交付时采用。"
          : rule.defaultAdvice;

      return [
        `- ${label}`,
        `  - 命中关键词: ${rule.match.join("、")}`,
        `  - 优先卖法: ${preferredLane?.name || resolvedPreferredLaneId}`,
        `  - 备选卖法: ${secondaryLane?.name || rule.secondaryLane}`,
        `  - 写法提醒: ${advice}`,
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
    "### 商机资料提炼的判断内核",
    `- 总公式: ${strategy.formula || ""}`,
    `- 优先鱼塘: ${(strategy.buyerPonds || []).join("；")}`,
    `- 筛选清单: ${(strategy.selectionChecklist || []).join("；")}`,
    `- 产品阶梯: ${(strategy.offerLadder || []).join("；")}`,
    `- 坏商机信号: ${(strategy.badOpportunitySignals || []).join("；")}`,
    "",
    "### 可卖方向",
    lanes,
    "",
    "### 热点映射规则",
    rules,
    "",
    "### 输出硬规则",
    `- 是否强制保留账号方向: ${
      playbook.outputRules.requireAccountLikeOpportunityInTodayCanSell
        ? "是"
        : "否"
    }`,
    `- 候选覆盖 ${playbook.outputRules.dailyCreativityModeCount || 3} 种商业验证角度，并保证主推与次推不是同一种模式: ${
      playbook.outputRules.requireDistinctCreativityModes ? "是" : "否"
    }`,
    `- 验证阶梯: ${playbook.outputRules.offerTiers.join("、")}，不要机械写成报价表`,
    `- 弱证据处理: ${playbook.outputRules.weakDayLanguage.join("、")}`,
    `- 叙事要求: ${playbook.outputRules.narrativeRequirement}`,
    `- 每条机会必须包含: ${playbook.outputRules.requiredOpportunityFields.join(
      "、"
    )}`,
    `- 本周小试必须包含: ${playbook.outputRules.requiredWeeklyTryFields.join(
      "、"
    )}`,
    `- 今日三步必须包含: ${playbook.outputRules.requiredActionFields.join(
      "、"
    )}`,
    `- 标题规则: ${playbook.outputRules.titleRule}`,
    `- 今日信号写法: ${playbook.outputRules.whyNowRule}`,
    `- 不要把这些写成主卖点: ${playbook.outputRules.discouragedLeadSignals.join(
      "、"
    )}`,
    "",
    "### 创意卖法模式库",
    ...playbook.outputRules.creativityModes.map(
      (mode) =>
        `- ${mode.label}: ${mode.summary}｜价值来源：${mode.monetizationHint}｜48 小时起手：${mode.starterMove}｜别写成：${mode.avoid}`
    ),
    "",
    "### 禁止乱写",
    ...playbook.outputRules.bannedClaims.map((item) => `- ${item}`),
    ...playbook.outputRules.bannedPublicPhrases.map(
      (item) => `- 禁止公开使用措辞: ${item}`
    ),
  ].join("\n");
}
