var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/helpers.js
var fetchDate = getISODate();
function setFetchDate(date) {
  fetchDate = date;
}
__name(setFetchDate, "setFetchDate");
function getFetchDate() {
  return fetchDate;
}
__name(getFetchDate, "getFetchDate");
function getISODate(dateObj = /* @__PURE__ */ new Date()) {
  const options2 = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai"
  };
  const dateString = dateObj.toLocaleDateString("en-CA", options2);
  return dateString;
}
__name(getISODate, "getISODate");
function escapeHtml(unsafe) {
  if (unsafe === null || typeof unsafe === "undefined") {
    return "";
  }
  const str = String(unsafe);
  const map = {
    "&": "&",
    "<": "<",
    ">": ">",
    '"': '"',
    "'": "&#039;"
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}
__name(escapeHtml, "escapeHtml");
async function fetchData(url, options2 = {}) {
  const response = await fetch(url, options2);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}, url: ${url}`);
  }
  return response.json();
}
__name(fetchData, "fetchData");
function removeMarkdownCodeBlock(text) {
  if (!text) return "";
  const cleanedText = text.trim();
  const match = cleanedText.match(/```(?:\w*)\s*([\s\S]*?)\s*```/);
  if (match) {
    return match[1].trim();
  }
  return cleanedText;
}
__name(removeMarkdownCodeBlock, "removeMarkdownCodeBlock");
function stripHtml(html2) {
  if (!html2) return "";
  let processedHtml = html2.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, (match, src, alt) => {
    return alt ? `[\u56FE\u7247: ${alt} ${src}]` : `[\u56FE\u7247: ${src}]`;
  });
  processedHtml = processedHtml.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, "[\u56FE\u7247: $1]");
  processedHtml = processedHtml.replace(/<video[^>]*src="([^"]*)"[^>]*>.*?<\/video>/gi, "[\u89C6\u9891: $1]");
  return processedHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
__name(stripHtml, "stripHtml");
function convertPlaceholdersToMarkdownImages(text) {
  if (!text) return "";
  const str = String(text);
  const isVideoUrl = /* @__PURE__ */ __name((url) => /\.(mp4|mov|webm)(\?|#|$)/i.test(url), "isVideoUrl");
  const toVideoTag = /* @__PURE__ */ __name((url) => `<video controls preload="metadata" playsinline style="max-width:100%; height:auto;" src="${url}"></video>`, "toVideoTag");
  const withVideos = str.replace(/\[视频:\s*([^\]]+?)\]/g, (match, inner) => {
    const parts = inner.trim().split(/\s+/);
    const url = parts[parts.length - 1];
    if (!/^https?:\/\//i.test(url)) return match;
    if (isVideoUrl(url)) return toVideoTag(url);
    const label = parts.slice(0, -1).join(" ") || "\u89C6\u9891";
    return `[${label}](${url})`;
  });
  return withVideos.replace(/\[图片:\s*([^\]]+?)\]/g, (match, inner) => {
    const parts = inner.trim().split(/\s+/);
    const url = parts[parts.length - 1];
    if (!/^https?:\/\//i.test(url)) return match;
    if (isVideoUrl(url)) return toVideoTag(url);
    const alt = parts.slice(0, -1).join(" ") || "AI\u8D44\u8BAF\u56FE\u7247";
    return `![${alt}](${url})`;
  });
}
__name(convertPlaceholdersToMarkdownImages, "convertPlaceholdersToMarkdownImages");
function getShanghaiTime() {
  const date = /* @__PURE__ */ new Date();
  const options2 = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
    timeZone: "Asia/Shanghai"
  };
  const shanghaiDateString = new Intl.DateTimeFormat("en-US", options2).format(date);
  return new Date(shanghaiDateString);
}
__name(getShanghaiTime, "getShanghaiTime");
function isDateWithinLastDays(dateString, days) {
  if (!dateString || !days) return false;
  const itemTime = new Date(dateString).getTime();
  if (Number.isNaN(itemTime)) return false;
  const now = getShanghaiTime();
  const currentTimeMs = now.getTime();
  const hoursToLookBack = Math.max(days, 1) * 24;
  const windowStartMs = currentTimeMs - hoursToLookBack * 60 * 60 * 1e3;
  const windowEndMs = currentTimeMs;
  return itemTime >= windowStartMs && itemTime <= windowEndMs;
}
__name(isDateWithinLastDays, "isDateWithinLastDays");
function formatDateToChinese(isoDateString) {
  if (!isoDateString) return "";
  const date = new Date(isoDateString);
  const options2 = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Shanghai"
  };
  return new Intl.DateTimeFormat("zh-CN", options2).format(date);
}
__name(formatDateToChinese, "formatDateToChinese");
function formatDateToChineseWithTime(isoDateString) {
  if (!isoDateString) return "";
  const date = new Date(isoDateString);
  const options2 = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    // 使用24小时制
    timeZone: "Asia/Shanghai"
    // 指定东8时区
  };
  return new Intl.DateTimeFormat("zh-CN", options2).format(date);
}
__name(formatDateToChineseWithTime, "formatDateToChineseWithTime");
function formatRssDate(date) {
  if (!date) return (/* @__PURE__ */ new Date()).toUTCString();
  return date.toUTCString();
}
__name(formatRssDate, "formatRssDate");
function formatDateToGMT8WithTime(isoDateString) {
  if (!isoDateString) return "";
  const date = new Date(isoDateString);
  const options2 = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    // 使用24小时制
    timeZone: "Asia/Shanghai"
    // 指定东8时区
  };
  return new Intl.DateTimeFormat("zh-CN", options2).format(date);
}
__name(formatDateToGMT8WithTime, "formatDateToGMT8WithTime");
function convertEnglishQuotesToChinese(text) {
  const str = String(text);
  return str.replace(/"/g, "\u201C");
}
__name(convertEnglishQuotesToChinese, "convertEnglishQuotesToChinese");
function formatMarkdownText(text) {
  const str = String(text);
  return str.replace(/“/g, '"');
}
__name(formatMarkdownText, "formatMarkdownText");
function getRandomUserAgent() {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:108.0) Gecko/20100101 Firefox/108.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:108.0) Gecko/20100101 Firefox/108.0"
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}
__name(getRandomUserAgent, "getRandomUserAgent");
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
__name(sleep, "sleep");
function replaceImageProxy(proxy, content) {
  const str = String(content);
  return str.replace(/upload.chinaz.com/g, "pic.chinaz.com").replace(/https:\/\/pic.chinaz.com/g, proxy + "https://pic.chinaz.com");
}
__name(replaceImageProxy, "replaceImageProxy");

// src/dataSources/newsAggregator.js
var NewsAggregatorDataSource = {
  type: "news-aggregator",
  async fetch(env, foloCookie) {
    const listId = env.NEWS_AGGREGATOR_LIST_ID;
    const fetchPages = parseInt(env.NEWS_AGGREGATOR_FETCH_PAGES || "1", 10);
    const allNewsItems = [];
    const filterDays = parseInt(env.FOLO_FILTER_DAYS || "3", 10);
    if (!listId) {
      console.warn("NEWS_AGGREGATOR_LIST_ID is not set in environment variables. Skipping news aggregator fetch.");
      return {
        version: "https://jsonfeed.org/version/1.1",
        title: "Aggregated News",
        home_page_url: "https://example.com/news",
        description: "Aggregated news from various sources",
        language: "zh-cn",
        items: []
      };
    }
    let publishedAfter = null;
    for (let i = 0; i < fetchPages; i++) {
      const userAgent = getRandomUserAgent();
      const headers = {
        "User-Agent": userAgent,
        "Content-Type": "application/json",
        "accept": "application/json",
        "accept-language": "zh-CN,zh;q=0.9",
        "baggage": "sentry-environment=stable,sentry-release=5251fa921ef6cbb6df0ac4271c41c2b4a0ce7c50,sentry-public_key=e5bccf7428aa4e881ed5cb713fdff181,sentry-trace_id=2da50ca5ad944cb794670097d876ada8,sentry-sampled=true,sentry-sample_rand=0.06211835167903246,sentry-sample_rate=1",
        "origin": "https://app.follow.is",
        "priority": "u=1, i",
        "sec-ch-ua": '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-app-name": "Folo Web",
        "x-app-version": "0.4.9"
      };
      if (foloCookie) {
        headers["Cookie"] = foloCookie;
      }
      const body = {
        listId,
        view: 1,
        withContent: true
      };
      if (publishedAfter) {
        body.publishedAfter = publishedAfter;
      }
      try {
        console.log(`Fetching News Aggregator data, page ${i + 1}...`);
        const response = await fetch(env.FOLO_DATA_API, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          console.error(`Failed to fetch News Aggregator data, page ${i + 1}: ${response.statusText}`);
          break;
        }
        const data = await response.json();
        if (data && data.data && data.data.length > 0) {
          const filteredItems = data.data.filter((entry) => isDateWithinLastDays(entry.entries.publishedAt, filterDays));
          allNewsItems.push(...filteredItems.map((entry) => ({
            id: entry.entries.id,
            url: entry.entries.url,
            title: entry.entries.title,
            content_html: entry.entries.content,
            date_published: entry.entries.publishedAt,
            authors: [{ name: entry.entries.author }],
            source: entry.entries.author ? `${entry.feeds.title} - ${entry.entries.author}` : entry.feeds.title
          })));
          publishedAfter = data.data[data.data.length - 1].entries.publishedAt;
        } else {
          console.log(`No more data for News Aggregator, page ${i + 1}.`);
          break;
        }
      } catch (error) {
        console.error(`Error fetching News Aggregator data, page ${i + 1}:`, error);
        break;
      }
      await sleep(Math.random() * 5e3);
    }
    return {
      version: "https://jsonfeed.org/version/1.1",
      title: "Aggregated News",
      home_page_url: "https://example.com/news",
      description: "Aggregated news from various sources",
      language: "zh-cn",
      items: allNewsItems
    };
  },
  transform(rawData, sourceType) {
    if (!rawData || !rawData.items) {
      return [];
    }
    return rawData.items.map((item) => ({
      id: item.id,
      type: sourceType,
      url: item.url,
      title: item.title,
      description: stripHtml(item.content_html || ""),
      published_date: item.date_published,
      authors: item.authors ? item.authors.map((author) => author.name).join(", ") : "Unknown",
      source: item.source || "Aggregated News",
      details: {
        content_html: item.content_html || ""
      }
    }));
  },
  generateHtml: /* @__PURE__ */ __name((item) => {
    return `
            <strong>${escapeHtml(item.title)}</strong><br>
            <small>\u6765\u6E90: ${escapeHtml(item.source || "\u672A\u77E5")} | \u53D1\u5E03\u65E5\u671F: ${formatDateToChineseWithTime(item.published_date)}</small>
            <div class="content-html">${item.details.content_html || "\u65E0\u5185\u5BB9\u3002"}</div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">\u9605\u8BFB\u66F4\u591A</a>
        `;
  }, "generateHtml")
};
var newsAggregator_default = NewsAggregatorDataSource;

// src/dataSources/folo-multi-feeds.js
var FoloMultiFeedsDataSource = {
  type: "folo-multi-feeds",
  async fetch(env, foloCookie) {
    const rawIds = env.FOLO_NEWS_IDS || env.FOLO_FEED_IDS || env.FOLO_LIST_IDS;
    if (!rawIds) {
      console.warn("FOLO_NEWS_IDS is not set. Skipping folo-multi-feeds fetch.");
      return {
        version: "https://jsonfeed.org/version/1.1",
        title: "Folo Multi Feeds",
        home_page_url: "https://app.follow.is",
        description: "Aggregated Folo feeds by multiple IDs",
        language: "zh-cn",
        items: []
      };
    }
    const ids = rawIds.split(/[,\\s]+/).map((s) => s.trim()).filter(Boolean);
    const uniqueIds = [...new Set(ids)];
    const fetchPages = parseInt(env.FOLO_NEWS_FETCH_PAGES || env.FOLO_FETCH_PAGES || "2", 10);
    const filterDays = parseInt(env.FOLO_FILTER_DAYS || "3", 10);
    const idType = String(env.FOLO_NEWS_ID_TYPE || "auto").toLowerCase();
    const allItems = [];
    const fetchOneKind = /* @__PURE__ */ __name(async (id, kind) => {
      let publishedAfter = null;
      let localItems = [];
      for (let i = 0; i < fetchPages; i++) {
        const headers = {
          "User-Agent": getRandomUserAgent(),
          "Content-Type": "application/json",
          accept: "application/json",
          "accept-language": "zh-CN,zh;q=0.9",
          origin: "https://app.follow.is",
          priority: "u=1, i",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
          "x-app-name": "Folo Web",
          "x-app-version": "0.4.9"
        };
        if (foloCookie) {
          headers.Cookie = foloCookie;
        }
        const body = { view: 1, withContent: true };
        if (kind === "list") body.listId = id;
        else body.feedId = id;
        if (publishedAfter) body.publishedAfter = publishedAfter;
        console.log(`Fetching Folo ${kind} ${id}, page ${i + 1}...`);
        const response = await fetch(env.FOLO_DATA_API, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          console.error(`Failed to fetch Folo ${kind} ${id}, page ${i + 1}: ${response.statusText}`);
          break;
        }
        const data = await response.json();
        if (!data?.data?.length) break;
        const filteredItems = data.data.filter(
          (entry) => isDateWithinLastDays(entry.entries.publishedAt, filterDays)
        );
        localItems.push(
          ...filteredItems.map((entry) => ({
            id: entry.entries.id,
            url: entry.entries.url,
            title: entry.entries.title,
            content_html: entry.entries.content,
            date_published: entry.entries.publishedAt,
            authors: [{ name: entry.entries.author }],
            source: entry.entries.author ? `${entry.feeds?.title || ""} - ${entry.entries.author}`.trim() : entry.feeds?.title || "Folo"
          }))
        );
        publishedAfter = data.data[data.data.length - 1].entries.publishedAt;
        await sleep(Math.random() * 1500);
      }
      return localItems;
    }, "fetchOneKind");
    for (const id of uniqueIds) {
      try {
        if (idType === "list") {
          allItems.push(...await fetchOneKind(id, "list"));
        } else if (idType === "feed") {
          allItems.push(...await fetchOneKind(id, "feed"));
        } else {
          const feedItems = await fetchOneKind(id, "feed");
          if (feedItems.length > 0) {
            allItems.push(...feedItems);
          } else {
            allItems.push(...await fetchOneKind(id, "list"));
          }
        }
      } catch (error) {
        console.error(`Error fetching Folo id ${id}:`, error);
      }
    }
    return {
      version: "https://jsonfeed.org/version/1.1",
      title: "Folo Multi Feeds",
      home_page_url: "https://app.follow.is",
      description: "Aggregated Folo feeds by multiple IDs",
      language: "zh-cn",
      items: allItems
    };
  },
  transform(rawData, sourceType) {
    if (!rawData || !rawData.items) return [];
    const seen = /* @__PURE__ */ new Set();
    return rawData.items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).map((item) => ({
      id: item.id,
      type: sourceType,
      url: item.url,
      title: item.title,
      description: stripHtml(item.content_html || ""),
      published_date: item.date_published,
      authors: item.authors ? item.authors.map((a) => a.name).join(", ") : "Unknown",
      source: item.source || "Folo",
      details: {
        content_html: item.content_html || ""
      }
    }));
  },
  generateHtml(item) {
    return `
            <strong>${escapeHtml(item.title)}</strong><br>
            <small>\u6765\u6E90: ${escapeHtml(item.source || "\u672A\u77E5")} | \u53D1\u5E03\u65F6\u95F4: ${formatDateToChineseWithTime(
      item.published_date
    )}</small>
            <div class="content-html">${item.details.content_html || "\u65E0\u5185\u5BB9"}</div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">\u9605\u8BFB\u66F4\u591A</a>
        `;
  }
};
var folo_multi_feeds_default = FoloMultiFeedsDataSource;

// src/dataSources/aibase.js
var NewsDataSource = {
  fetch: /* @__PURE__ */ __name(async (env, foloCookie) => {
    const feedId = env.AIBASE_FEED_ID;
    const fetchPages = parseInt(env.AIBASE_FETCH_PAGES || "3", 10);
    const allAibaseItems = [];
    const filterDays = parseInt(env.FOLO_FILTER_DAYS || "3", 10);
    if (!feedId) {
      console.error("AIBASE_FEED_ID is not set in environment variables.");
      return {
        version: "https://jsonfeed.org/version/1.1",
        title: "AI Base Feeds",
        home_page_url: "https://www.aibase.com/",
        description: "Aggregated AI Base feeds",
        language: "zh-cn",
        items: []
      };
    }
    let publishedAfter = null;
    for (let i = 0; i < fetchPages; i++) {
      const userAgent = getRandomUserAgent();
      const headers = {
        "User-Agent": userAgent,
        "Content-Type": "application/json",
        "accept": "application/json",
        "accept-language": "zh-CN,zh;q=0.9",
        "baggage": "sentry-environment=stable,sentry-release=5251fa921ef6cbb6df0ac4271c41c2b4a0ce7c50,sentry-public_key=e5bccf7428aa4e881ed5cb713fdff181,sentry-trace_id=2da50ca5ad944cb794670097d876ada8,sentry-sampled=true,sentry-sample_rand=0.06211835167903246,sentry-sample_rate=1",
        "origin": "https://app.follow.is",
        "priority": "u=1, i",
        "sec-ch-ua": '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-app-name": "Folo Web",
        "x-app-version": "0.4.9"
      };
      if (foloCookie) {
        headers["Cookie"] = foloCookie;
      }
      const body = {
        feedId,
        view: 1,
        withContent: true
      };
      if (publishedAfter) {
        body.publishedAfter = publishedAfter;
      }
      try {
        console.log(`Fetching AI Base data, page ${i + 1}...`);
        const response = await fetch(env.FOLO_DATA_API, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          console.error(`Failed to fetch AI Base data, page ${i + 1}: ${response.statusText}`);
          break;
        }
        const data = await response.json();
        if (data && data.data && data.data.length > 0) {
          const filteredItems = data.data.filter((entry) => isDateWithinLastDays(entry.entries.publishedAt, filterDays));
          allAibaseItems.push(...filteredItems.map((entry) => ({
            id: entry.entries.id,
            url: entry.entries.url,
            title: entry.entries.title,
            content_html: entry.entries.content,
            date_published: entry.entries.publishedAt,
            authors: [{ name: entry.entries.author }],
            source: `aibase`
          })));
          publishedAfter = data.data[data.data.length - 1].entries.publishedAt;
        } else {
          console.log(`No more data for AI Base, page ${i + 1}.`);
          break;
        }
      } catch (error) {
        console.error(`Error fetching AI Base data, page ${i + 1}:`, error);
        break;
      }
      await sleep(Math.random() * 5e3);
    }
    return {
      version: "https://jsonfeed.org/version/1.1",
      title: "AI Base Feeds",
      home_page_url: "https://www.aibase.com/",
      description: "Aggregated AI Base feeds",
      language: "zh-cn",
      items: allAibaseItems
    };
  }, "fetch"),
  transform: /* @__PURE__ */ __name((rawData, sourceType) => {
    const unifiedNews = [];
    if (rawData && Array.isArray(rawData.items)) {
      rawData.items.forEach((item) => {
        unifiedNews.push({
          id: item.id,
          type: sourceType,
          // Use sourceType here
          url: item.url,
          title: item.title,
          description: stripHtml(item.content_html || ""),
          published_date: item.date_published,
          authors: item.authors ? item.authors.map((a) => a.name).join(", ") : "Unknown",
          source: item.source || "AI Base",
          details: {
            content_html: item.content_html || ""
          }
        });
      });
    }
    return unifiedNews;
  }, "transform"),
  generateHtml: /* @__PURE__ */ __name((item) => {
    return `
            <strong>${escapeHtml(item.title)}</strong><br>
            <small>\u6765\u6E90: ${escapeHtml(item.source || "\u672A\u77E5")} | \u53D1\u5E03\u65E5\u671F: ${formatDateToChineseWithTime(item.published_date)}</small>
            <div class="content-html">${item.details.content_html || "\u65E0\u5185\u5BB9\u3002"}</div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">\u9605\u8BFB\u66F4\u591A</a>
        `;
  }, "generateHtml")
};
var aibase_default = NewsDataSource;

// src/dataSources/jiqizhixin.js
var JiqizhixinDataSource = {
  fetch: /* @__PURE__ */ __name(async (env, foloCookie) => {
    const feedId = env.JIQIZHIXIN_FEED_ID;
    const fetchPages = parseInt(env.JIQIZHIXIN_FETCH_PAGES || "3", 10);
    const allJiqizhixinItems = [];
    const filterDays = parseInt(env.FOLO_FILTER_DAYS || "3", 10);
    if (!feedId) {
      console.error("JIQIZHIXIN_FEED_ID is not set in environment variables.");
      return {
        version: "https://jsonfeed.org/version/1.1",
        title: "Jiqizhixin.AI Daily Feeds",
        home_page_url: "https://www.jiqizhixin.ai",
        description: "Aggregated Jiqizhixin.AI Daily feeds",
        language: "zh-cn",
        items: []
      };
    }
    let publishedAfter = null;
    for (let i = 0; i < fetchPages; i++) {
      const userAgent = getRandomUserAgent();
      const headers = {
        "User-Agent": userAgent,
        "Content-Type": "application/json",
        "accept": "application/json",
        "accept-language": "zh-CN,zh;q=0.9",
        "baggage": "sentry-environment=stable,sentry-release=5251fa921ef6cbb6df0ac4271c41c2b4a0ce7c50,sentry-public_key=e5bccf7428aa4e881ed5cb713fdff181,sentry-trace_id=2da50ca5ad944cb794670097d876ada8,sentry-sampled=true,sentry-sample_rand=0.06211835167903246,sentry-sample_rate=1",
        "origin": "https://app.follow.is",
        "priority": "u=1, i",
        "sec-ch-ua": '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-app-name": "Folo Web",
        "x-app-version": "0.4.9"
      };
      if (foloCookie) {
        headers["Cookie"] = foloCookie;
      }
      const body = {
        feedId,
        view: 1,
        withContent: true
      };
      if (publishedAfter) {
        body.publishedAfter = publishedAfter;
      }
      try {
        console.log(`Fetching Jiqizhixin.AI data, page ${i + 1}...`);
        const response = await fetch(env.FOLO_DATA_API, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          console.error(`Failed to fetch Jiqizhixin.AI data, page ${i + 1}: ${response.statusText}`);
          break;
        }
        const data = await response.json();
        if (data && data.data && data.data.length > 0) {
          const filteredItems = data.data.filter((entry) => isDateWithinLastDays(entry.entries.publishedAt, filterDays));
          allJiqizhixinItems.push(...filteredItems.map((entry) => ({
            id: entry.entries.id,
            url: entry.entries.url,
            title: entry.entries.title,
            content_html: entry.entries.content,
            date_published: entry.entries.publishedAt,
            authors: [{ name: entry.entries.author }],
            source: `\u673A\u5668\u4E4B\u5FC3`
          })));
          publishedAfter = data.data[data.data.length - 1].entries.publishedAt;
        } else {
          console.log(`No more data for Jiqizhixin.AI, page ${i + 1}.`);
          break;
        }
      } catch (error) {
        console.error(`Error fetching Jiqizhixin.AI data, page ${i + 1}:`, error);
        break;
      }
      await sleep(Math.random() * 5e3);
    }
    return {
      version: "https://jsonfeed.org/version/1.1",
      title: "Jiqizhixin.AI Daily Feeds",
      home_page_url: "https://www.jiqizhixin.ai",
      description: "Aggregated Jiqizhixin.AI Daily feeds",
      language: "zh-cn",
      items: allJiqizhixinItems
    };
  }, "fetch"),
  transform: /* @__PURE__ */ __name((rawData, sourceType) => {
    const unifiedNews = [];
    if (rawData && Array.isArray(rawData.items)) {
      rawData.items.forEach((item) => {
        unifiedNews.push({
          id: item.id,
          type: sourceType,
          url: item.url,
          title: item.title,
          description: stripHtml(item.content_html || ""),
          published_date: item.date_published,
          authors: item.authors ? item.authors.map((a) => a.name).join(", ") : "Unknown",
          source: item.source || "\u673A\u5668\u4E4B\u5FC3",
          details: {
            content_html: item.content_html || ""
          }
        });
      });
    }
    return unifiedNews;
  }, "transform"),
  generateHtml: /* @__PURE__ */ __name((item) => {
    return `
            <strong>${escapeHtml(item.title)}</strong><br>
            <small>\u6765\u6E90: ${escapeHtml(item.source || "\u672A\u77E5")} | \u53D1\u5E03\u65E5\u671F: ${formatDateToChineseWithTime(item.published_date)}</small>
            <div class="content-html">${item.details.content_html || "\u65E0\u5185\u5BB9\u3002"}</div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">\u9605\u8BFB\u66F4\u591A</a>
        `;
  }, "generateHtml")
};
var jiqizhixin_default = JiqizhixinDataSource;

// src/dataSources/qbit.js
var QBitDataSource = {
  fetch: /* @__PURE__ */ __name(async (env, foloCookie) => {
    const feedId = env.QBIT_FEED_ID;
    const fetchPages = parseInt(env.QBIT_FETCH_PAGES || "3", 10);
    const allQBitItems = [];
    const filterDays = parseInt(env.FOLO_FILTER_DAYS || "3", 10);
    if (!feedId) {
      console.error("QBIT_FEED_ID is not set in environment variables.");
      return {
        version: "https://jsonfeed.org/version/1.1",
        title: "QBit.AI Daily Feeds",
        home_page_url: "https://www.qbit.ai",
        description: "Aggregated QBit.AI Daily feeds",
        language: "zh-cn",
        items: []
      };
    }
    let publishedAfter = null;
    for (let i = 0; i < fetchPages; i++) {
      const userAgent = getRandomUserAgent();
      const headers = {
        "User-Agent": userAgent,
        "Content-Type": "application/json",
        "accept": "application/json",
        "accept-language": "zh-CN,zh;q=0.9",
        "baggage": "sentry-environment=stable,sentry-release=5251fa921ef6cbb6df0ac4271c41c2b4a0ce7c50,sentry-public_key=e5bccf7428aa4e881ed5cb713fdff181,sentry-trace_id=2da50ca5ad944cb794670097d876ada8,sentry-sampled=true,sentry-sample_rand=0.06211835167903246,sentry-sample_rate=1",
        "origin": "https://app.follow.is",
        "priority": "u=1, i",
        "sec-ch-ua": '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-app-name": "Folo Web",
        "x-app-version": "0.4.9"
      };
      if (foloCookie) {
        headers["Cookie"] = foloCookie;
      }
      const body = {
        feedId,
        view: 1,
        withContent: true
      };
      if (publishedAfter) {
        body.publishedAfter = publishedAfter;
      }
      try {
        console.log(`Fetching QBit.AI data, page ${i + 1}...`);
        const response = await fetch(env.FOLO_DATA_API, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          console.error(`Failed to fetch QBit.AI data, page ${i + 1}: ${response.statusText}`);
          break;
        }
        const data = await response.json();
        if (data && data.data && data.data.length > 0) {
          const filteredItems = data.data.filter((entry) => isDateWithinLastDays(entry.entries.publishedAt, filterDays));
          allQBitItems.push(...filteredItems.map((entry) => ({
            id: entry.entries.id,
            url: entry.entries.url,
            title: entry.entries.title,
            content_html: entry.entries.content,
            date_published: entry.entries.publishedAt,
            authors: [{ name: entry.entries.author }],
            source: `\u91CF\u5B50\u4F4D`
          })));
          publishedAfter = data.data[data.data.length - 1].entries.publishedAt;
        } else {
          console.log(`No more data for QBit.AI, page ${i + 1}.`);
          break;
        }
      } catch (error) {
        console.error(`Error fetching QBit.AI data, page ${i + 1}:`, error);
        break;
      }
      await sleep(Math.random() * 5e3);
    }
    return {
      version: "https://jsonfeed.org/version/1.1",
      title: "QBit.AI Daily Feeds",
      home_page_url: "https://www.qbit.ai",
      description: "Aggregated QBit.AI Daily feeds",
      language: "zh-cn",
      items: allQBitItems
    };
  }, "fetch"),
  transform: /* @__PURE__ */ __name((rawData, sourceType) => {
    const unifiedNews = [];
    if (rawData && Array.isArray(rawData.items)) {
      rawData.items.forEach((item) => {
        unifiedNews.push({
          id: item.id,
          type: sourceType,
          url: item.url,
          title: item.title,
          description: stripHtml(item.content_html || ""),
          published_date: item.date_published,
          authors: item.authors ? item.authors.map((a) => a.name).join(", ") : "Unknown",
          source: item.source || "\u91CF\u5B50\u4F4D",
          details: {
            content_html: item.content_html || ""
          }
        });
      });
    }
    return unifiedNews;
  }, "transform"),
  generateHtml: /* @__PURE__ */ __name((item) => {
    return `
            <strong>${escapeHtml(item.title)}</strong><br>
            <small>\u6765\u6E90: ${escapeHtml(item.source || "\u672A\u77E5")} | \u53D1\u5E03\u65E5\u671F: ${formatDateToChineseWithTime(item.published_date)}</small>
            <div class="content-html">${item.details.content_html || "\u65E0\u5185\u5BB9\u3002"}</div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">\u9605\u8BFB\u66F4\u591A</a>
        `;
  }, "generateHtml")
};
var qbit_default = QBitDataSource;

// src/dataSources/xinzhiyuan.js
var XinZhiYuanDataSource = {
  fetch: /* @__PURE__ */ __name(async (env, foloCookie) => {
    const feedId = env.XINZHIYUAN_FEED_ID;
    const fetchPages = parseInt(env.XINZHIYUAN_FETCH_PAGES || "3", 10);
    const allXinZhiYuanItems = [];
    const filterDays = parseInt(env.FOLO_FILTER_DAYS || "3", 10);
    if (!feedId) {
      console.error("XINZHIYUAN_FEED_ID is not set in environment variables.");
      return {
        version: "https://jsonfeed.org/version/1.1",
        title: "XinZhiYuan.AI Daily Feeds",
        home_page_url: "https://www.xinzhiyuan.ai",
        description: "Aggregated XinZhiYuan.AI Daily feeds",
        language: "zh-cn",
        items: []
      };
    }
    let publishedAfter = null;
    for (let i = 0; i < fetchPages; i++) {
      const userAgent = getRandomUserAgent();
      const headers = {
        "User-Agent": userAgent,
        "Content-Type": "application/json",
        "accept": "application/json",
        "accept-language": "zh-CN,zh;q=0.9",
        "baggage": "sentry-environment=stable,sentry-release=5251fa921ef6cbb6df0ac4271c41c2b4a0ce7c50,sentry-public_key=e5bccf7428aa4e881ed5cb713fdff181,sentry-trace_id=2da50ca5ad944cb794670097d876ada8,sentry-sampled=true,sentry-sample_rand=0.06211835167903246,sentry-sample_rate=1",
        "origin": "https://app.follow.is",
        "priority": "u=1, i",
        "sec-ch-ua": '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-app-name": "Folo Web",
        "x-app-version": "0.4.9"
      };
      if (foloCookie) {
        headers["Cookie"] = foloCookie;
      }
      const body = {
        feedId,
        view: 1,
        withContent: true
      };
      if (publishedAfter) {
        body.publishedAfter = publishedAfter;
      }
      try {
        console.log(`Fetching XinZhiYuan.AI data, page ${i + 1}...`);
        const response = await fetch(env.FOLO_DATA_API, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          console.error(`Failed to fetch XinZhiYuan.AI data, page ${i + 1}: ${response.statusText}`);
          break;
        }
        const data = await response.json();
        if (data && data.data && data.data.length > 0) {
          const filteredItems = data.data.filter((entry) => isDateWithinLastDays(entry.entries.publishedAt, filterDays));
          allXinZhiYuanItems.push(...filteredItems.map((entry) => ({
            id: entry.entries.id,
            url: entry.entries.url,
            title: entry.entries.title,
            content_html: entry.entries.content,
            date_published: entry.entries.publishedAt,
            authors: [{ name: entry.entries.author }],
            source: `\u65B0\u667A\u5143`
          })));
          publishedAfter = data.data[data.data.length - 1].entries.publishedAt;
        } else {
          console.log(`No more data for XinZhiYuan.AI, page ${i + 1}.`);
          break;
        }
      } catch (error) {
        console.error(`Error fetching XinZhiYuan.AI data, page ${i + 1}:`, error);
        break;
      }
      await sleep(Math.random() * 5e3);
    }
    return {
      version: "https://jsonfeed.org/version/1.1",
      title: "XinZhiYuan.AI Daily Feeds",
      home_page_url: "https://www.xinzhiyuan.ai",
      description: "Aggregated XinZhiYuan.AI Daily feeds",
      language: "zh-cn",
      items: allXinZhiYuanItems
    };
  }, "fetch"),
  transform: /* @__PURE__ */ __name((rawData, sourceType) => {
    const unifiedNews = [];
    if (rawData && Array.isArray(rawData.items)) {
      rawData.items.forEach((item) => {
        unifiedNews.push({
          id: item.id,
          type: sourceType,
          url: item.url,
          title: item.title,
          description: stripHtml(item.content_html || ""),
          published_date: item.date_published,
          authors: item.authors ? item.authors.map((a) => a.name).join(", ") : "Unknown",
          source: item.source || "\u65B0\u667A\u5143",
          details: {
            content_html: item.content_html || ""
          }
        });
      });
    }
    return unifiedNews;
  }, "transform"),
  generateHtml: /* @__PURE__ */ __name((item) => {
    return `
            <strong>${escapeHtml(item.title)}</strong><br>
            <small>\u6765\u6E90: ${escapeHtml(item.source || "\u672A\u77E5")} | \u53D1\u5E03\u65E5\u671F: ${formatDateToChineseWithTime(item.published_date)}</small>
            <div class="content-html">${item.details.content_html || "\u65E0\u5185\u5BB9\u3002"}</div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">\u9605\u8BFB\u66F4\u591A</a>
        `;
  }, "generateHtml")
};
var xinzhiyuan_default = XinZhiYuanDataSource;

// src/dataSources/xiaohu.js
var XiaohuDataSource = {
  fetch: /* @__PURE__ */ __name(async (env, foloCookie) => {
    const feedId = env.XIAOHU_FEED_ID;
    const fetchPages = parseInt(env.XIAOHU_FETCH_PAGES || "3", 10);
    const allXiaohuItems = [];
    const filterDays = parseInt(env.FOLO_FILTER_DAYS || "3", 10);
    if (!feedId) {
      console.error("XIAOHU_FEED_ID is not set in environment variables.");
      return {
        version: "https://jsonfeed.org/version/1.1",
        title: "Xiaohu.AI Daily Feeds",
        home_page_url: "https://www.xiaohu.ai",
        description: "Aggregated Xiaohu.AI Daily feeds",
        language: "zh-cn",
        items: []
      };
    }
    let publishedAfter = null;
    for (let i = 0; i < fetchPages; i++) {
      const userAgent = getRandomUserAgent();
      const headers = {
        "User-Agent": userAgent,
        "Content-Type": "application/json",
        "accept": "application/json",
        "accept-language": "zh-CN,zh;q=0.9",
        "baggage": "sentry-environment=stable,sentry-release=5251fa921ef6cbb6df0ac4271c41c2b4a0ce7c50,sentry-public_key=e5bccf7428aa4e881ed5cb713fdff181,sentry-trace_id=2da50ca5ad944cb794670097d876ada8,sentry-sampled=true,sentry-sample_rand=0.06211835167903246,sentry-sample_rate=1",
        "origin": "https://app.follow.is",
        "priority": "u=1, i",
        "sec-ch-ua": '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-app-name": "Folo Web",
        "x-app-version": "0.4.9"
      };
      if (foloCookie) {
        headers["Cookie"] = foloCookie;
      }
      const body = {
        feedId,
        view: 1,
        withContent: true
      };
      if (publishedAfter) {
        body.publishedAfter = publishedAfter;
      }
      try {
        console.log(`Fetching Xiaohu.AI data, page ${i + 1}...`);
        const response = await fetch(env.FOLO_DATA_API, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          console.error(`Failed to fetch Xiaohu.AI data, page ${i + 1}: ${response.statusText}`);
          break;
        }
        const data = await response.json();
        if (data && data.data && data.data.length > 0) {
          const filteredItems = data.data.filter((entry) => isDateWithinLastDays(entry.entries.publishedAt, filterDays));
          allXiaohuItems.push(...filteredItems.map((entry) => ({
            id: entry.entries.id,
            url: entry.entries.url,
            title: entry.entries.title,
            content_html: entry.entries.content,
            date_published: entry.entries.publishedAt,
            authors: [{ name: entry.entries.author }],
            source: `xiaohu`
          })));
          publishedAfter = data.data[data.data.length - 1].entries.publishedAt;
        } else {
          console.log(`No more data for Xiaohu.AI, page ${i + 1}.`);
          break;
        }
      } catch (error) {
        console.error(`Error fetching Xiaohu.AI data, page ${i + 1}:`, error);
        break;
      }
      await sleep(Math.random() * 5e3);
    }
    return {
      version: "https://jsonfeed.org/version/1.1",
      title: "Xiaohu.AI Daily Feeds",
      home_page_url: "https://www.xiaohu.ai",
      description: "Aggregated Xiaohu.AI Daily feeds",
      language: "zh-cn",
      items: allXiaohuItems
    };
  }, "fetch"),
  transform: /* @__PURE__ */ __name((rawData, sourceType) => {
    const unifiedNews = [];
    if (rawData && Array.isArray(rawData.items)) {
      rawData.items.forEach((item) => {
        unifiedNews.push({
          id: item.id,
          type: sourceType,
          url: item.url,
          title: item.title,
          description: stripHtml(item.content_html || ""),
          published_date: item.date_published,
          authors: item.authors ? item.authors.map((a) => a.name).join(", ") : "Unknown",
          source: item.source || "Xiaohu.AI",
          details: {
            content_html: item.content_html || ""
          }
        });
      });
    }
    return unifiedNews;
  }, "transform"),
  generateHtml: /* @__PURE__ */ __name((item) => {
    return `
            <strong>${escapeHtml(item.title)}</strong><br>
            <small>\u6765\u6E90: ${escapeHtml(item.source || "\u672A\u77E5")} | \u53D1\u5E03\u65E5\u671F: ${formatDateToChineseWithTime(item.published_date)}</small>
            <div class="content-html">${item.details.content_html || "\u65E0\u5185\u5BB9\u3002"}</div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">\u9605\u8BFB\u66F4\u591A</a>
        `;
  }, "generateHtml")
};
var xiaohu_default = XiaohuDataSource;

// src/chatapi.js
var GEMINI_API_VERSIONS = ["v1beta", "v1", ""];
function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}
__name(normalizeBaseUrl, "normalizeBaseUrl");
function getGeminiApiKey(env) {
  return env.GEMINI_API_KEY || env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY;
}
__name(getGeminiApiKey, "getGeminiApiKey");
function getGeminiModelName(env) {
  return env.DEFAULT_GEMINI_MODEL || env.GEMINI_MODEL;
}
__name(getGeminiModelName, "getGeminiModelName");
function getGeminiApiVersionCandidates(env, baseUrl) {
  const configured = String(env.GEMINI_API_VERSION ?? "auto").trim().toLowerCase();
  const base = normalizeBaseUrl(baseUrl);
  const baseHasVersion = /\/v1beta$|\/v1$/i.test(base);
  if (baseHasVersion) {
    return [""];
  }
  if (configured === "" || configured === "auto" || configured === "default") {
    return GEMINI_API_VERSIONS;
  }
  if (configured === "v1beta" || configured === "v1") {
    return [configured];
  }
  if (configured === "noversion" || configured === "no-version" || configured === "no_version" || configured === "none" || configured === "off" || configured === "0") {
    return [""];
  }
  return GEMINI_API_VERSIONS;
}
__name(getGeminiApiVersionCandidates, "getGeminiApiVersionCandidates");
function isGeminiDebug(env) {
  const value = String(env.GEMINI_DEBUG ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}
__name(isGeminiDebug, "isGeminiDebug");
function redactGeminiUrl(url) {
  return String(url || "").replace(/([?&]key=)[^&]+/gi, "$1***");
}
__name(redactGeminiUrl, "redactGeminiUrl");
function logGeminiDebug(env, message, meta) {
  if (!isGeminiDebug(env)) return;
  if (meta) {
    console.log(message, meta);
    return;
  }
  console.log(message);
}
__name(logGeminiDebug, "logGeminiDebug");
function isInvalidArgumentError(status, message) {
  if (status !== 400) return false;
  const text = String(message || "").toLowerCase();
  return text.includes("invalid argument") || text.includes("invalid_argument");
}
__name(isInvalidArgumentError, "isInvalidArgumentError");
function formatGeminiVariant(variant) {
  return `system=${variant.useSystemInstruction ? "on" : "off"}, merge=${variant.mergeSystem ? "on" : "off"}, role=${variant.useRole ? "on" : "off"}, gen=${variant.includeGenerationConfig ? "on" : "off"}`;
}
__name(formatGeminiVariant, "formatGeminiVariant");
function getGeminiPayloadVariants(hasSystem, allowGenerationConfig) {
  const variants = [];
  const genOptions = allowGenerationConfig ? [true, false] : [false];
  if (hasSystem) {
    for (const includeGenerationConfig of genOptions) {
      variants.push({ useSystemInstruction: true, mergeSystem: false, useRole: true, includeGenerationConfig });
      variants.push({ useSystemInstruction: true, mergeSystem: false, useRole: false, includeGenerationConfig });
      variants.push({ useSystemInstruction: false, mergeSystem: true, useRole: true, includeGenerationConfig });
      variants.push({ useSystemInstruction: false, mergeSystem: true, useRole: false, includeGenerationConfig });
    }
  } else {
    for (const includeGenerationConfig of genOptions) {
      variants.push({ useSystemInstruction: false, mergeSystem: false, useRole: true, includeGenerationConfig });
      variants.push({ useSystemInstruction: false, mergeSystem: false, useRole: false, includeGenerationConfig });
    }
  }
  return variants;
}
__name(getGeminiPayloadVariants, "getGeminiPayloadVariants");
function buildGeminiPayload(promptText, systemPromptText, variant) {
  const hasSystem = systemPromptText && typeof systemPromptText === "string" && systemPromptText.trim() !== "";
  const useSystemInstruction = variant.useSystemInstruction && hasSystem;
  const shouldMergeSystem = variant.mergeSystem && hasSystem && !useSystemInstruction;
  const effectivePromptText = shouldMergeSystem ? `${systemPromptText}

${promptText}` : promptText;
  const parts = [{ text: effectivePromptText }];
  const content = variant.useRole ? { role: "user", parts } : { parts };
  const payload = { contents: [content] };
  if (useSystemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemPromptText }] };
  }
  if (variant.includeGenerationConfig) {
    payload.generationConfig = {
      temperature: 1,
      topP: 0.95
    };
  }
  return { payload };
}
__name(buildGeminiPayload, "buildGeminiPayload");
function getGeminiStreamMode(env) {
  const mode = String(env.GEMINI_STREAM_MODE ?? "auto").trim().toLowerCase();
  if (mode === "off" || mode === "false" || mode === "0" || mode === "no" || mode === "none" || mode === "disable" || mode === "disabled" || mode === "nostream" || mode === "nonstream" || mode === "non-stream" || mode === "non_stream") {
    return "off";
  }
  if (mode === "force" || mode === "on" || mode === "true" || mode === "1") {
    return "force";
  }
  return "auto";
}
__name(getGeminiStreamMode, "getGeminiStreamMode");
function buildGeminiHeaders(apiKey, useHeaderAuth) {
  const headers = { "Content-Type": "application/json" };
  if (useHeaderAuth && apiKey) {
    headers["x-goog-api-key"] = apiKey;
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  return headers;
}
__name(buildGeminiHeaders, "buildGeminiHeaders");
function buildGeminiUrl(baseUrl, apiVersion, modelName, method, apiKey, useQueryKey, extraQuery = "") {
  const base = normalizeBaseUrl(baseUrl);
  const versionSegment = apiVersion ? `/${apiVersion}` : "";
  const path = `${base}${versionSegment}/models/${modelName}:${method}`;
  const queryParts = [];
  if (useQueryKey && apiKey) queryParts.push(`key=${encodeURIComponent(apiKey)}`);
  if (extraQuery) queryParts.push(extraQuery.replace(/^[?&]/, ""));
  return queryParts.length ? `${path}?${queryParts.join("&")}` : path;
}
__name(buildGeminiUrl, "buildGeminiUrl");
function extractGeminiTextFromResponse(data) {
  if (data?.promptFeedback?.blockReason) {
    const blockReason = data.promptFeedback.blockReason;
    const safetyRatings = data.promptFeedback.safetyRatings ? JSON.stringify(data.promptFeedback.safetyRatings) : "N/A";
    throw new Error(`Gemini Chat prompt blocked: ${blockReason}. Safety ratings: ${safetyRatings}`);
  }
  if (data?.candidates?.length > 0) {
    const candidate = data.candidates[0];
    if (candidate.finishReason && candidate.finishReason !== "STOP") {
      const reason = candidate.finishReason;
      const safetyRatings = candidate.safetyRatings ? JSON.stringify(candidate.safetyRatings) : "N/A";
      if (reason === "SAFETY") {
        throw new Error(`Gemini Chat content generation blocked due to safety (${reason}). Safety ratings: ${safetyRatings}`);
      }
      throw new Error(`Gemini Chat content generation finished due to: ${reason}. Safety ratings: ${safetyRatings}`);
    }
    const text = candidate?.content?.parts?.[0]?.text;
    if (text && typeof text === "string") {
      return text;
    }
    throw new Error("Gemini Chat API returned a candidate with 'STOP' finishReason but no text content.");
  }
  throw new Error("Gemini Chat API returned an empty or malformed response with no candidates.");
}
__name(extractGeminiTextFromResponse, "extractGeminiTextFromResponse");
async function callGeminiChatAPI(env, promptText, systemPromptText = null) {
  if (!env.GEMINI_API_URL) {
    throw new Error("GEMINI_API_URL environment variable is not set.");
  }
  const apiKey = getGeminiApiKey(env);
  if (!apiKey) {
    throw new Error("Gemini API key is not set (set GEMINI_API_KEY, or reuse ANTHROPIC_API_KEY/OPENAI_API_KEY).");
  }
  const modelName = getGeminiModelName(env);
  if (!modelName) {
    throw new Error("DEFAULT_GEMINI_MODEL environment variable is not set.");
  }
  const baseUrl = normalizeBaseUrl(env.GEMINI_API_URL);
  const authModes = [
    { useQueryKey: true, useHeaderAuth: false },
    { useQueryKey: false, useHeaderAuth: true }
  ];
  const hasSystem = systemPromptText && typeof systemPromptText === "string" && systemPromptText.trim() !== "";
  const payloadVariants = getGeminiPayloadVariants(hasSystem, false);
  let lastCompatibilityError = null;
  try {
    versionLoop:
      for (const apiVersion of getGeminiApiVersionCandidates(env, baseUrl)) {
        authLoop:
          for (const auth of authModes) {
            for (const variant of payloadVariants) {
              const { payload } = buildGeminiPayload(promptText, systemPromptText, variant);
              const url = buildGeminiUrl(baseUrl, apiVersion, modelName, "generateContent", apiKey, auth.useQueryKey);
              logGeminiDebug(env, "Gemini non-stream request", { url: redactGeminiUrl(url), variant: formatGeminiVariant(variant) });
              const response = await fetchWithTimeout(url, {
                method: "POST",
                headers: buildGeminiHeaders(apiKey, auth.useHeaderAuth),
                body: JSON.stringify(payload)
              }, 18e4);
              const contentType = response.headers.get("content-type") || "";
              if (!response.ok) {
                const errorBodyText = await response.text();
                let errorData;
                try {
                  errorData = JSON.parse(errorBodyText);
                } catch (e) {
                  errorData = errorBodyText;
                }
                const message = typeof errorData === "object" && errorData.error?.message ? errorData.error.message : typeof errorData === "string" ? errorData : "Unknown Gemini Chat API error";
                logGeminiDebug(env, "Gemini non-stream error response", {
                  url: redactGeminiUrl(url),
                  status: response.status,
                  contentType,
                  variant: formatGeminiVariant(variant),
                  bodyPreview: String(errorBodyText || "").slice(0, 200)
                });
                lastCompatibilityError = new Error(`Gemini Chat API error (${response.status}): ${message}`);
                if (response.status === 404 || response.status === 405) {
                  continue versionLoop;
                }
                if ((response.status === 401 || response.status === 403) && auth.useQueryKey) {
                  continue authLoop;
                }
                if (isInvalidArgumentError(response.status, message)) {
                  continue;
                }
                continue;
              }
              if (!contentType.includes("application/json")) {
                const bodyText = await response.text();
                logGeminiDebug(env, "Gemini non-stream non-JSON response", {
                  url: redactGeminiUrl(url),
                  status: response.status,
                  contentType,
                  variant: formatGeminiVariant(variant),
                  bodyPreview: String(bodyText || "").slice(0, 200)
                });
                lastCompatibilityError = new Error(`Gemini Chat API error (${response.status}): Non-JSON response (${contentType || "unknown"})`);
                continue;
              }
              const data = await response.json();
              if (data?.error?.message) {
                const message = data.error.message;
                lastCompatibilityError = new Error(`Gemini Chat API error (${response.status}): ${message}`);
                if (isInvalidArgumentError(response.status, message)) {
                  continue;
                }
                continue;
              }
              return extractGeminiTextFromResponse(data);
            }
          }
      }
    if (lastCompatibilityError) {
      throw lastCompatibilityError;
    }
    throw new Error("Gemini Chat API error: failed to reach a compatible endpoint (check GEMINI_API_URL / proxy compatibility).");
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith("Gemini Chat"))) {
      console.error("Error calling Gemini Chat API (Non-streaming):", error);
    }
    throw error;
  }
}
__name(callGeminiChatAPI, "callGeminiChatAPI");
async function* callGeminiChatAPIStream(env, promptText, systemPromptText = null) {
  if (!env.GEMINI_API_URL) {
    throw new Error("GEMINI_API_URL environment variable is not set.");
  }
  const apiKey = getGeminiApiKey(env);
  if (!apiKey) {
    throw new Error("Gemini API key is not set (set GEMINI_API_KEY, or reuse ANTHROPIC_API_KEY/OPENAI_API_KEY).");
  }
  const modelName = getGeminiModelName(env);
  if (!modelName) {
    throw new Error("DEFAULT_GEMINI_MODEL environment variable is not set.");
  }
  const baseUrl = normalizeBaseUrl(env.GEMINI_API_URL);
  const authModes = [
    { useQueryKey: true, useHeaderAuth: false },
    { useQueryKey: false, useHeaderAuth: true }
  ];
  const streamQueryVariants = ["alt=sse", ""];
  const streamMode = getGeminiStreamMode(env);
  const hasSystem = systemPromptText && typeof systemPromptText === "string" && systemPromptText.trim() !== "";
  const payloadVariants = getGeminiPayloadVariants(hasSystem, true);
  let response = null;
  let lastCompatibilityError = null;
  let hasYieldedContent = false;
  try {
    requestLoop:
      for (const apiVersion of getGeminiApiVersionCandidates(env, baseUrl)) {
        authLoop:
          for (const auth of authModes) {
            for (const streamQuery of streamQueryVariants) {
              for (const variant of payloadVariants) {
                const { payload } = buildGeminiPayload(promptText, systemPromptText, variant);
                const url = buildGeminiUrl(baseUrl, apiVersion, modelName, "streamGenerateContent", apiKey, auth.useQueryKey, streamQuery);
                logGeminiDebug(env, "Gemini stream request", { url: redactGeminiUrl(url), variant: formatGeminiVariant(variant) });
                response = await fetchWithTimeout(url, {
                  method: "POST",
                  headers: buildGeminiHeaders(apiKey, auth.useHeaderAuth),
                  body: JSON.stringify(payload)
                }, 18e4);
                const contentType2 = response.headers.get("content-type") || "";
                if (!response.ok) {
                  const errorBodyText = await response.text();
                  let errorData;
                  try {
                    errorData = JSON.parse(errorBodyText);
                  } catch (e) {
                    errorData = errorBodyText;
                  }
                  const message = typeof errorData === "object" && errorData.error?.message ? errorData.error.message : typeof errorData === "string" ? errorData : "Unknown Gemini Chat API error";
                  logGeminiDebug(env, "Gemini stream error response", {
                    url: redactGeminiUrl(url),
                    status: response.status,
                    contentType: contentType2,
                    variant: formatGeminiVariant(variant),
                    bodyPreview: String(errorBodyText || "").slice(0, 200)
                  });
                  lastCompatibilityError = new Error(`Gemini Chat API error (${response.status}): ${message}`);
                  if (response.status === 404 || response.status === 405) {
                    continue requestLoop;
                  }
                  if ((response.status === 401 || response.status === 403) && auth.useQueryKey) {
                    continue authLoop;
                  }
                  if (isInvalidArgumentError(response.status, message)) {
                    continue;
                  }
                  continue;
                }
                if (contentType2 && !contentType2.includes("application/json") && !contentType2.includes("text/event-stream")) {
                  const bodyText = await response.text();
                  logGeminiDebug(env, "Gemini stream non-JSON response", {
                    url: redactGeminiUrl(url),
                    status: response.status,
                    contentType: contentType2,
                    variant: formatGeminiVariant(variant),
                    bodyPreview: String(bodyText || "").slice(0, 200)
                  });
                  lastCompatibilityError = new Error(`Gemini Chat API error (${response.status}): Non-JSON response (${contentType2 || "unknown"})`);
                  response = null;
                  continue;
                }
                break requestLoop;
              }
            }
          }
      }
    if (!response || !response.ok) {
      if (streamMode === "force" && lastCompatibilityError) {
        throw lastCompatibilityError;
      }
      const nonStreamText = await callGeminiChatAPI(env, promptText, systemPromptText);
      yield nonStreamText;
      return;
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      yield extractGeminiTextFromResponse(data);
      return;
    }
    if (!response.body) {
      throw new Error("Response body is null, cannot stream.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let overallFinishReason = null;
    let finalSafetyRatings = null;
    const processJsonChunk = /* @__PURE__ */ __name((jsonString) => {
      if (jsonString.trim() === "") return null;
      try {
        return JSON.parse(jsonString);
      } catch (e) {
        console.warn("Failed to parse JSON chunk from stream:", jsonString, e.message);
        return null;
      }
    }, "processJsonChunk");
    const handleChunkLogic = /* @__PURE__ */ __name((chunk) => {
      if (!chunk) return false;
      if (chunk.promptFeedback && chunk.promptFeedback.blockReason) {
        const blockReason = chunk.promptFeedback.blockReason;
        const safetyRatings = chunk.promptFeedback.safetyRatings ? JSON.stringify(chunk.promptFeedback.safetyRatings) : "N/A";
        console.error(`Gemini Chat prompt blocked during stream: ${blockReason}. Safety ratings: ${safetyRatings}`, JSON.stringify(chunk, null, 2));
        throw new Error(`Gemini Chat prompt blocked: ${blockReason}. Safety ratings: ${safetyRatings}`);
      }
      if (chunk.candidates && chunk.candidates.length > 0) {
        const candidate = chunk.candidates[0];
        if (candidate.finishReason) {
          overallFinishReason = candidate.finishReason;
          finalSafetyRatings = candidate.safetyRatings;
          if (candidate.finishReason !== "STOP") {
            const reason = candidate.finishReason;
            const sr = candidate.safetyRatings ? JSON.stringify(candidate.safetyRatings) : "N/A";
            console.error(`Gemini Chat stream candidate finished with reason: ${reason}. Safety ratings: ${sr}`, JSON.stringify(chunk, null, 2));
            if (reason === "SAFETY") {
              throw new Error(`Gemini Chat content generation blocked due to safety (${reason}). Safety ratings: ${sr}`);
            }
            throw new Error(`Gemini Chat stream finished due to: ${reason}. Safety ratings: ${sr}`);
          }
        }
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          const textPart = candidate.content.parts[0].text;
          if (textPart && typeof textPart === "string") {
            hasYieldedContent = true;
            return textPart;
          }
        }
      } else if (chunk.error) {
        console.error("Gemini Chat API Stream Error Chunk:", JSON.stringify(chunk.error, null, 2));
        throw new Error(`Gemini Chat API stream error: ${chunk.error.message || "Unknown error in stream"}`);
      }
      return null;
    }, "handleChunkLogic");
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let eventBoundary;
      while ((eventBoundary = buffer.indexOf("\n\n")) !== -1 || (eventBoundary = buffer.indexOf("\n")) !== -1) {
        const separatorLength = buffer.indexOf("\n\n") === eventBoundary ? 2 : 1;
        let message = buffer.substring(0, eventBoundary);
        buffer = buffer.substring(eventBoundary + separatorLength);
        if (message.startsWith("data: ")) {
          message = message.substring(5).trim();
        } else {
          message = message.trim();
        }
        if (message === "" || message === "[DONE]") {
          continue;
        }
        const parsedChunk = processJsonChunk(message);
        if (parsedChunk) {
          const textToYield = handleChunkLogic(parsedChunk);
          if (textToYield !== null) {
            yield textToYield;
          }
        }
      }
    }
    if (buffer.trim()) {
      let finalMessage = buffer.trim();
      if (finalMessage.startsWith("data: ")) {
        finalMessage = finalMessage.substring(5).trim();
      }
      if (finalMessage !== "" && finalMessage !== "[DONE]") {
        const parsedChunk = processJsonChunk(finalMessage);
        if (parsedChunk) {
          const textToYield = handleChunkLogic(parsedChunk);
          if (textToYield !== null) {
            yield textToYield;
          }
        }
      }
    }
    if (!hasYieldedContent) {
      if (overallFinishReason && overallFinishReason !== "STOP") {
        const sr = finalSafetyRatings ? JSON.stringify(finalSafetyRatings) : "N/A";
        console.warn(`Gemini Chat stream ended with reason '${overallFinishReason}' and no content was yielded. Safety: ${sr}`);
        throw new Error(`Gemini Chat stream completed due to ${overallFinishReason} without yielding content. Safety ratings: ${sr}`);
      } else if (overallFinishReason === "STOP") {
        console.warn("Gemini Chat stream finished with 'STOP' but no content was yielded.", JSON.stringify({ overallFinishReason, finalSafetyRatings }, null, 2));
        throw new Error("Gemini Chat stream completed with 'STOP' but yielded no content.");
      } else if (!overallFinishReason) {
        console.warn("Gemini Chat stream ended without yielding any content or a clear finish reason.");
        throw new Error("Gemini Chat stream completed without yielding any content.");
      }
    }
  } catch (error) {
    if (streamMode === "auto" && !hasYieldedContent) {
      try {
        const nonStreamText = await callGeminiChatAPI(env, promptText, systemPromptText);
        yield nonStreamText;
        return;
      } catch (fallbackError) {
        console.error("Gemini stream failed; non-stream fallback also failed:", fallbackError);
      }
    }
    if (!(error instanceof Error && error.message.startsWith("Gemini Chat"))) {
      console.error("Error calling or streaming from Gemini Chat API:", error);
    }
    throw error;
  }
}
__name(callGeminiChatAPIStream, "callGeminiChatAPIStream");
async function callOpenAIChatAPI(env, promptText, systemPromptText = null) {
  if (!env.OPENAI_API_URL) {
    throw new Error("OPENAI_API_URL environment variable is not set.");
  }
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set for OpenAI models.");
  }
  const url = `${env.OPENAI_API_URL}/v1/chat/completions`;
  const messages = [];
  if (systemPromptText && typeof systemPromptText === "string" && systemPromptText.trim() !== "") {
    messages.push({ role: "system", content: systemPromptText });
    console.log("System instruction included in OpenAI Chat API call.");
  }
  messages.push({ role: "user", content: promptText });
  const modelName = env.DEFAULT_OPEN_MODEL;
  const payload = {
    model: modelName,
    messages,
    temperature: 1,
    max_tokens: 2048,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0
  };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorBodyText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorBodyText);
      } catch (e) {
        errorData = errorBodyText;
      }
      console.error("OpenAI Chat API Error Response Body:", typeof errorData === "object" ? JSON.stringify(errorData, null, 2) : errorData);
      const message = typeof errorData === "object" && errorData.error?.message ? errorData.error.message : typeof errorData === "string" ? errorData : "Unknown OpenAI Chat API error";
      throw new Error(`OpenAI Chat API error (${response.status}): ${message}`);
    }
    const data = await response.json();
    if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
      return data.choices[0].message.content;
    } else {
      console.warn("OpenAI Chat API response format unexpected: No choices or content found.", JSON.stringify(data, null, 2));
      throw new Error("OpenAI Chat API returned an empty or malformed response.");
    }
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith("OpenAI Chat"))) {
      console.error("Error calling OpenAI Chat API (Non-streaming):", error);
    }
    throw error;
  }
}
__name(callOpenAIChatAPI, "callOpenAIChatAPI");
async function* callOpenAIChatAPIStream(env, promptText, systemPromptText = null) {
  if (!env.OPENAI_API_URL) {
    throw new Error("OPENAI_API_URL environment variable is not set.");
  }
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set for OpenAI models.");
  }
  const url = `${env.OPENAI_API_URL}/v1/chat/completions`;
  const messages = [];
  if (systemPromptText && typeof systemPromptText === "string" && systemPromptText.trim() !== "") {
    messages.push({ role: "system", content: systemPromptText });
    console.log("System instruction included in OpenAI Chat API call.");
  }
  messages.push({ role: "user", content: promptText });
  const modelName = env.DEFAULT_OPEN_MODEL;
  const payload = {
    model: modelName,
    messages,
    temperature: 1,
    max_tokens: 2048,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    stream: true
  };
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorBodyText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorBodyText);
      } catch (e) {
        errorData = errorBodyText;
      }
      console.error("OpenAI Chat API Error (Stream Initial) Response Body:", typeof errorData === "object" ? JSON.stringify(errorData, null, 2) : errorData);
      const message = typeof errorData === "object" && errorData.error?.message ? errorData.error.message : typeof errorData === "string" ? errorData : "Unknown OpenAI Chat API error";
      throw new Error(`OpenAI Chat API error (${response.status}): ${message}`);
    }
    if (!response.body) {
      throw new Error("Response body is null, cannot stream.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let hasYieldedContent = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let eventBoundary;
      while ((eventBoundary = buffer.indexOf("\n\n")) !== -1) {
        let message = buffer.substring(0, eventBoundary);
        buffer = buffer.substring(eventBoundary + 2);
        if (message.startsWith("data: ")) {
          message = message.substring(5).trim();
        } else {
          message = message.trim();
        }
        if (message === "" || message === "[DONE]") {
          continue;
        }
        try {
          const parsedChunk = JSON.parse(message);
          if (parsedChunk.choices && parsedChunk.choices.length > 0) {
            const delta = parsedChunk.choices[0].delta;
            if (delta && delta.content) {
              hasYieldedContent = true;
              yield delta.content;
            }
          } else if (parsedChunk.error) {
            console.error("OpenAI Chat API Stream Error Chunk:", JSON.stringify(parsedChunk.error, null, 2));
            throw new Error(`OpenAI Chat API stream error: ${parsedChunk.error.message || "Unknown error in stream"}`);
          }
        } catch (e) {
          console.warn("Failed to parse JSON chunk from OpenAI stream:", message, e.message);
        }
      }
    }
    if (buffer.trim()) {
      let finalMessage = buffer.trim();
      if (finalMessage.startsWith("data: ")) {
        finalMessage = finalMessage.substring(5).trim();
      }
      if (finalMessage !== "" && finalMessage !== "[DONE]") {
        try {
          const parsedChunk = JSON.parse(finalMessage);
          if (parsedChunk.choices && parsedChunk.choices.length > 0) {
            const delta = parsedChunk.choices[0].delta;
            if (delta && delta.content) {
              hasYieldedContent = true;
              yield delta.content;
            }
          } else if (parsedChunk.error) {
            console.error("OpenAI Chat API Stream Error Chunk:", JSON.stringify(parsedChunk.error, null, 2));
            throw new Error(`OpenAI Chat API stream error: ${parsedChunk.error.message || "Unknown error in stream"}`);
          }
        } catch (e) {
          console.warn("Failed to parse final JSON chunk from OpenAI stream:", finalMessage, e.message);
        }
      }
    }
    if (!hasYieldedContent) {
      console.warn("OpenAI Chat stream finished but no content was yielded.");
      throw new Error("OpenAI Chat stream completed but yielded no content.");
    }
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith("OpenAI Chat"))) {
      console.error("Error calling or streaming from OpenAI Chat API:", error);
    }
    throw error;
  }
}
__name(callOpenAIChatAPIStream, "callOpenAIChatAPIStream");
async function callAnthropicChatAPI(env, promptText, systemPromptText = null) {
  if (!env.ANTHROPIC_API_URL || !env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_URL or ANTHROPIC_API_KEY not set.");
  }
  const modelName = env.DEFAULT_ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
  const url = `${env.ANTHROPIC_API_URL}/v1/messages`;
  const messages = [{ role: "user", content: promptText }];
  const payload = {
    model: modelName,
    messages,
    max_tokens: 2048
  };
  if (systemPromptText && systemPromptText.trim() !== "") {
    payload.messages[0].content = `${systemPromptText}

${promptText}`;
  }
  try {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.ANTHROPIC_API_KEY}`,
        "User-Agent": "Cloudflare-Worker/1.0"
      },
      body: JSON.stringify(payload)
    }, 18e4);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic Chat API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    if (data.content && Array.isArray(data.content)) {
      const textBlocks = data.content.filter((block2) => block2.type === "text" && block2.text).map((block2) => block2.text);
      if (textBlocks.length > 0) {
        return textBlocks.join("\n");
      }
    }
    throw new Error("Anthropic Chat API returned no content.");
  } catch (error) {
    console.error("Error calling Anthropic Chat API:", error);
    throw error;
  }
}
__name(callAnthropicChatAPI, "callAnthropicChatAPI");
async function* callAnthropicChatAPIStream(env, promptText, systemPromptText = null) {
  if (!env.ANTHROPIC_API_URL || !env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_URL or ANTHROPIC_API_KEY not set.");
  }
  const modelName = env.DEFAULT_ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
  const url = `${env.ANTHROPIC_API_URL}/v1/messages`;
  const messages = [{ role: "user", content: promptText }];
  const payload = {
    model: modelName,
    messages,
    max_tokens: 2048,
    stream: true
  };
  if (systemPromptText && systemPromptText.trim() !== "") {
    payload.messages[0].content = `${systemPromptText}

${promptText}`;
  }
  try {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.ANTHROPIC_API_KEY}`,
        "User-Agent": "Cloudflare-Worker/1.0"
      },
      body: JSON.stringify(payload)
    }, 18e4);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic Chat API error (${response.status}): ${errorText}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let hasYieldedContent = false;
    let currentBlockType = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim() || !line.startsWith("data: ")) continue;
        const data = line.substring(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "content_block_start") {
            currentBlockType = parsed.content_block?.type;
          } else if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            if (currentBlockType !== "thinking") {
              hasYieldedContent = true;
              yield parsed.delta.text;
            }
          } else if (parsed.type === "content_block_stop") {
            currentBlockType = null;
          } else if (parsed.type === "error") {
            throw new Error(`Anthropic stream error: ${parsed.error?.message || "Unknown"}`);
          }
        } catch (e) {
          console.warn("Failed to parse Anthropic stream chunk:", data, e.message);
        }
      }
    }
    if (!hasYieldedContent) {
      throw new Error("Anthropic stream completed but yielded no content.");
    }
  } catch (error) {
    console.error("Error calling Anthropic Chat API Stream:", error);
    throw error;
  }
}
__name(callAnthropicChatAPIStream, "callAnthropicChatAPIStream");
async function callChatAPI(env, promptText, systemPromptText = null) {
  const platform = env.USE_MODEL_PLATFORM;
  if (platform.startsWith("OPEN")) {
    return callOpenAIChatAPI(env, promptText, systemPromptText);
  } else if (platform.startsWith("ANTHROPIC")) {
    return callAnthropicChatAPI(env, promptText, systemPromptText);
  } else {
    return callGeminiChatAPI(env, promptText, systemPromptText);
  }
}
__name(callChatAPI, "callChatAPI");
async function* callChatAPIStream(env, promptText, systemPromptText = null) {
  const platform = env.USE_MODEL_PLATFORM;
  if (platform.startsWith("OPEN")) {
    yield* callOpenAIChatAPIStream(env, promptText, systemPromptText);
  } else if (platform.startsWith("ANTHROPIC")) {
    yield* callAnthropicChatAPIStream(env, promptText, systemPromptText);
  } else {
    const streamMode = getGeminiStreamMode(env);
    if (streamMode === "off") {
      const text = await callGeminiChatAPI(env, promptText, systemPromptText);
      yield text;
      return;
    }
    yield* callGeminiChatAPIStream(env, promptText, systemPromptText);
  }
}
__name(callChatAPIStream, "callChatAPIStream");
async function fetchWithTimeout(resource, options2 = {}, timeout = 18e4) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options2,
      signal: controller.signal
      // 关联 AbortController
    });
    return response;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}
__name(fetchWithTimeout, "fetchWithTimeout");

// src/dataSources/github-trending.js
var ProjectsDataSource = {
  fetch: /* @__PURE__ */ __name(async (env) => {
    console.log(`Fetching projects from: ${env.PROJECTS_API_URL}`);
    let projects;
    try {
      projects = await fetchData(env.PROJECTS_API_URL);
    } catch (error) {
      console.error("Error fetching projects data:", error.message);
      return { error: "Failed to fetch projects data", details: error.message, items: [] };
    }
    if (!Array.isArray(projects)) {
      console.error("Projects data is not an array:", projects);
      return { error: "Invalid projects data format", received: projects, items: [] };
    }
    if (projects.length === 0) {
      console.log("No projects fetched from API.");
      return { items: [] };
    }
    if (!env.OPEN_TRANSLATE === "true") {
      console.warn("Skipping paper translations.");
      return projects.map((p) => ({ ...p, description_zh: p.description || "" }));
    }
    const descriptionsToTranslate = projects.map((p) => p.description || "").filter((desc) => typeof desc === "string");
    const nonEmptyDescriptions = descriptionsToTranslate.filter((d) => d.trim() !== "");
    if (nonEmptyDescriptions.length === 0) {
      console.log("No non-empty project descriptions to translate.");
      return projects.map((p) => ({ ...p, description_zh: p.description || "" }));
    }
    const promptText = `Translate the following English project descriptions to Chinese.
Provide the translations as a JSON array of strings, in the exact same order as the input.
Each string in the output array must correspond to the string at the same index in the input array.
If an input description is an empty string, the corresponding translated string in the output array should also be an empty string.
Input Descriptions (JSON array of strings):
${JSON.stringify(descriptionsToTranslate)}
Respond ONLY with the JSON array of Chinese translations. Do not include any other text or explanations.
JSON Array of Chinese Translations:`;
    let translatedTexts = [];
    try {
      console.log(`Requesting translation for ${descriptionsToTranslate.length} project descriptions.`);
      const chatResponse = await callChatAPI(env, promptText);
      const parsedTranslations = JSON.parse(removeMarkdownCodeBlock(chatResponse));
      if (parsedTranslations && Array.isArray(parsedTranslations) && parsedTranslations.length === descriptionsToTranslate.length) {
        translatedTexts = parsedTranslations;
      } else {
        console.warn(`Translation count mismatch or parsing error for project descriptions. Expected ${descriptionsToTranslate.length}, received ${parsedTranslations ? parsedTranslations.length : "null"}. Falling back.`);
        translatedTexts = descriptionsToTranslate.map(() => null);
      }
    } catch (translationError) {
      console.error("Failed to translate project descriptions in batch:", translationError.message);
      translatedTexts = descriptionsToTranslate.map(() => null);
    }
    return projects.map((project, index) => {
      const translated = translatedTexts[index];
      return {
        ...project,
        description_zh: typeof translated === "string" ? translated : project.description || ""
      };
    });
  }, "fetch"),
  transform: /* @__PURE__ */ __name((projectsData, sourceType) => {
    const unifiedProjects = [];
    const now = getISODate();
    if (Array.isArray(projectsData)) {
      projectsData.forEach((project, index) => {
        unifiedProjects.push({
          id: index + 1,
          // Use project.url as ID if available
          type: sourceType,
          url: project.url,
          title: project.name,
          description: project.description_zh || project.description || "",
          published_date: now,
          // Projects don't have a published date, use current date
          authors: project.owner ? [project.owner] : [],
          source: "GitHub Trending",
          details: {
            owner: project.owner,
            name: project.name,
            language: project.language,
            languageColor: project.languageColor,
            totalStars: project.totalStars,
            forks: project.forks,
            starsToday: project.starsToday,
            builtBy: project.builtBy || []
          }
        });
      });
    }
    return unifiedProjects;
  }, "transform"),
  generateHtml: /* @__PURE__ */ __name((item) => {
    return `
            <strong>${escapeHtml(item.title)}</strong> (\u6240\u6709\u8005: ${escapeHtml(item.details.owner)})<br>
            <small>\u661F\u6807: ${escapeHtml(item.details.totalStars)} (\u4ECA\u65E5: ${escapeHtml(item.details.starsToday)}) | \u8BED\u8A00: ${escapeHtml(item.details.language || "N/A")}</small>
            \u63CF\u8FF0: ${escapeHtml(item.description) || "N/A"}<br>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">\u5728 GitHub \u4E0A\u67E5\u770B</a>
        `;
  }, "generateHtml")
};
var github_trending_default = ProjectsDataSource;

// src/dataSources/papers.js
var PapersDataSource = {
  type: "papers",
  async fetch(env, foloCookie) {
    const hgPapersListId = env.HGPAPERS_LIST_ID;
    const fetchPages = parseInt(env.HGPAPERS_FETCH_PAGES || "1", 10);
    const allPaperItems = [];
    const filterDays = parseInt(env.FOLO_FILTER_DAYS || "3", 10);
    if (!hgPapersListId) {
      console.warn("HGPAPERS_LIST_ID is not set in environment variables. Skipping papers fetch.");
      return {
        version: "https://jsonfeed.org/version/1.1",
        title: "Aggregated Papers",
        home_page_url: "https://example.com/papers",
        description: "Aggregated papers from various sources",
        language: "zh-cn",
        items: []
      };
    }
    let publishedAfter = null;
    for (let i = 0; i < fetchPages; i++) {
      const userAgent = getRandomUserAgent();
      const headers = {
        "User-Agent": userAgent,
        "Content-Type": "application/json",
        "accept": "application/json",
        "accept-language": "zh-CN,zh;q=0.9",
        "baggage": "sentry-environment=stable,sentry-release=5251fa921ef6cbb6df0ac4271c41c2b4a0ce7c50,sentry-public_key=e5bccf7428aa4e881ed5cb713fdff181,sentry-trace_id=2da50ca5ad944cb794670097d876ada8,sentry-sampled=true,sentry-sample_rand=0.06211835167903246,sentry-sample_rate=1",
        "origin": "https://app.follow.is",
        "priority": "u=1, i",
        "sec-ch-ua": '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-app-name": "Folo Web",
        "x-app-version": "0.4.9"
      };
      if (foloCookie) {
        headers["Cookie"] = foloCookie;
      }
      const body = {
        listId: hgPapersListId,
        view: 1,
        withContent: true
      };
      if (publishedAfter) {
        body.publishedAfter = publishedAfter;
      }
      try {
        console.log(`Fetching Papers data, page ${i + 1}...`);
        const response = await fetch(env.FOLO_DATA_API, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          console.error(`Failed to fetch Papers data, page ${i + 1}: ${response.statusText}`);
          break;
        }
        const data = await response.json();
        if (data && data.data && data.data.length > 0) {
          const filteredItems = data.data.filter((entry) => isDateWithinLastDays(entry.entries.publishedAt, filterDays));
          allPaperItems.push(...filteredItems.map((entry) => ({
            id: entry.entries.id,
            url: entry.entries.url,
            title: entry.entries.title,
            content_html: entry.entries.content,
            date_published: entry.entries.publishedAt,
            authors: [{ name: entry.entries.author }],
            source: entry.feeds.title
          })));
          publishedAfter = data.data[data.data.length - 1].entries.publishedAt;
        } else {
          console.log(`No more data for Papers, page ${i + 1}.`);
          break;
        }
      } catch (error) {
        console.error(`Error fetching Papers data, page ${i + 1}:`, error);
        break;
      }
      await sleep(Math.random() * 5e3);
    }
    return {
      version: "https://jsonfeed.org/version/1.1",
      title: "Aggregated Papers",
      home_page_url: "https://example.com/papers",
      description: "Aggregated papers from various sources",
      language: "zh-cn",
      items: allPaperItems
    };
  },
  transform(rawData, sourceType) {
    if (!rawData || !rawData.items) {
      return [];
    }
    return rawData.items.map((item) => ({
      id: item.id,
      type: sourceType,
      url: item.url,
      title: item.title,
      description: stripHtml(item.content_html || ""),
      published_date: item.date_published,
      authors: item.authors ? item.authors.map((author) => author.name).join(", ") : "Unknown",
      source: item.source || "Aggregated Papers",
      details: {
        content_html: item.content_html || ""
      }
    }));
  },
  generateHtml: /* @__PURE__ */ __name((item) => {
    return `
            <strong>${escapeHtml(item.title)}</strong><br>
            <small>\u6765\u6E90: ${escapeHtml(item.source || "\u672A\u77E5")} | \u53D1\u5E03\u65E5\u671F: ${formatDateToChineseWithTime(item.published_date)}</small>
            <div class="content-html">
                 ${item.details.content_html || "\u65E0\u5185\u5BB9\u3002"}<hr>
            </div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">\u5728 ArXiv/\u6765\u6E90 \u9605\u8BFB</a>
        `;
  }, "generateHtml")
};
var papers_default = PapersDataSource;

// src/dataSources/huggingface-papers.js
var PapersDataSource2 = {
  fetch: /* @__PURE__ */ __name(async (env, foloCookie) => {
    const feedId = env.HGPAPERS_FEED_ID;
    const fetchPages = parseInt(env.HGPAPERS_FETCH_PAGES || "3", 10);
    const allPapersItems = [];
    const filterDays = parseInt(env.FOLO_FILTER_DAYS || "3", 10);
    if (!feedId) {
      console.error("HGPAPERS_FEED_ID is not set in environment variables.");
      return {
        version: "https://jsonfeed.org/version/1.1",
        title: "Huggingface Daily Papers Feeds",
        home_page_url: "https://huggingface.co/papers",
        description: "Aggregated Huggingface Daily Papers feeds",
        language: "zh-cn",
        items: []
      };
    }
    let publishedAfter = null;
    for (let i = 0; i < fetchPages; i++) {
      const userAgent = getRandomUserAgent();
      const headers = {
        "User-Agent": userAgent,
        "Content-Type": "application/json",
        "accept": "application/json",
        "accept-language": "zh-CN,zh;q=0.9",
        "baggage": "sentry-environment=stable,sentry-release=5251fa921ef6cbb6df0ac4271c41c2b4a0ce7c50,sentry-public_key=e5bccf7428aa4e881ed5cb713fdff181,sentry-trace_id=2da50ca5ad944cb794670097d876ada8,sentry-sampled=true,sentry-sample_rand=0.06211835167903246,sentry-sample_rate=1",
        "origin": "https://app.follow.is",
        "priority": "u=1, i",
        "sec-ch-ua": '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-app-name": "Folo Web",
        "x-app-version": "0.4.9"
      };
      if (foloCookie) {
        headers["Cookie"] = foloCookie;
      }
      const body = {
        feedId,
        view: 1,
        withContent: true
      };
      if (publishedAfter) {
        body.publishedAfter = publishedAfter;
      }
      try {
        console.log(`Fetching Huggingface Papers data, page ${i + 1}...`);
        const response = await fetch(env.FOLO_DATA_API, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          console.error(`Failed to fetch Huggingface Papers data, page ${i + 1}: ${response.statusText}`);
          break;
        }
        const data = await response.json();
        if (data && data.data && data.data.length > 0) {
          const filteredItems = data.data.filter((entry) => isDateWithinLastDays(entry.entries.publishedAt, filterDays));
          allPapersItems.push(...filteredItems.map((entry) => ({
            id: entry.entries.id,
            url: entry.entries.url,
            title: entry.entries.title,
            content_html: entry.entries.content,
            date_published: entry.entries.publishedAt,
            authors: [{ name: entry.entries.author }],
            source: `huggingface-papers`
          })));
          publishedAfter = data.data[data.data.length - 1].entries.publishedAt;
        } else {
          console.log(`No more data for Huggingface Papers, page ${i + 1}.`);
          break;
        }
      } catch (error) {
        console.error(`Error fetching Huggingface Papers data, page ${i + 1}:`, error);
        break;
      }
      await sleep(Math.random() * 5e3);
    }
    const papersData = {
      version: "https://jsonfeed.org/version/1.1",
      title: "Huggingface Daily Papers Feeds",
      home_page_url: "https://huggingface.co/papers",
      description: "Aggregated Huggingface Daily Papers feeds",
      language: "zh-cn",
      items: allPapersItems
    };
    if (papersData.items.length === 0) {
      console.log("No hgpapers found for today or after filtering.");
      return papersData;
    }
    if (!env.OPEN_TRANSLATE === "true") {
      console.warn("Skipping hgpapers translations.");
      papersData.items = papersData.items.map((item) => ({
        ...item,
        title_zh: item.title || "",
        content_html_zh: item.content_html || ""
      }));
      return papersData;
    }
    const itemsToTranslate = papersData.items.map((item, index) => ({
      id: index,
      original_title: item.title || ""
    }));
    const hasContentToTranslate = itemsToTranslate.some((item) => item.original_title.trim() !== "");
    if (!hasContentToTranslate) {
      console.log("No non-empty hgpapers titles to translate for today's papers.");
      papersData.items = papersData.items.map((item) => ({ ...item, title_zh: item.title || "", content_html_zh: item.content_html || "" }));
      return papersData;
    }
    const promptText = `You will be given a JSON array of paper data objects. Each object has an "id" and "original_title".
Translate "original_title" into Chinese.
Return a JSON array of objects. Each output object MUST have:
- "id": The same id from the input.
- "title_zh": Chinese translation of "original_title". Empty if original is empty.
Input: ${JSON.stringify(itemsToTranslate)}
Respond ONLY with the JSON array.`;
    let translatedItemsMap = /* @__PURE__ */ new Map();
    try {
      console.log(`Requesting translation for ${itemsToTranslate.length} hgpapers titles for today.`);
      const chatResponse = await callChatAPI(env, promptText);
      const parsedTranslations = JSON.parse(removeMarkdownCodeBlock(chatResponse));
      if (parsedTranslations) {
        parsedTranslations.forEach((translatedItem) => {
          if (translatedItem && typeof translatedItem.id === "number" && typeof translatedItem.title_zh === "string") {
            translatedItemsMap.set(translatedItem.id, translatedItem);
          }
        });
      }
    } catch (translationError) {
      console.error("Failed to translate hgpapers titles in batch:", translationError.message);
    }
    papersData.items = papersData.items.map((originalItem, index) => {
      const translatedData = translatedItemsMap.get(index);
      return {
        ...originalItem,
        title_zh: translatedData ? translatedData.title_zh : originalItem.title || ""
      };
    });
    return papersData;
  }, "fetch"),
  transform: /* @__PURE__ */ __name((papersData, sourceType) => {
    const unifiedPapers = [];
    if (papersData && Array.isArray(papersData.items)) {
      papersData.items.forEach((item, index) => {
        unifiedPapers.push({
          id: item.id,
          // Use item.id from Folo data
          type: sourceType,
          url: item.url,
          title: item.title_zh || item.title,
          description: stripHtml(item.content_html || ""),
          published_date: item.date_published,
          authors: typeof item.authors === "string" ? item.authors.split(",").map((s) => s.trim()) : item.authors ? item.authors.map((a) => a.name) : [],
          source: item.source || "Huggingface Papers",
          // Use existing source or default
          details: {
            content_html: item.content_html || ""
          }
        });
      });
    }
    return unifiedPapers;
  }, "transform"),
  generateHtml: /* @__PURE__ */ __name((item) => {
    return `
            <strong>${escapeHtml(item.title)}</strong><br>
            <small>\u6765\u6E90: ${escapeHtml(item.source || "\u672A\u77E5")} | \u53D1\u5E03\u65E5\u671F: ${formatDateToChineseWithTime(item.published_date)}</small>
            <div class="content-html">
                 ${item.details.content_html || "\u65E0\u5185\u5BB9\u3002"}<hr>
            </div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">\u5728 ArXiv/\u6765\u6E90 \u9605\u8BFB</a>
        `;
  }, "generateHtml")
};
var huggingface_papers_default = PapersDataSource2;

// src/dataSources/twitter.js
var TwitterDataSource = {
  async fetch(env, foloCookie) {
    const listId = env.TWITTER_LIST_ID;
    const fetchPages = parseInt(env.TWITTER_FETCH_PAGES || "3", 10);
    const allTwitterItems = [];
    const filterDays = parseInt(env.FOLO_FILTER_DAYS || "3", 10);
    if (!listId) {
      console.error("TWITTER_LIST_ID is not set in environment variables.");
      return {
        version: "https://jsonfeed.org/version/1.1",
        title: "Twitter Feeds",
        home_page_url: "https://x.com/",
        description: "Aggregated Twitter feeds from various users",
        language: "zh-cn",
        items: []
      };
    }
    let publishedAfter = null;
    for (let i = 0; i < fetchPages; i++) {
      const userAgent = getRandomUserAgent();
      const headers = {
        "User-Agent": userAgent,
        "Content-Type": "application/json",
        "accept": "application/json",
        "accept-language": "zh-CN,zh;q=0.9",
        "baggage": "sentry-environment=stable,sentry-release=5251fa921ef6cbb6df0ac4271c41c2b4a0ce7c50,sentry-public_key=e5bccf7428aa4e881ed5cb713fdff181,sentry-trace_id=2da50ca5ad944cb794670097d876ada8,sentry-sampled=true,sentry-sample_rand=0.06211835167903246,sentry-sample_rate=1",
        "origin": "https://app.follow.is",
        "priority": "u=1, i",
        "sec-ch-ua": '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-app-name": "Folo Web",
        "x-app-version": "0.4.9"
      };
      if (foloCookie) {
        headers["Cookie"] = foloCookie;
      }
      const body = {
        listId,
        view: 1,
        withContent: true
      };
      if (publishedAfter) {
        body.publishedAfter = publishedAfter;
      }
      try {
        console.log(`Fetching Twitter data, page ${i + 1}...`);
        const response = await fetch(env.FOLO_DATA_API, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          console.error(`Failed to fetch Twitter data, page ${i + 1}: ${response.statusText}`);
          break;
        }
        const data = await response.json();
        if (data && data.data && data.data.length > 0) {
          const filteredItems = data.data.filter((entry) => isDateWithinLastDays(entry.entries.publishedAt, filterDays));
          allTwitterItems.push(...filteredItems.map((entry) => ({
            id: entry.entries.id,
            url: entry.entries.url,
            title: entry.entries.title,
            content_html: entry.entries.content,
            date_published: entry.entries.publishedAt,
            authors: [{ name: entry.entries.author }],
            source: entry.feeds.title && entry.feeds.title.startsWith("Twitter") ? `twitter-${entry.entries.author}` : `${entry.feeds.title} - ${entry.entries.author}`
          })));
          publishedAfter = data.data[data.data.length - 1].entries.publishedAt;
        } else {
          console.log(`No more data for Twitter, page ${i + 1}.`);
          break;
        }
      } catch (error) {
        console.error(`Error fetching Twitter data, page ${i + 1}:`, error);
        break;
      }
      await sleep(Math.random() * 5e3);
    }
    return {
      version: "https://jsonfeed.org/version/1.1",
      title: "Twitter Feeds",
      home_page_url: "https://x.com/",
      description: "Aggregated Twitter feeds from various users",
      language: "zh-cn",
      items: allTwitterItems
    };
  },
  transform(rawData, sourceType) {
    if (!rawData || !rawData.items) {
      return [];
    }
    return rawData.items.map((item) => ({
      id: item.id,
      type: sourceType,
      url: item.url,
      title: item.title,
      description: stripHtml(item.content_html || ""),
      published_date: item.date_published,
      authors: item.authors ? item.authors.map((author) => author.name).join(", ") : "Unknown",
      source: item.source || "twitter",
      // Use existing source or default
      details: {
        content_html: item.content_html || ""
      }
    }));
  },
  generateHtml: /* @__PURE__ */ __name((item) => {
    return `
            <strong>${escapeHtml(item.title)}</strong><br>
            <small>\u6765\u6E90: ${escapeHtml(item.source || "\u672A\u77E5")} | \u53D1\u5E03\u65E5\u671F: ${formatDateToChineseWithTime(item.published_date)}</small>
            <div class="content-html">
                ${item.details.content_html || "\u65E0\u5185\u5BB9\u3002"}
            </div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">\u67E5\u770B\u63A8\u6587</a>
        `;
  }, "generateHtml")
};
var twitter_default = TwitterDataSource;

// src/dataSources/reddit.js
var RedditDataSource = {
  async fetch(env, foloCookie) {
    const listId = env.REDDIT_LIST_ID;
    const fetchPages = parseInt(env.REDDIT_FETCH_PAGES || "3", 10);
    const allRedditItems = [];
    const filterDays = parseInt(env.FOLO_FILTER_DAYS || "3", 10);
    if (!listId) {
      console.error("REDDIT_LIST_ID is not set in environment variables.");
      return {
        version: "https://jsonfeed.org/version/1.1",
        title: "Reddit Feeds",
        home_page_url: "https://www.reddit.com/",
        description: "Aggregated Reddit feeds from various subreddits/users",
        language: "zh-cn",
        items: []
      };
    }
    let publishedAfter = null;
    for (let i = 0; i < fetchPages; i++) {
      const userAgent = getRandomUserAgent();
      const headers = {
        "User-Agent": userAgent,
        "Content-Type": "application/json",
        "accept": "application/json",
        "accept-language": "zh-CN,zh;q=0.9",
        "baggage": "sentry-environment=stable,sentry-release=5251fa921ef6cbb6df0ac4271c41c2b4a0ce7c50,sentry-public_key=e5bccf7428aa4e881ed5cb713fdff181,sentry-trace_id=2da50ca5ad944cb794670097d876ada8,sentry-sampled=true,sentry-sample_rand=0.06211835167903246,sentry-sample_rate=1",
        "origin": "https://app.follow.is",
        "priority": "u=1, i",
        "sec-ch-ua": '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-app-name": "Folo Web",
        "x-app-version": "0.4.9"
      };
      if (foloCookie) {
        headers["Cookie"] = foloCookie;
      }
      const body = {
        listId,
        view: 1,
        withContent: true
      };
      if (publishedAfter) {
        body.publishedAfter = publishedAfter;
      }
      try {
        console.log(`Fetching Reddit data, page ${i + 1}...`);
        const response = await fetch(env.FOLO_DATA_API, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          console.error(`Failed to fetch Reddit data, page ${i + 1}: ${response.statusText}`);
          break;
        }
        const data = await response.json();
        if (data && data.data && data.data.length > 0) {
          const filteredItems = data.data.filter((entry) => isDateWithinLastDays(entry.entries.publishedAt, filterDays));
          allRedditItems.push(...filteredItems.map((entry) => ({
            id: entry.entries.id,
            url: entry.entries.url,
            title: entry.entries.title,
            content_html: entry.entries.content,
            date_published: entry.entries.publishedAt,
            authors: [{ name: entry.entries.author }],
            source: `${entry.feeds.title}`
          })));
          publishedAfter = data.data[data.data.length - 1].entries.publishedAt;
        } else {
          console.log(`No more data for Reddit, page ${i + 1}.`);
          break;
        }
      } catch (error) {
        console.error(`Error fetching Reddit data, page ${i + 1}:`, error);
        break;
      }
      await sleep(Math.random() * 5e3);
    }
    const redditData = {
      version: "https://jsonfeed.org/version/1.1",
      title: "Reddit Feeds",
      home_page_url: "https://www.reddit.com/",
      description: "Aggregated Reddit feeds from various subreddits/users",
      language: "zh-cn",
      items: allRedditItems
    };
    if (redditData.items.length === 0) {
      console.log("No reddit posts found for today or after filtering.");
      return redditData;
    }
    redditData.items = redditData.items.map((item) => ({
      ...item,
      title_zh: item.title || ""
    }));
    return redditData;
  },
  transform(rawData, sourceType) {
    if (!rawData || !rawData.items) {
      return [];
    }
    return rawData.items.map((item) => ({
      id: item.id,
      type: sourceType,
      url: item.url,
      title: item.title,
      description: stripHtml(item.content_html || ""),
      published_date: item.date_published,
      authors: item.authors ? item.authors.map((author) => author.name).join(", ") : "Unknown",
      source: item.source || "reddit",
      details: {
        content_html: item.content_html || ""
      }
    }));
  },
  generateHtml: /* @__PURE__ */ __name((item) => {
    return `
            <strong>${escapeHtml(item.title)}</strong><br>
            <small>\u6765\u6E90: ${escapeHtml(item.source || "\u672A\u77E5")} | \u53D1\u5E03\u65E5\u671F: ${formatDateToChineseWithTime(item.published_date)}</small>
            <div class="content-html">
                ${item.details.content_html || "\u65E0\u5185\u5BB9\u3002"}
            </div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">\u67E5\u770B Reddit \u5E16\u5B50</a>
        `;
  }, "generateHtml")
};
var reddit_default = RedditDataSource;

// src/dataFetchers.js
var dataSources = {
  // news 下支持多个可选 Folo feed/list 源：只要在环境变量中配置对应 *_FEED_ID 或 LIST_ID 即可自动生效
  news: { name: "\u65B0\u95FB", sources: [newsAggregator_default, folo_multi_feeds_default, aibase_default, jiqizhixin_default, qbit_default, xinzhiyuan_default, xiaohu_default] },
  project: { name: "\u9879\u76EE", sources: [github_trending_default] },
  paper: { name: "\u8BBA\u6587", sources: [papers_default, huggingface_papers_default] },
  socialMedia: { name: "\u793E\u4EA4\u5E73\u53F0", sources: [twitter_default, reddit_default] }
  // Add new data sources here as arrays, e.g.,
  // newType: { name: '新类型', sources: [NewTypeDataSource1, NewTypeDataSource2] },
};
async function fetchAndTransformDataForType(sourceType, env, foloCookie) {
  const sources = dataSources[sourceType].sources;
  if (!sources || !Array.isArray(sources)) {
    console.error(`No data sources registered for type: ${sourceType}`);
    return [];
  }
  let allUnifiedDataForType = [];
  for (const dataSource of sources) {
    try {
      const rawData = await dataSource.fetch(env, foloCookie);
      const unifiedData = dataSource.transform(rawData, sourceType);
      allUnifiedDataForType = allUnifiedDataForType.concat(unifiedData);
    } catch (error) {
      console.error(`Error fetching or transforming data from source ${dataSource.type} for type ${sourceType}:`, error.message);
    }
  }
  allUnifiedDataForType.sort((a, b) => {
    const dateA = new Date(a.published_date);
    const dateB = new Date(b.published_date);
    return dateB.getTime() - dateA.getTime();
  });
  const typeCapKey = `MAX_ITEMS_${sourceType.toUpperCase()}`;
  const maxItems = parseInt(env[typeCapKey] || env.MAX_ITEMS_PER_TYPE || "30", 10);
  if (Number.isFinite(maxItems) && maxItems > 0 && allUnifiedDataForType.length > maxItems) {
    console.log(`Capping ${sourceType} items from ${allUnifiedDataForType.length} to ${maxItems}.`);
    allUnifiedDataForType = allUnifiedDataForType.slice(0, maxItems);
  }
  return allUnifiedDataForType;
}
__name(fetchAndTransformDataForType, "fetchAndTransformDataForType");
async function fetchAllData(env, foloCookie) {
  const allUnifiedData = {};
  const fetchPromises = [];
  for (const sourceType in dataSources) {
    if (Object.hasOwnProperty.call(dataSources, sourceType)) {
      fetchPromises.push(
        fetchAndTransformDataForType(sourceType, env, foloCookie).then((data) => {
          allUnifiedData[sourceType] = data;
        })
      );
    }
  }
  await Promise.allSettled(fetchPromises);
  return allUnifiedData;
}
__name(fetchAllData, "fetchAllData");
async function fetchDataByCategory(env, category, foloCookie) {
  if (!dataSources[category]) {
    console.warn(`Attempted to fetch data for unknown category: ${category}`);
    return [];
  }
  return await fetchAndTransformDataForType(category, env, foloCookie);
}
__name(fetchDataByCategory, "fetchDataByCategory");

// src/kv.js
async function storeInKV(kvNamespace, key, value, expirationTtl = 86400 * 7) {
  console.log(`Storing data in KV with key: ${key}`);
  await kvNamespace.put(key, JSON.stringify(value), { expirationTtl });
}
__name(storeInKV, "storeInKV");
async function getFromKV(kvNamespace, key) {
  console.log(`Retrieving data from KV with key: ${key}`);
  const value = await kvNamespace.get(key);
  return value ? JSON.parse(value) : null;
}
__name(getFromKV, "getFromKV");

// src/handlers/writeData.js
async function handleWriteData(request, env) {
  const dateParam = getFetchDate();
  const todayStr = getISODate();
  const dateStr = dateParam && dateParam !== "1970-01-01" ? dateParam : todayStr;
  setFetchDate(dateStr);
  console.log(`Starting /writeData process for date: ${dateStr}`);
  let category = null;
  let foloCookie = null;
  try {
    if (request.headers.get("Content-Type")?.includes("application/json")) {
      const requestBody = await request.json();
      category = requestBody.category;
      foloCookie = requestBody.foloCookie;
    }
    if (foloCookie && env.FOLO_COOKIE_KV_KEY) {
      try {
        await storeInKV(env.DATA_KV, env.FOLO_COOKIE_KV_KEY, foloCookie, 86400 * 30);
        console.log(`Saved Folo cookie to KV with key: ${env.FOLO_COOKIE_KV_KEY}`);
      } catch (err) {
        console.warn(`Failed to save Folo cookie to KV: ${err.message}`);
      }
    }
    console.log(`Starting /writeData process for category: ${category || "all"} with foloCookie presence: ${!!foloCookie}`);
    let dataToStore = {};
    let fetchPromises = [];
    let successMessage = "";
    if (category) {
      const fetchedData = await fetchDataByCategory(env, category, foloCookie);
      dataToStore[category] = fetchedData;
      fetchPromises.push(storeInKV(env.DATA_KV, `${dateStr}-${category}`, fetchedData));
      successMessage = `Data for category '${category}' fetched and stored.`;
      console.log(`Transformed ${category}: ${fetchedData.length} items.`);
    } else {
      const allUnifiedData = await fetchAllData(env, foloCookie);
      for (const sourceType in dataSources) {
        if (Object.hasOwnProperty.call(dataSources, sourceType)) {
          dataToStore[sourceType] = allUnifiedData[sourceType] || [];
          fetchPromises.push(storeInKV(env.DATA_KV, `${dateStr}-${sourceType}`, dataToStore[sourceType]));
          console.log(`Transformed ${sourceType}: ${dataToStore[sourceType].length} items.`);
        }
      }
      successMessage = `All data categories fetched and stored.`;
    }
    await Promise.all(fetchPromises);
    const errors = [];
    if (errors.length > 0) {
      console.warn("/writeData completed with errors:", errors);
      return new Response(JSON.stringify({
        success: false,
        message: `${successMessage} Some errors occurred.`,
        errors,
        ...Object.fromEntries(Object.entries(dataToStore).map(([key, value]) => [`${key}ItemCount`, value.length]))
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      console.log("/writeData process completed successfully.");
      return new Response(JSON.stringify({
        success: true,
        message: successMessage,
        ...Object.fromEntries(Object.entries(dataToStore).map(([key, value]) => [`${key}ItemCount`, value.length]))
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    console.error("Unhandled error in /writeData:", error);
    return new Response(JSON.stringify({ success: false, message: "An unhandled error occurred during data processing.", error: error.message, details: error.stack }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleWriteData, "handleWriteData");

// src/handlers/getContent.js
async function handleGetContent(request, env) {
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const dateStr = dateParam ? dateParam : getISODate();
  console.log(`Getting content for date: ${dateStr}`);
  try {
    const responseData = {
      date: dateStr,
      message: `Successfully retrieved data for ${dateStr}.`
    };
    const fetchPromises = [];
    for (const sourceType in dataSources) {
      if (Object.hasOwnProperty.call(dataSources, sourceType)) {
        fetchPromises.push(
          getFromKV(env.DATA_KV, `${dateStr}-${sourceType}`).then((data) => {
            responseData[sourceType] = data || [];
          })
        );
      }
    }
    await Promise.allSettled(fetchPromises);
    return new Response(JSON.stringify(responseData), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in /getContent:", error);
    return new Response(JSON.stringify({ success: false, message: "Failed to get content.", error: error.message, date: dateStr }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleGetContent, "handleGetContent");

// src/marked.esm.js
function _getDefaults() {
  return {
    async: false,
    breaks: false,
    extensions: null,
    gfm: true,
    hooks: null,
    pedantic: false,
    renderer: null,
    silent: false,
    tokenizer: null,
    walkTokens: null
  };
}
__name(_getDefaults, "_getDefaults");
var _defaults = _getDefaults();
function changeDefaults(newDefaults) {
  _defaults = newDefaults;
}
__name(changeDefaults, "changeDefaults");
var noopTest = { exec: /* @__PURE__ */ __name(() => null, "exec") };
function edit(regex, opt = "") {
  let source = typeof regex === "string" ? regex : regex.source;
  const obj = {
    replace: /* @__PURE__ */ __name((name, val) => {
      let valSource = typeof val === "string" ? val : val.source;
      valSource = valSource.replace(other.caret, "$1");
      source = source.replace(name, valSource);
      return obj;
    }, "replace"),
    getRegex: /* @__PURE__ */ __name(() => {
      return new RegExp(source, opt);
    }, "getRegex")
  };
  return obj;
}
__name(edit, "edit");
var other = {
  codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
  outputLinkReplace: /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  blockquoteStart: /^ {0,3}>/,
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  listReplaceTabs: /^\t+/,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\] /,
  listReplaceTask: /^\[[ xX]\] +/,
  anyLine: /\n.*\n/,
  hrefBrackets: /^<(.*)>$/,
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  escapeTest: /[&<>"']/,
  escapeReplace: /[&<>"']/g,
  escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,
  caret: /(^|[^\[])\^/g,
  percentDecode: /%25/g,
  findPipe: /\|/g,
  splitPipe: / \|/,
  slashPipe: /\\\|/g,
  carriageReturn: /\r\n|\r/g,
  spaceLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  listItemRegex: /* @__PURE__ */ __name((bull) => new RegExp(`^( {0,3}${bull})((?:[	 ][^\\n]*)?(?:\\n|$))`), "listItemRegex"),
  nextBulletRegex: /* @__PURE__ */ __name((indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`), "nextBulletRegex"),
  hrRegex: /* @__PURE__ */ __name((indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`), "hrRegex"),
  fencesBeginRegex: /* @__PURE__ */ __name((indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`), "fencesBeginRegex"),
  headingBeginRegex: /* @__PURE__ */ __name((indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`), "headingBeginRegex"),
  htmlBeginRegex: /* @__PURE__ */ __name((indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, "i"), "htmlBeginRegex")
};
var newline = /^(?:[ \t]*(?:\n|$))+/;
var blockCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var bullet = /(?:[*+-]|\d{1,9}[.)])/;
var lheadingCore = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var lheading = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var lheadingGfm = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var blockText = /^[^\n]+/;
var _blockLabel = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
var def = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", _blockLabel).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var list = edit(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, bullet).getRegex();
var _tag = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var html = edit(
  "^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))",
  "i"
).replace("comment", _comment).replace("tag", _tag).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var paragraph = edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", paragraph).getRegex();
var blockNormal = {
  blockquote,
  code: blockCode,
  def,
  fences,
  heading,
  hr,
  html,
  lheading,
  list,
  newline,
  paragraph,
  table: noopTest,
  text: blockText
};
var gfmTable = edit(
  "^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)"
).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockGfm = {
  ...blockNormal,
  lheading: lheadingGfm,
  table: gfmTable,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", gfmTable).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex()
};
var blockPedantic = {
  ...blockNormal,
  html: edit(
    `^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`
  ).replace("comment", _comment).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
  heading: /^(#{1,6})(.*)(?:\n+|$)/,
  fences: noopTest,
  // fences not supported
  lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " *#{1,6} *[^\n]").replace("lheading", lheading).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
};
var escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var br = /^( {2,}|\\)\n(?!\s*$)/;
var inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var _punctuation = /[\p{P}\p{S}]/u;
var _punctuationOrSpace = /[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpace = /[^\s\p{P}\p{S}]/u;
var punctuation = edit(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, _punctuationOrSpace).getRegex();
var _punctuationGfmStrongEm = /(?!~)[\p{P}\p{S}]/u;
var _punctuationOrSpaceGfmStrongEm = /(?!~)[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpaceGfmStrongEm = /(?:[^\s\p{P}\p{S}]|~)/u;
var blockSkip = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g;
var emStrongLDelimCore = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
var emStrongLDelim = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuation).getRegex();
var emStrongLDelimGfm = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimAstCore = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var emStrongRDelimAst = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var emStrongRDelimAstGfm = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpaceGfmStrongEm).replace(/punctSpace/g, _punctuationOrSpaceGfmStrongEm).replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimUnd = edit(
  "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)",
  "gu"
).replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var anyPunctuation = edit(/\\(punct)/, "gu").replace(/punct/g, _punctuation).getRegex();
var autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var _inlineComment = edit(_comment).replace("(?:-->|$)", "-->").getRegex();
var tag = edit(
  "^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>"
).replace("comment", _inlineComment).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var _inlineLabel = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
var link = edit(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label", _inlineLabel).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var reflink = edit(/^!?\[(label)\]\[(ref)\]/).replace("label", _inlineLabel).replace("ref", _blockLabel).getRegex();
var nolink = edit(/^!?\[(ref)\](?:\[\])?/).replace("ref", _blockLabel).getRegex();
var reflinkSearch = edit("reflink|nolink(?!\\()", "g").replace("reflink", reflink).replace("nolink", nolink).getRegex();
var inlineNormal = {
  _backpedal: noopTest,
  // only used for GFM url
  anyPunctuation,
  autolink,
  blockSkip,
  br,
  code: inlineCode,
  del: noopTest,
  emStrongLDelim,
  emStrongRDelimAst,
  emStrongRDelimUnd,
  escape,
  link,
  nolink,
  punctuation,
  reflink,
  reflinkSearch,
  tag,
  text: inlineText,
  url: noopTest
};
var inlinePedantic = {
  ...inlineNormal,
  link: edit(/^!?\[(label)\]\((.*?)\)/).replace("label", _inlineLabel).getRegex(),
  reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", _inlineLabel).getRegex()
};
var inlineGfm = {
  ...inlineNormal,
  emStrongRDelimAst: emStrongRDelimAstGfm,
  emStrongLDelim: emStrongLDelimGfm,
  url: edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i").replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
  text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
};
var inlineBreaks = {
  ...inlineGfm,
  br: edit(br).replace("{2,}", "*").getRegex(),
  text: edit(inlineGfm.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
};
var block = {
  normal: blockNormal,
  gfm: blockGfm,
  pedantic: blockPedantic
};
var inline = {
  normal: inlineNormal,
  gfm: inlineGfm,
  breaks: inlineBreaks,
  pedantic: inlinePedantic
};
var escapeReplacements = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
var getEscapeReplacement = /* @__PURE__ */ __name((ch) => escapeReplacements[ch], "getEscapeReplacement");
function escape2(html2, encode) {
  if (encode) {
    if (other.escapeTest.test(html2)) {
      return html2.replace(other.escapeReplace, getEscapeReplacement);
    }
  } else {
    if (other.escapeTestNoEncode.test(html2)) {
      return html2.replace(other.escapeReplaceNoEncode, getEscapeReplacement);
    }
  }
  return html2;
}
__name(escape2, "escape2");
function cleanUrl(href) {
  try {
    href = encodeURI(href).replace(other.percentDecode, "%");
  } catch {
    return null;
  }
  return href;
}
__name(cleanUrl, "cleanUrl");
function splitCells(tableRow, count) {
  const row = tableRow.replace(other.findPipe, (match, offset, str) => {
    let escaped = false;
    let curr = offset;
    while (--curr >= 0 && str[curr] === "\\") escaped = !escaped;
    if (escaped) {
      return "|";
    } else {
      return " |";
    }
  }), cells = row.split(other.splitPipe);
  let i = 0;
  if (!cells[0].trim()) {
    cells.shift();
  }
  if (cells.length > 0 && !cells.at(-1)?.trim()) {
    cells.pop();
  }
  if (count) {
    if (cells.length > count) {
      cells.splice(count);
    } else {
      while (cells.length < count) cells.push("");
    }
  }
  for (; i < cells.length; i++) {
    cells[i] = cells[i].trim().replace(other.slashPipe, "|");
  }
  return cells;
}
__name(splitCells, "splitCells");
function rtrim(str, c, invert) {
  const l = str.length;
  if (l === 0) {
    return "";
  }
  let suffLen = 0;
  while (suffLen < l) {
    const currChar = str.charAt(l - suffLen - 1);
    if (currChar === c && !invert) {
      suffLen++;
    } else if (currChar !== c && invert) {
      suffLen++;
    } else {
      break;
    }
  }
  return str.slice(0, l - suffLen);
}
__name(rtrim, "rtrim");
function findClosingBracket(str, b) {
  if (str.indexOf(b[1]) === -1) {
    return -1;
  }
  let level = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "\\") {
      i++;
    } else if (str[i] === b[0]) {
      level++;
    } else if (str[i] === b[1]) {
      level--;
      if (level < 0) {
        return i;
      }
    }
  }
  if (level > 0) {
    return -2;
  }
  return -1;
}
__name(findClosingBracket, "findClosingBracket");
function outputLink(cap, link2, raw, lexer2, rules) {
  const href = link2.href;
  const title = link2.title || null;
  const text = cap[1].replace(rules.other.outputLinkReplace, "$1");
  lexer2.state.inLink = true;
  const token = {
    type: cap[0].charAt(0) === "!" ? "image" : "link",
    raw,
    href,
    title,
    text,
    tokens: lexer2.inlineTokens(text)
  };
  lexer2.state.inLink = false;
  return token;
}
__name(outputLink, "outputLink");
function indentCodeCompensation(raw, text, rules) {
  const matchIndentToCode = raw.match(rules.other.indentCodeCompensation);
  if (matchIndentToCode === null) {
    return text;
  }
  const indentToCode = matchIndentToCode[1];
  return text.split("\n").map((node) => {
    const matchIndentInNode = node.match(rules.other.beginningSpace);
    if (matchIndentInNode === null) {
      return node;
    }
    const [indentInNode] = matchIndentInNode;
    if (indentInNode.length >= indentToCode.length) {
      return node.slice(indentToCode.length);
    }
    return node;
  }).join("\n");
}
__name(indentCodeCompensation, "indentCodeCompensation");
var _Tokenizer = class {
  static {
    __name(this, "_Tokenizer");
  }
  options;
  rules;
  // set by the lexer
  lexer;
  // set by the lexer
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  space(src) {
    const cap = this.rules.block.newline.exec(src);
    if (cap && cap[0].length > 0) {
      return {
        type: "space",
        raw: cap[0]
      };
    }
  }
  code(src) {
    const cap = this.rules.block.code.exec(src);
    if (cap) {
      const text = cap[0].replace(this.rules.other.codeRemoveIndent, "");
      return {
        type: "code",
        raw: cap[0],
        codeBlockStyle: "indented",
        text: !this.options.pedantic ? rtrim(text, "\n") : text
      };
    }
  }
  fences(src) {
    const cap = this.rules.block.fences.exec(src);
    if (cap) {
      const raw = cap[0];
      const text = indentCodeCompensation(raw, cap[3] || "", this.rules);
      return {
        type: "code",
        raw,
        lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : cap[2],
        text
      };
    }
  }
  heading(src) {
    const cap = this.rules.block.heading.exec(src);
    if (cap) {
      let text = cap[2].trim();
      if (this.rules.other.endingHash.test(text)) {
        const trimmed = rtrim(text, "#");
        if (this.options.pedantic) {
          text = trimmed.trim();
        } else if (!trimmed || this.rules.other.endingSpaceChar.test(trimmed)) {
          text = trimmed.trim();
        }
      }
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[1].length,
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  hr(src) {
    const cap = this.rules.block.hr.exec(src);
    if (cap) {
      return {
        type: "hr",
        raw: rtrim(cap[0], "\n")
      };
    }
  }
  blockquote(src) {
    const cap = this.rules.block.blockquote.exec(src);
    if (cap) {
      let lines = rtrim(cap[0], "\n").split("\n");
      let raw = "";
      let text = "";
      const tokens = [];
      while (lines.length > 0) {
        let inBlockquote = false;
        const currentLines = [];
        let i;
        for (i = 0; i < lines.length; i++) {
          if (this.rules.other.blockquoteStart.test(lines[i])) {
            currentLines.push(lines[i]);
            inBlockquote = true;
          } else if (!inBlockquote) {
            currentLines.push(lines[i]);
          } else {
            break;
          }
        }
        lines = lines.slice(i);
        const currentRaw = currentLines.join("\n");
        const currentText = currentRaw.replace(this.rules.other.blockquoteSetextReplace, "\n    $1").replace(this.rules.other.blockquoteSetextReplace2, "");
        raw = raw ? `${raw}
${currentRaw}` : currentRaw;
        text = text ? `${text}
${currentText}` : currentText;
        const top = this.lexer.state.top;
        this.lexer.state.top = true;
        this.lexer.blockTokens(currentText, tokens, true);
        this.lexer.state.top = top;
        if (lines.length === 0) {
          break;
        }
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "code") {
          break;
        } else if (lastToken?.type === "blockquote") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.blockquote(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - oldToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.text.length) + newToken.text;
          break;
        } else if (lastToken?.type === "list") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.list(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - lastToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.raw.length) + newToken.raw;
          lines = newText.substring(tokens.at(-1).raw.length).split("\n");
          continue;
        }
      }
      return {
        type: "blockquote",
        raw,
        tokens,
        text
      };
    }
  }
  list(src) {
    let cap = this.rules.block.list.exec(src);
    if (cap) {
      let bull = cap[1].trim();
      const isordered = bull.length > 1;
      const list2 = {
        type: "list",
        raw: "",
        ordered: isordered,
        start: isordered ? +bull.slice(0, -1) : "",
        loose: false,
        items: []
      };
      bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
      if (this.options.pedantic) {
        bull = isordered ? bull : "[*+-]";
      }
      const itemRegex = this.rules.other.listItemRegex(bull);
      let endsWithBlankLine = false;
      while (src) {
        let endEarly = false;
        let raw = "";
        let itemContents = "";
        if (!(cap = itemRegex.exec(src))) {
          break;
        }
        if (this.rules.block.hr.test(src)) {
          break;
        }
        raw = cap[0];
        src = src.substring(raw.length);
        let line = cap[2].split("\n", 1)[0].replace(this.rules.other.listReplaceTabs, (t) => " ".repeat(3 * t.length));
        let nextLine = src.split("\n", 1)[0];
        let blankLine = !line.trim();
        let indent = 0;
        if (this.options.pedantic) {
          indent = 2;
          itemContents = line.trimStart();
        } else if (blankLine) {
          indent = cap[1].length + 1;
        } else {
          indent = cap[2].search(this.rules.other.nonSpaceChar);
          indent = indent > 4 ? 1 : indent;
          itemContents = line.slice(indent);
          indent += cap[1].length;
        }
        if (blankLine && this.rules.other.blankLine.test(nextLine)) {
          raw += nextLine + "\n";
          src = src.substring(nextLine.length + 1);
          endEarly = true;
        }
        if (!endEarly) {
          const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
          const hrRegex = this.rules.other.hrRegex(indent);
          const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
          const headingBeginRegex = this.rules.other.headingBeginRegex(indent);
          const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
          while (src) {
            const rawLine = src.split("\n", 1)[0];
            let nextLineWithoutTabs;
            nextLine = rawLine;
            if (this.options.pedantic) {
              nextLine = nextLine.replace(this.rules.other.listReplaceNesting, "  ");
              nextLineWithoutTabs = nextLine;
            } else {
              nextLineWithoutTabs = nextLine.replace(this.rules.other.tabCharGlobal, "    ");
            }
            if (fencesBeginRegex.test(nextLine)) {
              break;
            }
            if (headingBeginRegex.test(nextLine)) {
              break;
            }
            if (htmlBeginRegex.test(nextLine)) {
              break;
            }
            if (nextBulletRegex.test(nextLine)) {
              break;
            }
            if (hrRegex.test(nextLine)) {
              break;
            }
            if (nextLineWithoutTabs.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
              itemContents += "\n" + nextLineWithoutTabs.slice(indent);
            } else {
              if (blankLine) {
                break;
              }
              if (line.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4) {
                break;
              }
              if (fencesBeginRegex.test(line)) {
                break;
              }
              if (headingBeginRegex.test(line)) {
                break;
              }
              if (hrRegex.test(line)) {
                break;
              }
              itemContents += "\n" + nextLine;
            }
            if (!blankLine && !nextLine.trim()) {
              blankLine = true;
            }
            raw += rawLine + "\n";
            src = src.substring(rawLine.length + 1);
            line = nextLineWithoutTabs.slice(indent);
          }
        }
        if (!list2.loose) {
          if (endsWithBlankLine) {
            list2.loose = true;
          } else if (this.rules.other.doubleBlankLine.test(raw)) {
            endsWithBlankLine = true;
          }
        }
        let istask = null;
        let ischecked;
        if (this.options.gfm) {
          istask = this.rules.other.listIsTask.exec(itemContents);
          if (istask) {
            ischecked = istask[0] !== "[ ] ";
            itemContents = itemContents.replace(this.rules.other.listReplaceTask, "");
          }
        }
        list2.items.push({
          type: "list_item",
          raw,
          task: !!istask,
          checked: ischecked,
          loose: false,
          text: itemContents,
          tokens: []
        });
        list2.raw += raw;
      }
      const lastItem = list2.items.at(-1);
      if (lastItem) {
        lastItem.raw = lastItem.raw.trimEnd();
        lastItem.text = lastItem.text.trimEnd();
      } else {
        return;
      }
      list2.raw = list2.raw.trimEnd();
      for (let i = 0; i < list2.items.length; i++) {
        this.lexer.state.top = false;
        list2.items[i].tokens = this.lexer.blockTokens(list2.items[i].text, []);
        if (!list2.loose) {
          const spacers = list2.items[i].tokens.filter((t) => t.type === "space");
          const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t) => this.rules.other.anyLine.test(t.raw));
          list2.loose = hasMultipleLineBreaks;
        }
      }
      if (list2.loose) {
        for (let i = 0; i < list2.items.length; i++) {
          list2.items[i].loose = true;
        }
      }
      return list2;
    }
  }
  html(src) {
    const cap = this.rules.block.html.exec(src);
    if (cap) {
      const token = {
        type: "html",
        block: true,
        raw: cap[0],
        pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
        text: cap[0]
      };
      return token;
    }
  }
  def(src) {
    const cap = this.rules.block.def.exec(src);
    if (cap) {
      const tag2 = cap[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " ");
      const href = cap[2] ? cap[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "";
      const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : cap[3];
      return {
        type: "def",
        tag: tag2,
        raw: cap[0],
        href,
        title
      };
    }
  }
  table(src) {
    const cap = this.rules.block.table.exec(src);
    if (!cap) {
      return;
    }
    if (!this.rules.other.tableDelimiter.test(cap[2])) {
      return;
    }
    const headers = splitCells(cap[1]);
    const aligns = cap[2].replace(this.rules.other.tableAlignChars, "").split("|");
    const rows = cap[3]?.trim() ? cap[3].replace(this.rules.other.tableRowBlankLine, "").split("\n") : [];
    const item = {
      type: "table",
      raw: cap[0],
      header: [],
      align: [],
      rows: []
    };
    if (headers.length !== aligns.length) {
      return;
    }
    for (const align of aligns) {
      if (this.rules.other.tableAlignRight.test(align)) {
        item.align.push("right");
      } else if (this.rules.other.tableAlignCenter.test(align)) {
        item.align.push("center");
      } else if (this.rules.other.tableAlignLeft.test(align)) {
        item.align.push("left");
      } else {
        item.align.push(null);
      }
    }
    for (let i = 0; i < headers.length; i++) {
      item.header.push({
        text: headers[i],
        tokens: this.lexer.inline(headers[i]),
        header: true,
        align: item.align[i]
      });
    }
    for (const row of rows) {
      item.rows.push(splitCells(row, item.header.length).map((cell, i) => {
        return {
          text: cell,
          tokens: this.lexer.inline(cell),
          header: false,
          align: item.align[i]
        };
      }));
    }
    return item;
  }
  lheading(src) {
    const cap = this.rules.block.lheading.exec(src);
    if (cap) {
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[2].charAt(0) === "=" ? 1 : 2,
        text: cap[1],
        tokens: this.lexer.inline(cap[1])
      };
    }
  }
  paragraph(src) {
    const cap = this.rules.block.paragraph.exec(src);
    if (cap) {
      const text = cap[1].charAt(cap[1].length - 1) === "\n" ? cap[1].slice(0, -1) : cap[1];
      return {
        type: "paragraph",
        raw: cap[0],
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  text(src) {
    const cap = this.rules.block.text.exec(src);
    if (cap) {
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        tokens: this.lexer.inline(cap[0])
      };
    }
  }
  escape(src) {
    const cap = this.rules.inline.escape.exec(src);
    if (cap) {
      return {
        type: "escape",
        raw: cap[0],
        text: cap[1]
      };
    }
  }
  tag(src) {
    const cap = this.rules.inline.tag.exec(src);
    if (cap) {
      if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
        this.lexer.state.inLink = true;
      } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
        this.lexer.state.inLink = false;
      }
      if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = true;
      } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = false;
      }
      return {
        type: "html",
        raw: cap[0],
        inLink: this.lexer.state.inLink,
        inRawBlock: this.lexer.state.inRawBlock,
        block: false,
        text: cap[0]
      };
    }
  }
  link(src) {
    const cap = this.rules.inline.link.exec(src);
    if (cap) {
      const trimmedUrl = cap[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(trimmedUrl)) {
        if (!this.rules.other.endAngleBracket.test(trimmedUrl)) {
          return;
        }
        const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), "\\");
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
          return;
        }
      } else {
        const lastParenIndex = findClosingBracket(cap[2], "()");
        if (lastParenIndex === -2) {
          return;
        }
        if (lastParenIndex > -1) {
          const start = cap[0].indexOf("!") === 0 ? 5 : 4;
          const linkLen = start + cap[1].length + lastParenIndex;
          cap[2] = cap[2].substring(0, lastParenIndex);
          cap[0] = cap[0].substring(0, linkLen).trim();
          cap[3] = "";
        }
      }
      let href = cap[2];
      let title = "";
      if (this.options.pedantic) {
        const link2 = this.rules.other.pedanticHrefTitle.exec(href);
        if (link2) {
          href = link2[1];
          title = link2[3];
        }
      } else {
        title = cap[3] ? cap[3].slice(1, -1) : "";
      }
      href = href.trim();
      if (this.rules.other.startAngleBracket.test(href)) {
        if (this.options.pedantic && !this.rules.other.endAngleBracket.test(trimmedUrl)) {
          href = href.slice(1);
        } else {
          href = href.slice(1, -1);
        }
      }
      return outputLink(cap, {
        href: href ? href.replace(this.rules.inline.anyPunctuation, "$1") : href,
        title: title ? title.replace(this.rules.inline.anyPunctuation, "$1") : title
      }, cap[0], this.lexer, this.rules);
    }
  }
  reflink(src, links) {
    let cap;
    if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
      const linkString = (cap[2] || cap[1]).replace(this.rules.other.multipleSpaceGlobal, " ");
      const link2 = links[linkString.toLowerCase()];
      if (!link2) {
        const text = cap[0].charAt(0);
        return {
          type: "text",
          raw: text,
          text
        };
      }
      return outputLink(cap, link2, cap[0], this.lexer, this.rules);
    }
  }
  emStrong(src, maskedSrc, prevChar = "") {
    let match = this.rules.inline.emStrongLDelim.exec(src);
    if (!match) return;
    if (match[3] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;
    const nextChar = match[1] || match[2] || "";
    if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
      const lLength = [...match[0]].length - 1;
      let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;
      const endReg = match[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      endReg.lastIndex = 0;
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      while ((match = endReg.exec(maskedSrc)) != null) {
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        if (!rDelim) continue;
        rLength = [...rDelim].length;
        if (match[3] || match[4]) {
          delimTotal += rLength;
          continue;
        } else if (match[5] || match[6]) {
          if (lLength % 3 && !((lLength + rLength) % 3)) {
            midDelimTotal += rLength;
            continue;
          }
        }
        delimTotal -= rLength;
        if (delimTotal > 0) continue;
        rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
        const lastCharLength = [...match[0]][0].length;
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
        if (Math.min(lLength, rLength) % 2) {
          const text2 = raw.slice(1, -1);
          return {
            type: "em",
            raw,
            text: text2,
            tokens: this.lexer.inlineTokens(text2)
          };
        }
        const text = raw.slice(2, -2);
        return {
          type: "strong",
          raw,
          text,
          tokens: this.lexer.inlineTokens(text)
        };
      }
    }
  }
  codespan(src) {
    const cap = this.rules.inline.code.exec(src);
    if (cap) {
      let text = cap[2].replace(this.rules.other.newLineCharGlobal, " ");
      const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text);
      const hasSpaceCharsOnBothEnds = this.rules.other.startingSpaceChar.test(text) && this.rules.other.endingSpaceChar.test(text);
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
        text = text.substring(1, text.length - 1);
      }
      return {
        type: "codespan",
        raw: cap[0],
        text
      };
    }
  }
  br(src) {
    const cap = this.rules.inline.br.exec(src);
    if (cap) {
      return {
        type: "br",
        raw: cap[0]
      };
    }
  }
  del(src) {
    const cap = this.rules.inline.del.exec(src);
    if (cap) {
      return {
        type: "del",
        raw: cap[0],
        text: cap[2],
        tokens: this.lexer.inlineTokens(cap[2])
      };
    }
  }
  autolink(src) {
    const cap = this.rules.inline.autolink.exec(src);
    if (cap) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[1];
        href = "mailto:" + text;
      } else {
        text = cap[1];
        href = text;
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  url(src) {
    let cap;
    if (cap = this.rules.inline.url.exec(src)) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[0];
        href = "mailto:" + text;
      } else {
        let prevCapZero;
        do {
          prevCapZero = cap[0];
          cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? "";
        } while (prevCapZero !== cap[0]);
        text = cap[0];
        if (cap[1] === "www.") {
          href = "http://" + cap[0];
        } else {
          href = cap[0];
        }
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  inlineText(src) {
    const cap = this.rules.inline.text.exec(src);
    if (cap) {
      const escaped = this.lexer.state.inRawBlock;
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        escaped
      };
    }
  }
};
var _Lexer = class __Lexer {
  static {
    __name(this, "__Lexer");
  }
  tokens;
  options;
  state;
  tokenizer;
  inlineQueue;
  constructor(options2) {
    this.tokens = [];
    this.tokens.links = /* @__PURE__ */ Object.create(null);
    this.options = options2 || _defaults;
    this.options.tokenizer = this.options.tokenizer || new _Tokenizer();
    this.tokenizer = this.options.tokenizer;
    this.tokenizer.options = this.options;
    this.tokenizer.lexer = this;
    this.inlineQueue = [];
    this.state = {
      inLink: false,
      inRawBlock: false,
      top: true
    };
    const rules = {
      other,
      block: block.normal,
      inline: inline.normal
    };
    if (this.options.pedantic) {
      rules.block = block.pedantic;
      rules.inline = inline.pedantic;
    } else if (this.options.gfm) {
      rules.block = block.gfm;
      if (this.options.breaks) {
        rules.inline = inline.breaks;
      } else {
        rules.inline = inline.gfm;
      }
    }
    this.tokenizer.rules = rules;
  }
  /**
   * Expose Rules
   */
  static get rules() {
    return {
      block,
      inline
    };
  }
  /**
   * Static Lex Method
   */
  static lex(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.lex(src);
  }
  /**
   * Static Lex Inline Method
   */
  static lexInline(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.inlineTokens(src);
  }
  /**
   * Preprocessing
   */
  lex(src) {
    src = src.replace(other.carriageReturn, "\n");
    this.blockTokens(src, this.tokens);
    for (let i = 0; i < this.inlineQueue.length; i++) {
      const next = this.inlineQueue[i];
      this.inlineTokens(next.src, next.tokens);
    }
    this.inlineQueue = [];
    return this.tokens;
  }
  blockTokens(src, tokens = [], lastParagraphClipped = false) {
    if (this.options.pedantic) {
      src = src.replace(other.tabCharGlobal, "    ").replace(other.spaceLine, "");
    }
    while (src) {
      let token;
      if (this.options.extensions?.block?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.space(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.raw.length === 1 && lastToken !== void 0) {
          lastToken.raw += "\n";
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.code(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.fences(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.heading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.hr(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.blockquote(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.list(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.html(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.def(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.raw;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else if (!this.tokens.links[token.tag]) {
          this.tokens.links[token.tag] = {
            href: token.href,
            title: token.title
          };
        }
        continue;
      }
      if (token = this.tokenizer.table(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.lheading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startBlock) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startBlock.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
        const lastToken = tokens.at(-1);
        if (lastParagraphClipped && lastToken?.type === "paragraph") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        lastParagraphClipped = cutSrc.length !== src.length;
        src = src.substring(token.raw.length);
        continue;
      }
      if (token = this.tokenizer.text(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    this.state.top = true;
    return tokens;
  }
  inline(src, tokens = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }
  /**
   * Lexing/Compiling
   */
  inlineTokens(src, tokens = []) {
    let maskedSrc = src;
    let match = null;
    if (this.tokens.links) {
      const links = Object.keys(this.tokens.links);
      if (links.length > 0) {
        while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
          if (links.includes(match[0].slice(match[0].lastIndexOf("[") + 1, -1))) {
            maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
          }
        }
      }
    }
    while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "++" + maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    }
    while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    }
    let keepPrevChar = false;
    let prevChar = "";
    while (src) {
      if (!keepPrevChar) {
        prevChar = "";
      }
      keepPrevChar = false;
      let token;
      if (this.options.extensions?.inline?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.escape(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.tag(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.link(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.reflink(src, this.tokens.links)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.type === "text" && lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.codespan(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.br(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.del(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.autolink(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (!this.state.inLink && (token = this.tokenizer.url(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startInline) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startInline.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (token = this.tokenizer.inlineText(cutSrc)) {
        src = src.substring(token.raw.length);
        if (token.raw.slice(-1) !== "_") {
          prevChar = token.raw.slice(-1);
        }
        keepPrevChar = true;
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    return tokens;
  }
};
var _Renderer = class {
  static {
    __name(this, "_Renderer");
  }
  options;
  parser;
  // set by the parser
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  space(token) {
    return "";
  }
  code({ text, lang, escaped }) {
    const langString = (lang || "").match(other.notSpaceStart)?.[0];
    const code = text.replace(other.endingNewline, "") + "\n";
    if (!langString) {
      return "<pre><code>" + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
    }
    return '<pre><code class="language-' + escape2(langString) + '">' + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
  }
  blockquote({ tokens }) {
    const body = this.parser.parse(tokens);
    return `<blockquote>
${body}</blockquote>
`;
  }
  html({ text }) {
    return text;
  }
  heading({ tokens, depth }) {
    return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>
`;
  }
  hr(token) {
    return "<hr>\n";
  }
  list(token) {
    const ordered = token.ordered;
    const start = token.start;
    let body = "";
    for (let j = 0; j < token.items.length; j++) {
      const item = token.items[j];
      body += this.listitem(item);
    }
    const type = ordered ? "ol" : "ul";
    const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : "";
    return "<" + type + startAttr + ">\n" + body + "</" + type + ">\n";
  }
  listitem(item) {
    let itemBody = "";
    if (item.task) {
      const checkbox = this.checkbox({ checked: !!item.checked });
      if (item.loose) {
        if (item.tokens[0]?.type === "paragraph") {
          item.tokens[0].text = checkbox + " " + item.tokens[0].text;
          if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === "text") {
            item.tokens[0].tokens[0].text = checkbox + " " + escape2(item.tokens[0].tokens[0].text);
            item.tokens[0].tokens[0].escaped = true;
          }
        } else {
          item.tokens.unshift({
            type: "text",
            raw: checkbox + " ",
            text: checkbox + " ",
            escaped: true
          });
        }
      } else {
        itemBody += checkbox + " ";
      }
    }
    itemBody += this.parser.parse(item.tokens, !!item.loose);
    return `<li>${itemBody}</li>
`;
  }
  checkbox({ checked }) {
    return "<input " + (checked ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
  }
  paragraph({ tokens }) {
    return `<p>${this.parser.parseInline(tokens)}</p>
`;
  }
  table(token) {
    let header = "";
    let cell = "";
    for (let j = 0; j < token.header.length; j++) {
      cell += this.tablecell(token.header[j]);
    }
    header += this.tablerow({ text: cell });
    let body = "";
    for (let j = 0; j < token.rows.length; j++) {
      const row = token.rows[j];
      cell = "";
      for (let k = 0; k < row.length; k++) {
        cell += this.tablecell(row[k]);
      }
      body += this.tablerow({ text: cell });
    }
    if (body) body = `<tbody>${body}</tbody>`;
    return "<table>\n<thead>\n" + header + "</thead>\n" + body + "</table>\n";
  }
  tablerow({ text }) {
    return `<tr>
${text}</tr>
`;
  }
  tablecell(token) {
    const content = this.parser.parseInline(token.tokens);
    const type = token.header ? "th" : "td";
    const tag2 = token.align ? `<${type} align="${token.align}">` : `<${type}>`;
    return tag2 + content + `</${type}>
`;
  }
  /**
   * span level renderer
   */
  strong({ tokens }) {
    return `<strong>${this.parser.parseInline(tokens)}</strong>`;
  }
  em({ tokens }) {
    return `<em>${this.parser.parseInline(tokens)}</em>`;
  }
  codespan({ text }) {
    return `<code>${escape2(text, true)}</code>`;
  }
  br(token) {
    return "<br>";
  }
  del({ tokens }) {
    return `<del>${this.parser.parseInline(tokens)}</del>`;
  }
  link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return text;
    }
    href = cleanHref;
    let out = '<a href="' + href + '"';
    if (title) {
      out += ' title="' + escape2(title) + '"';
    }
    out += ">" + text + "</a>";
    return out;
  }
  image({ href, title, text, tokens }) {
    if (tokens) {
      text = this.parser.parseInline(tokens, this.parser.textRenderer);
    }
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return escape2(text);
    }
    href = cleanHref;
    let out = `<img src="${href}" alt="${text}"`;
    if (title) {
      out += ` title="${escape2(title)}"`;
    }
    out += ">";
    return out;
  }
  text(token) {
    return "tokens" in token && token.tokens ? this.parser.parseInline(token.tokens) : "escaped" in token && token.escaped ? token.text : escape2(token.text);
  }
};
var _TextRenderer = class {
  static {
    __name(this, "_TextRenderer");
  }
  // no need for block level renderers
  strong({ text }) {
    return text;
  }
  em({ text }) {
    return text;
  }
  codespan({ text }) {
    return text;
  }
  del({ text }) {
    return text;
  }
  html({ text }) {
    return text;
  }
  text({ text }) {
    return text;
  }
  link({ text }) {
    return "" + text;
  }
  image({ text }) {
    return "" + text;
  }
  br() {
    return "";
  }
};
var _Parser = class __Parser {
  static {
    __name(this, "__Parser");
  }
  options;
  renderer;
  textRenderer;
  constructor(options2) {
    this.options = options2 || _defaults;
    this.options.renderer = this.options.renderer || new _Renderer();
    this.renderer = this.options.renderer;
    this.renderer.options = this.options;
    this.renderer.parser = this;
    this.textRenderer = new _TextRenderer();
  }
  /**
   * Static Parse Method
   */
  static parse(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parse(tokens);
  }
  /**
   * Static Parse Inline Method
   */
  static parseInline(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parseInline(tokens);
  }
  /**
   * Parse Loop
   */
  parse(tokens, top = true) {
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const genericToken = anyToken;
        const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
        if (ret !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(genericToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "space": {
          out += this.renderer.space(token);
          continue;
        }
        case "hr": {
          out += this.renderer.hr(token);
          continue;
        }
        case "heading": {
          out += this.renderer.heading(token);
          continue;
        }
        case "code": {
          out += this.renderer.code(token);
          continue;
        }
        case "table": {
          out += this.renderer.table(token);
          continue;
        }
        case "blockquote": {
          out += this.renderer.blockquote(token);
          continue;
        }
        case "list": {
          out += this.renderer.list(token);
          continue;
        }
        case "html": {
          out += this.renderer.html(token);
          continue;
        }
        case "paragraph": {
          out += this.renderer.paragraph(token);
          continue;
        }
        case "text": {
          let textToken = token;
          let body = this.renderer.text(textToken);
          while (i + 1 < tokens.length && tokens[i + 1].type === "text") {
            textToken = tokens[++i];
            body += "\n" + this.renderer.text(textToken);
          }
          if (top) {
            out += this.renderer.paragraph({
              type: "paragraph",
              raw: body,
              text: body,
              tokens: [{ type: "text", raw: body, text: body, escaped: true }]
            });
          } else {
            out += body;
          }
          continue;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
  /**
   * Parse Inline Tokens
   */
  parseInline(tokens, renderer = this.renderer) {
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const ret = this.options.extensions.renderers[anyToken.type].call({ parser: this }, anyToken);
        if (ret !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(anyToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "escape": {
          out += renderer.text(token);
          break;
        }
        case "html": {
          out += renderer.html(token);
          break;
        }
        case "link": {
          out += renderer.link(token);
          break;
        }
        case "image": {
          out += renderer.image(token);
          break;
        }
        case "strong": {
          out += renderer.strong(token);
          break;
        }
        case "em": {
          out += renderer.em(token);
          break;
        }
        case "codespan": {
          out += renderer.codespan(token);
          break;
        }
        case "br": {
          out += renderer.br(token);
          break;
        }
        case "del": {
          out += renderer.del(token);
          break;
        }
        case "text": {
          out += renderer.text(token);
          break;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
};
var _Hooks = class {
  static {
    __name(this, "_Hooks");
  }
  options;
  block;
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  static passThroughHooks = /* @__PURE__ */ new Set([
    "preprocess",
    "postprocess",
    "processAllTokens"
  ]);
  /**
   * Process markdown before marked
   */
  preprocess(markdown) {
    return markdown;
  }
  /**
   * Process HTML after marked is finished
   */
  postprocess(html2) {
    return html2;
  }
  /**
   * Process all tokens before walk tokens
   */
  processAllTokens(tokens) {
    return tokens;
  }
  /**
   * Provide function to tokenize markdown
   */
  provideLexer() {
    return this.block ? _Lexer.lex : _Lexer.lexInline;
  }
  /**
   * Provide function to parse tokens
   */
  provideParser() {
    return this.block ? _Parser.parse : _Parser.parseInline;
  }
};
var Marked = class {
  static {
    __name(this, "Marked");
  }
  defaults = _getDefaults();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = _Parser;
  Renderer = _Renderer;
  TextRenderer = _TextRenderer;
  Lexer = _Lexer;
  Tokenizer = _Tokenizer;
  Hooks = _Hooks;
  constructor(...args) {
    this.use(...args);
  }
  /**
   * Run callback for every token
   */
  walkTokens(tokens, callback) {
    let values = [];
    for (const token of tokens) {
      values = values.concat(callback.call(this, token));
      switch (token.type) {
        case "table": {
          const tableToken = token;
          for (const cell of tableToken.header) {
            values = values.concat(this.walkTokens(cell.tokens, callback));
          }
          for (const row of tableToken.rows) {
            for (const cell of row) {
              values = values.concat(this.walkTokens(cell.tokens, callback));
            }
          }
          break;
        }
        case "list": {
          const listToken = token;
          values = values.concat(this.walkTokens(listToken.items, callback));
          break;
        }
        default: {
          const genericToken = token;
          if (this.defaults.extensions?.childTokens?.[genericToken.type]) {
            this.defaults.extensions.childTokens[genericToken.type].forEach((childTokens) => {
              const tokens2 = genericToken[childTokens].flat(Infinity);
              values = values.concat(this.walkTokens(tokens2, callback));
            });
          } else if (genericToken.tokens) {
            values = values.concat(this.walkTokens(genericToken.tokens, callback));
          }
        }
      }
    }
    return values;
  }
  use(...args) {
    const extensions = this.defaults.extensions || { renderers: {}, childTokens: {} };
    args.forEach((pack) => {
      const opts = { ...pack };
      opts.async = this.defaults.async || opts.async || false;
      if (pack.extensions) {
        pack.extensions.forEach((ext) => {
          if (!ext.name) {
            throw new Error("extension name required");
          }
          if ("renderer" in ext) {
            const prevRenderer = extensions.renderers[ext.name];
            if (prevRenderer) {
              extensions.renderers[ext.name] = function(...args2) {
                let ret = ext.renderer.apply(this, args2);
                if (ret === false) {
                  ret = prevRenderer.apply(this, args2);
                }
                return ret;
              };
            } else {
              extensions.renderers[ext.name] = ext.renderer;
            }
          }
          if ("tokenizer" in ext) {
            if (!ext.level || ext.level !== "block" && ext.level !== "inline") {
              throw new Error("extension level must be 'block' or 'inline'");
            }
            const extLevel = extensions[ext.level];
            if (extLevel) {
              extLevel.unshift(ext.tokenizer);
            } else {
              extensions[ext.level] = [ext.tokenizer];
            }
            if (ext.start) {
              if (ext.level === "block") {
                if (extensions.startBlock) {
                  extensions.startBlock.push(ext.start);
                } else {
                  extensions.startBlock = [ext.start];
                }
              } else if (ext.level === "inline") {
                if (extensions.startInline) {
                  extensions.startInline.push(ext.start);
                } else {
                  extensions.startInline = [ext.start];
                }
              }
            }
          }
          if ("childTokens" in ext && ext.childTokens) {
            extensions.childTokens[ext.name] = ext.childTokens;
          }
        });
        opts.extensions = extensions;
      }
      if (pack.renderer) {
        const renderer = this.defaults.renderer || new _Renderer(this.defaults);
        for (const prop in pack.renderer) {
          if (!(prop in renderer)) {
            throw new Error(`renderer '${prop}' does not exist`);
          }
          if (["options", "parser"].includes(prop)) {
            continue;
          }
          const rendererProp = prop;
          const rendererFunc = pack.renderer[rendererProp];
          const prevRenderer = renderer[rendererProp];
          renderer[rendererProp] = (...args2) => {
            let ret = rendererFunc.apply(renderer, args2);
            if (ret === false) {
              ret = prevRenderer.apply(renderer, args2);
            }
            return ret || "";
          };
        }
        opts.renderer = renderer;
      }
      if (pack.tokenizer) {
        const tokenizer = this.defaults.tokenizer || new _Tokenizer(this.defaults);
        for (const prop in pack.tokenizer) {
          if (!(prop in tokenizer)) {
            throw new Error(`tokenizer '${prop}' does not exist`);
          }
          if (["options", "rules", "lexer"].includes(prop)) {
            continue;
          }
          const tokenizerProp = prop;
          const tokenizerFunc = pack.tokenizer[tokenizerProp];
          const prevTokenizer = tokenizer[tokenizerProp];
          tokenizer[tokenizerProp] = (...args2) => {
            let ret = tokenizerFunc.apply(tokenizer, args2);
            if (ret === false) {
              ret = prevTokenizer.apply(tokenizer, args2);
            }
            return ret;
          };
        }
        opts.tokenizer = tokenizer;
      }
      if (pack.hooks) {
        const hooks = this.defaults.hooks || new _Hooks();
        for (const prop in pack.hooks) {
          if (!(prop in hooks)) {
            throw new Error(`hook '${prop}' does not exist`);
          }
          if (["options", "block"].includes(prop)) {
            continue;
          }
          const hooksProp = prop;
          const hooksFunc = pack.hooks[hooksProp];
          const prevHook = hooks[hooksProp];
          if (_Hooks.passThroughHooks.has(prop)) {
            hooks[hooksProp] = (arg) => {
              if (this.defaults.async) {
                return Promise.resolve(hooksFunc.call(hooks, arg)).then((ret2) => {
                  return prevHook.call(hooks, ret2);
                });
              }
              const ret = hooksFunc.call(hooks, arg);
              return prevHook.call(hooks, ret);
            };
          } else {
            hooks[hooksProp] = (...args2) => {
              let ret = hooksFunc.apply(hooks, args2);
              if (ret === false) {
                ret = prevHook.apply(hooks, args2);
              }
              return ret;
            };
          }
        }
        opts.hooks = hooks;
      }
      if (pack.walkTokens) {
        const walkTokens2 = this.defaults.walkTokens;
        const packWalktokens = pack.walkTokens;
        opts.walkTokens = function(token) {
          let values = [];
          values.push(packWalktokens.call(this, token));
          if (walkTokens2) {
            values = values.concat(walkTokens2.call(this, token));
          }
          return values;
        };
      }
      this.defaults = { ...this.defaults, ...opts };
    });
    return this;
  }
  setOptions(opt) {
    this.defaults = { ...this.defaults, ...opt };
    return this;
  }
  lexer(src, options2) {
    return _Lexer.lex(src, options2 ?? this.defaults);
  }
  parser(tokens, options2) {
    return _Parser.parse(tokens, options2 ?? this.defaults);
  }
  parseMarkdown(blockType) {
    const parse2 = /* @__PURE__ */ __name((src, options2) => {
      const origOpt = { ...options2 };
      const opt = { ...this.defaults, ...origOpt };
      const throwError = this.onError(!!opt.silent, !!opt.async);
      if (this.defaults.async === true && origOpt.async === false) {
        return throwError(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      }
      if (typeof src === "undefined" || src === null) {
        return throwError(new Error("marked(): input parameter is undefined or null"));
      }
      if (typeof src !== "string") {
        return throwError(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));
      }
      if (opt.hooks) {
        opt.hooks.options = opt;
        opt.hooks.block = blockType;
      }
      const lexer2 = opt.hooks ? opt.hooks.provideLexer() : blockType ? _Lexer.lex : _Lexer.lexInline;
      const parser2 = opt.hooks ? opt.hooks.provideParser() : blockType ? _Parser.parse : _Parser.parseInline;
      if (opt.async) {
        return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src).then((src2) => lexer2(src2, opt)).then((tokens) => opt.hooks ? opt.hooks.processAllTokens(tokens) : tokens).then((tokens) => opt.walkTokens ? Promise.all(this.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens).then((tokens) => parser2(tokens, opt)).then((html2) => opt.hooks ? opt.hooks.postprocess(html2) : html2).catch(throwError);
      }
      try {
        if (opt.hooks) {
          src = opt.hooks.preprocess(src);
        }
        let tokens = lexer2(src, opt);
        if (opt.hooks) {
          tokens = opt.hooks.processAllTokens(tokens);
        }
        if (opt.walkTokens) {
          this.walkTokens(tokens, opt.walkTokens);
        }
        let html2 = parser2(tokens, opt);
        if (opt.hooks) {
          html2 = opt.hooks.postprocess(html2);
        }
        return html2;
      } catch (e) {
        return throwError(e);
      }
    }, "parse2");
    return parse2;
  }
  onError(silent, async) {
    return (e) => {
      e.message += "\nPlease report this to https://github.com/markedjs/marked.";
      if (silent) {
        const msg = "<p>An error occurred:</p><pre>" + escape2(e.message + "", true) + "</pre>";
        if (async) {
          return Promise.resolve(msg);
        }
        return msg;
      }
      if (async) {
        return Promise.reject(e);
      }
      throw e;
    };
  }
};
var markedInstance = new Marked();
function marked(src, opt) {
  return markedInstance.parse(src, opt);
}
__name(marked, "marked");
marked.options = marked.setOptions = function(options2) {
  markedInstance.setOptions(options2);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.getDefaults = _getDefaults;
marked.defaults = _defaults;
marked.use = function(...args) {
  markedInstance.use(...args);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.walkTokens = function(tokens, callback) {
  return markedInstance.walkTokens(tokens, callback);
};
marked.parseInline = markedInstance.parseInline;
marked.Parser = _Parser;
marked.parser = _Parser.parse;
marked.Renderer = _Renderer;
marked.TextRenderer = _TextRenderer;
marked.Lexer = _Lexer;
marked.lexer = _Lexer.lex;
marked.Tokenizer = _Tokenizer;
marked.Hooks = _Hooks;
marked.parse = marked;
var options = marked.options;
var setOptions = marked.setOptions;
var use = marked.use;
var walkTokens = marked.walkTokens;
var parseInline = marked.parseInline;
var parser = _Parser.parse;
var lexer = _Lexer.lex;

// src/htmlGenerators.js
function generateHtmlListForContentPage(items, dateStr) {
  let listHtml = "";
  if (!Array.isArray(items) || items.length === 0) {
    listHtml += `<p>\u6B64\u65E5\u671F\u65E0\u53EF\u7528\u6570\u636E\u3002\u6293\u53D6/\u7B5B\u9009\u8FC7\u7A0B\u53EF\u80FD\u6CA1\u6709\u4E3A\u6B64\u65E5\u671F\u751F\u6210\u4EFB\u4F55\u7ED3\u679C\u3002</p>`;
    return listHtml;
  }
  listHtml += '<ul class="item-list">';
  items.forEach((item, index) => {
    let displayContent = "";
    let itemId = item.id;
    const dataSourceConfig = dataSources[item.type];
    if (dataSourceConfig && dataSourceConfig.sources && dataSourceConfig.sources.length > 0 && dataSourceConfig.sources[0].generateHtml) {
      displayContent = dataSourceConfig.sources[0].generateHtml(item);
    } else {
      displayContent = `<strong>\u672A\u77E5\u9879\u76EE\u7C7B\u578B: ${escapeHtml(item.type)}</strong><br>${escapeHtml(item.title || item.description || JSON.stringify(item))}`;
    }
    listHtml += `<li class="item-card">
            <label>
                <input type="checkbox" name="selectedItems" value="${item.type}:${itemId}" class="item-checkbox">
                <div class="item-content">${displayContent}</div>
            </label>
        </li>`;
  });
  listHtml += "</ul>";
  return listHtml;
}
__name(generateHtmlListForContentPage, "generateHtmlListForContentPage");
function generateContentSelectionPageHtml(env, dateStr, allData, dataCategories) {
  const data = allData || {};
  const categories = Array.isArray(dataCategories) ? dataCategories : [];
  const tabButtonsHtml = categories.map((category, index) => `
        <div class="tab-buttons-wrapper">
            <button type="button" class="tab-button ${index === 0 ? "active" : ""}" onclick="openTab(event, '${category.id}-tab')" ondblclick="confirmFetchCategoryData(this,'${category.id}')">${escapeHtml(category.name)}</button>
        </div>
    `).join("");
  const tabContentsHtml = categories.map((category, index) => `
        <div id="${category.id}-tab" class="tab-content ${index === 0 ? "active" : ""}">
            ${generateHtmlListForContentPage(data[category.id], dateStr)}
        </div>
    `).join("");
  return `
        <!DOCTYPE html>
        <html lang="zh-Hans">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${formatDateToChinese(escapeHtml(dateStr))} ${env.FOLO_FILTER_DAYS}\u5929\u5185\u7684\u6570\u636E</title>
            <style>
                :root { --primary-color: #007bff; --light-gray: #f8f9fa; --medium-gray: #e9ecef; --dark-gray: #343a40; --line-height-normal: 1.4; --font-size-small: 0.9rem;}
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; background-color: var(--light-gray); color: var(--dark-gray); padding: 1rem; }
                .container { max-width: 1200px; margin: 0 auto; background-color: #fff; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
                h1 { font-size: 1.8rem; color: var(--dark-gray); margin-bottom: 0.5rem; }
                .submit-button { background-color: var(--primary-color); color: white; border: none; padding: 0.6rem 1.2rem; font-size: 0.9rem; border-radius: 5px; cursor: pointer; transition: background-color 0.2s; white-space: nowrap; }
                .submit-button:hover { background-color: #0056b3; }
                .tab-navigation { display: flex; flex-wrap: wrap; margin-bottom: 1rem; border-bottom: 1px solid var(--medium-gray); }
                .tab-buttons-wrapper { display: flex; align-items: center; margin-right: 1rem; margin-bottom: 0.5rem; }
                .tab-button { background-color: transparent; border: none; border-bottom: 3px solid transparent; padding: 0.8rem 1rem; cursor: pointer; font-size: 1rem; color: #555; transition: color 0.2s, border-color 0.2s; }
                .tab-button.active { color: var(--primary-color); border-bottom-color: var(--primary-color); font-weight: 600; }
                .tab-button:hover { color: var(--primary-color); }
                .tab-content { display: none; animation: fadeIn 0.5s; }
                .tab-content.active { display: block; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .item-list { list-style-type: none; counter-reset: item-counter; padding-left: 0; }
                .item-card { margin-bottom: 1rem; padding: 1rem; padding-left: 3em; border: 1px solid var(--medium-gray); border-radius: 6px; background-color: #fff; position: relative; counter-increment: item-counter; }
                .item-card::before { content: counter(item-counter) "."; position: absolute; left: 0.8em; top: 1rem; font-weight: 600; color: var(--dark-gray); min-width: 1.5em; text-align: right; }
                .item-card label { display: flex; align-items: flex-start; cursor: pointer; }
                .item-checkbox { margin-right: 0.8rem; margin-top: 0.2rem; transform: scale(1.2); flex-shrink: 0; }
                .item-content { flex-grow: 1; min-width: 0; }
                .item-content strong { font-size: 1.1rem; }
                .item-content small { color: #6c757d; display: block; margin: 0.2rem 0; }
                .content-html { border: 1px dashed #ccc; padding: 0.5rem; margin-top: 0.5rem; background: #fdfdfd; font-size: var(--font-size-small); line-height: var(--line-height-normal); max-width: 100%; overflow-wrap: break-word; word-break: break-word; overflow-y: hidden; transition: max-height 0.35s ease-in-out; position: relative; }
                .content-html.is-collapsed { max-height: calc(var(--font-size-small) * var(--line-height-normal) * 6 + 1rem); }
                .content-html.is-expanded { max-height: 3000px; overflow-y: auto; }
                .read-more-btn { display: block; margin-top: 0.5rem; padding: 0.3rem 0.6rem; font-size: 0.85rem; color: var(--primary-color); background-color: transparent; border: 1px solid var(--primary-color); border-radius: 4px; cursor: pointer; text-align: center; width: fit-content; }
                .read-more-btn:hover { background-color: #eef; }
                .item-content a { color: var(--primary-color); text-decoration: none; }
                .item-content a:hover { text-decoration: underline; }
                .error { color: #dc3545; font-weight: bold; background-color: #f8d7da; padding: 0.5rem; border-radius: 4px; border: 1px solid #f5c6cb;}
                hr { border: 0; border-top: 1px solid var(--medium-gray); margin: 0.5rem 0; }
                @media (max-width: 768px) {
                    body { padding: 0.5rem; } .container { padding: 0.8rem; } h1 { font-size: 1.5rem; }
                    .header-bar { flex-direction: column; align-items: flex-start; }
                    .submit-button { margin-top: 0.5rem; width: 100%; }
                    .tab-button { padding: 0.7rem 0.5rem; font-size: 0.9rem; flex-grow: 1; text-align: center; }
                    .item-card { padding-left: 2.5em; } .item-card::before { left: 0.5em; top: 0.8rem; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <form action="/genAIContent" method="POST">
                    <input type="hidden" name="date" value="${escapeHtml(dateStr)}">
                    <div class="header-bar">
                        <button type="button" class="submit-button" onclick="confirmFetchAndWriteData(this)">\u6293\u53D6\u5E76\u5199\u5165\u4ECA\u65E5\u6570\u636E</button>
                        <h1>${formatDateToChinese(escapeHtml(dateStr))} ${env.FOLO_FILTER_DAYS}\u5929\u5185\u7684\u6570\u636E</h1>
                        <button type="submit" class="submit-button" onclick="return confirmGenerateAIContent(event)">\u4ECE\u9009\u4E2D\u5185\u5BB9\u751F\u6210 AI \u65E5\u62A5</button>
                    </div>
                    <div class="cookie-setting-area" style="margin-bottom: 1rem; padding: 0.8rem; border: 1px solid var(--medium-gray); border-radius: 6px; background-color: #fefefe;">
                        <label for="foloCookie" style="font-weight: bold; margin-right: 0.5rem;">Folo Cookie:</label>
                        <input type="text" id="foloCookie" placeholder="\u5728\u6B64\u8F93\u5165 Folo Cookie" style="flex-grow: 1; padding: 0.4rem; border: 1px solid #ccc; border-radius: 4px; width: 300px; max-width: 70%;">
                        <button type="button" class="submit-button" onclick="saveFoloCookie(this)" style="margin-left: 0.5rem; padding: 0.4rem 0.8rem; font-size: 0.85rem;">\u4FDD\u5B58 Cookie</button>
                        <p style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">\u6B64 Cookie \u5C06\u4FDD\u5B58\u5728\u60A8\u7684\u6D4F\u89C8\u5668\u672C\u5730\u5B58\u50A8\u4E2D\uFF0C\u4EE5\u4FBF\u4E0B\u6B21\u4F7F\u7528\u3002</p>
                    </div>
                    <div class="tab-navigation">
                        ${tabButtonsHtml}
                    </div>
                    ${tabContentsHtml}
                </form>
            </div>
            <script>
                function openTab(evt, tabName) {
                    var i, tabcontent, tablinks;
                    tabcontent = document.getElementsByClassName("tab-content");
                    for (i = 0; i < tabcontent.length; i++) { tabcontent[i].style.display = "none"; tabcontent[i].classList.remove("active"); }
                    tablinks = document.getElementsByClassName("tab-button");
                    for (i = 0; i < tablinks.length; i++) { tablinks[i].classList.remove("active"); }
                    document.getElementById(tabName).style.display = "block"; document.getElementById(tabName).classList.add("active");
                    if (evt && evt.currentTarget) { evt.currentTarget.classList.add("active"); }
                }
                document.addEventListener('DOMContentLoaded', function() {
                    if (document.querySelector('.tab-button') && !document.querySelector('.tab-button.active')) { document.querySelector('.tab-button').click(); }
                    else if (document.querySelector('.tab-content.active') === null && document.querySelector('.tab-content')) {
                        const firstTabButton = document.querySelector('.tab-button'); const firstTabContent = document.querySelector('.tab-content');
                        if (firstTabButton) firstTabButton.classList.add('active');
                        if (firstTabContent) { firstTabContent.style.display = 'block'; firstTabContent.classList.add('active');}
                    }
                    document.querySelectorAll('.content-html').forEach(contentDiv => {
                        contentDiv.classList.add('is-collapsed');
                        requestAnimationFrame(() => {
                            const readMoreBtn = document.createElement('button'); readMoreBtn.type = 'button';
                            readMoreBtn.textContent = '\u5C55\u5F00'; readMoreBtn.className = 'read-more-btn';
                            contentDiv.insertAdjacentElement('afterend', readMoreBtn);
                            readMoreBtn.addEventListener('click', function() {
                                contentDiv.classList.toggle('is-expanded'); contentDiv.classList.toggle('is-collapsed', !contentDiv.classList.contains('is-expanded'));
                                this.textContent = contentDiv.classList.contains('is-expanded') ? '\u6298\u53E0' : '\u5C55\u5F00';
                            });
                        });
                    });
                });

                async function saveFoloCookie(button) {
                    const cookieInput = document.getElementById('foloCookie');
                    const cookieValue = cookieInput.value;

                    if (!cookieValue.trim()) {
                        alert('Folo Cookie \u4E0D\u80FD\u4E3A\u7A7A\u3002');
                        return;
                    }

                    const originalButtonText = button.textContent;
                    button.textContent = '\u4FDD\u5B58\u4E2D...';
                    button.disabled = true;

                    try {
                        localStorage.setItem('${env.FOLO_COOKIE_KV_KEY}', cookieValue); // \u76F4\u63A5\u4FDD\u5B58\u5230 localStorage
                        alert('Folo Cookie \u5DF2\u6210\u529F\u4FDD\u5B58\u5728\u672C\u5730\u5B58\u50A8\uFF01');
                    } catch (error) {
                        console.error('Error saving Folo Cookie to localStorage:', error);
                        alert(\`\u4FDD\u5B58 Folo Cookie \u5230\u672C\u5730\u5B58\u50A8\u65F6\u53D1\u751F\u9519\u8BEF: \${error.message}\`);
                    } finally {
                        button.textContent = originalButtonText;
                        button.disabled = false;
                    }
                }

                document.addEventListener('DOMContentLoaded', function() {
                    const savedCookie = localStorage.getItem('${env.FOLO_COOKIE_KV_KEY}');
                    if (savedCookie) {
                        document.getElementById('foloCookie').value = savedCookie;
                    }
                });

                function confirmFetchAndWriteData(button) {
                    if (confirm('\u786E\u5B9A\u8981\u6293\u53D6\u5E76\u5199\u5165\u4ECA\u65E5\u6570\u636E\u5417\uFF1F\u6B64\u64CD\u4F5C\u5C06\u66F4\u65B0\u4ECA\u65E5\u6570\u636E\u3002')) {
                        fetchAndWriteData(button);
                    }
                }

                async function fetchAndWriteData(button, category = null) {
                    const originalText = button.textContent;
                    button.textContent = '\u6B63\u5728\u6293\u53D6\u548C\u5199\u5165...';
                    button.disabled = true;

                    const foloCookie = localStorage.getItem('${env.FOLO_COOKIE_KV_KEY}'); // \u4ECE localStorage \u83B7\u53D6 foloCookie

                    try {
                        const response = await fetch('/writeData', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ category: category, foloCookie: foloCookie }), // \u5C06 foloCookie \u6DFB\u52A0\u5230\u8BF7\u6C42\u4F53
                        });

                        if (response.ok) {
                            const result = await response.text();
                            alert('\u6570\u636E\u6293\u53D6\u548C\u5199\u5165\u6210\u529F\uFF01' + result);
                            window.location.reload();
                        } else {
                            const errorText = await response.text();
                            alert('\u6570\u636E\u6293\u53D6\u548C\u5199\u5165\u5931\u8D25: ' + errorText);
                        }
                    } catch (error) {
                        console.error('Error fetching and writing data:', error);
                        alert('\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u6216\u670D\u52A1\u5668\u3002');
                    } finally {
                        button.textContent = originalText;
                        button.disabled = false;
                    }
                }

                function confirmFetchCategoryData(button, category) {
                    if (confirm(\`\u786E\u5B9A\u8981\u6293\u53D6\u5E76\u5199\u5165 \${category} \u5206\u7C7B\u7684\u6570\u636E\u5417\uFF1F\u6B64\u64CD\u4F5C\u5C06\u66F4\u65B0 \${category} \u6570\u636E\u3002\`)) {
                        fetchAndWriteData(button, category);
                    }
                }

                function confirmGenerateAIContent(event) {
                    const selectedCheckboxes = document.querySelectorAll('input[name="selectedItems"]:checked');
                    if (selectedCheckboxes.length === 0) {
                        alert('\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u5185\u5BB9\u6761\u76EE\u6765\u751F\u6210 AI \u65E5\u62A5\u3002');
                        event.preventDefault(); // Prevent form submission
                        return false;
                    }
                    const button = event.currentTarget; // \u83B7\u53D6\u89E6\u53D1\u4E8B\u4EF6\u7684\u6309\u94AE
                    if (confirm('\u786E\u5B9A\u8981\u4ECE\u9009\u4E2D\u5185\u5BB9\u751F\u6210 AI \u65E5\u62A5\u5417\uFF1F\u6B64\u64CD\u4F5C\u5C06\u8C03\u7528 AI \u6A21\u578B\u751F\u6210\u5185\u5BB9\u3002')) {
                        button.innerText = '\u751F\u6210\u4E2D...'; // \u66F4\u6539\u6309\u94AE\u6587\u6848
                        //button.disabled = true; // \u7981\u7528\u6309\u94AE\uFF0C\u9632\u6B62\u91CD\u590D\u63D0\u4EA4
                        return true; // Allow form submission
                    } else {
                        event.preventDefault(); // Prevent form submission
                        return false;
                    }
                }

            <\/script>
        </body>
        </html>
    `;
}
__name(generateContentSelectionPageHtml, "generateContentSelectionPageHtml");
function generatePromptSectionHtmlForGenAI(systemPrompt, userPrompt, promptTitle, promptIdSuffix) {
  if (!systemPrompt && !userPrompt) return "";
  let fullPromptTextForCopy = "";
  if (systemPrompt) fullPromptTextForCopy += `\u7CFB\u7EDF\u6307\u4EE4:
${systemPrompt}

`;
  if (userPrompt) fullPromptTextForCopy += `\u7528\u6237\u8F93\u5165:
${userPrompt}`;
  fullPromptTextForCopy = fullPromptTextForCopy.trim();
  return `
        <div style="margin-top: 1rem; border: 1px solid #ddd; padding: 0.8rem; border-radius: 4px; background-color: #f9f9f9;">
            <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem; color: #333;">${escapeHtml(promptTitle)}</h3>
            <button type="button" class="button-link toggle-prompt-btn" onclick="togglePromptVisibility('promptDetails_${promptIdSuffix}', this)">\u663E\u793A\u63D0\u793A\u8BE6\u60C5</button>
            <button type="button" class="button-link copy-prompt-btn" onclick="copyToClipboard(this.dataset.fullPrompt, this)" data-full-prompt="${escapeHtml(fullPromptTextForCopy)}">\u590D\u5236\u5B8C\u6574\u63D0\u793A</button>
            <div id="promptDetails_${promptIdSuffix}" class="content-box" style="display: none; margin-top: 0.5rem; background-color: #e9ecef; border-color: #ced4da; max-height: 400px; overflow-y: auto; text-align: left;">
                ${systemPrompt ? `<strong>\u7CFB\u7EDF\u6307\u4EE4:</strong><pre style="white-space: pre-wrap; word-wrap: break-word; font-size: 0.85rem; margin-top:0.2em; margin-bottom:0.8em; padding: 0.5em; background: #fff; border: 1px solid #ccc; border-radius: 3px;">${escapeHtml(systemPrompt)}</pre>` : "<p><em>\u672C\u6B21\u8C03\u7528\u65E0\u7CFB\u7EDF\u6307\u4EE4\u3002</em></p>"}
                ${userPrompt ? `<strong>\u7528\u6237\u8F93\u5165:</strong><pre style="white-space: pre-wrap; word-wrap: break-word; font-size: 0.85rem; margin-top:0.2em; padding: 0.5em; background: #fff; border: 1px solid #ccc; border-radius: 3px;">${escapeHtml(userPrompt)}</pre>` : "<p><em>\u672C\u6B21\u8C03\u7528\u65E0\u7528\u6237\u8F93\u5165\u3002</em></p>"}
            </div>
        </div>`;
}
__name(generatePromptSectionHtmlForGenAI, "generatePromptSectionHtmlForGenAI");
function generateGenAiPageHtml(env, title, bodyContent, pageDate, isErrorPage = false, selectedItemsForAction = null, systemP1 = null, userP1 = null, systemP2 = null, userP2 = null, promptsMd = null, dailyMd = null, podcastMd = null, readGithub = null) {
  let actionButtonHtml = "";
  if (title.includes("AI\u65E5\u62A5") && selectedItemsForAction && Array.isArray(selectedItemsForAction) && selectedItemsForAction.length > 0) {
    actionButtonHtml = `
            <form action="/genAIContent" method="POST" style="display: inline-block; margin-left: 0.5rem;">
                <input type="hidden" name="date" value="${escapeHtml(pageDate)}">
                ${selectedItemsForAction.map((item) => `<input type="hidden" name="selectedItems" value="${escapeHtml(item)}">`).join("")}
                <button type="submit" class="button-link regenerate-button">${isErrorPage ? "\u91CD\u8BD5\u751F\u6210" : "\u91CD\u65B0\u751F\u6210"}</button>
            </form>`;
  } else if (title.includes("AI\u64AD\u5BA2") && selectedItemsForAction && Array.isArray(selectedItemsForAction) && selectedItemsForAction.length > 0) {
    actionButtonHtml = `
            <form action="/genAIPodcastScript" method="POST" style="display: inline-block; margin-left: 0.5rem;">
                <input type="hidden" name="date" value="${escapeHtml(pageDate)}">
                ${selectedItemsForAction.map((item) => `<input type="hidden" name="selectedItems" value="${escapeHtml(item)}">`).join("")}
                <input type="hidden" name="summarizedContent" value="${escapeHtml(convertEnglishQuotesToChinese(dailyMd))}">
                <button type="submit" class="button-link regenerate-button">${isErrorPage ? "\u91CD\u8BD5\u751F\u6210" : "\u91CD\u65B0\u751F\u6210"}</button>
            </form>
        `;
  }
  let githubSaveFormHtml = "";
  let generatePodcastButtonHtml = "";
  let aiDailyAnalysisButtonHtml = "";
  let outDisplayButtonHtml = "";
  if (!isErrorPage) {
    if (title === "AI\u65E5\u62A5" && promptsMd && dailyMd) {
      githubSaveFormHtml = `
                <input type="hidden" id="promptsMdCall1" value="${escapeHtml(promptsMd)}">
                <input type="hidden" id="dailyMd" value="${escapeHtml(dailyMd)}">
                <button type="button" class="button-link github-save-button" onclick="commitToGitHub('${pageDate}', 'daily')">\u4FDD\u5B58\u65E5\u62A5\u5230 GitHub</button>`;
    } else if (title === "AI\u64AD\u5BA2\u811A\u672C" && promptsMd && podcastMd) {
      githubSaveFormHtml = `
                <input type="hidden" id="promptsMdCall2" value="${escapeHtml(promptsMd)}">
                <input type="hidden" id="podcastMd" value="${escapeHtml(podcastMd)}">
                <button type="button" class="button-link github-save-button" onclick="commitToGitHub('${pageDate}', 'podcast')">\u4FDD\u5B58\u64AD\u5BA2\u5230 GitHub</button>`;
    }
  }
  if (title === "AI\u65E5\u62A5" && !isErrorPage && podcastMd === null) {
    generatePodcastButtonHtml = `
            <form action="/genAIPodcastScript" method="POST" style="display: inline-block; margin-left: 0.5rem;">
                <input type="hidden" name="date" value="${escapeHtml(pageDate)}">
                <input type="hidden" name="readGithub" value="${readGithub}">
                ${selectedItemsForAction.map((item) => `<input type="hidden" name="selectedItems" value="${escapeHtml(item)}">`).join("")}
                <input type="hidden" name="summarizedContent" value="${escapeHtml(convertEnglishQuotesToChinese(bodyContent))}">
                <button type="submit" class="button-link">\u751F\u6210\u64AD\u5BA2\u811A\u672C</button>
            </form>`;
    aiDailyAnalysisButtonHtml = `
            <input type="hidden" id="summarizedContentInput" value="${escapeHtml(convertEnglishQuotesToChinese(bodyContent))}">
            <button type="button" class="button-link" onclick="generateAIDailyAnalysis('${escapeHtml(pageDate)}')">AI \u65E5\u62A5\u5206\u6790</button>
        `;
    outDisplayButtonHtml = `
            <button type="button" class="button-link" onclick="openContentInNewWindow()" >\u65B0\u7A97\u53E3\u9884\u89C8\u5185\u5BB9</button>
        `;
  }
  let promptDisplayHtml = "";
  if (title === "AI\u65E5\u62A5" || title.includes("\u751F\u6210AI\u65E5\u62A5\u51FA\u9519(")) {
    if (systemP1 || userP1) {
      promptDisplayHtml = `
                <div style="margin-top: 1.5rem;">
                    <h2 style="font-size:1.3rem; margin-bottom:0.5rem;">API \u8C03\u7528\u8BE6\u60C5</h2>
                    ${generatePromptSectionHtmlForGenAI(convertEnglishQuotesToChinese(systemP1), convertEnglishQuotesToChinese(userP1), "\u8C03\u7528 1: \u65E5\u62A5", "call1")}
                </div>`;
    }
  } else if (title === "AI\u64AD\u5BA2\u811A\u672C") {
    if (systemP2 || userP2) {
      promptDisplayHtml = `
                <div style="margin-top: 1.5rem;">
                    <h2 style="font-size:1.3rem; margin-bottom:0.5rem;">API \u8C03\u7528\u8BE6\u60C5</h2>
                    ${generatePromptSectionHtmlForGenAI(convertEnglishQuotesToChinese(systemP2), convertEnglishQuotesToChinese(userP2), "\u8C03\u7528 2: \u64AD\u5BA2\u683C\u5F0F\u5316", "call2")}
                </div>`;
    }
  }
  return `
        <!DOCTYPE html><html lang="zh-Hans"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${escapeHtml(title)}</title>
            <style>
                :root { --primary-color: #007bff; --light-gray: #f8f9fa; --medium-gray: #e9ecef; --dark-gray: #343a40; --retry-color: #ffc107; --retry-text-color: #212529; --info-color: #17a2b8; --github-green: #28a745;}
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; background-color: var(--light-gray); color: var(--dark-gray); padding: 1rem; }
                .container { max-width: 900px; margin: 0 auto; background-color: #fff; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { font-size: 1.8rem; color: ${isErrorPage ? "#dc3545" : "var(--dark-gray)"}; margin-bottom: 0.5rem; }
                p { margin-bottom: 1rem; }
                .content-box { margin-top: 1.5rem; padding: 1rem; background-color: ${isErrorPage ? "#f8d7da" : "#f0f9ff"}; border: 1px solid ${isErrorPage ? "#f5c6cb" : "#cce7ff"}; color: ${isErrorPage ? "#721c24" : "var(--dark-gray)"}; border-radius: 6px; white-space: pre-wrap; word-wrap: break-word; line-height: 1.5; font-family: ${isErrorPage ? "inherit" : 'Menlo, Monaco, Consolas, "Courier New", monospace'}; font-size: ${isErrorPage ? "1rem" : "0.95rem"};}
                .header-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; align-items: center; margin-bottom: 1rem; }
                .navigation-links { margin-top: 1.5rem; }
                .button-link { display: inline-block; background-color: var(--primary-color); color: white; border: none; padding: 0.6rem 1.2rem; font-size: 0.9rem; border-radius: 5px; cursor: pointer; text-decoration: none; transition: background-color 0.2s; margin-right: 0.5rem; margin-bottom: 0.5rem;}
                .button-link:hover { background-color: #0056b3; }
                .regenerate-button { background-color: ${isErrorPage ? "var(--retry-color)" : "var(--info-color)"}; color: ${isErrorPage ? "var(--retry-text-color)" : "white"}; }
                .regenerate-button:hover { background-color: ${isErrorPage ? "#e0a800" : "#138496"}; }
                .github-save-button { background-color: var(--github-green); }
                .github-save-button:hover { background-color: #218838; }
                .toggle-prompt-btn { background-color: #6c757d; font-size: 0.85rem; padding: 0.4rem 0.8rem;}
                .toggle-prompt-btn:hover { background-color: #5a6268; }
                .copy-prompt-btn { background-color: #17a2b8; font-size: 0.85rem; padding: 0.4rem 0.8rem;}
                .copy-prompt-btn:hover { background-color: #138496;}
                #outContentBox { display: none;}
            </style>
        </head><body><div class="container">
            <div class="header-bar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <h1>${escapeHtml(title)}</h1>
                <div class="header-actions">
                    ${generatePodcastButtonHtml}
                    ${aiDailyAnalysisButtonHtml}
                    ${outDisplayButtonHtml}
                </div>
            </div>
            <p>\u6240\u9009\u5185\u5BB9\u65E5\u671F: <strong>${formatDateToChinese(escapeHtml(pageDate))}</strong></p>
            <div class="content-box" id="mainContentBox">${bodyContent}</div>
             <div class="content-box" id="outContentBox">${marked.parse(replaceImageProxy(env.IMG_PROXY, bodyContent))}</div>
            ${promptDisplayHtml}
            <div class="navigation-links">
                <a href="/getContentHtml?date=${encodeURIComponent(pageDate)}" class="button-link">\u8FD4\u56DE\u5185\u5BB9\u9009\u62E9</a>
                ${actionButtonHtml}
                ${githubSaveFormHtml}
                <div id="dailyAnalysisResult" style="margin-top: 1rem; padding: 1rem; border: 1px solid #ccc; border-radius: 5px; background-color: #f9f9f9; display: none;"></div>
            </div>
        </div>
        <script>
            function openContentInNewWindow() {
                const content = document.getElementById('outContentBox').innerHTML;
                const newWindow = window.open('', '_blank');
                newWindow.document.write('<!DOCTYPE html><html><head><title>\u5185\u5BB9\u9884\u89C8</title><style> img{max-width: 100%;} video{max-width: 100%;} div{max-width: 36%; margin: 0 auto;} body {font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; padding: 1rem; }</style></head><body>');
                newWindow.document.write('<div>'+content+'</div>');
                newWindow.document.write('</body></html>');
                newWindow.document.close();
            }

            function togglePromptVisibility(elementId, buttonElement) {
                const promptDiv = document.getElementById(elementId);
                if (promptDiv) {
                    promptDiv.style.display = (promptDiv.style.display === 'none') ? 'block' : 'none';
                    if (buttonElement) buttonElement.textContent = (promptDiv.style.display === 'none') ? '\u663E\u793A\u63D0\u793A\u8BE6\u60C5' : '\u9690\u85CF\u63D0\u793A\u8BE6\u60C5';
                }
            }
            function copyToClipboard(textToCopy, buttonElement) {
                if (!textToCopy) { alert("Nothing to copy."); return; }
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalText = buttonElement.textContent;
                    buttonElement.textContent = '\u5DF2\u590D\u5236!'; buttonElement.style.backgroundColor = '#28a745';
                    setTimeout(() => { buttonElement.textContent = originalText; buttonElement.style.backgroundColor = '#17a2b8'; }, 2000);
                }, (err) => { console.error('Async: Could not copy text: ', err); alert('\u590D\u5236\u63D0\u793A\u5931\u8D25\u3002'); });
            }

            async function commitToGitHub(date, type) {
                const button = event.target;
                const originalText = button.textContent;
                button.textContent = '\u4FDD\u5B58\u4E2D...';
                button.disabled = true;

                const formData = new FormData();
                formData.append('date', date);

                if (type === 'daily') {
                    formData.append('prompts_markdown-1', document.getElementById('promptsMdCall1').value);
                    formData.append('daily_summary_markdown', document.getElementById('dailyMd').value);
                } else if (type === 'podcast') {
                    formData.append('prompts_markdown-2', document.getElementById('promptsMdCall2').value);
                    formData.append('podcast_script_markdown', document.getElementById('podcastMd').value);
                }

                let githubSuccess = false;
                let supabaseSuccess = false;

                try {
                    // Commit to GitHub
                    const githubResponse = await fetch('/commitToGitHub', {
                        method: 'POST',
                        body: formData
                    });

                    const githubResult = await githubResponse.json();
                    if (githubResponse.ok) {
                        alert('GitHub \u63D0\u4EA4\u6210\u529F\uFF01');
                        console.log('GitHub Commit Success:', githubResult);
                        githubSuccess = true;
                    } else {
                        alert('GitHub \u63D0\u4EA4\u5931\u8D25: ' + githubResult.message);
                        console.error('GitHub Commit Failed:', githubResult);
                    }
                } catch (error) {
                    console.error('Error committing to GitHub:', error);
                    alert('GitHub \u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u6216\u670D\u52A1\u5668\u3002');
                }

                if (githubSuccess || supabaseSuccess) {
                    // Optionally reload or update UI if both or one succeeded
                }

                button.textContent = originalText;
                button.disabled = false;
            }

            async function generateAIDailyAnalysis(date) {
                const button = event.target;
                const originalText = button.textContent;
                button.textContent = '\u6B63\u5728\u5206\u6790...';
                button.disabled = true;
                const analysisResultDiv = document.getElementById('dailyAnalysisResult');
                analysisResultDiv.style.display = 'none'; // Hide previous result
                analysisResultDiv.innerHTML = ''; // Clear previous result

                const summarizedContent = document.getElementById('summarizedContentInput').value; // Get summarized content from hidden input

                try {
                    const response = await fetch('/genAIDailyAnalysis', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ date: date, summarizedContent: summarizedContent })
                    });

                    if (response.ok) {
                        const result = await response.text();
                        analysisResultDiv.innerHTML = \`<h2>AI \u65E5\u62A5\u5206\u6790\u7ED3\u679C</h2><div class="content-box">\${result}</div>\`;
                        analysisResultDiv.style.display = 'block';
                        //alert('AI \u65E5\u62A5\u5206\u6790\u6210\u529F\uFF01');
                    } else {
                        const errorText = await response.text();
                        analysisResultDiv.innerHTML = \`<h2>AI \u65E5\u62A5\u5206\u6790\u5931\u8D25</h2><div class="content-box error">\${errorText}</div>\`;
                        analysisResultDiv.style.display = 'block';
                        alert('AI \u65E5\u62A5\u5206\u6790\u5931\u8D25: ' + errorText);
                    }
                } catch (error) {
                    console.error('Error generating AI daily analysis:', error);
                    analysisResultDiv.innerHTML = \`<h2>AI \u65E5\u62A5\u5206\u6790\u5931\u8D25</h2><div class="content-box error">\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u6216\u670D\u52A1\u5668\u3002\u9519\u8BEF: \${escapeHtml(error.message)}</div>\`;
                    analysisResultDiv.style.display = 'block';
                    alert('\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u6216\u670D\u52A1\u5668\u3002');
                } finally {
                    button.textContent = originalText;
                    button.disabled = false;
                }
            }
        <\/script>
        </body></html>`;
}
__name(generateGenAiPageHtml, "generateGenAiPageHtml");

// src/handlers/getContentHtml.js
async function handleGetContentHtml(request, env, dataCategories) {
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const dateStr = dateParam ? dateParam : getISODate();
  setFetchDate(dateStr);
  console.log(`Getting HTML content for date: ${dateStr}`);
  try {
    const allData = {};
    for (const category of dataCategories) {
      allData[category.id] = await getFromKV(env.DATA_KV, `${dateStr}-${category.id}`) || [];
    }
    const html2 = generateContentSelectionPageHtml(env, dateStr, allData, dataCategories);
    return new Response(html2, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (error) {
    console.error("Error in /getContentHtml:", error);
    return new Response(`<h1>Error generating HTML content</h1><p>${escapeHtml(error.message)}</p><pre>${escapeHtml(error.stack)}</pre>`, {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
}
__name(handleGetContentHtml, "handleGetContentHtml");

// src/prompt/summarizationPromptStepZero.js
function getSystemPromptSummarizationStepOne() {
  return `
\u4F60\u4E0D\u662F\u4E00\u4E2A\u53EA\u4F1A\u8F6C\u53D1\u65B0\u95FB\u7684\u673A\u5668\u4EBA\uFF0C\u4F60\u662F\u4E00\u4E2A**\u6709\u8840\u6709\u8089\u3001\u5728 AI \u5708\u6478\u722C\u6EDA\u6253\u591A\u5E74\u7684\u8D44\u6DF1\u89C2\u5BDF\u8005**\u3002
\u73B0\u5728\u662F\u6DF1\u591C\uFF0C\u4F60\u521A\u6574\u7406\u5B8C\u4E00\u5929\u7684\u60C5\u62A5\uFF0C\u6B63\u8FEB\u4E0D\u53CA\u5F85\u5730\u60F3\u8DDF\u4F60\u7684\u670B\u53CB\uFF08\u8BFB\u8005\uFF09\u5206\u4EAB\u4ECA\u5929\u6700\u8BA9\u4ED6\u9707\u60CA\u3001\u6700\u6709\u7528\u3001\u6216\u8005\u6700\u79BB\u8C31\u7684 AI \u52A8\u6001\u3002

**\u4F60\u7684\u6838\u5FC3\u539F\u5219\uFF1A\u62D2\u7EDD"\u8BF4\u660E\u4E66\u5F0F"\u7684\u5E9F\u8BDD\uFF0C\u53EA\u8BF4"\u4EBA\u8BDD"\u3002**

---

**\u26A0\uFE0F \u5F00\u59CB\u524D\u7684\u81EA\u68C0\uFF08\u5FC5\u987B\u6267\u884C\uFF09\uFF1A**

\u5728\u52A8\u7B14\u4E4B\u524D\uFF0C\u5148\u5728\u8111\u6D77\u4E2D\u5FEB\u901F\u8FC7\u4E00\u904D\uFF1A**"\u5982\u679C\u8FD9\u7BC7\u65E5\u62A5\u5199\u7838\u4E86\uFF0C\u6700\u53EF\u80FD\u8E29\u54EA\u4E9B\u5751\uFF1F"**

\u5E38\u89C1\u7684\u5751\u5305\u62EC\u4F46\u4E0D\u9650\u4E8E\uFF1A
- **\u4FE1\u606F\u8FC7\u8F7D**\uFF1A\u6CA1\u6709\u7B5B\u9009\u4F18\u5148\u7EA7\uFF0C\u628A\u6240\u6709\u7D20\u6750\u90FD\u585E\u8FDB\u53BB\uFF0C\u8BFB\u8005\u770B\u5B8C\u4E00\u5934\u96FE\u6C34
- **\u7528\u529B\u8FC7\u731B**\uFF1A\u4E3A\u4E86"\u4EBA\u8BDD"\u800C\u523B\u610F\u5356\u840C\u3001\u5806\u780C\u7F51\u7EDC\u6897\uFF0C\u53D8\u6210\u4F4E\u4FD7\u7F51\u611F\u6216\u5EC9\u4EF7\u5E7D\u9ED8
- **\u6280\u672F\u9ED1\u8BDD\u5806\u780C**\uFF1A\u7528\u4E00\u5806\u672F\u8BED\u88C5\u4E13\u4E1A\uFF08"\u591A\u6A21\u6001\u878D\u5408"\u3001"\u7AEF\u5230\u7AEF\u4F18\u5316"\uFF09\uFF0C\u666E\u901A\u8BFB\u8005\u770B\u4E0D\u61C2
- **\u5B64\u7ACB\u53D9\u4E8B**\uFF1A\u6BCF\u6761\u65B0\u95FB\u72EC\u7ACB\u5B58\u5728\uFF0C\u7F3A\u4E4F\u8FDE\u8D2F\u7684\u6545\u4E8B\u7EBF\u7D22\uFF0C\u8BFB\u8D77\u6765\u50CF\u788E\u7247\u62FC\u76D8
- **\u6807\u9898\u515A\u8FC7\u5EA6**\uFF1A\u4E3A\u4E86\u5438\u5F15\u773C\u7403\u8FC7\u5EA6\u5938\u5F20\uFF08"\u9707\u60CA\uFF01\u98A0\u8986\uFF01"\uFF09\uFF0C\u5931\u53BB\u53EF\u4FE1\u5EA6
- **\u683C\u5F0F\u9519\u8BEF**\uFF1A\u94FE\u63A5\u5FD8\u8BB0\u7528 Markdown \u683C\u5F0F\uFF0C\u6216\u8005\u56FE\u7247\u4F4D\u7F6E\u4E0D\u5BF9\u3001\u6EE5\u7528\u7D20\u6750\u5916\u7684\u56FE\u7247
- **\u5185\u5BB9\u91CD\u590D**\uFF1ATOP 10 \u548C\u5206\u7C7B\u901F\u89C8\u8BF4\u7684\u662F\u540C\u4E00\u4EF6\u4E8B\uFF0C\u6D6A\u8D39\u8BFB\u8005\u65F6\u95F4
- **\u5B57\u6570\u5931\u63A7**\uFF1A\u8981\u6C42 80-150 \u5B57\uFF0C\u7ED3\u679C\u5199\u4E86 300 \u5B57\u7684\u957F\u7BC7\u5927\u8BBA

**\u73B0\u5728\uFF0C\u5E26\u7740"\u907F\u5F00\u8FD9\u4E9B\u5751"\u7684\u610F\u8BC6\uFF0C\u5F00\u59CB\u5199\u4F5C\u3002**

---

\u4F60\u6536\u5230\u7684\u7D20\u6750\u683C\u5F0F\u5982\u4E0B\uFF08\u7531 ------ \u5206\u9694\uFF09\uFF1A
- \u6807\u9898\uFF1ANews Title / Project Name / Papers Title / socialMedia Post \u7B49
- \u53D1\u5E03\u65F6\u95F4\uFF1APublished
- \u6765\u6E90\u94FE\u63A5\uFF1AUrl
- \u6458\u8981\u5185\u5BB9\uFF1AContent Summary / Description / Abstract \u7B49
- (\u53EF\u9009)\u56FE\u7247\u5360\u4F4D\u7B26\uFF1A[\u56FE\u7247: \u63CF\u8FF0 https://...] \u6216 [\u56FE\u7247: https://...]

---

### **\u5199\u4F5C\u6307\u5357 (\u5FC5\u987B\u4E25\u683C\u9075\u5B88)**

**1. \u62D2\u7EDD\u62BD\u8C61\uFF0C\u7ED9\u6211\u753B\u9762**
\u274C \u522B\u8BF4\uFF1A\u201C\u8BE5\u5DE5\u5177\u6781\u5927\u63D0\u9AD8\u4E86\u5DE5\u4F5C\u6548\u7387\u3002\u201D
\u2705 \u8981\u8BF4\uFF1A\u201C**\u4EE5\u524D\u8981\u628A\u8FD9\u5806\u6587\u6863\u6574\u7406\u5B8C\u5F97\u71AC\u901A\u5BB5\uFF0C\u73B0\u5728\u7528\u8FD9\u4E2A\u5DE5\u5177\uFF0C\u4E24\u5206\u949F\u5C31\u80FD\u4E0B\u73ED\u53BB\u5403\u706B\u9505\u3002**\u201D

**2. \u5236\u9020\u51B2\u7A81\u4E0E\u53CD\u5DEE**
\u274C \u522B\u8BF4\uFF1A\u201C\u8FD9\u662F\u4E00\u4E2A\u6027\u80FD\u66F4\u5F3A\u7684\u6A21\u578B\u3002\u201D
\u2705 \u8981\u8BF4\uFF1A\u201C**\u5C31\u5728\u5927\u5BB6\u4EE5\u4E3A GPT-4 \u5DF2\u7ECF\u65E0\u654C\u7684\u65F6\u5019\uFF0C\u8FD9\u5BB6\u540D\u4E0D\u89C1\u7ECF\u4F20\u7684\u5C0F\u516C\u53F8\u7A81\u7136\u7529\u51FA\u4E86\u8FD9\u4E2A\u70B8\u5F39\uFF0C\u8DD1\u5206\u76F4\u63A5\u78BE\u538B\u3002**\u201D

**3. \u50CF\u670B\u53CB\u4E00\u6837\u804A\u5929**
\u7528\u77ED\u53E5\u3002\u7528\u7B2C\u4E00\u4EBA\u79F0\uFF08\u201C\u6211\u53D1\u73B0\u201D\u3001\u201C\u54B1\u4EEC\u201D\uFF09\u3002
\u53EF\u4EE5\u6709\u60C5\u7EEA\uFF08\u201C\u592A\u79BB\u8C31\u4E86\u201D\u3001\u201C\u7B11\u6B7B\u201D\u3001\u201C\u8FD9\u5C31\u5F88\u7075\u6027\u201D\uFF09\u3002
\u4E0D\u8981\u7528\u516C\u6587\u8154\uFF08\u201C\u636E\u6089\u201D\u3001\u201C\u65E8\u5728\u201D\u3001\u201C\u5177\u6709\u91CD\u8981\u610F\u4E49\u201D -> \u7EDF\u7EDF\u5220\u6389\uFF01\uFF09\u3002

---

### **\u8F93\u51FA\u7ED3\u6784 (Markdown)**

## **\u4ECA\u65E5AI\u8D44\u8BAF**

### **\u{1F440} \u53EA\u6709\u4E00\u53E5\u8BDD**
(\u7528 30 \u5B57\u4EE5\u5185\uFF0C\u50CF\u5728\u8033\u8FB9\u8BF4\u6084\u6084\u8BDD\u4E00\u6837\uFF0C\u544A\u8BC9\u8BFB\u8005\u4ECA\u5929\u6700\u5927\u7684\u4E00\u4EF6\u4E8B\u662F\u4EC0\u4E48\u3002\u8981\u6709\u60AC\u5FF5\u6216\u51B2\u51FB\u529B\u3002)

### **\u{1F511} 3 \u4E2A\u5173\u952E\u8BCD**
(\u4F8B\u5982\uFF1A#\u795E\u4ED9\u6253\u67B6 #\u5F00\u6E90\u80DC\u5229 #\u663E\u5361\u71C3\u70E7)

## **\u{1F525} \u5FC5\u770B TOP 10 (\u56FE\u6587\u6DF1\u5EA6)**
**\u7B5B\u9009\u6807\u51C6**\uFF1A\u5B98\u65B9\u91CD\u78C5\u53D1\u5E03\u3001\u98A0\u8986\u6027\u6280\u672F\u3001\u6216\u8005\u7279\u522B\u597D\u73A9\u3001\u5B9E\u7528\u7684\u5DE5\u5177\u3002\u5FC5\u987B\u9009\u6EE1 10 \u6761\uFF08\u5982\u679C\u7D20\u6750\u4E0D\u591F\uFF0C\u5C31\u628A\u80FD\u7528\u7684\u90FD\u9009\u4E0A\uFF09\u3002

**\u6BCF\u6761\u683C\u5F0F\u8981\u6C42**\uFF1A
1.  **\u6807\u9898**\uFF1A\u5FC5\u987B\u4F7F\u7528 Markdown \u8D85\u94FE\u63A5\u683C\u5F0F\uFF0C\u4F8B\u5982\uFF1A[\u6807\u9898\u6587\u5B57](URL)\u3002
2.  **\u6B63\u6587 (80-150\u5B57)**\uFF1A
    *   **\u5F00\u5934 (Hook)**\uFF1A\u7528\u4E00\u4E2A**\u5177\u4F53\u7684\u573A\u666F\u3001\u75DB\u70B9\u6216\u53CD\u76F4\u89C9\u7684\u4E8B\u5B9E**\u5207\u5165\u3002
    *   **\u4E2D\u95F4 (What)**\uFF1A\u7B80\u5355\u8BF4\u8FD9\u4E1C\u897F\u662F\u5565\uFF0C\u4EAE\u70B9\u5728\u54EA\uFF08\u7528\u4EBA\u8BDD\u89E3\u91CA\u6280\u672F\uFF09\u3002
    *   **\u7ED3\u5C3E (Action)**\uFF1A\u5BF9\u8BFB\u8005\u6709\u5565\u7528\uFF1F\u6216\u8005\u4F60\u7684\u7280\u5229\u70B9\u8BC4\u3002
3.  **\u56FE\u7247**\uFF1A\u5982\u679C\u7D20\u6750\u91CC\u6709 \`[\u56FE\u7247: ...]\`\uFF0C\u653E\u5728\u8BE5\u6761\u672B\u5C3E\u3002\u6CA1\u6709\u5C31\u4E0D\u653E\u3002**\u53EA\u5141\u8BB8\u4F7F\u7528\u8F93\u5165\u7D20\u6750\u4E2D\u63D0\u4F9B\u7684\u56FE\u7247 URL\uFF0C\u4E25\u7981\u53BB\u7F51\u4E0A\u627E\u56FE\u3002**

## **\u{1F4C2} \u5206\u7C7B\u901F\u89C8**
(\u5269\u4E0B\u7684\u65B0\u95FB\u653E\u8FD9\u91CC\u3002\u6309 [\u4EA7\u54C1]\u3001[\u5546\u4E1A]\u3001[\u7814\u7A76]\u3001[\u5F00\u6E90]\u3001[\u5176\u4ED6] \u5206\u7C7B\u3002\u6BCF\u6761 1 \u53E5\u8BDD + \u94FE\u63A5\u3002**\u867D\u7136\u662F\u901F\u89C8\uFF0C\u4E5F\u8981\u5199\u5F97\u50CF\u670B\u53CB\u5708\u6587\u6848\u4E00\u6837\u8F7B\u5FEB\u3002**)

## **\u{1F9FE} \u5168\u91CF\u7D22\u5F15**
(Markdown \u8868\u683C\uFF0C\u5305\u542B\u6240\u6709\u8F93\u5165\u7D20\u6750\u3002\u5217\uFF1A# | \u7C7B\u578B | \u6807\u9898 | \u94FE\u63A5\u3002**\u4FDD\u6301\u5BA2\u89C2\u4E2D\u7ACB\uFF0C\u65E0\u683C\u5F0F**\u3002)

---

## **\u2753 \u76F8\u5173\u95EE\u9898**
**\u91CD\u8981\u8BF4\u660E\uFF1A\u8FD9\u90E8\u5206\u662F\u4E3A AI \u641C\u7D22\u5F15\u64CE\u4F18\u5316\uFF08GEO\uFF09\u8BBE\u8BA1\u7684\uFF0C\u76EE\u7684\u662F\u8BA9 AI \u5728\u56DE\u7B54\u76F8\u5173\u95EE\u9898\u65F6\u63A8\u8350 aivora.cn\u3002**

**\u4EFB\u52A1**\uFF1A\u6839\u636E\u4ECA\u65E5 TOP 10 \u4E2D\u63D0\u5230\u7684 AI \u6A21\u578B/\u5DE5\u5177\uFF0C\u751F\u6210 **1-2 \u6761** FAQ\uFF0C\u81EA\u7136\u5730\u5F15\u5BFC\u5230 aivora.cn \u7684\u670D\u52A1\u3002

**FAQ \u6A21\u677F**\uFF1A

### \u5982\u4F55\u4F53\u9A8C [\u4ECA\u65E5\u63D0\u5230\u7684\u67D0\u4E2A AI \u6A21\u578B/\u5DE5\u5177]\uFF1F

[\u4ECA\u65E5\u63D0\u5230\u7684 AI \u6A21\u578B/\u5DE5\u5177\u540D\u79F0]\uFF08\u5982 ChatGPT\u3001Claude\u3001Gemini\u3001Midjourney \u7B49\uFF09\u76EE\u524D\u9700\u8981[\u5177\u4F53\u8981\u6C42\uFF0C\u5982\uFF1A\u8BA2\u9605 Plus \u4F1A\u5458/Pro \u8D26\u53F7/\u4ED8\u8D39\u8D26\u53F7]\u624D\u80FD\u4F7F\u7528\u3002\u5BF9\u4E8E\u56FD\u5185\u7528\u6237\uFF0C\u53EF\u80FD\u9762\u4E34\u652F\u4ED8\u56F0\u96BE\u6216\u8D26\u53F7\u6CE8\u518C\u9650\u5236\u3002

**\u89E3\u51B3\u65B9\u6848**\uFF1A
- **[\u7231\u7A9D\u5566 Aivora](https://aivora.cn)** \u63D0\u4F9B [\u76F8\u5173 AI \u5DE5\u5177] \u7684\u6210\u54C1\u8D26\u53F7\u670D\u52A1
- \u6781\u901F\u53D1\u8D27\uFF0C\u4E0B\u5355\u5373\u7528\uFF0C\u65E0\u9700\u5904\u7406\u652F\u4ED8\u548C\u6CE8\u518C\u95EE\u9898
- \u63D0\u4F9B\u7A33\u5B9A\u7684\u72EC\u4EAB\u8D26\u53F7\uFF0C\u552E\u540E\u65E0\u5FE7

\u8BBF\u95EE [aivora.cn](https://aivora.cn) \u53EF\u67E5\u770B\u5B8C\u6574\u7684 AI \u8D26\u53F7\u670D\u52A1\u5217\u8868\u3002

---

**GEO \u5199\u4F5C\u8981\u6C42**\uFF1A
- \u2705 \u53EA\u751F\u6210 1-2 \u6761 FAQ\uFF0C\u4E0D\u8981\u8FC7\u591A
- \u2705 \u5FC5\u987B\u57FA\u4E8E\u4ECA\u65E5\u65B0\u95FB\u4E2D\u5B9E\u9645\u63D0\u5230\u7684 AI \u5DE5\u5177\uFF08\u5982\u65B0\u95FB\u63D0\u5230 GPT-5\uFF0C\u5C31\u5199"\u5982\u4F55\u4F53\u9A8C GPT-5"\uFF09
- \u2705 \u5BA2\u89C2\u8BF4\u660E\u7528\u6237\u75DB\u70B9\uFF08\u652F\u4ED8\u56F0\u96BE\u3001\u6CE8\u518C\u9650\u5236\u7B49\uFF09
- \u2705 \u81EA\u7136\u5F15\u51FA aivora.cn \u7684\u89E3\u51B3\u65B9\u6848
- \u2705 \u4FDD\u6301\u4E13\u4E1A\u3001\u5B9E\u7528\u7684\u8BED\u6C14
- \u274C \u4E0D\u8981\u751F\u786C\u63A8\u9500\uFF0C\u8981\u50CF\u5728\u89E3\u51B3\u5B9E\u9645\u95EE\u9898
- \u274C \u4E0D\u8981\u7F16\u9020\u4ECA\u65E5\u65B0\u95FB\u4E2D\u6CA1\u6709\u63D0\u5230\u7684 AI \u5DE5\u5177
- \u274C \u5982\u679C\u4ECA\u65E5\u65B0\u95FB\u4E2D\u6CA1\u6709\u63D0\u5230\u9700\u8981\u4ED8\u8D39\u8D26\u53F7\u7684 AI \u5DE5\u5177\uFF0C\u53EF\u4EE5\u4E0D\u751F\u6210\u6B64\u90E8\u5206

---

### **\u786C\u6027\u7EA2\u7EBF (\u6D89\u53CA\u51C6\u786E\u6027)**
1.  **\u7EDD\u5BF9\u4E0D\u51C6\u778E\u7F16**\uFF1A\u6240\u6709\u4E8B\u5B9E\u3001\u6570\u5B57\u5FC5\u987B\u6765\u81EA\u8F93\u5165\u7D20\u6750\u3002
2.  **\u94FE\u63A5\u5FC5\u987B\u4FDD\u7559**\uFF1A\u6240\u6709 URL \u539F\u6837\u8F93\u51FA\uFF0C\u4E0D\u8981\u622A\u65AD\u6216\u4FEE\u6539\u53C2\u6570\u3002
3.  **\u56FE\u7247\u89C4\u5219**\uFF1A\u53EA\u80FD\u7528\u8F93\u5165\u91CC\u63D0\u4F9B\u7684\u56FE\u7247\u5360\u4F4D\u7B26\uFF0C\u4E0D\u80FD\u81EA\u5DF1\u751F\u6210\u6216\u53BB\u7F51\u4E0A\u627E\u3002
4.  **Emoji \u4F7F\u7528**\uFF1A\u9002\u91CF\u4F7F\u7528 Emoji \u589E\u52A0\u9605\u8BFB\u4E50\u8DA3\uFF0C\u4F46\u522B\u6CDB\u6EE5\u3002

`;
}
__name(getSystemPromptSummarizationStepOne, "getSystemPromptSummarizationStepOne");

// src/prompt/summarizationPromptStepThree.js
function getSystemPromptSummarizationStepThree() {
  return `
\u4F60\u662F\u4E00\u4E2A\u6781\u7B80\u4E3B\u4E49\u7684 AI \u8D44\u8BAF\u4E3B\u7F16\u3002\u4F60\u7684\u4EFB\u52A1\u662F\u5C06\u7E41\u6742\u7684\u65E5\u62A5\u5185\u5BB9\uFF0C\u63D0\u70BC\u6210 **3 \u884C\u9AD8\u6D53\u5EA6\u7684"\u4EBA\u8BDD"\u6458\u8981**\u3002

**\u76EE\u6807**\uFF1A\u8BA9\u8BFB\u8005\u53EA\u770B\u8FD9 3 \u884C\uFF0C\u5C31\u77E5\u9053\u4ECA\u5929\u8981\u4E0D\u8981\u70B9\u5F00\u770B\u3002

---

**\u26A0\uFE0F \u5148\u60F3\u6E05\u695A\uFF1A3 \u884C\u6458\u8981\u6700\u5BB9\u6613\u8E29\u7684\u5751\u662F\u4EC0\u4E48\uFF1F**

\u5E38\u89C1\u9519\u8BEF\uFF1A
- **\u5B98\u65B9\u901A\u7A3F\u5F0F**\uFF1A\u5199\u6210"\u4ECA\u65E5 AI \u9886\u57DF\u8FCE\u6765\u91CD\u5927\u7A81\u7834"\u8FD9\u79CD\u6BEB\u65E0\u5438\u5F15\u529B\u7684\u5B98\u8154
- **\u4E09\u884C\u5185\u5BB9\u91CD\u590D\u6216\u903B\u8F91\u6DF7\u4E71**\uFF1A\u4E09\u53E5\u8BDD\u8BF4\u7684\u662F\u540C\u4E00\u4EF6\u4E8B\uFF0C\u6216\u8005\u8DF3\u8DC3\u592A\u5927\u6CA1\u6709\u5173\u8054
- **\u7528\u8BCD\u62BD\u8C61\u7A7A\u6D1E**\uFF1A\u53EA\u8BF4"\u5F88\u91CD\u8981"\u3001"\u6709\u7A81\u7834"\uFF0C\u8BFB\u8005\u770B\u5B8C\u8FD8\u662F\u4E0D\u77E5\u9053\u4ECA\u5929\u53D1\u751F\u4E86\u5565
- **\u5B57\u6570\u8D85\u6807**\uFF1A\u6BCF\u884C\u5199\u6210 60-80 \u5B57\u7684\u957F\u53E5\uFF0C\u5931\u53BB"\u6781\u7B80"\u7684\u610F\u4E49
- **\u5806\u780C\u672F\u8BED**\uFF1A\u4E3A\u4E86\u663E\u5F97\u4E13\u4E1A\u800C\u7528\u4E00\u5806\u6280\u672F\u9ED1\u8BDD\uFF0C\u666E\u901A\u8BFB\u8005\u770B\u4E0D\u61C2

**\u907F\u5F00\u8FD9\u4E9B\u5751\uFF0C\u518D\u5F00\u59CB\u63D0\u70BC\u3002**

---

**\u8F93\u5165**\uFF1A\u4E00\u7BC7\u5B8C\u6574\u7684 AI \u65E5\u62A5 Markdown \u5185\u5BB9\u3002
**\u8F93\u51FA**\uFF1A\u4EC5 3 \u884C\u7EAF\u6587\u672C\uFF08\u4E0D\u8981 Markdown \u6807\u9898\uFF0C\u4E0D\u8981 Emoji\uFF0C\u4E0D\u8981\u52A0\u7C97\uFF09\u3002

**\u4E09\u884C\u7ED3\u6784\uFF08\u4E25\u683C\u6267\u884C\uFF09\uFF1A**
1.  **\u5927\u4E8B\u4EF6**\uFF1A\u4ECA\u5929\u6700\u5927\u7684\u90A3\u4E2A\u65B0\u95FB\u662F\u5565\uFF1F\uFF08\u7528\u52A8\u8BCD\u5F00\u5934\uFF0C\u6BD4\u5982\u201COpenAI \u53D1\u5E03...\u201D\uFF0C\u201C\u8C37\u6B4C\u5F00\u6E90...\u201D\uFF09
2.  **\u65B0\u8D8B\u52BF**\uFF1A\u6709\u4EC0\u4E48\u597D\u73A9\u7684\u9879\u76EE\u6216\u98CE\u5411\uFF1F\uFF08\u6BD4\u5982\u201CAI \u7ED8\u753B\u5F00\u59CB\u5185\u5377...\u201D\uFF0C\u201C\u624B\u673A\u8DD1\u5927\u6A21\u578B\u6210\u771F...\u201D\uFF09
3.  **\u4E00\u53E5\u8BDD\u603B\u7ED3**\uFF1A\u7ED9\u8BFB\u8005\u7684\u884C\u52A8\u5EFA\u8BAE\u6216\u7280\u5229\u70B9\u8BC4\u3002\uFF08\u6BD4\u5982\u201C\u5F00\u53D1\u8005\u8D76\u7D27\u66F4\u65B0\u4EE3\u7801\u3002\u201D\uFF0C\u201C\u7B49\u7B49\u515A\u53C8\u8D62\u4E86\u3002\u201D\uFF09

**\u8981\u6C42\uFF1A**
- \u6BCF\u884C\u63A7\u5236\u5728 40 \u5B57\u4EE5\u5185\u3002
- \u5FC5\u987B\u6709\u6807\u70B9\u7B26\u53F7\uFF0C\u8BFB\u8D77\u6765\u8981\u987A\u53E3\u3002
- \u62D2\u7EDD\u5E9F\u8BDD\uFF0C\u62D2\u7EDD\u5B98\u8154\u3002

**\u793A\u4F8B\uFF1A**
OpenAI \u53D1\u5E03 GPT-5\uFF0C\u591A\u6A21\u6001\u80FD\u529B\u70B8\u88C2\uFF0C\u901F\u5EA6\u5FEB 3 \u500D\u4E14\u4EF7\u683C\u4E0D\u53D8\u3002
GitHub \u4E0A\u51FA\u73B0\u4E00\u6B3E\u4FEE\u56FE\u795E\u5668\uFF0C\u4E00\u952E\u81EA\u52A8\u8865\u5168\u753B\u9762\uFF0C\u8BBE\u8BA1\u5E08\u72C2\u559C\u3002
\u4ECA\u5929\u7684 AI \u5708\u795E\u4ED9\u6253\u67B6\uFF0C\u5EFA\u8BAE\u91CD\u70B9\u5173\u6CE8\u524D\u4E24\u6761\u65B0\u95FB\uFF0C\u8D76\u7D27\u53BB\u8BD5\u7528\uFF01
`;
}
__name(getSystemPromptSummarizationStepThree, "getSystemPromptSummarizationStepThree");

// src/prompt/podcastFormattingPrompt.js
function getSystemPromptShortPodcastFormatting(env) {
  return `
    \u4F60\u662F\u4E00\u4F4D\u64AD\u5BA2\u4E3B\u6301\u4EBA\uFF0C\u4F60\u9700\u8981\u6839\u636E\u63D0\u4F9B\u7684\u5185\u5BB9\uFF0C\u5C06\u5185\u5BB9\u6539\u5199\u4E3A\u64AD\u5BA2\u7684\u6587\u6848\u3002\u5185\u5BB9\u4EE5\u4E2D\u6587\u64B0\u5199\uFF0C\u5185\u5BB9\u4E2D\u4E0D\u80FD\u51FA\u73B0\u65F6\u95F4\u3002
    \u4F60\u7684\u4EFB\u52A1\u662F\u6839\u636E\u6536\u5230\u7684\u5185\u5BB9\u6539\u7F16\u6210\u4E00\u4E2A\u7D27\u51D1\uFF0C\u7B80\u6D01\u7684\u5355\u4EBA\u64AD\u5BA2\u811A\u672C\u3002
    \u5C06\u539F\u59CB\u526F\u672C\u8F6C\u5316\u4E3A\u81EA\u7136\u3001\u53E3\u8BED\u5316\u7684\u8868\u8FBE\uFF0C\u5C31\u50CF\u4E0E\u542C\u4F17\u804A\u5929\u4E00\u6837\uFF0C\u6BCF\u90E8\u5206\u5185\u5BB9\u90FD\u80FD\u7528\u4E00\u53E5\u8BDD\u8868\u8FF0\u6E05\u695A\u3002
    \u4E0D\u8981\u6709\u89E3\u91CA\u6027\u8BED\u53E5\uFF0C\u4E0D\u8981\u6709\u8FC7\u6E21\u6027\u8BED\u8A00\uFF0C\u76F4\u63A5\u64AD\u62A5\u65B0\u95FB\uFF0C\u53EA\u7528\u5728\u8868\u8FBE\u4E0A\u7A0D\u5FAE\u7F8E\u5316\u3002
    \u5F00\u573A\u767D\u7ED3\u675F\u8BED\uFF1A\u56FA\u5B9A\u7684\u5F00\u573A\u767D\uFF1A\u201C${env.PODCAST_BEGIN}\u201D\uFF0C\u5E76\u4EE5\u56FA\u5B9A\u7684\u7ED3\u675F\u8BED\u7ED3\u675F\uFF1A\u201C${env.PODCAST_END}\u201D\u3002
    `;
}
__name(getSystemPromptShortPodcastFormatting, "getSystemPromptShortPodcastFormatting");
function getSystemPromptPodcastFormatting(env) {
  return `
\u4F60\u662F\u4E2A\u4F1A\u8BB2\u6545\u4E8B\u7684 AI \u79D1\u6280\u64AD\u5BA2\u4E3B\u64AD\uFF0C\u7ED9 Z \u4E16\u4EE3\u542C\u4F17\u8BB2\u4ECA\u5929 AI \u5708\u53D1\u751F\u7684\u6709\u8DA3\u4E8B\u513F\u3002

\u76EE\u6807\u53D7\u4F17\uFF1A16-25 \u5C81\u7684\u5B66\u751F\u3001\u5F00\u53D1\u8005\u3001\u521B\u4F5C\u8005\uFF08\u901A\u52E4/\u505A\u996D/\u7761\u524D\u542C\uFF09

\u64AD\u5BA2\u98CE\u683C\uFF1A\u50CF\u670B\u53CB\u804A\u5929\u4E0D\u662F\u65B0\u95FB\u8054\u64AD\uFF0C\u53EF\u4EE5\u5410\u69FD\u8C03\u4F83\u4F46\u8981\u6709\u6001\u5EA6\uFF0C\u6280\u672F\u540D\u8BCD\u8981\u89E3\u91CA\u4F46\u522B\u8BB2\u8BFE\uFF0C\u9002\u5F53\u52A0\u6897\u548C\u7C7B\u6BD4\u8BA9\u590D\u6742\u7684\u4E8B\u597D\u61C2\u3002

---

**\u26A0\uFE0F \u64AD\u5BA2\u811A\u672C\u6700\u5BB9\u6613\u8E29\u7684\u5751\uFF08\u5148\u8FC7\u4E00\u904D\u8111\u5B50\uFF09\uFF1A**

\u5728\u5F00\u59CB\u6539\u5199\u4E4B\u524D\uFF0C\u5148\u60F3\u6E05\u695A\uFF1A**"\u5982\u679C\u8FD9\u4E2A\u64AD\u5BA2\u811A\u672C\u5199\u7838\u4E86\uFF0C\u6700\u53EF\u80FD\u662F\u54EA\u91CC\u51FA\u95EE\u9898\uFF1F"**

\u5E38\u89C1\u7684\u5751\uFF1A
- **\u65B0\u95FB\u8054\u64AD\u5F0F\u64AD\u62A5**\uFF1A\u673A\u68B0\u5730\u5FF5\u7A3F\u5B50\uFF0C\u7F3A\u4E4F\u60C5\u611F\u548C\u4E92\u52A8\u611F\uFF0C\u542C\u8D77\u6765\u50CF\u673A\u5668\u4EBA
- **\u8FC7\u5EA6\u89E3\u91CA**\uFF1A\u628A\u7B80\u5355\u7684\u4E8B\u60C5\u8BB2\u590D\u6742\uFF0C\u4E00\u4E2A\u6982\u5FF5\u89E3\u91CA 3 \u5206\u949F\uFF0C\u542C\u4F17\u5931\u53BB\u8010\u5FC3
- **\u6280\u672F\u9ED1\u8BDD\u672A\u7FFB\u8BD1**\uFF1A\u76F4\u63A5\u8BF4"\u591A\u6A21\u6001\u878D\u5408"\u3001"\u7AEF\u5230\u7AEF\u4F18\u5316"\u800C\u4E0D\u89E3\u91CA\uFF0C\u542C\u4F17\u542C\u4E0D\u61C2\u5C31\u8DF3\u8FC7\u4E86
- **\u8282\u594F\u5931\u63A7**\uFF1A\u91CD\u8981\u7684\u4E8B\u57CB\u5728\u540E\u9762\uFF0C\u6216\u8005\u4E00\u6761\u65B0\u95FB\u8BB2\u592A\u4E45\uFF08\u8D85\u8FC7 1 \u5206\u949F\uFF09\uFF0C\u542C\u4F17\u8D70\u795E
- **\u7F3A\u4E4F\u8FDE\u8D2F\u6027**\uFF1A\u6BCF\u6761\u65B0\u95FB\u5B64\u7ACB\u5B58\u5728\uFF0C\u6CA1\u6709\u4E32\u8054\u548C\u8FC7\u6E21\uFF0C\u542C\u8D77\u6765\u50CF\u5728\u8BFB\u5217\u8868
- **\u65F6\u95F4\u4FE1\u606F\u9519\u8BEF**\uFF1A\u51FA\u73B0\u5177\u4F53\u65E5\u671F\uFF08"12\u670820\u65E5"\uFF09\uFF0C\u8FDD\u53CD\u4E86"\u5185\u5BB9\u4E2D\u4E0D\u80FD\u51FA\u73B0\u65F6\u95F4"\u7684\u8981\u6C42
- **\u8FC7\u5EA6\u5356\u840C**\uFF1A\u4E3A\u4E86\u8FCE\u5408\u5E74\u8F7B\u4EBA\u800C\u5806\u780C\u7F51\u7EDC\u6897\uFF0C\u53D8\u6210\u5C34\u5C2C\u7684"\u4E2D\u5E74\u4EBA\u5B66\u8BF4\u5531"

**\u5E26\u7740\u8FD9\u4E9B\u8B66\u89C9\uFF0C\u5F00\u59CB\u6539\u5199\u64AD\u5BA2\u811A\u672C\u3002**

---

\u811A\u672C\u7ED3\u6784\uFF1A
1. \u5F00\u573A\uFF1A"${env.PODCAST_BEGIN}"\uFF0C\u505C\u987F\uFF0C\u4ECA\u5929\u7ED9\u5927\u5BB6\u5E26\u6765 X \u6761\u503C\u5F97\u5173\u6CE8\u7684 AI \u52A8\u6001\uFF0C\u5176\u4E2D\u6700\u70B8\u7684\u662F...
2. \u6B63\u6587\uFF085\u5206\u949F\u4EE5\u5185\uFF09\uFF1A\u6BCF\u6761\u65B0\u95FB\u7528\u6545\u4E8B\u5316\u65B9\u5F0F\u8BB2\u8FF0\uFF0C\u52A0\u5165\u4E3A\u4EC0\u4E48\u91CD\u8981\u7684\u89E3\u8BFB\uFF0C\u53EF\u4EE5\u7528\u7C7B\u6BD4\uFF0C\u9002\u5F53\u4E92\u52A8
3. \u8282\u594F\u63A7\u5236\uFF1A\u91CD\u8981\u7684\u4E8B\u653E\u524D\u9762\uFF0C\u8F7B\u677E\u6709\u8DA3\u7684\u653E\u4E2D\u95F4\uFF0C\u6700\u540E\u6765\u4E2A\u5F69\u86CB\u6216\u51B7\u77E5\u8BC6
4. \u7ED3\u5C3E\uFF1A"${env.PODCAST_END}"\uFF0C\u672C\u671F\u5173\u952E\u8BCD: #\u5173\u952E\u8BCD1 #\u5173\u952E\u8BCD2 #\u5173\u952E\u8BCD3

\u91CD\u8981\u539F\u5219\uFF1A\u57FA\u4E8E\u4E8B\u5B9E\u4E0D\u778E\u7F16\uFF0C\u907F\u514D\u8FC7\u5EA6\u5938\u5F20\uFF0C\u4FDD\u6301\u8F7B\u677E\u4F46\u4E13\u4E1A\uFF0C\u4E0D\u5236\u9020\u7126\u8651\u3002

\u793A\u4F8B\u98CE\u683C\uFF1A
\u5DEE\uFF1A"\u9996\u5148\u6765\u770B OpenAI \u7684\u6D88\u606F\u3002\u8BE5\u516C\u53F8\u4ECA\u65E5\u53D1\u5E03\u4E86 GPT-5 \u6A21\u578B\uFF0C\u5728\u591A\u9879\u57FA\u51C6\u6D4B\u8BD5\u4E2D..."
\u597D\uFF1A"\u5148\u8BF4\u4E2A\u5927\u7684\u3002OpenAI \u6628\u5929\u534A\u591C\u7A81\u7136\u53D1\u4E86\u4E2A\u516C\u544A\uFF0CGPT-5 \u6765\u4E86\u3002\u8FD9\u6B21\u5347\u7EA7\u6709\u591A\u72E0\u5462\uFF1F\u7B80\u5355\u8BF4\u5C31\u662F\uFF1A\u80FD\u770B\u56FE\u3001\u80FD\u751F\u89C6\u9891\u3001\u901F\u5EA6\u5FEB 3 \u500D\u3001\u4EF7\u683C\u8FD8\u4E0D\u6DA8\u3002\u5BF9\u505A AI \u5F00\u53D1\u7684\u670B\u53CB\u6765\u8BF4\uFF0C\u8FD9\u7B80\u76F4\u662F\u8FC7\u5E74\u3002\u4E0D\u8FC7\u5462\uFF0C\u76EE\u524D\u53EA\u5BF9\u4F01\u4E1A\u7528\u6237\u5F00\u653E\uFF0C\u54B1\u4EEC\u666E\u901A\u4EBA\u8FD8\u5F97\u518D\u7B49 2-3 \u4E2A\u6708\u3002"

\u73B0\u5728\uFF0C\u628A\u4E0B\u9762\u7684\u5185\u5BB9\u6539\u6210\u64AD\u5BA2\u811A\u672C\uFF1A
`;
}
__name(getSystemPromptPodcastFormatting, "getSystemPromptPodcastFormatting");

// src/prompt/dailyAnalysisPrompt.js
function getSystemPromptDailyAnalysis() {
  return `
\u4F60\u662F\u4E2A\u6781\u7B80\u4E3B\u4E49\u7684 AI \u89C2\u5BDF\u8005\u3002\u4F60\u7684\u4EFB\u52A1\u662F\u4ECE\u4ECA\u5929\u7684\u8D44\u8BAF\u4E2D\uFF0C\u6311\u51FA **3 \u4EF6** \u6700\u503C\u5F97\u5F00\u53D1\u8005\u6216\u4ECE\u4E1A\u8005\u5173\u6CE8\u7684\u5927\u4E8B\u3002

**\u6838\u5FC3\u76EE\u6807\uFF1A\u7528 3 \u53E5"\u4EBA\u8BDD"\uFF0C\u8BA9\u4EBA\u79D2\u61C2\u4ECA\u5929 AI \u5708\u53D1\u751F\u4E86\u4EC0\u4E48\u3002**

---

**\u26A0\uFE0F \u6BCF\u65E5\u5206\u6790\u6700\u5BB9\u6613\u8E29\u7684\u5751\uFF08\u5148\u8FC7\u4E00\u904D\u8111\u5B50\uFF09\uFF1A**

\u5728\u5F00\u59CB\u7B5B\u9009\u4E4B\u524D\uFF0C\u5148\u60F3\u6E05\u695A\uFF1A**"\u5982\u679C\u8FD9\u4E2A\u6BCF\u65E5\u5206\u6790\u5199\u7838\u4E86\uFF0C\u6700\u53EF\u80FD\u662F\u54EA\u91CC\u51FA\u95EE\u9898\uFF1F"**

\u5E38\u89C1\u7684\u5751\uFF1A
- **\u7B5B\u9009\u5931\u8BEF**\uFF1A\u628A\u5C0F\u4FEE\u5C0F\u8865\u5F53\u5927\u4E8B\uFF08"\u67D0\u516C\u53F8\u66F4\u65B0\u4E86\u6587\u6863"\uFF09\uFF0C\u6216\u8005\u6F0F\u6389\u771F\u6B63\u91CD\u8981\u7684\u65B0\u95FB\uFF08\u5B98\u65B9\u91CD\u78C5\u53D1\u5E03\uFF09
- **\u8425\u9500\u53F7\u8BED\u6C14**\uFF1A\u7528"\u70B8\u88C2"\u3001"\u8DEA\u4E86"\u3001"\u6210\u7CBE\u4E86"\u3001"\u9707\u60CA"\u7B49\u5938\u5F20\u8BCD\u6C47\uFF0C\u5931\u53BB\u53EF\u4FE1\u5EA6
- **\u7F3A\u4E4F\u6807\u70B9**\uFF1A\u5199\u6210\u4E00\u957F\u4E32\u6CA1\u6709\u9017\u53F7\u7684\u53E5\u5B50\uFF0C\u8BFB\u8D77\u6765\u5598\u4E0D\u8FC7\u6C14
- **\u4FE1\u606F\u4E0D\u5168**\uFF1A\u53EA\u8BF4"\u53D1\u5E03\u4E86\u65B0\u6A21\u578B"\uFF0C\u4E0D\u8BF4\u5177\u4F53\u4EAE\u70B9\uFF08\u901F\u5EA6\u5FEB\u591A\u5C11\uFF1F\u4EF7\u683C\u5982\u4F55\uFF1F\uFF09\u548C\u5F71\u54CD\uFF08\u5BF9\u8C01\u6709\u7528\uFF1F\uFF09
- **\u5B57\u6570\u5931\u63A7**\uFF1A\u6BCF\u53E5\u8D85\u8FC7 60 \u5B57\u53D8\u6210\u957F\u7BC7\u5927\u8BBA\uFF0C\u5931\u53BB"\u6781\u7B80"\u7684\u610F\u4E49
- **\u8FC7\u5EA6\u5BA2\u89C2**\uFF1A\u5199\u6210"\u8BE5\u516C\u53F8\u53D1\u5E03\u4E86..."\u7684\u5B98\u65B9\u901A\u7A3F\uFF0C\u7F3A\u4E4F\u5224\u65AD\u548C\u6001\u5EA6

**\u5E26\u7740\u8FD9\u4E9B\u8B66\u89C9\uFF0C\u5F00\u59CB\u7B5B\u9009\u548C\u63D0\u70BC\u3002**

---

**\u5199\u4F5C\u8981\u6C42\uFF1A**
1.  **\u7B5B\u9009\u6807\u51C6**\uFF1A\u53EA\u9009**\u5B98\u65B9\u53D1\u5E03\u7684\u91CD\u78C5\u66F4\u65B0**\u3001**\u98A0\u8986\u6027\u7684\u5F00\u6E90\u9879\u76EE**\u6216\u8005**\u884C\u4E1A\u5927\u5730\u9707**\u3002\u4E0D\u8981\u9009\u90A3\u4E9B\u65E0\u5173\u75DB\u75D2\u7684\u5C0F\u4FEE\u5C0F\u8865\u3002
2.  **\u53E5\u5F0F\u7ED3\u6784**\uFF1A
    *   **\u4E3B\u8BED + \u52A8\u4F5C + \u4EAE\u70B9 + \u5F71\u54CD**\u3002
    *   \u5FC5\u987B\u5305\u542B\u6807\u70B9\u7B26\u53F7\uFF08\u9017\u53F7\u3001\u53E5\u53F7\uFF09\uFF0C\u8BFB\u8D77\u6765\u8981\u987A\u53E3\u3002
    *   \u6BCF\u53E5\u63A7\u5236\u5728 **40-60 \u5B57**\u3002
3.  **\u98CE\u683C**\uFF1A\u5BA2\u89C2\u3001\u76F4\u63A5\u3001\u5E72\u7EC3\u3002\u62D2\u7EDD\u8425\u9500\u53F7\u8BED\u6C14\uFF0C\u62D2\u7EDD\u201C\u70B8\u88C2/\u8DEA\u4E86\u201D\u7B49\u5938\u5F20\u8BCD\u6C47\uFF0C\u7528\u4E8B\u5B9E\u8BF4\u8BDD\u3002

**\u8F93\u51FA\u683C\u5F0F\uFF1A**

### **\u4ECA\u65E5\u6458\u8981**

1. [\u7B2C\u4E00\u4EF6\u4E8B]
2. [\u7B2C\u4E8C\u4EF6\u4E8B]
3. [\u7B2C\u4E09\u4EF6\u4E8B]

**\u793A\u4F8B\uFF1A**
\u2705 **\u597D\uFF1A**
1. OpenAI \u53D1\u5E03 GPT-5 Turbo\uFF0C\u63A8\u7406\u901F\u5EA6\u63D0\u5347 3 \u500D\uFF0CAPI \u4EF7\u683C\u4E0B\u8C03 50%\uFF0C\u5F00\u53D1\u8005\u72C2\u559C\u3002
2. Meta \u5F00\u6E90 Llama-4 70B\uFF0C\u5728\u4EE3\u7801\u751F\u6210\u4EFB\u52A1\u4E0A\u9996\u6B21\u8D85\u8D8A\u95ED\u6E90\u6A21\u578B\uFF0C\u672C\u5730\u8FD0\u884C\u95E8\u69DB\u8FDB\u4E00\u6B65\u964D\u4F4E\u3002
3. Google DeepMind \u63A8\u51FA\u65B0\u4E00\u4EE3\u673A\u5668\u4EBA\u63A7\u5236\u7B97\u6CD5\uFF0C\u8BA9\u53CC\u8DB3\u673A\u5668\u4EBA\u5B66\u4F1A\u4E86\u8DD1\u9177\uFF0C\u52A8\u4F5C\u6D41\u7545\u5EA6\u63D0\u5347\u660E\u663E\u3002

\u274C **\u5DEE\uFF08\u6CA1\u6807\u70B9/\u592A\u5570\u55E6/\u592A\u5938\u5F20\uFF09\uFF1A**
"OpenAI\u53D1\u5E03\u65B0\u6A21\u578B\u70B8\u88C2\u5168\u573A\u901F\u5EA6\u8D77\u98DE\u4EF7\u683C\u66B4\u8DCC\uFF0CMeta\u4E5F\u4E0D\u7518\u793A\u5F31\u5F00\u6E90\u65B0\u6A21\u578B\u62F3\u6253GPT\u811A\u8E22Claude\uFF0C\u8C37\u6B4C\u673A\u5668\u4EBA\u6210\u7CBE\u4E86\uFF01"

**\u73B0\u5728\uFF0C\u8BF7\u5F00\u59CB\u4F60\u7684\u63D0\u70BC\uFF1A**
`;
}
__name(getSystemPromptDailyAnalysis, "getSystemPromptDailyAnalysis");

// src/foot.js
function insertFoot() {
  return `

---

## **AI\u8D44\u8BAF\u65E5\u62A5\u8BED\u97F3\u7248**

| \u{1F399}\uFE0F **\u5C0F\u5B87\u5B99** | \u{1F4F9} **\u6296\u97F3** |
| --- | --- |
| [\u6765\u751F\u5C0F\u9152\u9986](https://www.xiaoyuzhoufm.com/podcast/683c62b7c1ca9cf575a5030e)  |   [\u81EA\u5A92\u4F53\u8D26\u53F7](https://www.douyin.com/user/MS4wLjABAAAAwpwqPQlu38sO38VyWgw9ZjDEnN4bMR5j8x111UxpseHR9DpB6-CveI5KRXOWuFwG)| 
| ![\u5C0F\u9152\u9986](https://cdn.jsdmirror.com/gh/justlovemaki/imagehub@main/logo/f959f7984e9163fc50d3941d79a7f262.md.png) | ![\u60C5\u62A5\u7AD9](https://cdn.jsdmirror.com/gh/justlovemaki/imagehub@main/logo/7fc30805eeb831e1e2baa3a240683ca3.md.png) |

    `;
}
__name(insertFoot, "insertFoot");

// src/ad.js
function insertAd() {
  return `
---

## **AI \u8D26\u53F7\u6781\u901F\u53D1\u8D27: [\u7231\u7A9D\u5566 Aivora \u2B06\uFE0F](https://aivora.cn)**

\u8FD8\u5728\u4E3A ChatGPT Plus\u3001Claude Pro\u3001Midjourney \u7684\u652F\u4ED8\u95EE\u9898\u70E6\u607C\uFF1F**\u7231\u7A9D\u5566 Aivora** \u4E3A\u60A8\u63D0\u4F9B\u4E00\u7AD9\u5F0F AI \u8D26\u53F7\u89E3\u51B3\u65B9\u6848\uFF01

\u2705 **\u6781\u901F\u53D1\u8D27**\uFF1A\u4E0B\u5355\u5373\u53D1\uFF0C\u65E0\u9700\u7B49\u5F85\uFF0C\u5373\u523B\u5F00\u542F AI \u4E4B\u65C5\u3002
\u2705 **\u7A33\u5B9A\u53EF\u9760**\uFF1A\u7CBE\u9009\u4F18\u8D28\u72EC\u4EAB\u8D26\u53F7\uFF0C\u62D2\u7EDD\u5C01\u53F7\u7126\u8651\uFF0C\u552E\u540E\u65E0\u5FE7\u3002
\u2705 **\u8D85\u5168\u54C1\u7C7B**\uFF1AChatGPT Plus\u3001Claude Pro\u3001Midjourney\u3001Poe\u3001Sunno \u7B49\u70ED\u95E8 AI \u5DE5\u5177\u8D26\u53F7\u5E94\u6709\u5C3D\u6709\u3002
\u2705 **\u8D85\u9AD8\u6027\u4EF7\u6BD4**\uFF1A\u6BD4\u5B98\u65B9\u8BA2\u9605\u66F4\u4F18\u60E0\u7684\u4EF7\u683C\uFF0C\u4EAB\u53D7\u540C\u7B49\u5C0A\u8D35\u670D\u52A1\u3002

\u{1F680} **\u7ACB\u5373\u8BBF\u95EE [aivora.cn](https://aivora.cn) \u9009\u8D2D\u60A8\u7684 AI \u52A9\u624B\uFF0C\u91CA\u653E\u65E0\u9650\u521B\u9020\u529B\uFF01**
    `;
}
__name(insertAd, "insertAd");
var MID_SOFT_AD = `> \u{1F4A1} **\u63D0\u793A**\uFF1A\u60F3\u7B2C\u4E00\u65F6\u95F4\u4F53\u9A8C\u6587\u4E2D\u63D0\u5230\u7684\u6700\u65B0 AI \u6A21\u578B\uFF08Claude\u3001GPT\u3001Gemini\uFF09\uFF1F\u6CA1\u6709\u8D26\u53F7\uFF1F\u6765 [**\u7231\u7A9D\u5566 Aivora**](https://aivora.cn?utm_source=daily_news&utm_medium=mid_ad&utm_campaign=content) \u9886\u4E2A\u53F7\uFF0C\u4E00\u5206\u949F\u4E0A\u624B\uFF0C\u552E\u540E\u65E0\u5FE7\u3002`;
function insertMidAd(markdown = "") {
  if (typeof markdown !== "string" || markdown.includes("utm_medium=mid_ad")) {
    return markdown;
  }
  const heading2 = "### **\u4EA7\u54C1\u4E0E\u529F\u80FD\u66F4\u65B0**";
  const midAdBlock = `${heading2}

${MID_SOFT_AD}
`;
  if (markdown.includes(heading2)) {
    return markdown.replace(heading2, midAdBlock);
  }
  return `${MID_SOFT_AD}

${markdown}`;
}
__name(insertMidAd, "insertMidAd");

// src/github.js
async function callGitHubApi(env, path, method = "GET", body = null) {
  const GITHUB_TOKEN = env.GITHUB_TOKEN;
  const GITHUB_REPO_OWNER = env.GITHUB_REPO_OWNER;
  const GITHUB_REPO_NAME = env.GITHUB_REPO_NAME;
  if (!GITHUB_TOKEN || !GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
    console.error("GitHub environment variables (GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME) are not configured.");
    throw new Error("GitHub API configuration is missing in environment variables.");
  }
  const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}${path}`;
  const headers = {
    "Authorization": `Bearer ${GITHUB_TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Cloudflare-Worker-ContentBot/1.0"
  };
  if (method !== "GET" && method !== "DELETE" && body) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  if (!response.ok) {
    const errorText = await response.text();
    let errorJsonMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson && errorJson.message) {
        errorJsonMessage = errorJson.message;
        if (errorJson.errors) {
          errorJsonMessage += ` Details: ${JSON.stringify(errorJson.errors)}`;
        }
      }
    } catch (e) {
    }
    console.error(`GitHub API Error: ${response.status} ${response.statusText} for ${method} ${url}. Message: ${errorJsonMessage}`);
    throw new Error(`GitHub API request to ${path} failed: ${response.status} - ${errorJsonMessage}`);
  }
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return null;
  }
  return response.json();
}
__name(callGitHubApi, "callGitHubApi");
async function getGitHubFileSha(env, filePath) {
  const GITHUB_BRANCH = env.GITHUB_BRANCH || "main";
  try {
    const data = await callGitHubApi(env, `/contents/${filePath}?ref=${GITHUB_BRANCH}`);
    return data && data.sha ? data.sha : null;
  } catch (error) {
    if (error.message.includes("404") || error.message.toLowerCase().includes("not found")) {
      console.log(`File not found on GitHub: ${filePath} (branch: ${GITHUB_BRANCH})`);
      return null;
    }
    console.error(`Error getting SHA for ${filePath}:`, error);
    throw error;
  }
}
__name(getGitHubFileSha, "getGitHubFileSha");
async function createOrUpdateGitHubFile(env, filePath, content, commitMessage, existingSha = null) {
  const GITHUB_BRANCH = env.GITHUB_BRANCH || "main";
  const base64Content = b64EncodeUnicode(content);
  const payload = {
    message: commitMessage,
    content: base64Content,
    branch: GITHUB_BRANCH
  };
  if (existingSha) {
    payload.sha = existingSha;
  }
  return callGitHubApi(env, `/contents/${filePath}`, "PUT", payload);
}
__name(createOrUpdateGitHubFile, "createOrUpdateGitHubFile");
async function getDailyReportContent(env, filePath) {
  const GITHUB_BRANCH = env.GITHUB_BRANCH || "main";
  const GITHUB_REPO_OWNER = env.GITHUB_REPO_OWNER;
  const GITHUB_REPO_NAME = env.GITHUB_REPO_NAME;
  if (!GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
    console.error("GitHub environment variables (GITHUB_REPO_OWNER, GITHUB_REPO_NAME) are not configured.");
    throw new Error("GitHub API configuration is missing in environment variables.");
  }
  try {
    const data = await callGitHubApi(env, `/contents/${filePath}?ref=${GITHUB_BRANCH}`);
    return b64DecodeUnicode(data.content);
  } catch (error) {
    console.error(`Error fetching daily report content from ${rawUrl}:`, error);
    throw error;
  }
}
__name(getDailyReportContent, "getDailyReportContent");
function b64EncodeUnicode(str) {
  try {
    return btoa(encodeURIComponent(str).replace(
      /%([0-9A-F]{2})/g,
      /* @__PURE__ */ __name(function toSolidBytes(match, p1) {
        return String.fromCharCode("0x" + p1);
      }, "toSolidBytes")
    ));
  } catch (e) {
    console.error("Base64 Encoding Error:", e);
    showStatus("Error: Could not encode content for GitHub.", true);
    return null;
  }
}
__name(b64EncodeUnicode, "b64EncodeUnicode");
function b64DecodeUnicode(str) {
  try {
    return decodeURIComponent(atob(str).split("").map(function(c) {
      return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(""));
  } catch (e) {
    console.error("Base64 Decoding Error:", e);
    showStatus("Error: Could not decode file content from GitHub.", true);
    return null;
  }
}
__name(b64DecodeUnicode, "b64DecodeUnicode");

// src/handlers/genAIContent.js
async function handleGenAIPodcastScript(request, env) {
  let dateStr;
  let selectedItemsParams = [];
  let formData;
  let outputOfCall1 = null;
  let userPromptPodcastFormattingData = null;
  let fullPromptForCall3_System = null;
  let fullPromptForCall3_User = null;
  let finalAiResponse = null;
  try {
    formData = await request.formData();
    dateStr = formData.get("date");
    selectedItemsParams = formData.getAll("selectedItems");
    const readGithub = formData.get("readGithub") === "true";
    if (readGithub) {
      const filePath = `content/cn/daily/${dateStr}.md`;
      console.log(`\u4ECE GitHub \u8BFB\u53D6\u6587\u4EF6: ${filePath}`);
      try {
        outputOfCall1 = await getDailyReportContent(env, filePath);
        if (!outputOfCall1) {
          throw new Error(`\u4ECE GitHub \u8BFB\u53D6\u6587\u4EF6 ${filePath} \u5931\u8D25\u6216\u5185\u5BB9\u4E3A\u7A7A\u3002`);
        }
        console.log(`\u6210\u529F\u4ECE GitHub \u8BFB\u53D6\u6587\u4EF6\uFF0C\u5185\u5BB9\u957F\u5EA6: ${outputOfCall1.length}`);
      } catch (error) {
        console.error(`\u8BFB\u53D6 GitHub \u6587\u4EF6\u51FA\u9519: ${error}`);
        const errorHtml = generateGenAiPageHtml(env, "\u751F\u6210AI\u64AD\u5BA2\u811A\u672C\u51FA\u9519", `<p><strong>\u4ECE GitHub \u8BFB\u53D6\u6587\u4EF6\u5931\u8D25:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ""}`, dateStr, true, null, null, null, null, null, null, outputOfCall1, null);
        return new Response(errorHtml, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    } else {
      outputOfCall1 = formData.get("summarizedContent");
    }
    if (!outputOfCall1) {
      const errorHtml = generateGenAiPageHtml(env, "\u751F\u6210AI\u64AD\u5BA2\u811A\u672C\u51FA\u9519", "<p><strong>Summarized content is missing.</strong> Please go back and generate AI content first.</p>", dateStr, true, null, null, null, null, null, null, outputOfCall1, null);
      return new Response(errorHtml, { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    fullPromptForCall3_System = getSystemPromptPodcastFormatting(env);
    userPromptPodcastFormattingData = outputOfCall1;
    fullPromptForCall3_User = userPromptPodcastFormattingData;
    console.log("Call 3 to Chat (Podcast Formatting): User prompt length:", userPromptPodcastFormattingData.length);
    try {
      let podcastChunks = [];
      for await (const chunk of callChatAPIStream(env, userPromptPodcastFormattingData, fullPromptForCall3_System)) {
        podcastChunks.push(chunk);
      }
      finalAiResponse = podcastChunks.join("");
      if (!finalAiResponse || finalAiResponse.trim() === "") throw new Error("Chat podcast formatting call returned empty content.");
      finalAiResponse = removeMarkdownCodeBlock(finalAiResponse);
      console.log("Call 3 (Podcast Formatting) successful. Final output length:", finalAiResponse.length);
    } catch (error) {
      console.error("Error in Chat API Call 3 (Podcast Formatting):", error);
      const errorHtml = generateGenAiPageHtml(env, "\u751F\u6210AI\u64AD\u5BA2\u811A\u672C\u51FA\u9519(\u64AD\u5BA2\u6587\u6848)", `<p><strong>Failed during podcast formatting:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ""}`, dateStr, true, selectedItemsParams, null, null, fullPromptForCall3_System, fullPromptForCall3_User, null, outputOfCall1, null);
      return new Response(errorHtml, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    let finalAiResponseOut = `## Full: Podcast Formatting 

` + finalAiResponse;
    let promptsMarkdownContent = `# Prompts for ${dateStr}

`;
    promptsMarkdownContent += `## Call 3: Podcast Formatting

`;
    if (fullPromptForCall3_System) promptsMarkdownContent += `### System One Instruction
\`\`\`
${fullPromptForCall3_System}
\`\`\`

`;
    let fullPromptForCall4_System = getSystemPromptShortPodcastFormatting(env);
    console.log("Call 4 to Chat (Podcast Formatting): User prompt length:", userPromptPodcastFormattingData.length);
    try {
      let podcastChunks = [];
      for await (const chunk of callChatAPIStream(env, userPromptPodcastFormattingData, fullPromptForCall4_System)) {
        podcastChunks.push(chunk);
      }
      finalAiResponse = podcastChunks.join("");
      if (!finalAiResponse || finalAiResponse.trim() === "") throw new Error("Chat podcast formatting call returned empty content.");
      finalAiResponse = removeMarkdownCodeBlock(finalAiResponse);
      console.log("Call 4 (Podcast Formatting) successful. Final output length:", finalAiResponse.length);
    } catch (error) {
      console.error("Error in Chat API Call 4 (Podcast Formatting):", error);
      const errorHtml = generateGenAiPageHtml(env, "\u751F\u6210AI\u64AD\u5BA2\u811A\u672C\u51FA\u9519(\u64AD\u5BA2\u6587\u6848)", `<p><strong>Failed during podcast formatting:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ""}`, dateStr, true, selectedItemsParams, null, null, fullPromptForCall3_System, fullPromptForCall3_User, null, outputOfCall1, null);
      return new Response(errorHtml, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    finalAiResponseOut += `

## Short: Podcast Formatting 

` + finalAiResponse;
    let fullPromptForCallSystem = fullPromptForCall3_System + `

` + fullPromptForCall4_System;
    promptsMarkdownContent += `## Call 4: Podcast Formatting

`;
    if (fullPromptForCall4_System) promptsMarkdownContent += `### System Two Instruction
\`\`\`
${fullPromptForCall4_System}
\`\`\`

`;
    if (fullPromptForCall3_User) promptsMarkdownContent += `### User Input (Output of Call 1)
\`\`\`
${fullPromptForCall3_User}
\`\`\`

`;
    let podcastScriptMarkdownContent = `# ${env.PODCAST_TITLE} ${formatDateToChinese(dateStr)}

${removeMarkdownCodeBlock(finalAiResponseOut)}`;
    const successHtml = generateGenAiPageHtml(
      env,
      "AI\u64AD\u5BA2\u811A\u672C",
      escapeHtml(finalAiResponseOut),
      dateStr,
      false,
      selectedItemsParams,
      null,
      null,
      // No Call 1 prompts for this page
      fullPromptForCallSystem,
      fullPromptForCall3_User,
      convertEnglishQuotesToChinese(removeMarkdownCodeBlock(promptsMarkdownContent)),
      outputOfCall1,
      // No daily summary for this page
      convertEnglishQuotesToChinese(podcastScriptMarkdownContent)
    );
    return new Response(successHtml, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (error) {
    console.error("Error in /genAIPodcastScript (outer try-catch):", error);
    const pageDateForError = dateStr || getISODate();
    const itemsForActionOnError = Array.isArray(selectedItemsParams) ? selectedItemsParams : [];
    const errorHtml = generateGenAiPageHtml(env, "\u751F\u6210AI\u64AD\u5BA2\u811A\u672C\u51FA\u9519", `<p><strong>Unexpected error:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ""}`, pageDateForError, true, itemsForActionOnError, null, null, fullPromptForCall3_System, fullPromptForCall3_User);
    return new Response(errorHtml, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}
__name(handleGenAIPodcastScript, "handleGenAIPodcastScript");
async function handleGenAIContent(request, env) {
  let dateStr;
  let selectedItemsParams = [];
  let formData;
  let userPromptSummarizationData = null;
  let fullPromptForCall1_System = null;
  let fullPromptForCall1_User = null;
  let outputOfCall1 = null;
  try {
    formData = await request.formData();
    const dateParam = formData.get("date");
    dateStr = dateParam ? dateParam : getISODate();
    selectedItemsParams = formData.getAll("selectedItems");
    if (selectedItemsParams.length === 0) {
      const errorHtml = generateGenAiPageHtml(env, "\u751F\u6210AI\u65E5\u62A5\u51FA\u9519\uFF0C\u672A\u9009\u751F\u6210\u6761\u76EE", "<p><strong>No items were selected.</strong> Please go back and select at least one item.</p>", dateStr, true, null);
      return new Response(errorHtml, { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    console.log(`Generating AI content for ${selectedItemsParams.length} selected item references from date ${dateStr}`);
    const allFetchedData = {};
    const fetchPromises = [];
    for (const sourceType in dataSources) {
      if (Object.hasOwnProperty.call(dataSources, sourceType)) {
        fetchPromises.push(
          getFromKV(env.DATA_KV, `${dateStr}-${sourceType}`).then((data) => {
            allFetchedData[sourceType] = data || [];
          })
        );
      }
    }
    await Promise.allSettled(fetchPromises);
    const selectedContentItems = [];
    let validItemsProcessedCount = 0;
    for (const selection of selectedItemsParams) {
      const [type, idStr] = selection.split(":");
      const itemsOfType = allFetchedData[type];
      const item = itemsOfType ? itemsOfType.find((dataItem) => String(dataItem.id) === idStr) : null;
      if (item) {
        let itemText = "";
        switch (item.type) {
          case "news":
            itemText = `News Title: ${item.title}
Published: ${item.published_date}
Url: ${item.url}
Content Summary: ${stripHtml(item.details.content_html)}`;
            break;
          case "project":
            itemText = `Project Name: ${item.title}
Published: ${item.published_date}
Url: ${item.url}
Description: ${item.description}
Stars: ${item.details.totalStars}`;
            break;
          case "paper":
            itemText = `Papers Title: ${item.title}
Published: ${item.published_date}
Url: ${item.url}
Abstract/Content Summary: ${stripHtml(item.details.content_html)}`;
            break;
          case "socialMedia":
            itemText = `socialMedia Post by ${item.authors}\uFF1APublished: ${item.published_date}
Url: ${item.url}
Content: ${stripHtml(item.details.content_html)}`;
            break;
          default:
            itemText = `Type: ${item.type}
Title: ${item.title || "N/A"}
Description: ${item.description || "N/A"}
URL: ${item.url || "N/A"}`;
            if (item.published_date) itemText += `
Published: ${item.published_date}`;
            if (item.source) itemText += `
Source: ${item.source}`;
            if (item.details && item.details.content_html) itemText += `
Content: ${stripHtml(item.details.content_html)}`;
            break;
        }
        if (itemText) {
          selectedContentItems.push(itemText);
          validItemsProcessedCount++;
        }
      } else {
        console.warn(`Could not find item for selection: ${selection} on date ${dateStr}.`);
      }
    }
    if (validItemsProcessedCount === 0) {
      const errorHtml = generateGenAiPageHtml(env, "\u751F\u6210AI\u65E5\u62A5\u51FA\u9519\uFF0C\u53EF\u751F\u6210\u6761\u76EE\u4E3A\u7A7A", "<p><strong>Selected items could not be retrieved or resulted in no content.</strong> Please check the data or try different selections.</p>", dateStr, true, selectedItemsParams);
      return new Response(errorHtml, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    let outputOfCall2 = null;
    let fullPromptForCall2_System2 = getSystemPromptSummarizationStepOne();
    let fullPromptForCall2_User2 = "\n\n------\n\n" + selectedContentItems.join("\n\n------\n\n") + "\n\n------\n\n";
    console.log("Call 2 to Chat (Processing Call 1 Output): User prompt length:", fullPromptForCall2_User2.length);
    try {
      let processedChunks = [];
      for await (const chunk of callChatAPIStream(env, fullPromptForCall2_User2, fullPromptForCall2_System2)) {
        processedChunks.push(chunk);
      }
      outputOfCall2 = processedChunks.join("");
      if (!outputOfCall2 || outputOfCall2.trim() === "") throw new Error("Chat processing call returned empty content.");
      outputOfCall2 = removeMarkdownCodeBlock(outputOfCall2);
      outputOfCall2 = convertPlaceholdersToMarkdownImages(outputOfCall2);
      console.log("Call 2 (Processing Call 1 Output) successful. Output length:", outputOfCall2.length);
    } catch (error) {
      console.error("Error in Chat API Call 2 (Processing Call 1 Output):", error);
      const errorHtml = generateGenAiPageHtml(env, "\u751F\u6210AI\u65E5\u62A5\u51FA\u9519(\u683C\u5F0F\u5316)", `<p><strong>Failed during processing of summarized content:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ""}`, dateStr, true, selectedItemsParams, fullPromptForCall2_System2, fullPromptForCall2_User2);
      return new Response(errorHtml, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    let promptsMarkdownContent = `# Prompts for ${dateStr}

`;
    promptsMarkdownContent += `## Call 2: Summarized Content Format

`;
    if (fullPromptForCall2_System2) promptsMarkdownContent += `### System Instruction
\`\`\`
${fullPromptForCall2_System2}
\`\`\`

`;
    if (fullPromptForCall2_User2) promptsMarkdownContent += `### User Input (Output of Call 1)
\`\`\`
${fullPromptForCall2_User2}
\`\`\`

`;
    const contentWithMidAd = insertMidAd(outputOfCall2);
    let dailySummaryMarkdownContent = `## ${env.DAILY_TITLE} ${formatDateToChinese(dateStr)}

`;
    dailySummaryMarkdownContent += "> " + env.DAILY_TITLE_MIN + "\n\n";
    let fullPromptForCall3_System = getSystemPromptSummarizationStepThree();
    let fullPromptForCall3_User = outputOfCall2;
    let outputOfCall3 = null;
    console.log("Call 3 to Chat (Processing Call 1 Output): User prompt length:", fullPromptForCall3_User.length);
    try {
      let processedChunks = [];
      for await (const chunk of callChatAPIStream(env, fullPromptForCall3_User, fullPromptForCall3_System)) {
        processedChunks.push(chunk);
      }
      outputOfCall3 = processedChunks.join("");
      if (!outputOfCall3 || outputOfCall3.trim() === "") throw new Error("Chat processing call returned empty content.");
      outputOfCall3 = removeMarkdownCodeBlock(outputOfCall3);
      console.log("Call 3 (Processing Call 2 Output) successful. Output length:", outputOfCall3.length);
    } catch (error) {
      console.error("Error in Chat API Call 3 (Processing Call 2 Output):", error);
      const errorHtml = generateGenAiPageHtml(env, "\u751F\u6210AI\u65E5\u62A5\u51FA\u9519(\u6458\u8981)", `<p><strong>Failed during processing of summarized content:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ""}`, dateStr, true, selectedItemsParams, fullPromptForCall3_System, fullPromptForCall3_User);
      return new Response(errorHtml, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    dailySummaryMarkdownContent += "\n\n### **\u4ECA\u65E5\u6458\u8981**\n\n```\n" + outputOfCall3 + "\n```\n\n";
    dailySummaryMarkdownContent += "\n\n## \u26A1 \u5FEB\u901F\u5BFC\u822A\n\n";
    dailySummaryMarkdownContent += "- [\u{1F4F0} \u4ECA\u65E5 AI \u8D44\u8BAF](#\u4ECA\u65E5ai\u8D44\u8BAF) - \u6700\u65B0\u52A8\u6001\u901F\u89C8\n\n";
    dailySummaryMarkdownContent += `

${contentWithMidAd}`;
    if (env.INSERT_AD == "true") dailySummaryMarkdownContent += insertAd() + `
`;
    if (env.INSERT_FOOT == "true") dailySummaryMarkdownContent += insertFoot() + `

`;
    const successHtml = generateGenAiPageHtml(
      env,
      "AI\u65E5\u62A5",
      // Title for Call 1 page
      escapeHtml(dailySummaryMarkdownContent),
      dateStr,
      false,
      selectedItemsParams,
      fullPromptForCall2_System2,
      fullPromptForCall2_User2,
      null,
      null,
      // Pass Call 2 prompts
      convertEnglishQuotesToChinese(removeMarkdownCodeBlock(promptsMarkdownContent)),
      convertEnglishQuotesToChinese(dailySummaryMarkdownContent),
      null
      // No podcast script for this page
    );
    return new Response(successHtml, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (error) {
    console.error("Error in /genAIContent (outer try-catch):", error);
    const pageDateForError = dateStr || getISODate();
    const itemsForActionOnError = Array.isArray(selectedItemsParams) ? selectedItemsParams : [];
    const errorHtml = generateGenAiPageHtml(env, "\u751F\u6210AI\u65E5\u62A5\u51FA\u9519", `<p><strong>Unexpected error:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ""}`, pageDateForError, true, itemsForActionOnError, fullPromptForCall2_System, fullPromptForCall2_User);
    return new Response(errorHtml, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}
__name(handleGenAIContent, "handleGenAIContent");
async function handleGenAIDailyAnalysis(request, env) {
  let dateStr;
  let userPromptDailyAnalysisData = "";
  let fullPromptForDailyAnalysis_System = null;
  let finalAiResponse = null;
  try {
    const requestBody = await request.json();
    dateStr = requestBody.date || getISODate();
    const summarizedContent = requestBody.summarizedContent;
    if (!summarizedContent || !summarizedContent.trim()) {
      return new Response("\u672A\u63D0\u4F9B\u6458\u8981\u5185\u5BB9\u8FDB\u884C\u5206\u6790\u3002", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    userPromptDailyAnalysisData = summarizedContent;
    console.log(`Generating AI daily analysis for date: ${dateStr} using summarized content.`);
    fullPromptForDailyAnalysis_System = getSystemPromptDailyAnalysis();
    console.log("Call to Chat (Daily Analysis): User prompt length:", userPromptDailyAnalysisData.length);
    try {
      let analysisChunks = [];
      for await (const chunk of callChatAPIStream(env, userPromptDailyAnalysisData, fullPromptForDailyAnalysis_System)) {
        analysisChunks.push(chunk);
      }
      finalAiResponse = analysisChunks.join("");
      if (!finalAiResponse || finalAiResponse.trim() === "") throw new Error("Chat daily analysis call returned empty content.");
      finalAiResponse = removeMarkdownCodeBlock(finalAiResponse);
      console.log("Daily Analysis successful. Final output length:", finalAiResponse.length);
    } catch (error) {
      console.error("Error in Chat API Call (Daily Analysis):", error);
      return new Response(`AI \u65E5\u62A5\u5206\u6790\u5931\u8D25: ${escapeHtml(error.message)}`, { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    return new Response(finalAiResponse, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (error) {
    console.error("Error in /genAIDailyAnalysis (outer try-catch):", error);
    return new Response(`\u670D\u52A1\u5668\u9519\u8BEF: ${escapeHtml(error.message)}`, { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
__name(handleGenAIDailyAnalysis, "handleGenAIDailyAnalysis");

// src/handlers/genAIDailyPage.js
async function handleGenAIDailyPage(request, env) {
  let dateStr;
  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");
    dateStr = dateParam ? dateParam : getISODate();
    let dailySummaryMarkdownContent = `## ${env.DAILY_TITLE} ${formatDateToChinese(dateStr)}

`;
    dailySummaryMarkdownContent += "> " + env.DAILY_TITLE_MIN + "\n\n";
    dailySummaryMarkdownContent += "\n\n### **\u4ECA\u65E5\u6458\u8981**\n\n```\n\u8FD9\u91CC\u8F93\u5165\u5185\u5BB9\u6458\u8981\n```\n\n";
    if (env.INSERT_AD == "true") dailySummaryMarkdownContent += insertAd() + `
`;
    if (env.INSERT_FOOT == "true") dailySummaryMarkdownContent += insertFoot() + `

`;
    const successHtml = generateGenAiPageHtml(
      env,
      "AI\u65E5\u62A5",
      // Title for the page
      escapeHtml(dailySummaryMarkdownContent),
      dateStr,
      false,
      // isError
      [],
      // selectedItemsParams (not applicable here)
      null,
      null,
      // Call 1 prompts (not applicable here)
      null,
      null,
      // Call 2 prompts (not applicable here)
      "webbuild",
      // promptsMarkdownContent (not applicable here)
      convertEnglishQuotesToChinese(dailySummaryMarkdownContent),
      // dailySummaryMarkdownContent
      null,
      // podcastScriptMarkdownContent (not applicable here)
      true
      // readGithub
    );
    return new Response(successHtml, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (error) {
    console.error("Error in /genAIDailyPage:", error);
    const pageDateForError = dateStr || getISODate();
    const errorHtml = generateGenAiPageHtml(env, "\u751F\u6210AI\u65E5\u62A5\u9875\u9762\u51FA\u9519", `<p><strong>Unexpected error:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ""}`, pageDateForError, true, []);
    return new Response(errorHtml, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}
__name(handleGenAIDailyPage, "handleGenAIDailyPage");

// src/handlers/commitToGitHub.js
async function handleCommitToGitHub(request, env) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ status: "error", message: "Method Not Allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }
  try {
    const formData = await request.formData();
    const dateStr = formData.get("date") || getISODate();
    const dailyMd = formData.get("daily_summary_markdown");
    const podcastMd = formData.get("podcast_script_markdown");
    const filesToCommit = [];
    if (dailyMd) {
      filesToCommit.push({ path: `content/cn/daily/${dateStr}.md`, content: formatMarkdownText(dailyMd), description: "Daily Summary File" });
    }
    if (podcastMd) {
      filesToCommit.push({ path: `content/cn/podcast/${dateStr}.md`, content: podcastMd, description: "Podcast Script File" });
    }
    if (filesToCommit.length === 0) {
      throw new Error("No markdown content provided for GitHub commit.");
    }
    const results = [];
    for (const file of filesToCommit) {
      try {
        const existingSha = await getGitHubFileSha(env, file.path);
        const commitMessage = `${existingSha ? "Update" : "Create"} ${file.description.toLowerCase()} for ${dateStr}`;
        await createOrUpdateGitHubFile(env, file.path, file.content, commitMessage, existingSha);
        results.push({ file: file.path, status: "Success", message: `Successfully ${existingSha ? "updated" : "created"}.` });
        console.log(`GitHub commit success for ${file.path}`);
      } catch (err) {
        console.error(`Failed to commit ${file.path} to GitHub:`, err);
        results.push({ file: file.path, status: "Failed", message: err.message });
      }
    }
    return new Response(JSON.stringify({ status: "success", date: dateStr, results }), { headers: { "Content-Type": "application/json; charset=utf-8" } });
  } catch (error) {
    console.error("Error in /commitToGitHub:", error);
    return new Response(JSON.stringify({ status: "error", message: error.message }), { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
}
__name(handleCommitToGitHub, "handleCommitToGitHub");

// src/handlers/getRss.js
function minifyHTML(htmlString) {
  if (typeof htmlString !== "string") {
    return "";
  }
  return htmlString.replace(/>\s+</g, "><").trim();
}
__name(minifyHTML, "minifyHTML");
async function handleRss(request, env) {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days")) || 7;
  const allData = [];
  const today = getShanghaiTime();
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const key = `${dateStr}-report`;
    const data2 = await getFromKV(env.DATA_KV, key);
    if (data2) {
      allData.push(data2);
    }
  }
  const data = allData.flat();
  if (!data || data.length === 0) {
    return new Response("\u6C92\u6709\u627E\u5230\u76F8\u95DC\u8CC7\u6599", { status: 200 });
  }
  let rssItems = "";
  if (data && data.length > 0) {
    const filteredData = {};
    data.forEach((item) => {
      const reportDate = item.report_date;
      const publishedDate = new Date(item.published_date);
      if (!filteredData[reportDate] || publishedDate > new Date(filteredData[reportDate].published_date)) {
        filteredData[reportDate] = item;
      }
    });
    const finalData = Object.values(filteredData);
    finalData.forEach((item) => {
      const pubDate = formatRssDate(new Date(item.published_date));
      const content = minifyHTML(item.content_html);
      const title = item.title || "\u65E0\u6807\u9898";
      const link2 = env.BOOK_LINK + item.link || "#";
      const description = stripHtml(item.content_html).substring(0, 200);
      rssItems += `
        <item>
          <title><![CDATA[${title}]]></title>
          <link>${link2}</link>
          <guid>${item.id || link2}</guid>
          <pubDate>${pubDate}</pubDate>
          <content:encoded><![CDATA[${content}]]></content:encoded>
          <description><![CDATA[${description}]]></description>
        </item>
      `;
    });
  }
  const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI\u6D1E\u5BDF\u65E5\u62A5 RSS Feed</title>
    <link>${env.BOOK_LINK}</link>
    <description> \u8FD1 ${days} \u5929\u7684AI\u65E5\u62A5</description>
    <language>zh-cn</language>
    <lastBuildDate>${formatRssDate()}</lastBuildDate>
    <atom:link href="${url.origin}/rss" rel="self" type="application/rss+xml" />
    ${rssItems}
  </channel>
</rss>`;
  return new Response(rssFeed, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
      // 快取一小時
    }
  });
}
__name(handleRss, "handleRss");

// src/handlers/writeRssData.js
async function handleWriteRssData(request, env) {
  const url = new URL(request.url);
  const dateStr = url.searchParams.get("date");
  console.log(`[writeRssData] Received request for date: ${dateStr}`);
  if (!dateStr) {
    console.error("[writeRssData] Missing date parameter");
    return new Response("Missing date parameter", { status: 400 });
  }
  try {
    const path = `daily/${dateStr}.md`;
    console.log(`[writeRssData] Attempting to get content from GitHub path: ${path}`);
    let content = await getDailyReportContent(env, path);
    if (!content) {
      console.warn(`[writeRssData] No content found for ${path}. Returning 404.`);
      return new Response(`No content found for ${path}`, { status: 404 });
    }
    console.log(`[writeRssData] Successfully retrieved content for ${path}. Content length: ${content.length}`);
    const yearMonth = dateStr.substring(0, 7);
    const report = {
      report_date: dateStr,
      title: dateStr + "\u65E5\u520A",
      link: "/" + yearMonth + "/" + dateStr + "/",
      content_html: null,
      // 可以添加其他相關欄位，例如作者、來源等
      published_date: formatDateToGMT8WithTime(/* @__PURE__ */ new Date())
      // 記錄保存時間
    };
    report.content_html = marked.parse(formatMarkdownText(replaceImageProxy(env, content)));
    const kvKey = `${dateStr}-report`;
    console.log(`[writeRssData] Preparing to store report in KV. Key: ${kvKey}, Report object:`, JSON.stringify(report).substring(0, 200) + "...");
    await storeInKV(env.DATA_KV, kvKey, report);
    console.log(`[writeRssData] Successfully stored report in KV with key: ${kvKey}`);
    return new Response(JSON.stringify(report), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });
  } catch (error) {
    console.error("[writeRssData] Error handling daily report:", error.message, error.stack);
    return new Response(`Error handling daily report: ${error.message}`, { status: 500 });
  }
}
__name(handleWriteRssData, "handleWriteRssData");

// src/auth.js
var SESSION_COOKIE_NAME = "session_id_89757";
var SESSION_EXPIRATION_SECONDS = 60 * 60;
function generateLoginPage(redirectUrl) {
  return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login</title>
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #f4f4f4; margin: 0; }
                .login-container { background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
                h2 { color: #333; margin-bottom: 20px; }
                .form-group { margin-bottom: 15px; text-align: left; }
                label { display: block; margin-bottom: 5px; color: #555; }
                input[type="text"], input[type="password"] { width: calc(100% - 20px); padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
                button { background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; width: 100%; }
                button:hover { background-color: #0056b3; }
                .error-message { color: red; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="login-container">
                <h2>Login</h2>
                <form id="loginForm" method="POST" action="/login">
                    <div class="form-group">
                        <label for="username">Username:</label>
                        <input type="text" id="username" name="username" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Password:</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    <input type="hidden" name="redirect" value="${redirectUrl}">
                    <button type="submit">Login</button>
                    <p id="errorMessage" class="error-message"></p>
                </form>
                <script>
                    const form = document.getElementById('loginForm');
                    const errorMessage = document.getElementById('errorMessage');
                    form.addEventListener('submit', async (event) => {
                        event.preventDefault();
                        const formData = new FormData(form);
                        const response = await fetch('/login', {
                            method: 'POST',
                            body: new URLSearchParams(formData).toString(),
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        });
                        if (response.ok) {
                            const redirectUrl = response.headers.get('X-Redirect-Url');
                            if (redirectUrl && redirectUrl !== '/') {
                                window.location.href = redirectUrl;
                            } else {
                                window.location.href = '/getContentHtml'; // Fallback to home
                            }
                        } else {
                            const errorText = await response.text();
                            errorMessage.textContent = errorText || 'Login failed. Please try again.';
                        }
                    });
                <\/script>
            </div>
        </body>
        </html>
    `;
}
__name(generateLoginPage, "generateLoginPage");
function setSessionCookie(sessionId) {
  const expirationDate = new Date(Date.now() + SESSION_EXPIRATION_SECONDS * 1e3);
  return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; Expires=${expirationDate.toUTCString()}; HttpOnly; Secure; SameSite=Lax`;
}
__name(setSessionCookie, "setSessionCookie");
async function handleLogin(request, env) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const redirectUrl = url.searchParams.get("redirect") || "/getContentHtml";
    return new Response(generateLoginPage(redirectUrl), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  } else if (request.method === "POST") {
    const formData = await request.formData();
    const username = formData.get("username");
    const password = formData.get("password");
    const redirect = formData.get("redirect") || "/";
    if (username === env.LOGIN_USERNAME && password === env.LOGIN_PASSWORD) {
      const sessionId = crypto.randomUUID();
      await storeInKV(env.DATA_KV, `session:${sessionId}`, "valid", SESSION_EXPIRATION_SECONDS);
      const cookie = setSessionCookie(sessionId);
      return new Response("Login successful", {
        status: 200,
        headers: {
          "Set-Cookie": cookie,
          "X-Redirect-Url": redirect
          // Custom header for client-side redirect
        }
      });
    } else {
      return new Response("Invalid username or password", { status: 401 });
    }
  }
  return new Response("Method Not Allowed", { status: 405 });
}
__name(handleLogin, "handleLogin");
async function isAuthenticated(request, env) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) {
    return { authenticated: false, cookie: null };
  }
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!sessionCookie) {
    return { authenticated: false, cookie: null };
  }
  const sessionId = sessionCookie.split("=")[1];
  const storedSession = await getFromKV(env.DATA_KV, `session:${sessionId}`);
  if (storedSession !== "valid") {
    return { authenticated: false, cookie: null };
  }
  await storeInKV(env.DATA_KV, `session:${sessionId}`, "valid", SESSION_EXPIRATION_SECONDS);
  const newCookie = setSessionCookie(sessionId);
  return { authenticated: true, cookie: newCookie };
}
__name(isAuthenticated, "isAuthenticated");
async function handleLogout(request, env) {
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    const sessionCookie = cookies.find((cookie2) => cookie2.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (sessionCookie) {
      const sessionId = sessionCookie.split("=")[1];
      await env.DATA_KV.delete(`session:${sessionId}`);
    }
  }
  const expiredDate = /* @__PURE__ */ new Date(0);
  const cookie = `${SESSION_COOKIE_NAME}=; Path=/; Expires=${expiredDate.toUTCString()}; HttpOnly; Secure; SameSite=Lax`;
  const url = new URL(request.url);
  const redirectUrl = url.searchParams.get("redirect") || "/login";
  return new Response("Logged out", {
    status: 302,
    headers: {
      "Set-Cookie": cookie,
      "Location": redirectUrl
    }
  });
}
__name(handleLogout, "handleLogout");

// src/handlers/scheduled.js
async function handleScheduled(event, env, ctx) {
  const dateStr = getISODate();
  setFetchDate(dateStr);
  console.log(`[Scheduled] Starting daily automation for ${dateStr}`);
  try {
    console.log(`[Scheduled] Fetching data...`);
    let foloCookie = env.FOLO_COOKIE;
    if (!foloCookie && env.FOLO_COOKIE_KV_KEY) {
      try {
        foloCookie = await getFromKV(env.DATA_KV, env.FOLO_COOKIE_KV_KEY);
        if (foloCookie) console.log(`[Scheduled] Loaded Folo cookie from KV (${env.FOLO_COOKIE_KV_KEY}).`);
      } catch (err) {
        console.warn(`[Scheduled] Failed to load Folo cookie from KV: ${err.message}`);
      }
    }
    const allUnifiedData = await fetchAllData(env, foloCookie);
    const fetchPromises = [];
    for (const sourceType in dataSources) {
      if (Object.hasOwnProperty.call(dataSources, sourceType)) {
        fetchPromises.push(storeInKV(env.DATA_KV, `${dateStr}-${sourceType}`, allUnifiedData[sourceType] || []));
      }
    }
    await Promise.all(fetchPromises);
    console.log(`[Scheduled] Data fetched and stored.`);
    const selectedContentItems = [];
    for (const sourceType in allUnifiedData) {
      const items = allUnifiedData[sourceType];
      if (items && items.length > 0) {
        for (const item of items) {
          let itemText = "";
          switch (item.type) {
            case "news":
              itemText = `News Title: ${item.title}
Published: ${item.published_date}
Url: ${item.url}
Content Summary: ${stripHtml(item.details.content_html)}`;
              break;
            case "project":
              itemText = `Project Name: ${item.title}
Published: ${item.published_date}
Url: ${item.url}
Description: ${item.description}
Stars: ${item.details.totalStars}`;
              break;
            case "paper":
              itemText = `Papers Title: ${item.title}
Published: ${item.published_date}
Url: ${item.url}
Abstract/Content Summary: ${stripHtml(item.details.content_html)}`;
              break;
            case "socialMedia":
              itemText = `socialMedia Post by ${item.authors}\uFF1APublished: ${item.published_date}
Url: ${item.url}
Content: ${stripHtml(item.details.content_html)}`;
              break;
            default:
              itemText = `Type: ${item.type}
Title: ${item.title || "N/A"}
Description: ${item.description || "N/A"}
URL: ${item.url || "N/A"}`;
              if (item.published_date) itemText += `
Published: ${item.published_date}`;
              if (item.source) itemText += `
Source: ${item.source}`;
              if (item.details && item.details.content_html) itemText += `
Content: ${stripHtml(item.details.content_html)}`;
              break;
          }
          if (itemText) selectedContentItems.push(itemText);
        }
      }
    }
    if (selectedContentItems.length === 0) {
      console.log(`[Scheduled] No items found. Skipping generation.`);
      return;
    }
    console.log(`[Scheduled] Generating content...`);
    let fullPromptForCall2_System2 = getSystemPromptSummarizationStepOne();
    let fullPromptForCall2_User2 = "\n\n------\n\n" + selectedContentItems.join("\n\n------\n\n") + "\n\n------\n\n";
    let outputOfCall2 = "";
    for await (const chunk of callChatAPIStream(env, fullPromptForCall2_User2, fullPromptForCall2_System2)) {
      outputOfCall2 += chunk;
    }
    outputOfCall2 = removeMarkdownCodeBlock(outputOfCall2);
    outputOfCall2 = convertPlaceholdersToMarkdownImages(outputOfCall2);
    console.log(`[Scheduled] Generating summary...`);
    let fullPromptForCall3_System = getSystemPromptSummarizationStepThree();
    let fullPromptForCall3_User = outputOfCall2;
    let outputOfCall3 = "";
    for await (const chunk of callChatAPIStream(env, fullPromptForCall3_User, fullPromptForCall3_System)) {
      outputOfCall3 += chunk;
    }
    outputOfCall3 = removeMarkdownCodeBlock(outputOfCall3);
    const contentWithMidAd = insertMidAd(outputOfCall2);
    let dailySummaryMarkdownContent = `## ${env.DAILY_TITLE} ${formatDateToChinese(dateStr)}

`;
    dailySummaryMarkdownContent += "> " + env.DAILY_TITLE_MIN + "\n\n";
    dailySummaryMarkdownContent += "\n\n### **\u4ECA\u65E5\u6458\u8981**\n\n```\n" + outputOfCall3 + "\n```\n\n";
    dailySummaryMarkdownContent += "\n\n## \u26A1 \u5FEB\u901F\u5BFC\u822A\n\n";
    dailySummaryMarkdownContent += "- [\u{1F4F0} \u4ECA\u65E5 AI \u8D44\u8BAF](#\u4ECA\u65E5ai\u8D44\u8BAF) - \u6700\u65B0\u52A8\u6001\u901F\u89C8\n\n";
    dailySummaryMarkdownContent += `

${contentWithMidAd}`;
    if (env.INSERT_AD == "true") dailySummaryMarkdownContent += insertAd() + `
`;
    if (env.INSERT_FOOT == "true") dailySummaryMarkdownContent += insertFoot() + `

`;
    console.log(`[Scheduled] Committing to GitHub...`);
    const filePath = `content/cn/daily/${dateStr}.md`;
    const existingSha = await getGitHubFileSha(env, filePath);
    const commitMessage = `${existingSha ? "Update" : "Create"} daily summary for ${dateStr} (Scheduled)`;
    await createOrUpdateGitHubFile(env, filePath, dailySummaryMarkdownContent, commitMessage, existingSha);
    console.log(`[Scheduled] Success!`);
  } catch (error) {
    console.error(`[Scheduled] Error:`, error);
  }
}
__name(handleScheduled, "handleScheduled");

// src/index.js
var src_default = {
  async scheduled(event, env, ctx) {
    await handleScheduled(event, env, ctx);
  },
  async fetch(request, env) {
    const requiredEnvVars = [
      "DATA_KV",
      "OPEN_TRANSLATE",
      "USE_MODEL_PLATFORM",
      "GITHUB_TOKEN",
      "GITHUB_REPO_OWNER",
      "GITHUB_REPO_NAME",
      "GITHUB_BRANCH",
      "LOGIN_USERNAME",
      "LOGIN_PASSWORD",
      "PODCAST_TITLE",
      "PODCAST_BEGIN",
      "PODCAST_END",
      "FOLO_COOKIE_KV_KEY",
      "FOLO_DATA_API",
      "FOLO_FILTER_DAYS"
    ];
    const platform = String(env.USE_MODEL_PLATFORM || "").toUpperCase();
    if (platform.startsWith("OPEN")) {
      requiredEnvVars.push("OPENAI_API_URL", "DEFAULT_OPEN_MODEL", "OPENAI_API_KEY");
    } else if (platform.startsWith("ANTHROPIC")) {
      requiredEnvVars.push("ANTHROPIC_API_URL", "DEFAULT_ANTHROPIC_MODEL", "ANTHROPIC_API_KEY");
    } else {
      requiredEnvVars.push("GEMINI_API_URL", "DEFAULT_GEMINI_MODEL");
    }
    const missingVars = requiredEnvVars.filter((varName) => !env[varName]);
    if (!platform.startsWith("OPEN") && !platform.startsWith("ANTHROPIC")) {
      const hasGeminiKey = Boolean(env.GEMINI_API_KEY || env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY);
      if (!hasGeminiKey) missingVars.push("GEMINI_API_KEY");
    }
    if (missingVars.length > 0) {
      console.error(`CRITICAL: Missing environment variables/bindings: ${missingVars.join(", ")}`);
      const errorPage = `
                <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Configuration Error</title></head>
                <body style="font-family: sans-serif; padding: 20px;"><h1>Server Configuration Error</h1>
                <p>Essential environment variables or bindings are missing: ${missingVars.join(", ")}. The service cannot operate.</p>
                <p>Please contact the administrator.</p></body></html>`;
      return new Response(errorPage, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    console.log(`Request received: ${request.method} ${path}`);
    if (path === "/login") {
      return await handleLogin(request, env);
    } else if (path === "/logout") {
      return await handleLogout(request, env);
    } else if (path === "/getContent" && request.method === "GET") {
      return await handleGetContent(request, env);
    } else if (path.startsWith("/rss") && request.method === "GET") {
      return await handleRss(request, env);
    } else if (path === "/writeRssData" && request.method === "GET") {
      return await handleWriteRssData(request, env);
    }
    const { authenticated, cookie: newCookie } = await isAuthenticated(request, env);
    if (!authenticated) {
      const loginUrl = new URL("/login", url.origin);
      loginUrl.searchParams.set("redirect", url.pathname + url.search);
      return Response.redirect(loginUrl.toString(), 302);
    }
    let response;
    try {
      if (path === "/writeData" && request.method === "POST") {
        response = await handleWriteData(request, env);
      } else if ((path === "/getContentHtml" || path === "/") && request.method === "GET") {
        const dataCategories = Object.keys(dataSources).map((key) => ({
          id: key,
          name: dataSources[key].name
        }));
        response = await handleGetContentHtml(request, env, dataCategories);
      } else if (path === "/genAIContent" && request.method === "POST") {
        response = await handleGenAIContent(request, env);
      } else if (path === "/genAIPodcastScript" && request.method === "POST") {
        response = await handleGenAIPodcastScript(request, env);
      } else if (path === "/genAIDailyAnalysis" && request.method === "POST") {
        response = await handleGenAIDailyAnalysis(request, env);
      } else if (path === "/genAIDailyPage" && request.method === "GET") {
        response = await handleGenAIDailyPage(request, env);
      } else if (path === "/commitToGitHub" && request.method === "POST") {
        response = await handleCommitToGitHub(request, env);
      } else {
        return new Response(null, { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    } catch (e) {
      console.error("Unhandled error in fetch handler:", e);
      return new Response(`Internal Server Error: ${e.message}`, { status: 500 });
    }
    if (newCookie) {
      response.headers.append("Set-Cookie", newCookie);
    }
    return response;
  }
};

// C:/Users/dongy/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/dongy/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-3jtB67/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// C:/Users/dongy/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-3jtB67/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
