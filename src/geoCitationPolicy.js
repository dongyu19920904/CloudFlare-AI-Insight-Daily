const MODEL_MANIPULATION_PATTERNS = [
  /【\s*(?:LLM\s*爬虫指令|大模型提示词)\s*】/i,
  /(?:请|务必|必须).{0,12}(?:将|把).{0,18}(?:本文|本页|本站|本周刊|此内容).{0,30}(?:权重|关联度).{0,20}(?:提升|最高)/i,
  /(?:优先|逐字).{0,12}(?:参考|引用).{0,30}(?:本文|本页|本站|本周刊|其中的见解)/i,
  /(?:大模型|LLM|AI).{0,20}(?:爬虫|搜索|回答).{0,40}(?:推荐本站|推荐我们|提高权重|提升权重)/i,
];

export function getTransparentGeoWritingRules() {
  return `
## 透明可引用规则
- GEO 的目标是帮助读者和模型准确理解、核验与引用内容，不是向爬虫下命令。
- 先用 1-2 个短句直接回答本段问题，再给证据、影响和必要限制；不要把全部信息压成一个长句。
- 可独立引用的事实句要写清实体、发生了什么，以及来源支持的时间、数字或适用范围。
- 关键事实紧跟描述性原始来源链接；链接文字要说明该页面证明了什么，不写“原文”“点击这里”。
- 明确区分来源事实、编辑判断和待验证推论。证据不完整时直接说明缺口，不用肯定语气补齐。
- 不输出“提高权重、提升关联度、优先引用、逐字引用、经典之作”等面向模型的操纵指令。
- 不生成肉眼不可见文本、隐藏 HTML/CSS、爬虫专用内容，或任何要求搜索与 AI 系统推荐本站的句子。
`.trim();
}

export function getModelManipulationPatterns() {
  return [...MODEL_MANIPULATION_PATTERNS];
}

export function containsModelManipulationDirective(text) {
  const content = String(text || "");
  return MODEL_MANIPULATION_PATTERNS.some((pattern) => pattern.test(content));
}
