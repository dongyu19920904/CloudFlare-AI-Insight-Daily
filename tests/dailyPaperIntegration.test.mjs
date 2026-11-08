import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyPromptSelection, getDailyPublisherKey } from '../src/dailyPromptSelection.js';
import { buildDailyGenerationPromptInput, getDailyPromptAllocationStats } from '../src/dailyGenerationPromptInput.js';

const headlines = ['医院试点影像 AI 辅助诊断', '学校部署课堂语音 AI 转录', '物流公司采用智能体路线规划',
  '设计工具引入多模态图层编辑', '银行测试机器学习异常支付识别', '游戏开发环境支持角色对话生成',
  '工厂增加视觉模型质检设备', '农业平台发布作物预测算法', '法务系统改进大模型合同检索',
  '音频软件推出实时降噪模型', '地图团队优化机器人导航训练', '电商客服加入商品知识问答',
  '安全实验室评估语言模型提示注入', '云平台降低 AI 推理部署延迟', '芯片厂商提供神经网络编译器'];
const news = headlines.map((title, i) => ({
  type: 'news', title, description: `${title}。This separate AI application includes a documented demonstration and user workflow.`,
  url: `https://publisher${i}.example/article/${i}`, published_date: '2026-11-09', source: `Publisher ${i}`,
}));
function paper(id, title, author) {
  return { type: 'paper', title, authors: author, url: `https://arxiv.org/abs/${id}`,
    description: 'The authors evaluate AI agents on controlled tasks. A measured experiment compares the method against a baseline and describes its limitations.',
    published_date: '2026-11-06', source: 'papers.cool / arXiv', details: {} };
}
const first = paper('2611.08452', 'ReproBridge: Building Reproducibility into ML Research Artifacts', 'Yubo Wang');
const second = paper('2611.08483', 'SwarmEvolve: Latent Agent Swarms for Evolutionary Discovery and Optimization', 'Qile Jiang');

test('two independent papers from arXiv are not collapsed into one publisher', () => {
  const result = buildDailyPromptSelection({ news, paper: [first, second] });
  assert.notEqual(getDailyPublisherKey(first), getDailyPublisherKey(second));
  assert.equal(result.selectedCounts.paper, 2);
  assert.equal(getDailyPublisherKey(news[0]), 'publisher0.example');
  const stats = getDailyPromptAllocationStats(result.selectedContentItems);
  assert.equal(stats.topItems, 10);
  assert.equal(stats.reservedPaperItems, 2);
});

test('research allocation keeps both papers out of TOP and preserves full source abstracts', () => {
  const firstWithLongAbstract = { ...first, description: `${'Background about AI research. '.repeat(28)}The measured result is 92.6 percent under the reported benchmark.` };
  const result = buildDailyPromptSelection({ news, paper: [firstWithLongAbstract, second] });
  const prompt = buildDailyGenerationPromptInput(result.selectedContentItems);
  const top = prompt.split('【今日焦点候选素材】')[1].split('【前沿研究专用候选素材】')[0];
  assert.ok(!top.includes(first.url));
  assert.ok(!top.includes(second.url));
  assert.match(prompt, /92\.6 percent/);
  assert.match(prompt, /author|作者/i);
});

test('paper identity deduplicates versions across discovery sites without relaxing news limits', () => {
  const duplicate = { ...first, url: 'https://huggingface.co/papers/2611.08452v2', source: 'HF' };
  const samePublisherNews = { ...news[0], title: 'AI model deployment memory efficiency', url: `${news[0].url}-second` };
  const result = buildDailyPromptSelection({ news: [news[0], samePublisherNews], paper: [first, duplicate, second] });
  assert.equal(result.selectedCounts.paper, 2);
  assert.equal(result.selectedCounts.news, 1);
});

test('low-volume inputs never promote ordinary papers into TOP', () => {
  const result = buildDailyPromptSelection({ news: news.slice(0, 2), paper: [first, second] });
  const stats = getDailyPromptAllocationStats(result.selectedContentItems);
  assert.equal(stats.reservedPaperItems, 2);
  assert.equal(stats.topItems, 2);
});

test('papers retain topic diversity and overlapping research teams do not occupy both slots', () => {
  const sameTeam = { ...second, authors: 'Another lead, Yubo Wang, Shared Researcher' };
  const overlapping = { ...first, authors: 'Yubo Wang, Shared Researcher' };
  const visual = paper('2611.09999', 'Speech multimodal synthesis benchmark for audio', 'Independent Researcher');
  const result = buildDailyPromptSelection({ paper: [overlapping, sameTeam, visual] });
  assert.equal(result.selectedCounts.paper, 2);
  assert.ok(result.selectedContentItems.some(item => item.includes(visual.url)));
  assert.ok(!(result.selectedContentItems.some(item => item.includes(first.url)) && result.selectedContentItems.some(item => item.includes(second.url))));
});

test('adding optional papers leaves ten sufficient news candidates and their TOP order unchanged', () => {
  const baseline = buildDailyPromptSelection({ news: news.slice(0, 10) });
  const added = buildDailyPromptSelection({ news: news.slice(0, 10), paper: [first, second] });
  const topHeadlines = result => [...buildDailyGenerationPromptInput(result.selectedContentItems)
    .split('【今日焦点候选素材】')[1].split('【前沿研究专用候选素材】')[0]
    .matchAll(/^News Title: (.+)$/gm)].map(match => match[1]);
  assert.equal(topHeadlines(added).length, 10);
  assert.deepEqual(topHeadlines(added), topHeadlines(baseline));
});

test('a paper evaluating Jev or GPT is not merged into a vendor launch or vendor quota', () => {
  const benchmark = { ...first, description: `${first.description} We evaluate Jev and GPT-6 Sol on independent benchmark tasks.` };
  const launch = { ...news[0], title: 'Jev model release adds typed decisions', description: 'Jev is an AI decision model with a new API.' };
  const result = buildDailyPromptSelection({ news: [launch], paper: [benchmark, second] });
  assert.equal(result.selectedCounts.paper, 2);
  assert.equal(getDailyPromptAllocationStats(result.selectedContentItems).reservedPaperItems, 2);
});

test('repository benchmarks and training-free research are not project promotions or freebie ads', () => {
  const projects = Array.from({ length: 4 }, (_, i) => ({ type: 'project', title: `AI project ${i}`,
    description: 'AI agent workflow tool', url: `https://github.com/team-${i}/tool-${i}`,
    source: 'GitHub Trending Daily', details: { sourceKind: 'trending-daily' } }));
  const repository = { ...first, description: `${first.description} We report results on repository migration.` };
  const trainingFree = { ...second, description: `${second.description} Training-free inference does not change the model weights.` };
  const result = buildDailyPromptSelection({ news: news.slice(0, 10), project: projects, paper: [repository, trainingFree] });
  assert.equal(result.selectedCounts.paper, 2);
  assert.equal(getDailyPromptAllocationStats(result.selectedContentItems).reservedPaperItems, 2);
  for (const item of result.selectedContentItems.filter(item => item.startsWith('Papers Title:'))) assert.doesNotMatch(item, /welfare\/freebie/);
});
