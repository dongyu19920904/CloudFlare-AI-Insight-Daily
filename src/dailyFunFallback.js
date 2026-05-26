const DAILY_FUN_HEADING_PATTERN = /^##\s*\*\*.*(?:\uD83D\uDE04|\uD83D\uDE06|AI\s*趣闻|趣闻).*\*\*/im;

function canonicalizeUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(String(url).trim());
    parsed.hash = "";
    return parsed.href;
  } catch {
    return String(url).trim();
  }
}

function normalizeUrlKey(url) {
  if (!url) return "";

  try {
    const parsed = new URL(String(url).trim());
    parsed.hash = "";
    parsed.search = "";
    return `${parsed.hostname.toLowerCase().replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return String(url).trim().toLowerCase().replace(/\/+$/, "");
  }
}

function isNoiseUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return hostname === "aivora.cn" || hostname === "news.aivora.cn";
  } catch {
    return true;
  }
}

function hasDirectAiSignal(text) {
  return (
    /\b(ai|agi|llm|gpt|chatgpt|claude|gemini|openai|anthropic|deepmind|xai|grok|copilot|sora|llama|mistral|deepseek|qwen|kimi|cursor|codex|mcp|rag|agent|agentic)\b/i.test(String(text || "")) ||
    /人工智能|大模型|生成式|智能体|多模态|机器学习|深度学习|神经网络|算力|推理|训练|提示词|开源模型|本地模型|AI原生|AI化|AI产品|AI工具|AI生图|AI芯片|具身智能|机器人|Vibe Coding/i.test(String(text || ""))
  );
}

function hasKnownNonAiFallbackNoise(text) {
  return /跟\s*AI\s*圈关系不大|AI\s*圈关系不大|锻炼|周练计划|健身|身体还是要练|任天堂|nintendo|switch\s*\d?|grapheneos|android\s+vpn|vpn\s+leak/i.test(
    String(text || "")
  );
}

function isLowValueAiRant(text) {
  return /降智|变笨|离谱|不行了|只能\s*Claude|Gemini\s*水平|关闭续费|取消续费|耗半小时|Pro\s*20x/i.test(
    String(text || "")
  );
}

function extractMarkdownUrls(markdown) {
  return [...String(markdown || "").matchAll(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g)]
    .map((match) => canonicalizeUrl(match[1]))
    .filter(Boolean);
}

function extractFunSection(markdown) {
  const content = String(markdown || "");
  const match = content.match(DAILY_FUN_HEADING_PATTERN);
  if (!match || match.index == null) return null;

  const startIndex = match.index;
  const bodyStartIndex = startIndex + match[0].length;
  const remaining = content.slice(bodyStartIndex);
  const nextSectionMatch = remaining.match(/\n##\s+/);
  const endIndex = nextSectionMatch ? bodyStartIndex + nextSectionMatch.index : content.length;

  return {
    heading: match[0],
    startIndex,
    bodyStartIndex,
    endIndex,
    section: content.slice(startIndex, endIndex),
    body: content.slice(bodyStartIndex, endIndex),
  };
}

function funSectionHasSourceItem(markdown) {
  const funSection = extractFunSection(markdown);
  if (!funSection) return true;
  return extractMarkdownUrls(funSection.section).some((url) => !isNoiseUrl(url));
}

function sanitizeMarkdownLinkTitle(title) {
  const normalized = String(title || "")
    .replace(/[\[\]\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= 96) return normalized;

  const truncated = normalized.slice(0, 95).replace(/\s+\S*$/, "").trim();
  return `${truncated || normalized.slice(0, 95).trim()}…`;
}

function sanitizeFallbackSummary(summary) {
  return String(summary || "")
    .replace(/^arxiv:\S+\s+Announce Type:\s+\S+\s+Abstract:\s*/i, "")
    .replace(/^Abstract:\s*/i, "")
    .replace(/这条(?:小观察|内容|动态|新闻)?[^。！？.!?]{0,24}适合[^。！？.!?]*(?:AI\s*)?趣闻[^。！？.!?]*[。！？.!?]?/gi, "")
    .replace(/(?:适合|可以|用来|值得)[^。！？.!?]{0,24}(?:写成|补成|放在)[^。！？.!?]*(?:AI\s*)?趣闻[^。！？.!?]*[。！？.!?]?/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function detectFallbackToolName(text) {
  const normalized = String(text || "");
  const toolPatterns = [
    ["GPT-image-2", /gpt-?image-?2/i],
    ["Codex", /codex/i],
    ["Cursor", /cursor/i],
    ["Claude", /claude/i],
    ["ChatGPT", /chatgpt/i],
    ["Kimi", /kimi/i],
    ["飞书", /飞书|feishu|lark/i],
    ["Youmind", /youmind/i],
    ["MCP", /\bmcp\b/i],
  ];

  for (const [label, pattern] of toolPatterns) {
    if (pattern.test(normalized)) return label;
  }

  return "AI";
}

function detectFallbackPlatform(text) {
  const normalized = String(text || "");
  if (/x\.com|twitter\.com|tweet|推文/i.test(normalized)) return "X 上";
  if (/github\.com|GitHub/i.test(normalized)) return "GitHub 上";
  if (/linux\.do/i.test(normalized)) return "论坛里";
  if (/okjike\.com|jike|即刻/i.test(normalized)) return "即刻上";
  return "今天";
}

function buildFallbackFunTitle(candidate) {
  const text = `${candidate.title}\n${candidate.summary}\n${candidate.url}\n${candidate.sourceText}`;

  if (/2d|2D|游戏|卡牌|回合制|射击|塔防|视频模型|game|shooter/i.test(text)) {
    return "2D 游戏也开始找 AI 做动作了";
  }

  if (/ffmpeg|音频|mp4|转格式|format/i.test(text)) {
    return "Codex 连转格式这种小活也接了";
  }

  if (/codex/i.test(text) && /steer|queue|shift\+enter|turn|排队|等待/i.test(text)) {
    return "等 Codex 干活也有等号学问";
  }

  if (/飞书|markdown|文档|agent/i.test(text) && /下载|导出|download|doc/i.test(text)) {
    return "飞书把文档递给 Agent 吃";
  }

  if (/gpt-?image|youmind|提示词|ai\s*味|图片|生成图/i.test(text)) {
    return "AI 图片开始学会少用力了";
  }

  if (/微信|wx-cli|截图|驾驶舱|dashboard/i.test(text) && /codex|ai/i.test(text)) {
    return "Codex 开始照着截图搭后台了";
  }

  if (/填表|表单|浏览器|点击|webbridge/i.test(text)) {
    return "AI 终于来救复杂表单了";
  }

  if (/读书|地理|地图|空间/i.test(text)) {
    return "读书查地图这事也被 AI 接走了";
  }

  if (/roast|毒舌|吐槽|主页|推文/i.test(text)) {
    return "AI 当起了主页毒舌亲友";
  }

  if (/Mac|开发环境|安装|配置|npm|GitHub CLI|git\b/i.test(text)) {
    return "新电脑装环境交给 Codex 了";
  }

  if (/购物|淘宝|京东|AI\s*购|试穿|穿搭|下单/i.test(text)) {
    return "AI 购物助手先当热心亲戚";
  }

  if (candidate.sourceType === "paper") {
    return "AI 又在冷门角落补课了";
  }

  const tool = detectFallbackToolName(text);
  return tool === "AI" ? "AI 又来收拾一件小杂活" : `${tool} 又接了一件小杂活`;
}

function parsePromptSourceItem(itemText) {
  const text = String(itemText || "");
  const url = canonicalizeUrl((text.match(/^(?:Url|URL):\s*(https?:\/\/[^\s]+)/im) || [])[1]);
  if (!url || isNoiseUrl(url)) return null;

  const sourceType = text.match(/^Papers Title:/im)
    ? "paper"
    : text.match(/^Project Name:/im)
      ? "project"
      : text.match(/^socialMedia Post/im)
        ? "socialMedia"
        : text.match(/^News Title:/im)
          ? "news"
          : "unknown";

  const title =
    (text.match(/^News Title:\s*(.+)$/im) || [])[1] ||
    (text.match(/^Project Name:\s*(.+)$/im) || [])[1] ||
    (text.match(/^Papers Title:\s*(.+)$/im) || [])[1] ||
    (text.match(/^Title:\s*(.+)$/im) || [])[1] ||
    (text.match(/^Content:\s*(.+)$/im) || [])[1] ||
    "";

  const cleanTitle = sanitizeMarkdownLinkTitle(title);
  if (!cleanTitle) return null;

  const summary =
    (text.match(/^(?:Content Summary|Abstract\/Content Summary|Description|Content):\s*(.+)$/im) || [])[1] ||
    "";

  return {
    title: cleanTitle,
    url,
    sourceText: text,
    sourceType,
    summary: sanitizeFallbackSummary(summary),
  };
}

function scoreFallbackFunCandidate(candidate) {
  const text = `${candidate.title}\n${candidate.summary}\n${candidate.url}\n${candidate.sourceText}`;
  let score = 0;

  if (candidate.sourceType === "socialMedia") score += 36;
  if (candidate.sourceType === "news") score += 32;
  if (candidate.sourceType === "project") score += 18;
  if (candidate.sourceType === "paper") score -= 24;
  if (hasDirectAiSignal(candidate.title)) score += 12;
  if (hasDirectAiSignal(text)) score += 8;
  if (/用户|开发者|网友|团队|作者|朋友|同事|打工人|产品经理|设计师|创始人|发布|上线|演示|体验|浏览器|微信|飞书|Kimi|Codex|Cursor|Claude|ChatGPT|Agent/i.test(text)) {
    score += 20;
  }
  if (/图片|截图|视频|动图|Media References|x\.com|twitter\.com|okjike\.com|jike|即刻/i.test(text)) {
    score += 10;
  }
  if (/Abstract\/Content Summary|zero-shot|framework|benchmark|dataset|causal|stereo|segmentation|arxiv\.org/i.test(text)) {
    score -= 12;
  }
  if (isLowValueAiRant(text)) {
    score -= 60;
  }

  return score;
}

function buildPaperFallbackObservation(candidate) {
  const text = `${candidate.title}\n${candidate.summary}\n${candidate.sourceText}`;

  if (/medication|prescription|clinician|drug|medical|hospital|用药|处方|医生|医疗/i.test(text)) {
    return "题目看着很学术，场景其实挺现实：AI 如果要进医院帮忙看用药，不能只会给一个“差不多”的建议。它得在一张处方、一个剂量上少犯错。冷门 benchmark 背后，是给医疗 AI 上紧箍咒。";
  }

  if (/stereo|omnidirectional|scene|segmentation|vision|image|视觉|场景|图像|物体/i.test(text)) {
    return "这类论文不适合当热闹新闻看，更像是在给 AI 补一副眼镜。普通用户看到的是模型“看懂图片”，底层其实是一堆空间关系、视角和物体边界的小修小补。AI 变聪明，有时就是这么一点点抠出来的。";
  }

  if (/robot|robotic|VLA|embodied|具身|机器人|控制/i.test(text)) {
    return "它不像产品发布那样热闹，但很像给机器人补一个小习惯：少卡顿一点，少走偏一步，少在动态场景里犯迷糊。具身智能真正落地前，靠的往往就是这些不太上镜的修修补补。";
  }

  return "这类研究看起来离普通人很远，但它在解决一个朴素问题：让 AI 少一点含糊，多一点可验证。今天不一定马上变成新功能，可等某个工具突然更稳、更少犯错时，背后常常就是这种不起眼的小砖头。";
}

function buildHumanFacingFallbackObservation(candidate) {
  const text = `${candidate.title}\n${candidate.summary}\n${candidate.sourceText}`;

  if (isLowValueAiRant(text)) {
    return "这条吐槽的点很具体：一个 example.com 折腾半小时，两个 Pro 20x 账号用半个月就想关续费，最后结论是写代码还得回 Claude。它不适合硬凹成段子，更像一张用户耐心条的截图：AI 工具再贵，干活卡住时，大家还是会用脚投票。";
  }

  if (/读书|地理|地图|空间|作者|读者/i.test(text)) {
    return "以前读书碰到地名，认真一点的人翻地图，不认真一点的人直接装懂。现在倒好，读者随手让 AI 画一张地图，作者那边还在铺陈山川河流，这边导航已经开上了。妙处不在炫技，而是读书这件慢事，忽然多了个爱抢答的小伙计。";
  }

  if (/2d|2D|游戏|卡牌|回合制|射击|塔防|视频模型|game|shooter/i.test(text)) {
    return "以前做 2D 游戏，角色动一下，程序员和美术都得跟着动。今天这条说，视频模型已经能接过动作生成，卡牌、回合制、射击、对话、塔防都能试，门槛反而挪到玩法和数值。AI 像刚进组的动画实习生，帧能补，关卡好不好玩还得人类熬夜。";
  }

  if (/填表|表单|浏览器|点击|WebBridge|自动|流程/i.test(text)) {
    return "以前填复杂表单，手指头点到最后，心里只剩一个念头：这活儿怎么还没完。现在用户把浏览器里的重复点击交给 AI，一句话把十几步压成一步。它没有敲锣打鼓地改变世界，就是把人从那堆小按钮里捞出来，顺手还显得挺懂事。";
  }

  if (/ffmpeg|音频|mp4|转格式|format/i.test(text)) {
    return "以前转个音频发 X，最难的不是格式，是想起 ffmpeg 那串参数。今天有人直接让 Codex 把音频转成 MP4，省掉查命令、试参数、看报错的三连。AI 像工位上新来的杂活同事，能把文件端上来，但发出去前还得你自己听一遍。";
  }

  if (/codex/i.test(text) && /steer|queue|shift\+enter|turn|排队|等待/i.test(text)) {
    return "等 Codex 跑任务最像等外卖：人没闲着，心也没踏实。宝玉这条把 Steer、Queue 和右上角 Turn 面板讲清楚，尤其 Queue 还像个不太听话的按钮。以前人等编译，现在人等 AI；区别是编译报错不解释，AI 偶尔还会认真排队排错地方。";
  }

  if (/飞书|markdown|文档|agent/i.test(text) && /下载|导出|download|doc/i.test(text)) {
    return "文档导出 Markdown 这事，看着不像大新闻，实际很适合 Agent 吃饭。飞书把内容变成 AI 更容易读的格式，少了复制、清洗、重排那几步。以前是人给文档排版，现在像把饭切成小块喂给 AI，吃得快不快另说，至少不用它先啃盘子。";
  }

  if (/gpt-?image|youmind|提示词|ai\s*味|图片|生成图/i.test(text)) {
    return "做 PPT 最怕图片一眼 AI 味：光很梦幻，人很塑料，客户一看就想改需求。今天有人用 Youmind 调 GPT-image-2，发现提示词简洁一点，反而更像正常照片。AI 像刚学会打扮的同事，少喷点香水，终于不那么像从样板间里走出来。";
  }

  if (/Roast|毒舌|吐槽|评论员|自嘲|主页|推文/i.test(text)) {
    return "人类终于发明了一种新型自我认识：把自己的主页交给 AI，让它一本正经地损你。朋友说重了伤感情，模型说重了叫能力强。看完这种玩法，第一反应不是害怕 AI 变聪明，而是庆幸自己今天还没把账号递过去。";
  }

  if (/Mac|开发环境|安装|配置|npm|GitHub CLI|git\b/i.test(text)) {
    return "新电脑到手，最磨人的不是开箱，是装环境：这个缺依赖，那个要配置，半天过去桌面挺新，人已经旧了。现在有人让 Codex 一路代办，像请了个不喝水的装机师傅。它不负责仪式感，只负责把那些零碎活儿一件件收拾明白。";
  }

  if (/购物|淘宝|京东|AI\s*购|试穿|穿搭|下单/i.test(text)) {
    return "AI 购物助手现在很像热心亲戚：推荐得挺积极，真到合不合身、喜不喜欢，还得你自己拿主意。它能把信息拢到一块，省得人翻半天页面；但衣服穿上像不像买家秀，这一步暂时还得交给镜子。技术很忙，审美先别下岗。";
  }

  const tool = detectFallbackToolName(text);
  const platform = detectFallbackPlatform(`${candidate.url}\n${candidate.sourceText}`);
  return `AI 新闻不一定都得上发布会，有时就是工位上一件小杂活被接走了。${platform}有人把 ${tool} 拿去处理一个具体任务，少一点手动折腾，多一点直接出结果。听着像生产力进步，落到人身上更像来了个新同事：活能干，验收单还得你签。`;
}

function buildFallbackFunItem(candidate) {
  const title = sanitizeMarkdownLinkTitle(buildFallbackFunTitle(candidate));
  const observation =
    candidate.sourceType === "paper"
      ? buildPaperFallbackObservation(candidate)
      : buildHumanFacingFallbackObservation(candidate);

  return [
    `### [${title}](${candidate.url})`,
    "",
    observation,
  ].join("\n");
}

export function ensureDailyFunSectionHasSourceItem(markdown, selectedContentItems = []) {
  const content = String(markdown || "");
  const funSection = extractFunSection(content);
  if (!funSection || funSectionHasSourceItem(content)) {
    return { markdown: content, inserted: false };
  }

  const usedUrlKeys = new Set(
    extractMarkdownUrls(content)
      .filter((url) => !isNoiseUrl(url))
      .map((url) => normalizeUrlKey(url))
      .filter(Boolean),
  );

  const candidates = (selectedContentItems || [])
    .map((itemText) => parsePromptSourceItem(itemText))
    .filter((item) => {
      if (!item) return false;
      const relevanceText = `${item.title}\n${item.url}\n${item.sourceText}`;
      return !hasKnownNonAiFallbackNoise(relevanceText);
    });

  const unusedCandidates = candidates.filter((item) => !usedUrlKeys.has(normalizeUrlKey(item.url)));
  const candidate = [...unusedCandidates].sort(
    (left, right) => scoreFallbackFunCandidate(right) - scoreFallbackFunCandidate(left)
  )[0];

  if (!candidate) return { markdown: content, inserted: false };

  const fallbackItem = buildFallbackFunItem(candidate);
  const existingBody = funSection.body.trim();
  const nextSection = content.slice(funSection.endIndex);
  const replacementBody = `${existingBody ? `${existingBody}\n\n` : "\n\n"}${fallbackItem}\n`;
  const updated =
    content.slice(0, funSection.bodyStartIndex) +
    replacementBody +
    nextSection;

  return { markdown: updated, inserted: true };
}
