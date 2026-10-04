export type Locale = "en" | "zh-CN";
export type Page = "main" | "callsign" | "statistics" | "about" | "notFound";
export type State =
  | "ready"
  | "empty"
  | "not_configured"
  | "not_initialized"
  | "unavailable";
export const contests = [
  "cqww-dx",
  "cq-wpx",
  "wae-dx",
  "wapc-dx",
  "aadx",
  "iota",
  "arrl-dx",
];
export const modes = ["cw", "ssb", "mixed"];
export const rankFields = [
  "category_world_rank_official",
  "category_world_rank_calculated",
  "category_in_dxcc_rank_official",
  "category_in_dxcc_rank_calculated",
  "overlay_world_rank_official",
  "overlay_world_rank_calculated",
  "overlay_in_dxcc_rank_official",
  "overlay_in_dxcc_rank_calculated",
] as const;
export type Release = {
  release_id: string;
  built_at_utc: string;
  latest_retrieved_at_utc: string;
  dataset_license: string;
  attribution: string;
  partition_count: number;
  entry_count: string;
  operator_membership_count: string;
};
export type Result = Record<typeof rankFields[number], number | null> & {
  entry_id: string;
  contest_id: string;
  edition_year: number;
  mode: string;
  station_callsign: string;
  station_callsign_source: string;
  category_source: string;
  location_code_source: string | null;
  dxcc_entity_source: string | null;
  dxcc_adif: number | null;
  dxcc_entity_inferred: string | null;
  dxcc_resolution:
    | "source"
    | "callsign"
    | "unresolved"
    | "ambiguous_year"
    | "ambiguous_prefix"
    | "no_entity";
  overlay_category_source: string | null;
  score_source: string | null;
  score: string | null;
  qso_count: number | null;
  cq_zones: number | null;
  cq_countries: number | null;
  wpx_prefixes: number | null;
  multipliers: number | null;
  operating_hours_source: string | null;
  late_entry: boolean;
  award_eligibility: string;
  eligibility_basis: string;
  operator_list_complete: boolean;
  operators: string[];
  metrics_json: Record<string, unknown>;
  source_url: string;
  retrieved_at_utc: string;
  match_type: "station" | "operator";
};
export type Partition = {
  contest_id: string;
  edition_year: number;
  mode: string;
  retrieved_at_utc: string;
  source_url: string;
  entry_count: string;
  eligible_count: string;
  official_rank_count: string;
};
export type Filters = { contest: string; year: string; mode: string };
export type PageData = {
  page: Page;
  locale: Locale;
  path: string;
  query: string;
  state: State;
  release: Release | null;
  error: string | null;
  callsign: string;
  offset: number;
  pageSize: number;
  rows: Result[];
  hasMore: boolean;
  filters: Filters;
  partitions: Partition[];
  yearOptions: number[];
  contestCount: number;
};
