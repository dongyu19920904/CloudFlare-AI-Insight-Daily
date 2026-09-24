import { extractDailyMarkdownLinks } from "./dailyMarkdownItems.js";
import { countUsableDailyMedia } from "./dailyMediaCoverage.js";
import { normalizeMarkdownMediaUrl } from "./helpers.js";
import { callGitHubApi, getGitHubFileSha } from "./github.js";

const MAX_IMAGES_PER_DAILY = 4;
const MAX_IMAGE_BYTES = 500_000;

function telegramPostKey(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || !["t.me", "telegram.me"].includes(url.hostname.toLowerCase())) return "";
    const match = url.pathname.match(/^\/([a-z0-9_]{3,})\/(\d+)\/?$/i);
    return match ? `${match[1].toLowerCase()}-${match[2]}` : "";
  } catch {
    return "";
  }
}

function isTelegramImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(?:^|\.)telesco\.pe$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export function extractTelegramDailyImageCandidate(item) {
  const postKey = telegramPostKey(item?.url);
  if (!postKey) return null;

  for (const match of String(item?.details?.content_html || "").matchAll(/<img\b[^>]*>/gi)) {
    const imageUrl = normalizeMarkdownMediaUrl(match[0].match(/\bsrc=["']([^"']+)["']/i)?.[1]);
    if (isTelegramImageUrl(imageUrl)) {
      return { sourceUrl: item.url, postKey, imageUrl, title: item.title || "Telegram 原帖配图" };
    }
  }
  return null;
}

function imageExtension(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return "";
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

async function readBoundedImage(response) {
  if (!response.ok || !response.body || !/^image\/(?:jpeg|png|webp)(?:;|$)/i.test(response.headers.get("content-type") || "")) {
    throw new Error("Telegram image response is not a supported image");
  }
  const declaredSize = Number(response.headers.get("content-length"));
  if (declaredSize > MAX_IMAGE_BYTES) throw new Error("Telegram image exceeds the size limit");

  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  let complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        complete = true;
        break;
      }
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) throw new Error("Telegram image exceeds the size limit");
      chunks.push(value);
    }
  } finally {
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const extension = imageExtension(bytes);
  if (!extension) throw new Error("Telegram image has an unsupported file signature");
  return { bytes, extension };
}

function appendImage(block, imageMarkdown) {
  const separator = block.match(/\n---\s*$/);
  if (!separator) return `${block.trimEnd()}\n\n${imageMarkdown}\n\n`;
  return `${block.slice(0, separator.index).trimEnd()}\n\n${imageMarkdown}\n\n---\n\n`;
}

export async function archiveDailyTelegramImages(markdown, candidates, dateStr, env, dependencies = {}) {
  const content = String(markdown || "");
  const byPost = new Map((candidates || []).map((candidate) => [candidate.postKey, candidate]));
  const blockPattern = /^###\s+[^\r\n]+(?:\r?\n|$)[\s\S]*?(?=^###\s+|^##\s+|(?![\s\S]))/gm;
  const targets = [];

  for (const match of content.matchAll(blockPattern)) {
    if (targets.length >= MAX_IMAGES_PER_DAILY) break;
    const section = content.slice(0, match.index).match(/^##\s+[^\r\n]+$/gm)?.at(-1) || "";
    if (/(?:相关问题|FAQ)/i.test(section) || countUsableDailyMedia(match[0]) > 0) continue;
    const candidate = extractDailyMarkdownLinks(match[0])
      .map((link) => byPost.get(telegramPostKey(link.url)))
      .find(Boolean);
    if (candidate) targets.push({ offset: match.index, candidate });
  }

  const fetchImage = dependencies.fetchImage || fetch;
  const getFileSha = dependencies.getFileSha || getGitHubFileSha;
  const putFile = dependencies.putFile || callGitHubApi;
  let uploadQueue = Promise.resolve();
  const results = await Promise.all(targets.map(async ({ offset, candidate }) => {
    try {
      const basePath = `static/images/daily/${dateStr}/telegram-${candidate.postKey}`;
      const originalExtension = candidate.imageUrl.match(/\.(jpe?g|png|webp)(?:[?#]|$)/i)?.[1]?.toLowerCase();
      const expectedExtension = originalExtension === "jpeg" ? "jpg" : originalExtension;
      if (expectedExtension) {
        const existingPath = `${basePath}.${expectedExtension}`;
        if (await getFileSha(env, existingPath)) return { offset, candidate, sitePath: `/${existingPath.slice(7)}` };
      }

      const response = await fetchImage(candidate.imageUrl, {
        signal: AbortSignal.timeout(12000),
        redirect: "error",
      });
      const { bytes, extension } = await readBoundedImage(response);
      const filePath = `${basePath}.${extension}`;
      const sitePath = `/${filePath.slice(7)}`;
      if (!expectedExtension || expectedExtension !== extension) {
        if (await getFileSha(env, filePath)) return { offset, candidate, sitePath };
      }
      const upload = uploadQueue.then(() => putFile(env, `/contents/${filePath}`, "PUT", {
        message: `Archive Telegram image for daily ${dateStr}`,
        content: bytesToBase64(bytes),
        branch: env.GITHUB_BRANCH || "main",
      }));
      uploadQueue = upload.catch(() => {});
      await upload;
      return { offset, candidate, sitePath };
    } catch (error) {
      console.warn(`[Scheduled][Daily] Skipping Telegram image for ${candidate.sourceUrl}: ${error.message}`);
      return null;
    }
  }));

  const imagesByOffset = new Map(results.filter(Boolean).map((result) => [result.offset, result]));
  const updated = content.replace(blockPattern, (block, offset) => {
    const result = imagesByOffset.get(offset);
    if (!result) return block;
    const caption = String(result.candidate.title).replace(/[\[\]"'\r\n]+/g, " ").replace(/\s+/g, " ").slice(0, 48);
    return appendImage(block, `![${caption}](${result.sitePath} "${caption}")`);
  });
  return { markdown: updated, attemptedCount: targets.length, archivedCount: imagesByOffset.size };
}
