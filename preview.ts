// Local design preview: serves every page with sample data instead of
// PostgreSQL. Run with `deno task preview`; never deploy this entrypoint.
import { handleRequest } from "./src/server.tsx";
import { contests, modes, type PageData, type Result } from "./src/types.ts";

const retrieved = "2026-09-30T22:40:00Z";
const sourceUrl = "https://example.com/contest-results";

function sampleRow(i: number): Result {
  const operated = i % 4 === 3;
  const assisted = i % 2 === 1;
  return {
    entry_id: String(i + 1),
    contest_id: contests[i % contests.length],
    edition_year: 2025 - i,
    mode: modes[i % modes.length],
    station_callsign: operated ? "BY1PK" : "BI1XJT",
    station_callsign_source: operated ? "BY1PK" : "BI1XJT",
    category_source: assisted
      ? "Single Operator All Band Low Power Assisted"
      : "SO 20M HP",
    location_code_source: "BY",
    dxcc_entity_source: i % 3 ? "China" : null,
    dxcc_adif: 318,
    dxcc_entity_inferred: "China",
    dxcc_resolution: i % 3 ? "source" : "callsign",
    overlay_category_source: assisted ? "Rookie" : null,
    score_source: null,
    score: String(1234567 - i * 98765),
    qso_count: 1543 - i * 40,
    cq_zones: 120,
    cq_countries: 300,
    wpx_prefixes: null,
    multipliers: 420,
    operating_hours_source: "36.5",
    late_entry: false,
    award_eligibility: "eligible",
    eligibility_basis: "Sample eligibility basis",
    operator_list_complete: true,
    operators: operated ? ["BI1XJT", "BG1ABC", "BH1XYZ"] : ["BI1XJT"],
    metrics_json: { zones: 120, countries: 300 },
    source_url: sourceUrl,
    retrieved_at_utc: retrieved,
    match_type: operated ? "operator" : "station",
    category_world_rank_official: 12 + i,
    category_world_rank_calculated: 12 + i,
    category_in_dxcc_rank_official: assisted ? 1 : null,
    category_in_dxcc_rank_calculated: 1 + (i % 3),
    overlay_world_rank_official: null,
    overlay_world_rank_calculated: assisted ? 4 : null,
    overlay_in_dxcc_rank_official: null,
    overlay_in_dxcc_rank_calculated: assisted ? 1 : null,
  };
}

// Search for N0NE to see the empty-results state.
async function sampleLoader(data: PageData) {
  data.state = "ready";
  data.release = {
    release_id: "sample-0000000000000000000000000000000000000000",
    built_at_utc: "2026-10-01T08:12:00Z",
    latest_retrieved_at_utc: retrieved,
    dataset_license: "Sample data for local preview",
    attribution: "Sample data for local preview",
    partition_count: 312,
    entry_count: "4821733",
    operator_membership_count: "1203994",
  };
  data.contestCount = contests.length;
  data.yearOptions = [2025, 2024, 2023, 2022];
  if (data.callsign && data.callsign !== "N0NE") {
    data.rows = Array.from({ length: 12 }, (_, i) => sampleRow(i));
    data.hasMore = data.offset === 0;
  }
  if (data.page === "statistics") {
    data.partitions = Array.from({ length: 14 }, (_, i) => ({
      contest_id: contests[i % contests.length],
      edition_year: 2025 - Math.floor(i / 2),
      mode: modes[i % 2],
      retrieved_at_utc: retrieved,
      source_url: sourceUrl,
      entry_count: String(41234 - i * 1700),
      eligible_count: String(40100 - i * 1700),
      official_rank_count: String(39000 - i * 1700),
    })).filter((p) =>
      (!data.filters.contest || p.contest_id === data.filters.contest) &&
      (!data.filters.year || String(p.edition_year) === data.filters.year) &&
      (!data.filters.mode || p.mode === data.filters.mode)
    );
  }
}

const port = Number(Deno.env.get("PORT") ?? "8000");
Deno.serve(
  { port },
  (request, info) =>
    handleRequest(
      request,
      (info.remoteAddr as Deno.NetAddr).hostname,
      sampleLoader,
    ),
);
