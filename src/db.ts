// @ts-types="@types/pg"
import { Pool, type PoolClient } from "pg";
import {
  contests,
  type Filters,
  modes,
  type PageData,
  type Partition,
  type Release,
  type Result,
  type State,
} from "./types.ts";

export const PAGE_SIZE = 50;
export const MAX_OFFSET = 100_000;
let pool: Pool | undefined;
let statisticsCache:
  | { release: string; expires: number; rows: Partition[] }
  | undefined;

export function normalizeCallsign(value: string): string | null {
  const call = value.trim().toUpperCase();
  return call.length >= 3 && call.length <= 17 &&
      /^[A-Z0-9]{1,7}(?:\/[A-Z0-9]{1,7}){0,2}$/.test(call)
    ? call
    : null;
}

export function parseFilters(params: URLSearchParams): Filters | null {
  const contest = params.get("contest") ?? "";
  const year = params.get("year") ?? "";
  const mode = params.get("mode") ?? "";
  if (
    (contest && !contests.includes(contest)) ||
    (mode && !modes.includes(mode)) ||
    (year && (!/^\d{4}$/.test(year) || +year < 1900 || +year > 2200))
  ) return null;
  return { contest, year, mode };
}

export function parseOffset(value: string | null): number | null {
  if (value === null) return 0;
  if (!/^\d+$/.test(value)) return null;
  const offset = Number(value);
  return Number.isSafeInteger(offset) && offset <= MAX_OFFSET &&
      offset % PAGE_SIZE === 0
    ? offset
    : null;
}

function getPool(): Pool | null {
  const connectionString = Deno.env.get("DATABASE_URL")?.trim();
  if (!connectionString) return null;
  return pool ??= new Pool({
    connectionString,
    max: 4,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
  });
}

export async function withReadOnlyTransaction<T>(
  database: Pool,
  read: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await database.connect();
  let discard = false;
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15s'");
    const result = await read(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}

function errorState(error: unknown): State {
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "UNKNOWN";
  console.error("Archive query failed", { code });
  return ["3D000", "3F000", "42P01", "42703"].includes(code)
    ? "not_initialized"
    : "unavailable";
}

export async function loadArchive(data: PageData): Promise<void> {
  const database = getPool();
  if (!database) {
    data.state = "not_configured";
    return;
  }
  try {
    await withReadOnlyTransaction(database, async (database) => {
      const release = await database.query<Release>(`
      SELECT release_id, built_at_utc::text, latest_retrieved_at_utc::text,
        dataset_license, attribution, partition_count, entry_count::text, operator_membership_count::text
      FROM testag_dataset_release ORDER BY built_at_utc DESC, release_id DESC LIMIT 1
    `);
      data.release = release.rows[0] ?? null;
      if (!data.release) {
        data.state = "empty";
        return;
      }
      data.state = "ready";
      if (data.error) return;
      if (data.page === "callsign" && data.callsign) {
        const result = await database.query<Result>(
          `
        WITH matched AS (
          SELECT result_id, 'station'::text AS match_type FROM contest_result WHERE station_callsign = $1
          UNION ALL
          SELECT result_id, 'operator'::text AS match_type FROM contest_result_operator WHERE operator_callsign = $1
        ), unique_matches AS (
          SELECT result_id, CASE WHEN bool_or(match_type = 'station') THEN 'station' ELSE 'operator' END AS match_type
          FROM matched GROUP BY result_id
        )
        SELECT r.entry_id, r.contest_id, r.edition_year, r.mode,
          r.station_callsign_source, r.station_callsign, r.location_code_source, c.category_source,
          r.dxcc_entity_source, r.dxcc_adif, r.dxcc_entity_inferred, r.dxcc_resolution, r.overlay_category_source, r.score_source, r.score::text AS score,
          r.qso_count, r.cq_zones, r.cq_countries, r.wpx_prefixes, r.multipliers,
          r.operating_hours_source, r.operating_hours, r.late_entry, r.award_eligibility,
          b.eligibility_basis, r.operator_list_complete,
          r.category_world_rank_official, r.category_world_rank_calculated,
          r.category_in_dxcc_rank_official, r.category_in_dxcc_rank_calculated,
          r.overlay_world_rank_official, r.overlay_world_rank_calculated,
          r.overlay_in_dxcc_rank_official, r.overlay_in_dxcc_rank_calculated, r.metrics_json,
          m.match_type, p.source_url, p.retrieved_at_utc::text,
          COALESCE((SELECT array_agg(o.operator_callsign_source ORDER BY o.operator_order)
            FROM contest_result_operator o WHERE o.result_id = r.result_id), ARRAY[]::text[]) AS operators
        FROM unique_matches m JOIN contest_result r USING (result_id)
        JOIN contest_result_partition p USING (contest_id, edition_year, mode)
        JOIN contest_result_category c USING (category_id)
        JOIN contest_result_eligibility_basis b USING (eligibility_basis_id)
        ORDER BY r.edition_year DESC, r.contest_id, r.mode, c.category_source, r.entry_id
        LIMIT $2 OFFSET $3
      `,
          [data.callsign, PAGE_SIZE + 1, data.offset],
        );
        data.hasMore = result.rows.length > PAGE_SIZE;
        data.rows = result.rows.slice(0, PAGE_SIZE);
      }
      if (data.page === "statistics") {
        if (
          !statisticsCache ||
          statisticsCache.release !== data.release.release_id ||
          statisticsCache.expires < Date.now()
        ) {
          const partitions = await database.query<Partition>(`
          SELECT p.contest_id, p.edition_year, p.mode, p.retrieved_at_utc::text, p.source_url,
            count(r.result_id)::text AS entry_count,
            count(r.result_id) FILTER (WHERE r.award_eligibility = 'eligible')::text AS eligible_count,
            count(r.result_id) FILTER (WHERE r.category_world_rank_official IS NOT NULL
              OR r.category_in_dxcc_rank_official IS NOT NULL OR r.overlay_world_rank_official IS NOT NULL
              OR r.overlay_in_dxcc_rank_official IS NOT NULL)::text AS official_rank_count
          FROM contest_result_partition p LEFT JOIN contest_result r USING (contest_id, edition_year, mode)
          GROUP BY p.contest_id, p.edition_year, p.mode, p.retrieved_at_utc, p.source_url
          ORDER BY p.contest_id, p.edition_year DESC, p.mode
        `);
          statisticsCache = {
            release: data.release.release_id,
            expires: Date.now() + 60_000,
            rows: partitions.rows,
          };
        }
        data.yearOptions = [
          ...new Set(statisticsCache.rows.map((p) => p.edition_year)),
        ].sort((a, b) => b - a);
        data.contestCount = new Set(statisticsCache.rows.map((p) =>
          p.contest_id
        )).size;
        data.partitions = statisticsCache.rows.filter((p) =>
          (!data.filters.contest || p.contest_id === data.filters.contest) &&
          (!data.filters.year || p.edition_year === +data.filters.year) &&
          (!data.filters.mode || p.mode === data.filters.mode)
        );
      }
    });
  } catch (error) {
    data.state = errorState(error);
    data.release = null;
    data.rows = [];
    data.partitions = [];
    data.hasMore = false;
  }
}
