import {
  chooseLocale,
  handleRequest,
  initialData,
  renderPage,
} from "./server.tsx";
import { safeHttpUrl } from "./App.tsx";
import type { PageData } from "./types.ts";

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
const request = (path: string, init?: RequestInit) =>
  new Request(`http://localhost${path}`, init);
const noDatabase = async (_data: PageData) => {};

Deno.test("locale precedence is URL, cookie, browser", () => {
  assert(
    chooseLocale(
      request("/?lang=en", {
        headers: { cookie: "testag-lang=zh-CN", "accept-language": "zh-CN" },
      }),
    ) === "en",
  );
  assert(
    chooseLocale(
      request("/", {
        headers: { cookie: "testag-lang=zh-CN", "accept-language": "en" },
      }),
    ) === "zh-CN",
  );
  assert(
    chooseLocale(
      request("/", { headers: { "accept-language": "zh-TW,en;q=0.5" } }),
    ) === "zh-CN",
  );
});
Deno.test("search navigates to a separate callsign result page, including portable calls", async () => {
  const response = await handleRequest(
    request("/lookup?callsign=bi1xjt&lang=zh-CN"),
    "redirect",
    noDatabase,
  );
  assert(response.status === 303);
  assert(response.headers.get("location") === "/stats/BI1XJT?lang=zh-CN");
  const portable = await handleRequest(
    request("/lookup?callsign=BY%2FBI1XJT%2FP"),
    "portable",
    noDatabase,
  );
  assert(portable.headers.get("location") === "/stats/BY%2FBI1XJT%2FP?lang=en");
  const data = initialData(request("/stats/BY%2FBI1XJT%2FP?offset=50"));
  assert(
    data.page === "callsign" && data.callsign === "BY/BI1XJT/P" &&
      data.offset === 50,
  );
  const canonical = await handleRequest(
    request("/stats/bi1xjt?lang=en"),
    "canonical",
    noDatabase,
  );
  assert(
    canonical.status === 308 &&
      canonical.headers.get("location") === "/stats/BI1XJT?lang=en",
  );
});
Deno.test("all pages are server rendered with real links and localized table headings", async () => {
  for (const lang of ["en", "zh-CN"]) {
    for (const path of ["/", "/stats/BI1XJT", "/statistics", "/about"]) {
      const response = await handleRequest(
        request(`${path}?lang=${lang}`),
        `${path}-${lang}`,
        noDatabase,
      );
      assert(response.status === 200);
      const html = await response.text();
      assert(html.includes(`lang="${lang}"`));
      assert(html.includes('href="/statistics?lang='));
      assert(html.includes('href="/about?lang='));
      if (path === "/stats/BI1XJT") {
        assert(html.includes(lang === "en" ? "Calculated" : "计算"));
      }
      if (path === "/") {
        assert(!html.includes("<table"));
      }
      const nonce = html.match(/name="emotion-nonce" content="([^"]+)"/)?.[1];
      assert(
        nonce && html.includes(`nonce="${nonce}"`) &&
          response.headers.get("content-security-policy")?.includes(
            `nonce-${nonce}`,
          ),
      );
    }
  }
});
Deno.test("invalid queries fail before database access; unsafe links and embedded JSON are escaped", async () => {
  let queried = false;
  const response = await handleRequest(
    request("/stats/BI1XJT?offset=1"),
    "invalid",
    async () => {
      queried = true;
    },
  );
  assert(response.status === 400 && !queried);
  assert(safeHttpUrl("javascript:alert(1)") === undefined);
  assert(safeHttpUrl("https://example.com/") === "https://example.com/");
  const html = renderPage(
    initialData(
      request(
        "/lookup?callsign=" +
          encodeURIComponent("</script><script>alert(1)</script>"),
      ),
    ),
    "testnonce",
  );
  assert(!html.includes("</script><script>alert(1)"));
  assert(html.includes("\\u003c"));
});
Deno.test("unsupported routes/methods, API validation, HEAD, and rate limiting", async () => {
  assert(
    (await handleRequest(request("/missing"), "404", noDatabase)).status ===
      404,
  );
  assert(
    (await handleRequest(request("/", { method: "POST" }), "405", noDatabase))
      .status === 405,
  );
  const head = await handleRequest(
    request("/about", { method: "HEAD" }),
    "head",
    noDatabase,
  );
  assert(head.status === 200 && await head.text() === "");
  assert(
    (await handleRequest(request("/api/search"), "missingcall", noDatabase))
      .status === 400,
  );
  for (let i = 0; i < 60; i++) {
    assert(
      (await handleRequest(request("/api/status"), "rate-test", noDatabase))
        .status === 200,
    );
  }
  const limited = await handleRequest(
    request("/api/status"),
    "rate-test",
    noDatabase,
  );
  assert(limited.status === 429 && limited.headers.has("Retry-After"));
});
