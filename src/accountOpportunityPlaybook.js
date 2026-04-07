import { getOpportunityLaneById } from "./opportunityPlaybook.js";

export const accountOpportunityPlaybook = {
  businessProfile: {
    coreBusiness: ["AI账号", "镜像入口", "平替体验包", "账号搭售", "账号迁移包"],
    targetUsers: ["账号卖家本人", "闲鱼选品视角", "偏低售后、可当天试卖"],
    tone: "像操盘手做判断，直接、克制、偏执行，不写空话",
    editorialRule:
      "先判断今天出现了什么账号信号，再推演原账号、平替账号、镜像、组合包和迁移包的机会；先写今天能卖什么，再写为什么。",
  },

  productLanes: [
    {
      id: "account",
      name: "账号类",
      description: "适合卖成品号、平替号、体验号、多模型组合号。",
      sellFormats: ["单卖账号", "平替体验号", "组合体验包"],
      scoringProfile: {
        catalogFit: 32,
        standardDelivery: 16,
        lowPriceLeadGen: 16,
        upsellFit: 8,
      },
    },
    {
      id: "bundle",
      name: "搭售类",
      description: "适合卖账号+教程、账号+迁移说明、账号+上手包。",
      sellFormats: ["账号+说明", "账号+迁移包", "账号+场景模板"],
      scoringProfile: {
        catalogFit: 28,
        standardDelivery: 18,
        lowPriceLeadGen: 11,
        upsellFit: 12,
      },
    },
    {
      id: "service",
      name: "轻服务类",
      description: "适合做代找替代入口、代筛镜像、代迁移、代配置。",
      sellFormats: ["镜像筛选", "迁移说明", "代配置", "代筛替代入口"],
      scoringProfile: {
        catalogFit: 22,
        standardDelivery: 18,
        lowPriceLeadGen: 8,
        upsellFit: 10,
      },
    },
  ],

  topicRules: [
    {
      id: "gpt-account",
      label: "GPT / OpenAI 账号波动机会",
      match: ["openai", "gpt", "chatgpt", "plus", "pro", "openai account"],
      preferredLane: "account",
      secondaryLane: "bundle",
      defaultAdvice: "先写 GPT 账号异常后的平替和组合体验机会，不要只写 GPT 本身。",
      productAngle: "GPT 波动后的平替体验号 / 组合包",
      buyerHint: "原本想继续用 GPT，但今天更想找稳定替代的人",
      deliveryHint: "平替账号、组合入口、迁移说明、常用场景清单",
      channelHint: "闲鱼商品页、朋友圈、私聊",
      titleHint: "先写今天的麻烦和结果，再写 GPT / 平替名",
      avoidLeadHint: "不要只写模型参数、官方价格或技术热度",
    },
    {
      id: "claude-account",
      label: "Claude 账号机会",
      match: ["claude", "anthropic", "sonnet", "opus"],
      preferredLane: "account",
      secondaryLane: "bundle",
      defaultAdvice: "优先写成 Claude 体验入口、Claude 平替承接或 Claude 迁移包。",
      productAngle: "Claude 体验号 + 上手说明",
      buyerHint: "想接住 GPT 流失用户、快速给替代方案的人",
      deliveryHint: "账号入口、体验说明、常用场景、售后边界",
      channelHint: "闲鱼、群聊、朋友圈",
      titleHint: "先写用户今天换过去的理由，再写 Claude",
      avoidLeadHint: "不要把模型名词堆成标题",
    },
    {
      id: "gemini-account",
      label: "Gemini 账号机会",
      match: ["gemini", "google ai studio", "google gemini"],
      preferredLane: "account",
      secondaryLane: "bundle",
      defaultAdvice: "优先写成平替体验号和低门槛尝鲜入口。",
      productAngle: "Gemini 体验号 / 平替尝鲜包",
      buyerHint: "想找低门槛备选入口的人",
      deliveryHint: "体验号、场景说明、对比建议",
      channelHint: "闲鱼、商品页、私聊",
      titleHint: "先写今天能替代什么，再写 Gemini",
      avoidLeadHint: "不要只写官方生态和大词",
    },
    {
      id: "mirror",
      label: "镜像 / 第三方入口机会",
      match: ["镜像", "mirror", "third-party", "第三方入口", "api key", "共享站"],
      preferredLane: "service",
      secondaryLane: "account",
      defaultAdvice: "先写镜像能解决什么麻烦，再判断是否适合卖成体验包或筛选服务。",
      productAngle: "镜像体验包 / 替代入口筛选包",
      buyerHint: "想先用起来，但不想自己筛入口的人",
      deliveryHint: "镜像清单、实测说明、稳定性边界、替代建议",
      channelHint: "闲鱼、私聊",
      titleHint: "先写省事结果，再写镜像或入口",
      avoidLeadHint: "不要把不稳定入口包装成长期稳货",
    },
    {
      id: "ban-wave",
      label: "封号 / 风控波动机会",
      match: ["封号", "被封", "风控", "冻结", "ban", "suspend", "suspended"],
      preferredLane: "account",
      secondaryLane: "service",
      defaultAdvice: "遇到封号信号时，必须同步推演平替号、组合包和迁移包。",
      productAngle: "封号后的平替号 / 迁移包 / 组合包",
      buyerHint: "正在找应急替代入口的人",
      deliveryHint: "平替账号、组合号、迁移说明、售后边界",
      channelHint: "闲鱼、社群、私聊",
      titleHint: "直接写今天出了什么问题，以及你给什么替代",
      avoidLeadHint: "不要只写情绪，不要只写原账号挂了",
    },
    {
      id: "payment-limit",
      label: "支付 / 地区限制机会",
      match: ["支付失败", "绑卡失败", "地区限制", "payment", "card", "region", "country"],
      preferredLane: "account",
      secondaryLane: "bundle",
      defaultAdvice: "重点写成“省掉开通折腾”的成品入口，不要只写限制本身。",
      productAngle: "成品号 / 低门槛体验入口",
      buyerHint: "不想自己折腾支付和开通的人",
      deliveryHint: "账号入口、登录说明、上手路径",
      channelHint: "闲鱼、商品页",
      titleHint: "先写省事，再写账号名",
      avoidLeadHint: "不要把官方支付细节写成大段说明书",
    },
    {
      id: "pricing-shift",
      label: "涨价 / 免费缩水机会",
      match: ["涨价", "price", "pricing", "free tier", "免费额度", "配额", "quota"],
      preferredLane: "account",
      secondaryLane: "bundle",
      defaultAdvice: "优先推演低价替代、短期体验和多模型对照包。",
      productAngle: "低价平替体验包 / 对照试用包",
      buyerHint: "不想直接升级官方套餐的人",
      deliveryHint: "体验号、组合试用、场景说明",
      channelHint: "闲鱼、商品页",
      titleHint: "先写今天为什么更该先试替代，再写工具名",
      avoidLeadHint: "不要只写官方涨价新闻",
    },
    {
      id: "xianyu-signal",
      label: "闲鱼新品苗头机会",
      match: ["闲鱼", "xianyu", "上新", "新品", "标题", "组合包"],
      preferredLane: "bundle",
      secondaryLane: "account",
      defaultAdvice: "优先写闲鱼上能试挂的新标题、新组合和低售后方向。",
      productAngle: "闲鱼新品标题 / 账号搭售包",
      buyerHint: "今天就想试挂新品、看反馈的人",
      deliveryHint: "标题方向、组合结构、卖点脚本",
      channelHint: "闲鱼",
      titleHint: "先写今天先挂什么，再写账号或包名",
      avoidLeadHint: "不要假装知道实时销量，只写新品苗头",
    },
  ],

  outputRules: {
    maxPromptCandidates: 5,
    maxPublishedOpportunities: 3,
    maxDigestCandidates: 4,
    maxEvidenceItemsPerCandidate: 2,
    allowWeakDaySingleOpportunity: true,
    requireAccountLikeOpportunityInTodayCanSell: true,
    requireDistinctCreativityModes: true,
    dailyCreativityModeCount: 3,
    weakDayLanguage: ["先小范围试挂", "先观察", "先低成本验证"],
    requireSections: ["先看信号", "今日主推", "平替机会", "闲鱼新品", "今天别碰", "今日动作"],
    offerTiers: ["低价试水款", "标准成交款", "搭售利润款"],
    creativityModes: [
      {
        id: "replacement_entry",
        label: "替代入口型",
        summary: "不盯原账号本身，优先卖能立刻承接流量的平替入口或低门槛体验号。",
        monetizationHint: "卖的是今天就能接上、先不耽误使用。",
        starterMove: "先挂一个平替体验版或组合入口版，今天就能试单。",
        avoid: "不要写成原账号新闻复述。",
      },
      {
        id: "migration",
        label: "救火迁移型",
        summary: "当封号、风控、支付限制出现时，卖迁移包、替换包、止损包。",
        monetizationHint: "卖的是少停机、少折腾、少损失。",
        starterMove: "先做迁移清单、替代路线或迁移说明包。",
        avoid: "不要把高售后迁移写成轻松无风险。",
      },
      {
        id: "combo_pack",
        label: "组合体验型",
        summary: "把两个或三个模型组合成一单，卖“先试后定”的组合体验，而不是死卖单号。",
        monetizationHint: "卖的是对比体验和多场景兜底。",
        starterMove: "先做低价组合体验包，验证谁最爱问。",
        avoid: "不要写成没有边界的大礼包。",
      },
      {
        id: "risk_guard",
        label: "风控避坑型",
        summary: "把今天的波动翻译成买家看得懂的避坑方案，卖风险更低的选择。",
        monetizationHint: "卖的是确定感和少踩坑。",
        starterMove: "先做一个风控提示版商品文案或避坑说明。",
        avoid: "不要只渲染恐慌。",
      },
      {
        id: "xianyu_title_lab",
        label: "闲鱼标题实验型",
        summary: "把同一批货换成新标题、新组合、新卖点做实验，寻找今天更容易成交的入口。",
        monetizationHint: "卖的是标题和组合方式，不只是货本身。",
        starterMove: "今晚先试两版标题和一版新组合。",
        avoid: "不要假装知道实时销量。",
      },
      {
        id: "mirror_screening",
        label: "镜像筛选服务型",
        summary: "把镜像、第三方入口、备用通道写成代筛、代测、代找的轻服务。",
        monetizationHint: "卖的是你先替买家排坑。",
        starterMove: "先做一个镜像筛选说明或代测服务版。",
        avoid: "不要把不稳定镜像包装成长稳硬货。",
      },
    ],
    narrativeRequirement:
      "先把今天的账号信号讲清，再落到今天能卖什么和今天别碰什么，整篇像操盘判断，不像公开科普。",
    requiredOpportunityFields: [
      "发生了什么",
      "今天先挂什么",
      "今天先测什么",
      "售后风险",
    ],
    requiredWeeklyTryFields: ["平替机会", "闲鱼新品"],
    requiredActionFields: ["先发什么", "先录什么", "先卖哪一款"],
    titleRule:
      "标题先写今天的异常或买家麻烦，再写账号、平替或镜像名，不要堆技术词。",
    whyNowRule:
      "优先写今天为什么有人会临时找替代入口、为什么今天就值得上架测试。",
    discouragedLeadSignals: ["GitHub stars", "安装量", "技术圈热议", "SDK 名词堆砌"],
    bannedClaims: [
      "不要假装知道闲鱼实时销量、成交量或全网主流售价。",
      "不要承诺镜像站长期稳定或官方授权。",
      "不要把不确定的封号、风控、支付信息写成确定事实。",
      "不要把高售后风险方向硬写成今日主推。",
    ],
    bannedPublicPhrases: ["便宜 token", "风险自负", "多用户商业化"],
  },
};

export function serializeAccountOpportunityPlaybook(
  playbook = accountOpportunityPlaybook
) {
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
    `- 目标视角: ${business.targetUsers.join("、")}`,
    `- 语气: ${business.tone}`,
    `- 编辑原则: ${business.editorialRule}`,
    "",
    "### 可卖方向",
    lanes,
    "",
    "### 账号信号映射规则",
    rules,
    "",
    "### 输出硬规则",
    `- 今日主推至少保留 1 条账号或账号搭售方向: ${
      playbook.outputRules.requireAccountLikeOpportunityInTodayCanSell ? "是" : "否"
    }`,
    `- 今日至少轮换 ${playbook.outputRules.dailyCreativityModeCount || 3} 种创意卖法候选，并保证主推、平替机会、闲鱼新品至少覆盖两种不同模式: ${
      playbook.outputRules.requireDistinctCreativityModes ? "是" : "否"
    }`,
    `- 可自然带出的卖法: ${playbook.outputRules.offerTiers.join("、")}`,
    `- 弱证据时允许语气: ${playbook.outputRules.weakDayLanguage.join("、")}`,
    `- 叙事要求: ${playbook.outputRules.narrativeRequirement}`,
    `- 今日主推必须包含: ${playbook.outputRules.requiredOpportunityFields.join("、")}`,
    `- 今日动作必须包含: ${playbook.outputRules.requiredActionFields.join("、")}`,
    `- 标题规则: ${playbook.outputRules.titleRule}`,
    `- 今天能卖写法: ${playbook.outputRules.whyNowRule}`,
    `- 不要把这些写成主卖点: ${playbook.outputRules.discouragedLeadSignals.join("、")}`,
    "",
    "### 创意卖法模式库",
    ...playbook.outputRules.creativityModes.map(
      (mode) =>
        `- ${mode.label}: ${mode.summary}｜怎么赚钱：${mode.monetizationHint}｜新手起手：${mode.starterMove}｜别写成：${mode.avoid}`
    ),
    "",
    "### 禁止乱写",
    ...playbook.outputRules.bannedClaims.map((item) => `- ${item}`),
    ...playbook.outputRules.bannedPublicPhrases.map(
      (item) => `- 禁止公开使用措辞: ${item}`
    ),
  ].join("\n");
}
