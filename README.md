# TESTAG Web

A compact, bilingual contest-result lookup built from scratch with Deno, React,
and Material UI. Pages are server rendered and use normal document navigation.
Results appear in a dense table with all eight rank columns and official
sources.

## Local development

Use Deno 2 (verified with 2.9.7):

```sh
deno task dev
```

Open <http://localhost:8000>. Development bundles and watches the browser code,
watches the server, and optionally loads `.env`. It uses full local Deno
permissions so PostgreSQL Unix sockets also work. A database is optional for
viewing the pages; its absence is reported without sample data.

Copy `.env.example` to `.env` and configure `DATABASE_URL` for an existing
structured-data database. Use a SELECT-only role. The app also uses explicit
read-only transactions and limits statements to 15 seconds with
transaction-local settings. It omits PostgreSQL startup `options` so Prisma
pooled connections work. `PORT` defaults to 8000. Shell variables take
precedence over `.env`.

For a production-style local run with a TCP database configured in the shell:

```sh
deno task build
deno task start
```

To load a local environment file with the restricted production runtime:

```sh
NODE_ENV=production deno run --env-file=.env --allow-net --allow-read=public,dist --allow-env main.ts
```

A Unix-socket database needs additional read/write permission for its socket
directory when using this restricted command. `deno task dev` already handles
local socket permissions.

The structured-data builder supports atomic incremental updates. Tracking
columns `archive_digest` and `builder_version` on partitions are internal to the
builder; the web app continues using its existing SELECT queries. Published
release metadata changes when an update commits. Adding missing tracking columns
to a compatible compact schema can temporarily block reads. The app does not run
imports. See the structured-data README for update commands.

The compact database uses integer result relationships and lookup tables for
exact category and eligibility explanation text. Original archive IDs, official
ranks, metrics, and source details are preserved. The enriched archive adds
`dxcc_adif`, `dxcc_entity_inferred`, and `dxcc_resolution`; both in-DXCC rank
scopes use source-first, historical callsign fallback. Inferred entities are
labelled in English and Chinese; details show provenance and unresolved reasons.
**Rebuild an approved database with the updated structured-data builder before
running this web version**; the former text-key/JSONB and pre-inference compact
schemas are incompatible. Reapply SELECT grants to all six tables, including
`contest_result_category` and `contest_result_eligibility_basis`, after
rebuilding. Later archive updates can continue to use `--incremental`.

## Pages

| Route                     | Purpose                                                                          |
| ------------------------- | -------------------------------------------------------------------------------- |
| `/`                       | Main Page: callsign search and compact archive status.                           |
| `/lookup?callsign=BI1XJT` | Validates input and redirects to the callsign page.                              |
| `/stats/BI1XJT`           | Results in a large Material UI table.                                            |
| `/statistics`             | Contest/year/mode metadata, counts, source URLs, and retrieval dates.            |
| `/about`                  | Project description, ranking rules, licenses, attribution, and release metadata. |

Portable callsigns use URL encoding, for example `/stats/BY%2FBI1XJT%2FP`.
Callsign URLs are canonicalized to uppercase. Searches match station and
operator callsigns exactly; each matching entry appears once. Pages contain up
to 50 results, with `?offset=50` for the next page. Statistics accepts optional
`contest`, `year`, and `mode` query filters.

English and Simplified Chinese are available on every page. `?lang=en` or
`?lang=zh-CN` overrides a saved language cookie; otherwise the browser language
determines the first visit. Visible copy is in `src/locales.ts`. Light and dark
color schemes follow the operating system preference through Material UI CSS
variables, without client-side scheme detection.

Search, navigation, filtering, and pagination work without browser JavaScript.
The client hydrates Material UI controls and the entry-details dialog. Narrow
screens scroll tables within their container, retaining every column.

## Deno Deploy

Configure the independent web repository as a Deno Deploy app:

- App directory: repository root.
- Build command: `deno task build`.
- Dynamic entrypoint: `main.ts`.
- Runtime environment: `NODE_ENV=production` and secret `DATABASE_URL`.
- Database: network-accessible PostgreSQL prepared by structured-data, with a
  dedicated read-only role and the provider's required TLS configuration.

The build installs pinned npm dependencies through Deno and writes
`dist/client.js`. The server serves this bundle and `public/` assets without a
browser CDN dependency. Configuration follows
[Deno Deploy's build settings](https://docs.deno.com/deploy/reference/builds/).
The React/Emotion integration follows
[Material UI's server-rendering guide](https://mui.com/material-ui/guides/server-rendering/).
Production hosting, database attachment, and publication remain setup tasks.

## Verification

```sh
deno task check
deno task test
deno task build
deno fmt --check
```

For read-only query integration checks against a prepared compact database:

```sh
TESTAG_WEB_TEST_DATABASE_URL='postgresql://…' NODE_ENV=production deno test --allow-env --allow-net src/db_integration_test.ts
```

This check covers station/operator relationships, deduplication, ordering,
pagination, exact lookup text, parsed metrics, all eight rank fields, and
partition counts. It never builds or writes the database. Add read/write
permissions for the socket directory when using a PostgreSQL Unix socket.

Tests cover input validation, routing, language precedence, server-rendered
pages, escaping, API validation, and request limits without connecting to
PostgreSQL. For UI changes, check every page in both languages at desktop and
narrow widths; exercise navigation, filters, pagination, and the details dialog;
inspect browser errors. Integration checks read an existing development archive.
Never rebuild a database as a web test.

## Read-only JSON endpoints

- `GET /api/status`: archive state and current dataset release.
- `GET /api/search?callsign=BI1XJT&offset=0`: callsign result page data.
- `GET /api/statistics?contest=cqww-dx`: filtered partition metadata.

These share the HTML pages' queries. See [ARCHITECTURE.md](ARCHITECTURE.md) for
the contract and limits.

## License

Web code: GNU AGPL version 3 or later. Result data: CC BY-NC-ND 4.0
International. Attribution: Gong BI1XJT <BI1XJT@rad1o.cn>. Source organizers
retain rights to their original publications.

The database stores `award_eligibility` as the PostgreSQL enum
`testag_award_eligibility` (`eligible`, `ineligible`, `review`). Queries and the
public API retain these string labels. Rebuild databases with the older text
column before publishing the current dataset.
