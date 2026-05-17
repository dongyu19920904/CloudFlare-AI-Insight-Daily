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

  if (/读书|地理|地图|空间|作者|读者/i.test(text)) {
    return "以前读书碰到地名，认真一点的人翻地图，不认真一点的人直接装懂。现在倒好，读者随手让 AI 画一张地图，作者那边还在铺陈山川河流，这边导航已经开上了。妙处不在炫技，而是读书这件慢事，忽然多了个爱抢答的小伙计。";
  }

  if (/填表|表单|浏览器|点击|WebBridge|自动|流程/i.test(text)) {
    return "以前填复杂表单，手指头点到最后，心里只剩一个念头：这活儿怎么还没完。现在用户把浏览器里的重复点击交给 AI，一句话把十几步压成一步。它没有敲锣打鼓地改变世界，就是把人从那堆小按钮里捞出来，顺手还显得挺懂事。";
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

  return "这事好玩的地方，是 AI 没站在发布会大屏上讲大道理，而是钻进一个很小的动作里：少点几下、少等一会儿、少重复一遍。如今工具越聪明，越像办公室里那个爱搭把手的人，活不一定干得惊天动地，胜在你一回头，零碎事儿已经少了一截。";
}

function buildFallbackFunItem(candidate) {
  const title = hasDirectAiSignal(candidate.title)
    ? candidate.title
    : sanitizeMarkdownLinkTitle(`AI小观察：${candidate.title}`);
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
