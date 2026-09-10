// Public prose is compiled from typed source facts. The model may select a topic,
// but cannot supply a title, price, multiplier, eligibility statement or copy text.
export const FACT_COMPILER_VERSION = 'merchant-facts-v1';
export const PRO_URL = 'https://support.claude.com/en/articles/8325606-what-is-the-pro-plan';
export const MAX_URL = 'https://support.claude.com/en/articles/11049741-what-is-the-max-plan';
export const CHATGPT_PLUS_URL = 'https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus';
export const CHATGPT_BILLING_URL = 'https://help.openai.com/en/articles/9039756';
export const GOOGLE_PRO_URL = 'https://support.google.com/googleone/answer/14534406?hl=en';
export const GOOGLE_FAMILY_URL = 'https://support.google.com/googleone/answer/9004015?hl=en';
const clean = (value) => String(value || '').replace(/[<>\[\]`*_]/g, '').replace(/\s+/g, ' ').trim();
const finitePrice = (value) => Number.isFinite(value) && value > 0 && value < 100000;
const money = (value) => Number(value).toFixed(2).replace(/\.00$/, '');

export function compileMerchantFacts(bundle) {
  const facts = [];
  const add = (source, id, kind, values, quote, text) => {
    if (!quote || !source.text.includes(quote)) return;
    facts.push({ id, kind, values, evidenceId: source.id, sourceUrl: source.url, quote, text,
      factKey: `${FACT_COMPILER_VERSION}:${id}:${JSON.stringify(values)}` });
  };
  for (const source of bundle.evidence || []) {
    const text = source.text || '';
    if (source.kind === 'official' && source.url === CHATGPT_PLUS_URL) {
      const prices = [...text.matchAll(/Price:\s*\$(\d+(?:\.\d+)?)\/month \(billed monthly\)\./g)];
      if (prices.length === 1 && finitePrice(Number(prices[0][1]))) add(source, 'chatgpt-plus-price', 'official-price', { plan: 'ChatGPT Plus', amount: Number(prices[0][1]), currency: 'USD', period: 'month', region: 'unspecified' }, prices[0][0],
        `ChatGPT Plus 帮助页列出的参考价为每月 ${money(prices[0][1])} 美元，按月计费。实际地区、税费和付款金额要另查账单，这个价格不能当成第三方进货成本。`);
      const annual = 'Currently, we do not support annual billing or the option to pay for multiple months in advance for ChatGPT Plus subscriptions.';
      if (text.includes(annual)) add(source, 'chatgpt-plus-monthly-only', 'billing-boundary', { plan: 'ChatGPT Plus', annualBilling: false, multiMonthPrepay: false }, annual,
        'ChatGPT Plus 官方当前不提供年付或一次预付多个月。商家的长期服务承诺需要单独核对，不能写成官方年付套餐。');
    }
    if (source.kind === 'official' && source.url === CHATGPT_BILLING_URL) {
      const api = 'API usage is billed separately from your ChatGPT subscription.';
      if (text.includes(api)) add(source, 'chatgpt-api-billing', 'exclusion', { plan: 'ChatGPT subscription', item: 'API billing', included: false }, api,
        'API（程序接口）用量与 ChatGPT 订阅分开计费。售前答复应把两项费用分开，不能把 Plus 月费写成接口余额。');
      const duplicates = 'ChatGPT subscriptions can be billed through the web, Apple App Store, or Google Play Store. Subscriptions on more than one platform may result in separate charges.';
      if (text.includes(duplicates)) add(source, 'chatgpt-multiple-billing', 'billing-boundary', { platforms: ['web', 'Apple App Store', 'Google Play Store'], duplicateChargesPossible: true }, duplicates,
        'ChatGPT 可通过网页、苹果或 Google 应用商店计费，同时在多个平台订阅可能分别扣款。续费前先确认当前由哪个平台收款。');
    }
    if (source.kind === 'official' && source.url === GOOGLE_PRO_URL) {
      const storage = '5 TB or 10 TB of storage based on your specific Google AI Pro membership plan';
      if (text.includes(storage)) add(source, 'google-pro-storage-options', 'plan-options', { plan: 'Google AI Pro', storageTB: [5, 10], dependsOnMembership: true }, storage,
        'Google AI Pro 帮助页按具体会员方案列出 5 TB 或 10 TB 空间。不要只凭商品写了 Pro 就承诺固定容量，要核对实际方案。');
      const limits = 'Each product has its own AI usage limits. Your usage limits depend on which features you are using and your Google AI plan.';
      if (text.includes(limits)) add(source, 'google-pro-product-limits', 'usage-boundary', { perProduct: true, dependsOnFeatureAndPlan: true }, limits,
        'Google 的 AI 用量限制按产品、功能和套餐区分。一个功能可用，不能推断其他功能也有同样的额度。');
      const family = 'Family plan members on a Google AI Pro membership plan can enjoy select AI benefits and features at no extra cost.';
      if (text.includes(family)) add(source, 'google-pro-select-sharing', 'sharing-boundary', { plan: 'Google AI Pro', scope: 'select-benefits', allBenefits: false }, family,
        'Google AI Pro 家庭成员可共享部分 AI 权益。部分权益不等于所有权益，商品说明需要逐项写明。');
    }
    if (source.kind === 'official' && source.url === GOOGLE_FAMILY_URL) {
      const country = 'The people you invite need to live in the same country as you.';
      if (text.includes(country)) add(source, 'google-family-country', 'eligibility', { sameCountryRequired: true }, country,
        'Google 家庭共享要求受邀人与管理者居住在同一国家。无法确认真实资格时，先停止承诺可以加入。');
      const shared = 'Members of the Google family group do not have their own storage, they share the family group’s storage quota.';
      if (text.includes(shared)) add(source, 'google-family-shared-storage', 'sharing-boundary', { familyStorage: 'shared', perMemberFullPlanQuota: false }, shared,
        '家庭方案的空间由家庭组共同使用，不能把整组容量写成每位成员各自拥有的容量。');
      const limits = 'For some products like Google Flow and Google Antigravity, usage limits are shared by the entire family group rather than each member having their own separate limit.';
      if (text.includes(limits)) add(source, 'google-family-shared-limits', 'usage-boundary', { products: ['Google Flow', 'Google Antigravity'], scope: 'family-group' }, limits,
        'Google Flow、Google Antigravity 等部分产品的用量由整个家庭组共享，不能把它们写成每位成员都有一份独立额度。');
    }
    if (source.kind === 'official' && source.url === PRO_URL) {
      const api = 'The Pro plan does not include API usage through the Claude Console.';
      if (text.includes(api)) add(source, 'claude-pro-api', 'exclusion', { plan: 'Claude Pro', item: 'Console API usage', included: false }, api,
        'Claude Pro 套餐费不包含 Claude Console 的 API（程序接口）调用费用。需要接口调用时，另行核对接口的计费。');
      const prices = [...text.matchAll(/The Pro plan is available for \$(\d+(?:\.\d+)?) per month \(US\), with pricing in your local currency where supported\./g)];
      if (prices.length === 1 && finitePrice(Number(prices[0][1]))) add(source, 'claude-pro-price', 'official-price', { plan: 'Claude Pro', amount: Number(prices[0][1]), currency: 'USD', period: 'month', region: 'US' }, prices[0][0],
        `Claude Pro 官方美区参考价为每月 ${money(prices[0][1])} 美元。其他地区、税费与最终付款金额另查结账页，不能把这个价格当成第三方采购成本。`);
    }
    if (source.kind === 'official' && source.url === MAX_URL) {
      const web = 'These prices are for web subscriptions only.';
      const tiers = [...text.matchAll(/Max (5|20)x\s*:\s*\$(\d+(?:\.\d+)?) per month/g)];
      for (const tier of [5, 20]) {
        const matches = tiers.filter((match) => Number(match[1]) === tier);
        if (matches.length === 1 && text.includes(web) && finitePrice(Number(matches[0][2]))) add(source, `claude-max-${tier}-price`, 'official-price', { plan: `Claude Max ${tier}x`, amount: Number(matches[0][2]), currency: 'USD', period: 'month', surface: 'web' }, matches[0][0],
          `Claude Max ${tier}x 的官方网页订阅参考价为每月 ${money(matches[0][2])} 美元。手机商店价格可能不同，付款前确认实际账单。`);
      }
      const twenty = 'Max 20x provides 20 times more usage per session than the Pro plan.';
      if (text.includes(twenty)) add(source, 'claude-max-20-usage', 'multiplier', { plan: 'Claude Max 20x', baseline: 'Claude Pro', multiplier: 20, window: 'session' }, twenty,
        'Claude Max 20x 的每次会话用量档位是 Pro 的二十倍。比较的是用量，不是回答质量或成交机会。');
    }
    if (source.kind === 'aggregate' && source.url === 'https://supply.aivora.cn/card-products/claude-pro-month') {
      let payload; try { payload = JSON.parse(text); } catch { continue; }
      const offer = (payload.offers || []).find((item) => item.spec?.tier === 'pro'
        && /claude\s*pro/i.test(item.originalName || '') && !/镜像|共享|拼车|试用|官方授权|永久|零风险/i.test(item.originalName || '')
        && finitePrice(item.price) && item.currency === 'CNY' && /^https:\/\//.test(item.url || '')
        && Number.isFinite(Date.parse(item.sourceObservedAt))
        && Date.parse(bundle.sourceGeneratedAt) >= Date.parse(item.sourceObservedAt)
        && Date.parse(bundle.sourceGeneratedAt) - Date.parse(item.sourceObservedAt) <= 86400000);
      if (offer) {
        const name = clean(offer.originalName).slice(0, 120);
        add(source, 'claude-pro-quote', 'merchant-quote', { name, amount: offer.price, currency: 'CNY', url: offer.url, verifiedCost: false }, offer.originalName,
          `目录中一条商家报价写作“${name}”，标注 ${money(offer.price)} 元。交付和售后尚未核验，这不是可直接采购的成本。`);
      }
    }
  }
  return facts;
}

const TOPICS = [
  { id: 'google-pro-family-delivery', required: ['google-pro-select-sharing', 'google-family-country', 'google-family-shared-limits'], productSlug: 'gemini-pro-recharge',
    headline: '卖 Gemini 家庭权益前，先核对谁能加入、额度怎么共用',
    summary: '今天做一张家庭权益核对单，确认加入条件和共享额度。信息不全先不收款；货源交付未核验，今日不建议上新。',
    deliverable: '保存一份逐项核对单，写明加入资格、交付类型和共享范围。没有客户也能先检查自己的商品说明。',
    hypothesis: '待验证假设是这份核对单能用于回答家庭权益如何交付。没有你的真实咨询记录，不能判断是否有人愿意购买。',
    copyTitle: 'Gemini 家庭权益核对草稿',
    taskActions: ['复制核对草稿，保存为一份空白交付核对单。', '打开商品页，记录一条货源的原始链接。', '在原商家页面核对交付类型，把个人开通和家庭成员权益分开记录。', '按官方说明补齐加入条件和共享额度，未明确的项目留空。', '保存未解决的问题，资格或交付未确认前先不收款。'],
    merchantActions: ['如果已有家庭权益商品，检查是否把共享额度写成独享；找不到依据的承诺先撤下。', '如果已有待交付订单，先核对买家的真实加入资格；条件不符时停止该交付方案，不指导规避限制。'],
  },
  { id: 'google-pro-storage-quotation', required: ['google-pro-storage-options', 'google-pro-product-limits', 'google-family-shared-storage'], productSlug: 'gemini-pro-recharge',
    headline: 'Gemini Pro 同名货源怎么比，先对齐容量和交付类型',
    summary: '今天把一条货源的容量和交付类型记清，再决定能否比较价格。不要把共享空间写成独享；未核验交付前，今日不建议上新。',
    deliverable: '完成一条规格核对记录。只对齐真实写明的容量、个人或家庭交付、期限；缺项时保留问题，不填猜测值。',
    hypothesis: '待验证假设是规格记录能帮助你排除不适合比较的报价。没有订单数据，不能声称哪个方案更好卖。',
    copyTitle: 'Gemini Pro 容量说明草稿',
    taskActions: ['复制容量说明草稿，保存为待核对版本。', '打开商品页，记录一条原商家链接。', '在原页记录容量、交付类型和期限，没有明确写出的留空。', '只把已确认同一规格的采购价带入计算器，售价和费用由你填写。', '保存核对记录，列出还需商家确认的项目。'],
    merchantActions: ['如果已有 Gemini 商品，检查容量是否与实际会员方案一致；未核对前暂停容量承诺。', '如果准备更换货源，先对齐个人或家庭交付及期限；规格不同就停止用最低价直接比较。'],
  },
  { id: 'chatgpt-plus-billing-boundaries', required: ['chatgpt-plus-price', 'chatgpt-plus-monthly-only', 'chatgpt-api-billing'], productSlug: 'chatgpt-plus-recharge',
    headline: 'ChatGPT Plus 怎么写报价，先分清月费、长期服务和接口费',
    summary: '今天整理一份 Plus 费用答复，核对月费和商家承诺的服务期限。没有确认采购与售后前，今日不建议上新。',
    deliverable: '保存一份费用答复，标出第三方长期服务中仍需核对的期限和续费责任。',
    hypothesis: '待验证假设是费用答复可用于处理套餐和接口计费问题。是否有这类咨询，需要你记录真实结果。', copyTitle: 'ChatGPT Plus 费用答复草稿',
    taskActions: ['复制费用草稿，保存为一份售前答复。', '打开商品页，记录一条货源原始链接。', '在原页核对服务期限和续费责任，未说明的留空。', '把实际采购价和自己的售价填入计算器，保留未确定费用。', '保存核对记录，费用边界未确认前先不收款。'],
    merchantActions: ['如果已有 Plus 商品，检查是否将长期服务写成官方年付；没有依据就先改正。', '如果已有接口相关咨询，将订阅费与接口用量费分开答复；费用未确认前不要承诺接口余额。'],
  },
  { id: 'chatgpt-renewal-check', required: ['chatgpt-plus-monthly-only', 'chatgpt-multiple-billing', 'chatgpt-api-billing'], productSlug: 'chatgpt-plus-recharge',
    headline: '给 ChatGPT Plus 续费前，先查清当前由谁扣款',
    summary: '今天保存一张续费核对单，先确认原订阅的平台与服务期限。不要让未查清的扣费继续叠加；今日不建议上新。',
    deliverable: '得到一张空白续费核对单，记录计费平台、当前服务期限和下次核对日期。没有订单时只保存模板，不编造结果。',
    hypothesis: '待验证假设是续费核对单能用于处理跨平台订阅问题。没有你的账单或客户记录，不能声称已经减少重复扣费。', copyTitle: 'ChatGPT Plus 续费核对草稿',
    taskActions: ['复制续费核对草稿，保存为空白记录。', '打开官方计费说明，确认应检查的平台。', '记录待核对的平台和服务期限，不索取密码或完整银行卡信息。', '打开商品页，核对备选货源的服务边界，先不下单。', '保存仍缺的账单信息，未确认前暂停新的续费承诺。'],
    merchantActions: ['如果已有续费订单，请买家在自己的账号里核对原计费平台；未查清前暂停重复订阅。', '如果已有长期服务商品，检查每次续费由谁负责；责任未写清前暂停新的长期承诺。'],
  },
  { id: 'claude-pro-billing', required: ['claude-pro-api', 'claude-pro-price', 'claude-pro-quote'], productSlug: 'claude-pro-month',
    headline: '卖 Claude Pro 前，把套餐费和接口费说清楚',
    summary: '今天先做好一份能复制的售前答复，再核对一条货源。套餐说明和商家报价都列在下面；交付与售后未确认前，今日不建议上新。',
    deliverable: '今天拿到一份套餐答复和一条货源核对记录。答复可以保存备用，核对记录用于判断还缺什么，不能直接当作上架许可。',
    hypothesis: '待验证假设：这份材料可用于回答套餐费是否包含程序接口费用的问题。没有真实咨询或订单记录，尚不知道你的客户是否需要它。',
    copyTitle: 'Claude Pro 售前答复草稿',
  },
  { id: 'claude-plan-comparison', required: ['claude-pro-price', 'claude-max-5-price', 'claude-max-20-price', 'claude-max-20-usage'], productSlug: 'claude-pro-month',
    headline: 'Claude Pro 和 Max 怎么报价，先分清档位与用量',
    summary: '今天整理一份套餐对照答复，明确档位、计费周期和费用边界。用量倍数不代表收益；货源尚未完成交付核验，今日不建议上新。',
    deliverable: '今天保存一份带出处的套餐对照答复。遇到咨询时先确认对方要哪个档位，不用把三个不同套餐当成同一种货来比较。',
    hypothesis: '待验证假设：套餐对照可用于回答不同档位如何区别的问题。当前没有你的咨询记录，不能声称哪一档更好卖。',
    copyTitle: 'Claude 套餐对照答复草稿',
  },
];

export function buildCompiledTopics(bundle) {
  const facts = compileMerchantFacts(bundle);
  const used = new Set(bundle.usedFactKeys || []);
  return TOPICS.flatMap((topic) => {
    const selected = topic.required.map((id) => facts.find((fact) => fact.id === id));
    const product = bundle.products.find((item) => item.slug === topic.productSlug);
    if (!product || selected.some((fact) => !fact) || new Set(selected.map((fact) => fact.sourceUrl)).size < 2) return [];
    // A new quote alone cannot recycle the same tutorial daily. A previously
    // covered topic needs a changed official fact; changing timestamps is ignored.
    const seen = bundle.recentTopics?.some((item) => item.topicKey === `${FACT_COMPILER_VERSION}:${topic.id}`);
    const fresh = selected.filter((fact) => !used.has(fact.factKey));
    if (!fresh.length || seen && !fresh.some((fact) => fact.kind !== 'merchant-quote')) return [];
    return [{ ...topic, facts: selected, product, newFactIds: fresh.map((fact) => fact.id) }];
  });
}

export function selectCompiledTopic(output, topics) {
  let value; try { value = JSON.parse(String(output).trim().replace(/^```json\s*|\s*```$/g, '')); } catch { return null; }
  if (!value || Array.isArray(value) || Object.keys(value).length !== 1 || typeof value.topicId !== 'string') return null;
  return topics.find((topic) => topic.id === value.topicId) || null;
}

export function compileTopicDraft(topic) {
  const officialUrl = topic.facts.find((fact) => fact.kind !== 'merchant-quote').sourceUrl;
  const copyFacts = topic.facts.filter((fact) => fact.kind !== 'merchant-quote').map((fact) => fact.text);
  const taskUrls = topic.id === 'chatgpt-renewal-check'
    ? ['#merchant-record', CHATGPT_BILLING_URL, '#merchant-record', topic.product.url, '#merchant-record']
    : topic.id === 'google-pro-family-delivery'
      ? ['#merchant-record', topic.product.url, topic.product.url, GOOGLE_FAMILY_URL, '#merchant-record']
      : ['#merchant-record', topic.product.url, topic.product.url, topic.product.calculatorUrl, '#merchant-record'];
  return {
    headline: topic.headline, summary: topic.summary, topicKey: `${FACT_COMPILER_VERSION}:${topic.id}`,
    facts: topic.facts.map(({ evidenceId, quote, text }) => ({ evidenceId, quote, text })),
    customerHypothesis: topic.hypothesis, deliverable: topic.deliverable,
    steps: topic.taskActions ? topic.taskActions.map((action, index) => ({ action, url: taskUrls[index] })) : [
      { action: '复制下方答复，保存为你的第一份售前材料。', url: '#merchant-record' },
      { action: '打开标准商品页，选一条报价，记下它的原始商家链接。', url: topic.product.url },
      { action: '到这条商家原页填写核对记录：套餐档位、期限、交付方式、售后条款；没有写明的留空。', url: topic.product.url },
      { action: '将实际采购价与自己的售价填进计算器；费用未填齐时，不把估算结余当成净利润。', url: topic.product.calculatorUrl },
      { action: '保存本次结果，写明仍缺的条件；有真实咨询时再记录对方的问题。', url: '#merchant-record' },
    ],
    merchantActions: topic.merchantActions || [
      '如果已有相关商品，检查商品说明是否把套餐费用和额外用量混在一起；无法确认的承诺先撤下。',
      '如果已有待交付订单，重新打开该订单的货源原页确认库存；无法确认交付时先停止接单并联系买家。',
    ],
    stopCondition: '套餐档位、期限、交付或售后有一项未确认，就先不收款；没有可核对的成本，也不填写预期利润。',
    copyAsset: [topic.copyTitle, ...copyFacts, '具体交付方式、期限与售后须在付款前逐项确认。付款前再次确认库存。'].join('\n\n'),
    unknowns: ['原商家当前库存、交付与售后尚未完整核验。', '你的真实售价、手续费、退款和售后成本尚未填写。', '没有真实咨询、订单或收益数据，不能判断需求和盈利。'],
    followUp: '记录今天保存的材料、核对的来源和未解决的问题。没有询问、订单或成交就如实留空，不能用完成核对代替经营结果。',
    officialUrl,
  };
}

export function validateCompiledDraft(draft, topic, bundle) {
  const expected = compileTopicDraft(topic);
  const issues = [];
  if (JSON.stringify(draft) !== JSON.stringify(expected)) issues.push('compiled_draft_mutated');
  const current = compileMerchantFacts(bundle);
  for (const fact of topic.facts) if (!current.some((item) => JSON.stringify(item) === JSON.stringify(fact))) issues.push('compiled_fact_changed');
  if (draft.copyAsset.length > 600) issues.push('compiled_copy_too_long');
  return { ok: !issues.length, issues };
}
