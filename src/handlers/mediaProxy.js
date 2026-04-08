const ALLOWED_MEDIA_HOSTS = new Set(["video.twimg.com"]);
const FORWARDED_REQUEST_HEADERS = ["range"];
const PASSTHROUGH_RESPONSE_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
];

export function parseMediaProxyTarget(requestUrl) {
  const target = requestUrl.searchParams.get("url");
  if (!target) {
    return { error: "Missing url parameter.", status: 400 };
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return { error: "Invalid media url.", status: 400 };
  }

  if (targetUrl.protocol !== "https:") {
    return { error: "Only https media urls are allowed.", status: 400 };
  }

  if (!ALLOWED_MEDIA_HOSTS.has(targetUrl.hostname)) {
    return { error: "Unsupported media host.", status: 400 };
  }

  return { targetUrl };
}

export async function handleMediaProxy(request) {
  const requestUrl = new URL(request.url);
  const { targetUrl, error, status } = parseMediaProxyTarget(requestUrl);

  if (!targetUrl) {
    return new Response(error, {
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const upstreamHeaders = new Headers();
  for (const headerName of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(headerName);
    if (value) {
      upstreamHeaders.set(headerName, value);
    }
  }

  const upstreamResponse = await fetch(targetUrl.toString(), {
    method: request.method,
    headers: upstreamHeaders,
    redirect: "follow",
  });

  const responseHeaders = new Headers();
  for (const headerName of PASSTHROUGH_RESPONSE_HEADERS) {
    const value = upstreamResponse.headers.get(headerName);
    if (value) {
      responseHeaders.set(headerName, value);
    }
  }
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");

  return new Response(request.method === "HEAD" ? null : upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
