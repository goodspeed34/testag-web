# Web Project Instructions: TESTAG

These instructions are self-contained for standalone clones. When this
repository is checked out inside the TESTAG workspace, also follow the shared
guidance in the workspace root's `AGENTS.md`.

## Scope

Build a straightforward public web interface where an amateur radio operator
enters a callsign and sees published contest scores and ranks. Use Deno Deploy
for the web runtime and PostgreSQL for result queries. English and Chinese are
required. Keep the interface simple and responsive.

## Boundaries

- Read published results from PostgreSQL using parameterized queries and a
  read-only database role.
- Do not scrape official contest sites from web requests or modify the compiled
  result database.
- Validate callsign input and apply reasonable request limits.
- Put all visible strings in translation resources. Keep English and Chinese
  catalogs in sync.
- Preserve the data source attribution and result freshness information supplied
  by the structured-data build.
- Keep the interface straightforward, responsive, and free of unnecessary
  animation or visual complexity.
- Keep secrets out of source control and use only environment configuration for
  database credentials.

## Changes and verification

Update this repository's `ARCHITECTURE.md` and `README.md` when its routes,
models, runtime configuration, or user flows change. Use the verification
commands documented in the README once they exist. For UI changes, verify both
locales and narrow and desktop layouts in a runnable browser preview.

The implementation uses Deno, React, Material UI, and server-rendered pages.
Follow the routes, build commands, and current PostgreSQL contract documented in
README.md and ARCHITECTURE.md. Production deployment remains an environment
setup task.
