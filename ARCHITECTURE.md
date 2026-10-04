# TESTAG Web Architecture

## Runtime and boundary

Deno serves a multi-page React application with Material UI 7 and Emotion. The
independent structured-data repository owns the archive, canonical PostgreSQL
schema, validation, and database build. The web app reads published data only.

`main.ts` starts `Deno.serve`. `src/server.tsx` routes requests, validates
inputs, renders HTML, and serves an asset allowlist. `src/db.ts` owns
parameterized SELECT queries. `src/App.tsx` contains Material UI pages;
`src/locales.ts` contains the English and Chinese catalogs with identical typed
keys. `src/client.tsx` hydrates the server-rendered document.

`build.ts` bundles the browser entry into `dist/client.js` with esbuild.
`dev.ts` watches this bundle and starts the server with file watching.
Development permits local Unix sockets; production reads public assets and uses
network PostgreSQL. Both server and client use production React rendering to
keep hydration aligned.

## Routes and navigation

| Route                  | Behavior                                                            |
| ---------------------- | ------------------------------------------------------------------- |
| `GET /`                | Main Page with compact callsign search.                             |
| `GET /lookup`          | Validates callsign, then returns a 303 redirect to its result page. |
| `GET /stats/:callsign` | Dense results table with all eight rank fields.                     |
| `GET /statistics`      | Filterable partition metadata table.                                |
| `GET /about`           | Project, provenance, rankings, licenses, and release metadata.      |
| `GET /api/status`      | `{state, dataset}`.                                                 |
| `GET /api/search`      | `{state, callsign, offset, limit, rows, hasMore}`.                  |
| `GET /api/statistics`  | `{state, dataset, partitions}`.                                     |

HEAD has the same status and headers without a body. Other methods return 405;
unknown routes return 404. API validation errors return 400 with an `error`
code; unavailable search/statistics data returns 503. `/api/status` returns 200
with an explicit archive state. HTML pages remain readable when data is
unavailable.

Navigation uses ordinary links and full document requests, without a client
router. Search, statistics filters, and pagination work without JavaScript. The
entry-details dialog needs hydration. Language links retain the callsign path,
pagination, and filters.

Callsigns contain 3–17 ASCII letters/numbers with up to two slash-separated
segments, each at most seven characters. Callsigns are trimmed and uppercased.
Portable callsigns are encoded in the URL. Lowercase or unencoded paths redirect
to the canonical URL. `/?callsign=...` also redirects to the separate result
page. Offset is a multiple of 50 between 0 and 100,000. Statistics accepts the
archive's seven contest IDs, modes `cw`, `ssb`, and `mixed`, and years
1900–2200. Query strings are capped at 2 KiB.

## Current PostgreSQL contract

The app reads `structured-data/db/schema.sql`:

- `contest_result`: source/normalized station callsigns, score literal/numeric
  value, source category, explicit entity/overlay labels, eligibility, metrics,
  operator-list completeness, and eight paired rank fields.
- `contest_result_operator`: operator membership and source callsign spellings.
- `contest_result_partition`: contest/year/mode key, source URL, retrieval time;
  builder-owned nullable `archive_digest` and `builder_version` columns are
  ignored by web queries.
- `testag_dataset_release`: digest, build time, latest retrieval, license,
  attribution, and partition/result/operator-membership counts.

Release freshness uses `built_at_utc`, replacing the former `generated_at_utc`
field. The app does not use the removed `contest_result_official_rank` table or
former `computed_world_rank` field. An absent release row indicates an
incomplete or unpublished load; results are not queried until a release exists.

Structured-data incremental updates publish partition changes and the current
release metadata in one transaction. Failed updates retain the previous dataset;
unchanged updates retain its build timestamp. Incremental publication keeps only
the current release row. Existing web queries and digest-based cache invalidation
continue to work. Separate queries within a request can span an update commit;
requests do not guarantee one dataset snapshot. The first upgrade that adds
tracking columns to an older database may temporarily block reads. The web app
never performs this upgrade or invokes the builder.

Search unions station and operator indexes, deduplicates entries, and prefers
the station label when both match. It joins partition metadata for each source
link. Results sort by year descending, then contest, mode, source category, and
entry ID. A 51st fetched row determines whether another 50-row page exists. The
UI does not claim a total callsign result count.

The table preserves source score text when present and otherwise uses the stored
numeric score. Source categories and all eight ranks are displayed as stored.
Official/calculated values appear in separate columns for category worldwide,
category within DXCC/entity, explicit overlay worldwide, and explicit overlay
within DXCC/entity. Nulls display as a dash, explained as unavailable or
inapplicable. The browser does not calculate ranks, infer entities, or repair
records. Details include source callsigns, eligibility, operator completeness,
raw metrics, and provenance.

Statistics groups entries by partition and reports entry counts, eligible-entry
counts, and counts of entries containing any official rank. Aggregate rows are
cached per process for 60 seconds, invalidated when the release digest changes.
Filters apply to those rows. Release totals describe the entire dataset; the
shown-row count describes the filtered table.

## Localization and layout

English and Simplified Chinese are required. Precedence: explicit `lang` query,
saved `testag-lang` cookie, then browser language. The cookie is HttpOnly,
SameSite=Lax, and Secure on HTTPS. Dates display in UTC, counts use locale
formatting, and all component copy lives in the typed catalogs.

The UI uses a dense Material UI AppBar, TextFields, Buttons, Tables, and Dialog,
small margins, and full available width. Results use grouped sticky rank
headings, alternate row backgrounds, and table-contained horizontal scrolling.
Statistics has one row per partition. About uses compact text and a release
metadata table. Narrow screens wrap navigation/forms and retain columns through
table scrolling.

## Security and deployment

- Credentials remain in environment configuration; `.env` is ignored.
- Use a dedicated SELECT-only database role. Sessions additionally enforce
  `default_transaction_read_only=on`, a 15-second statement timeout, four pooled
  connections, and a five-second connection timeout.
- SQL binds callsign, limit, and offset. Source values render as React text.
  Links accept only HTTP/HTTPS and use `noopener noreferrer`.
- Hydration JSON escapes `<` and Unicode line separators to prevent source text
  from closing the script element.
- CSP restricts scripts and connections to the origin. Emotion style tags use
  per-response nonces. `style-src-attr` permits the inline attributes required
  by Material UI Paper/transition components; source records never supply
  styles. Framing, objects, and unnecessary device permissions are disabled.
- HTML/API responses are not cached; static assets have a five-minute cache.
- APIs, callsign pages, and Statistics allow 60 requests per remote address per
  minute per isolate. Shared edge limits remain an operational follow-up.

Deno Deploy uses build command `deno task build`, dynamic entrypoint `main.ts`,
`NODE_ENV=production`, and secret `DATABASE_URL`. `PORT` defaults to 8000.
PostgreSQL hosting, provider TLS requirements, database ownership, and
production publication remain environment decisions. No schema/data changes are
required.

## Verification and rights

README commands cover formatting, type checks, request tests, and bundling.
Browser checks cover both languages, desktop/narrow views, navigation, search
redirects, table scrolling, filters, and details. Integration checks read an
existing development archive only.

Web: GNU AGPL-3.0-or-later. Data: CC BY-NC-ND 4.0 International. Attribution:
Gong BI1XJT <BI1XJT@rad1o.cn>.
