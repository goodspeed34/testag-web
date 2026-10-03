import { renderToString } from "react-dom/server";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import createEmotionServer from "@emotion/server/create-instance";
import { App } from "./App.tsx";
import {
  loadArchive,
  normalizeCallsign,
  PAGE_SIZE,
  parseFilters,
  parseOffset,
} from "./db.ts";
import { translator } from "./locales.ts";
import type { Locale, Page, PageData } from "./types.ts";

const pages: Record<string, Page> = {
  "/": "main",
  "/lookup": "main",
  "/statistics": "statistics",
  "/about": "about",
};
const assets: Record<string, [string, string]> = {
  "/assets/client.js": ["../dist/client.js", "text/javascript; charset=utf-8"],
  "/assets/styles.css": ["../public/styles.css", "text/css; charset=utf-8"],
  "/favicon.svg": ["../public/favicon.svg", "image/svg+xml"],
};
const windows = new Map<string, { start: number; count: number }>();

export function chooseLocale(request: Request): Locale {
  const explicit = new URL(request.url).searchParams.get("lang");
  if (explicit === "en" || explicit === "zh-CN") return explicit;
  const saved = request.headers.get("cookie")?.match(
    /(?:^|;\s*)testag-lang=(en|zh-CN)(?:;|$)/,
  )?.[1];
  if (saved) return saved as Locale;
  return request.headers.get("accept-language")?.split(",")[0].trim()
      .toLowerCase().startsWith("zh")
    ? "zh-CN"
    : "en";
}

export function initialData(request: Request): PageData {
  const url = new URL(request.url);
  const filters = parseFilters(url.searchParams);
  const offset = parseOffset(url.searchParams.get("offset"));
  const callsignPage = url.pathname.startsWith("/stats/");
  let pathCall = "";
  try {
    pathCall = decodeURIComponent(url.pathname.slice(7));
  } catch {
    pathCall = "!";
  }
  const rawCall = callsignPage
    ? pathCall
    : url.searchParams.get("callsign") ?? "";
  const callsign = rawCall ? normalizeCallsign(rawCall) : "";
  return {
    page: callsignPage ? "callsign" : pages[url.pathname] ?? "notFound",
    path: url.pathname,
    query: url.searchParams.toString(),
    locale: chooseLocale(request),
    state: "not_configured",
    release: null,
    callsign: callsign ?? rawCall.slice(0, 64),
    offset: offset ?? 0,
    pageSize: PAGE_SIZE,
    error: callsign === null || (callsignPage && !callsign)
      ? "invalidCallsign"
      : !filters || offset === null
      ? "invalidQuery"
      : null,
    filters: filters ?? { contest: "", year: "", mode: "" },
    rows: [],
    partitions: [],
    yearOptions: [],
    contestCount: 0,
    hasMore: false,
  };
}

export function securityHeaders(nonce: string): Record<string, string> {
  return {
    "Content-Security-Policy":
      `default-src 'self'; script-src 'self'; style-src 'self' 'nonce-${nonce}'; style-src-attr 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cache-Control": "no-store",
  };
}

export function renderPage(data: PageData, nonce: string): string {
  const cache = createCache({ key: "mui", nonce });
  const { extractCriticalToChunks, constructStyleTagsFromChunks } =
    createEmotionServer(cache);
  const html = renderToString(
    <CacheProvider value={cache}>
      <App data={data} />
    </CacheProvider>,
  );
  const styles = constructStyleTagsFromChunks(extractCriticalToChunks(html));
  const t = translator(data.locale);
  const props = JSON.stringify(data).replaceAll("<", "\\u003c").replaceAll(
    "\u2028",
    "\\u2028",
  ).replaceAll("\u2029", "\\u2029");
  return `<!doctype html><html lang="${data.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${
    t("description")
  }"><meta name="emotion-nonce" content="${nonce}"><title>TESTAG — ${
    t(data.page)
  }</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/assets/styles.css">${styles}</head><body><div id="root">${html}</div><script id="page-data" type="application/json">${props}</script><script type="module" src="/assets/client.js"></script></body></html>`;
}

function limited(address: string): number | null {
  const now = Date.now();
  const entry = windows.get(address);
  if (!entry || now - entry.start >= 60_000) {
    if (windows.size > 5000) {
      for (const [key, row] of windows) {
        if (now - row.start >= 60_000) windows.delete(key);
      }
    }
    windows.set(address, { start: now, count: 1 });
    return null;
  }
  if (entry.count >= 60) {
    return Math.max(1, Math.ceil((60_000 - now + entry.start) / 1000));
  }
  entry.count++;
  return null;
}

type Loader = (data: PageData) => Promise<void>;
export async function handleRequest(
  request: Request,
  address = "local",
  loader: Loader = loadArchive,
): Promise<Response> {
  const url = new URL(request.url);
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const headers = securityHeaders(nonce);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, {
      status: 405,
      headers: { ...headers, Allow: "GET, HEAD" },
    });
  }
  const asset = assets[url.pathname];
  if (asset) {
    try {
      const bytes = await Deno.readFile(new URL(asset[0], import.meta.url));
      return new Response(request.method === "HEAD" ? null : bytes, {
        headers: {
          ...headers,
          "Content-Type": asset[1],
          "Cache-Control": "public, max-age=300",
        },
      });
    } catch {
      return new Response(null, { status: 404, headers });
    }
  }
  const data = initialData(request);
  const api = url.pathname.startsWith("/api/");
  if (url.pathname === "/api/status") data.page = "about";
  if (url.pathname === "/api/search") data.page = "callsign";
  if (url.pathname === "/api/statistics") data.page = "statistics";
  if (url.search.length > 2048) data.error = "invalidQuery";
  headers["Content-Language"] = data.locale;
  headers["Set-Cookie"] =
    `testag-lang=${data.locale}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${
      url.protocol === "https:" ? "; Secure" : ""
    }`;
  if (
    !data.error &&
    (url.pathname === "/lookup" || (url.pathname === "/" && data.callsign))
  ) {
    return new Response(null, {
      status: 303,
      headers: {
        ...headers,
        Location: data.callsign
          ? `/stats/${encodeURIComponent(data.callsign)}?lang=${data.locale}`
          : `/?lang=${data.locale}`,
      },
    });
  }
  if (
    !data.error && data.page === "callsign" && !api &&
    url.pathname !== `/stats/${encodeURIComponent(data.callsign)}`
  ) {
    return new Response(null, {
      status: 308,
      headers: {
        ...headers,
        Location: `/stats/${encodeURIComponent(data.callsign)}${url.search}`,
      },
    });
  }
  if (api || data.page === "statistics" || data.callsign) {
    const retry = limited(address);
    if (retry) {
      data.error = "rateLimited";
      headers["Retry-After"] = String(retry);
    }
  }
  let status = data.page === "notFound"
    ? 404
    : data.error === "rateLimited"
    ? 429
    : data.error
    ? 400
    : 200;
  if (data.page !== "notFound" && !data.error) await loader(data);
  if (api) {
    if (data.page === "notFound") {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    if (url.pathname === "/api/search" && !data.callsign) {
      data.error = "invalidCallsign";
      status = 400;
    }
    if (
      data.state !== "ready" && !data.error && url.pathname !== "/api/status"
    ) status = 503;
    const payload = data.error
      ? { error: data.error }
      : url.pathname === "/api/status"
      ? { state: data.state, dataset: data.release }
      : url.pathname === "/api/search"
      ? {
        state: data.state,
        callsign: data.callsign,
        offset: data.offset,
        limit: PAGE_SIZE,
        rows: data.rows,
        hasMore: data.hasMore,
      }
      : {
        state: data.state,
        dataset: data.release,
        partitions: data.partitions,
      };
    return new Response(
      request.method === "HEAD" ? null : JSON.stringify(payload),
      {
        status,
        headers: {
          ...headers,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }
  return new Response(
    request.method === "HEAD" ? null : renderPage(data, nonce),
    {
      status,
      headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
    },
  );
}
