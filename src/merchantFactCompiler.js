// Public prose is compiled from typed source facts. The model may select a topic,
// but cannot supply a title, price, multiplier, eligibility statement or copy text.
export const FACT_COMPILER_VERSION = 'merchant-facts-v1';
export const PRO_URL = 'https://support.claude.com/en/articles/8325606-what-is-the-pro-plan';
export const MAX_URL = 'https://support.claude.com/en/articles/11049741-what-is-the-max-plan';
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
    if (!product || selected.some((fact) => !fact) || new Set(selected.map((fact) => fact.evidenceId)).size < 2) return [];
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
  return {
    headline: topic.headline, summary: topic.summary, topicKey: `${FACT_COMPILER_VERSION}:${topic.id}`,
    facts: topic.facts.map(({ evidenceId, quote, text }) => ({ evidenceId, quote, text })),
    customerHypothesis: topic.hypothesis, deliverable: topic.deliverable,
    steps: [
      { action: '复制下方答复，保存为你的第一份售前材料。', url: '#merchant-record' },
      { action: '打开标准商品页，选一条报价，记下它的原始商家链接。', url: topic.product.url },
      { action: '到这条商家原页填写核对记录：套餐档位、期限、交付方式、售后条款；没有写明的留空。', url: topic.product.url },
      { action: '将实际采购价与自己的售价填进计算器；费用未填齐时，不把估算结余当成净利润。', url: topic.product.calculatorUrl },
      { action: '保存本次结果，写明仍缺的条件；有真实咨询时再记录对方的问题。', url: '#merchant-record' },
    ],
    merchantActions: [
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
