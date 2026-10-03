import { normalizeCallsign, parseFilters, parseOffset } from "./db.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}
Deno.test("callsign normalization accepts portable calls and rejects malformed input", () => {
  equal(normalizeCallsign(" bi1xjt "), "BI1XJT");
  equal(normalizeCallsign("BY/BI1XJT/P"), "BY/BI1XJT/P");
  for (
    const call of [
      "",
      "AB",
      "BI1XJT;DROP TABLE",
      "BI1XJT//P",
      "ABCDEFGH",
      "A/B/C/D",
      "中文呼号",
    ]
  ) equal(normalizeCallsign(call), null);
});
Deno.test("offsets must be bounded page boundaries", () => {
  equal(parseOffset(null), 0);
  equal(parseOffset("50"), 50);
  equal(parseOffset("100000"), 100000);
  for (
    const offset of ["-1", "1", "50.0", "5e1", "100050", "99999999999999999999"]
  ) equal(parseOffset(offset), null);
});
Deno.test("statistics filters only accept the archive's contest/year/mode set", () => {
  equal(
    parseFilters(new URLSearchParams("contest=cqww-dx&year=2025&mode=cw")),
    { contest: "cqww-dx", year: "2025", mode: "cw" },
  );
  for (
    const query of [
      "contest=unknown",
      "mode=rtty",
      "year=1899",
      "year=2201",
      "year=2025 OR 1=1",
    ]
  ) equal(parseFilters(new URLSearchParams(query)), null);
});
