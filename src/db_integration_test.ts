// @ts-types="@types/pg"
import { Pool } from "pg";
import { loadArchive, PAGE_SIZE, withReadOnlyTransaction } from "./db.ts";
import { initialData } from "./server.tsx";
import { rankFields } from "./types.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const url = Deno.env.get("TESTAG_WEB_TEST_DATABASE_URL");
Deno.test({
  name:
    "compact database preserves lookup fields, relationships and statistics",
  ignore: !url,
  // The application pool remains open for reuse, as in the server.
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    Deno.env.set("DATABASE_URL", url!);
    const readerPool = new Pool({
      connectionString: url,
      max: 1,
    });
    try {
      await withReadOnlyTransaction(readerPool, async (reader) => {
        const settings = await reader.query(
          "SELECT current_setting('transaction_read_only') AS readonly, current_setting('statement_timeout') AS timeout",
        );
        assert(
          settings.rows[0].readonly === "on",
          "Reads must use a read-only transaction",
        );
        assert(
          settings.rows[0].timeout === "15s",
          "Reads must retain their statement timeout",
        );
        const operators = await reader.query<{ operator_callsign: string }>(`
        SELECT o.operator_callsign FROM contest_result_operator o JOIN contest_result r USING (result_id)
        WHERE o.operator_callsign <> r.station_callsign AND o.operator_callsign ~ '^[A-Z0-9]{3,7}$' LIMIT 1
      `);
        assert(
          operators.rows.length === 1,
          "Archive needs an operator membership",
        );
        for (const call of ["BI1XJT", operators.rows[0].operator_callsign]) {
          const data = initialData(
            new Request(`http://localhost/stats/${encodeURIComponent(call)}`),
          );
          await loadArchive(data);
          assert(data.state === "ready", "Lookup must be ready");
          const expected = await reader.query<{ entry_id: string }>(
            `
          SELECT r.entry_id FROM contest_result r JOIN contest_result_category c USING (category_id)
          WHERE r.station_callsign=$1 OR EXISTS (SELECT 1 FROM contest_result_operator o
            WHERE o.result_id=r.result_id AND o.operator_callsign=$1)
          ORDER BY r.edition_year DESC, r.contest_id, r.mode, c.category_source, r.entry_id
        `,
            [call],
          );
          assert(
            JSON.stringify(data.rows.map((r) => r.entry_id)) ===
              JSON.stringify(
                expected.rows.slice(0, PAGE_SIZE).map((r) => r.entry_id),
              ),
            "Deduplication and ordering must match",
          );
          assert(
            data.hasMore === (expected.rows.length > PAGE_SIZE),
            "Pagination must match",
          );
          for (const row of data.rows) {
            assert(
              !("result_id" in row || "category_id" in row ||
                "eligibility_basis_id" in row),
              "Internal IDs must stay private",
            );
            for (const name of rankFields) {
              assert(name in row, "All eight ranks must remain available");
            }
            const source = await reader.query(
              `
            SELECT c.category_source, b.eligibility_basis, r.metrics_json, r.station_callsign,
              ARRAY(SELECT o.operator_callsign_source FROM contest_result_operator o
                WHERE o.result_id=r.result_id ORDER BY o.operator_order) AS operators
            FROM contest_result r JOIN contest_result_category c USING (category_id)
            JOIN contest_result_eligibility_basis b USING (eligibility_basis_id) WHERE r.entry_id=$1
          `,
              [row.entry_id],
            );
            const record = source.rows[0];
            assert(
              row.category_source === record.category_source &&
                row.eligibility_basis === record.eligibility_basis,
              "Exact source text must survive joins",
            );
            assert(
              JSON.stringify(row.metrics_json) ===
                JSON.stringify(record.metrics_json),
              "JSON metrics must be parsed and preserved",
            );
            assert(
              JSON.stringify(row.operators) ===
                JSON.stringify(record.operators),
              "Operator spellings and order must be preserved",
            );
            assert(
              row.match_type ===
                (record.station_callsign === call ? "station" : "operator"),
              "Station matches take precedence",
            );
          }
        }
        const stats = initialData(new Request("http://localhost/statistics"));
        await loadArchive(stats);
        assert(stats.state === "ready", "Statistics must be ready");
        const counts = await reader.query(
          "SELECT count(*)::text AS count FROM contest_result",
        );
        assert(
          stats.partitions.reduce((n, p) => n + Number(p.entry_count), 0) ===
            Number(counts.rows[0].count),
          "Statistics must include every result",
        );
        assert(
          stats.release?.entry_count === counts.rows[0].count,
          "Release counts must match",
        );
      });
      let rolledBack = false;
      try {
        await withReadOnlyTransaction(readerPool, async (reader) => {
          await reader.query("SELECT 1 / 0");
        });
      } catch {
        rolledBack = true;
      }
      assert(rolledBack, "Failed reads must propagate their error");
      await withReadOnlyTransaction(readerPool, async (reader) => {
        await reader.query("SELECT 1");
      });
    } finally {
      await readerPool.end();
    }
  },
});
