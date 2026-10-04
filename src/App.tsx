import { useState } from "react";
import {
  AppBar,
  Box,
  Button,
  createTheme,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ThemeProvider,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  contests,
  modes,
  type PageData,
  rankFields,
  type Result,
} from "./types.ts";
import { type MessageKey, translator } from "./locales.ts";

const theme = createTheme({
  palette: {
    primary: { main: "#1565c0" },
    background: { default: "#fff", paper: "#fff" },
  },
  typography: {
    fontFamily: 'Roboto, "Noto Sans SC", "Segoe UI", Arial, sans-serif',
    fontSize: 13,
    h6: { fontSize: "1.15rem", fontWeight: 500 },
    button: { textTransform: "none" },
  },
  shape: { borderRadius: 3 },
  components: {
    MuiButton: { defaultProps: { size: "small", disableElevation: true } },
    MuiTextField: { defaultProps: { size: "small", variant: "outlined" } },
    MuiTable: { defaultProps: { size: "small" } },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: "6px 10px",
          fontSize: "0.78rem",
          borderColor: "#e0e0e0",
        },
        head: {
          fontWeight: 600,
          backgroundColor: "#f5f5f5",
          whiteSpace: "nowrap",
        },
      },
    },
  },
});

export function safeHttpUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function value(input: unknown): string {
  if (input === null || input === undefined || input === "") return "—";
  return typeof input === "object" ? JSON.stringify(input) : String(input);
}

function pageLink(
  data: PageData,
  updates: Record<string, string>,
  path = data.path,
) {
  const params = new URLSearchParams(path === data.path ? data.query : "");
  params.set("lang", data.locale);
  for (const [key, val] of Object.entries(updates)) {
    val ? params.set(key, val) : params.delete(key);
  }
  return `${path}?${params}`;
}

export function App({ data }: { data: PageData }) {
  const t = translator(data.locale);
  const [selected, setSelected] = useState<Result | null>(null);
  const number = (n: string | number) =>
    new Intl.NumberFormat(data.locale).format(BigInt(n));
  const date = (s: string) =>
    new Intl.DateTimeFormat(data.locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hourCycle: "h23",
    }).format(new Date(s));
  const name = (key: string) => t(key as MessageKey) ?? key;
  const sourceLink = (url: string) =>
    safeHttpUrl(url)
      ? (
        <Link href={safeHttpUrl(url)} target="_blank" rel="noopener noreferrer">
          {t("source")}
        </Link>
      )
      : "—";
  const dxccLabels: Record<Result["dxcc_resolution"], MessageKey> = {
    source: "dxccSource",
    callsign: "dxccCallsign",
    unresolved: "dxccUnresolved",
    ambiguous_year: "dxccAmbiguousYear",
    ambiguous_prefix: "dxccAmbiguousPrefix",
    no_entity: "dxccNoEntity",
  };
  const fields: [MessageKey, keyof Result][] = [
    ["originalCallsign", "station_callsign_source"],
    ["category", "category_source"],
    ["location", "location_code_source"],
    ["entitySource", "dxcc_entity_source"],
    ["entityInferred", "dxcc_entity_inferred"],
    ["dxccAdif", "dxcc_adif"],
    ["overlay", "overlay_category_source"],
    ["basis", "eligibility_basis"],
    ["zones", "cq_zones"],
    ["countries", "cq_countries"],
    ["prefixes", "wpx_prefixes"],
    ["multipliers", "multipliers"],
    ["hours", "operating_hours_source"],
  ];
  const status = (
    <div className={`archive-status state-${data.state}`} role="status">
      <span className="status-dot" aria-hidden="true" />
      <span>{t(data.state)}</span>
      {data.release && (
        <span className="status-meta">
          {number(data.release.entry_count)} {t("records")} · {t("built")}:{" "}
          {date(data.release.built_at_utc)}
        </span>
      )}
    </div>
  );
  const mainColumns: MessageKey[] = [
    "station",
    "contest",
    "year",
    "mode",
    "match",
    "category",
    "entity",
    "overlay",
    "score",
    "qsos",
  ];
  const message = data.error
    ? t(data.error as MessageKey)
    : data.state !== "ready"
    ? t("unavailableHelp")
    : !data.callsign
    ? t("idle")
    : t("noResults");

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar
        position="static"
        elevation={0}
        color="default"
        className="topbar"
      >
        <Toolbar variant="dense" className="nav-toolbar">
          <Link
            className="brand"
            href={pageLink(data, {}, "/")}
            color="inherit"
            underline="none"
          >
            {t("brandName")}
          </Link>
          <Box
            component="nav"
            aria-label={t("navigation")}
            className="nav-links"
          >
            {([["main", "/"], ["statistics", "/statistics"], [
              "about",
              "/about",
            ]] as const).map(([page, path]) => (
              <Button
                key={page}
                href={pageLink(data, {}, path)}
                color={data.page === page ||
                    (data.page === "callsign" && page === "main")
                  ? "primary"
                  : "inherit"}
                aria-current={data.page === page ||
                    (data.page === "callsign" && page === "main")
                  ? "page"
                  : undefined}
                className={data.page === page ||
                    (data.page === "callsign" && page === "main")
                  ? "active-nav"
                  : ""}
              >
                {t(page)}
              </Button>
            ))}
          </Box>
          <Box className="locale-links" role="group" aria-label={t("language")}>
            <Button
              href={pageLink(data, { lang: "en" })}
              aria-label={t("english")}
              aria-current={data.locale === "en" ? "true" : undefined}
            >
              {t("englishShort")}
            </Button>
            <Button
              href={pageLink(data, { lang: "zh-CN" })}
              aria-label={t("chinese")}
              aria-current={data.locale === "zh-CN" ? "true" : undefined}
            >
              {t("chinese")}
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      <Box component="main" className="page-content">
        {(data.page === "main" || data.page === "callsign") && (
          <>
            <Typography component="h1" variant="h6" className="page-title">
              {t(data.page === "main" ? "main" : "results")}
              {data.page === "callsign" && (
                <>
                  · <span className="mono">{data.callsign}</span>
                </>
              )}
            </Typography>
            <Box
              component="form"
              action="/lookup"
              method="get"
              className="compact-form"
            >
              <input type="hidden" name="lang" value={data.locale} />
              <TextField
                name="callsign"
                label={t("callsign")}
                placeholder={t("placeholder")}
                defaultValue={data.callsign}
                error={data.error === "invalidCallsign"}
                required
                className="callsign-input"
                slotProps={{
                  htmlInput: {
                    maxLength: 17,
                    autoCapitalize: "characters",
                    autoComplete: "off",
                    spellCheck: false,
                    "aria-describedby": "lookup-hint",
                  },
                }}
              />
              <Button type="submit" variant="contained">{t("search")}</Button>
              {data.callsign && (
                <Button
                  href={pageLink(data, {}, "/").split("?")[0] +
                    `?lang=${data.locale}`}
                >
                  {t("clear")}
                </Button>
              )}
              <Typography
                id="lookup-hint"
                variant="body2"
                color="text.secondary"
              >
                {t("hint")}
              </Typography>
            </Box>
            {status}
            {data.page === "main" && (
              <Typography
                variant="body2"
                color={data.error ? "error" : "text.secondary"}
                role={data.error ? "alert" : undefined}
              >
                {data.error ? t(data.error as MessageKey) : t("description")}
              </Typography>
            )}
          </>
        )}
        {data.page === "callsign" && (
          <>
            <div className="table-toolbar">
              <Typography component="h2" variant="subtitle2">
                {t("results")}
                {data.callsign && (
                  <>
                    · <span className="mono">{data.callsign}</span>
                  </>
                )}
              </Typography>
              <span>{data.rows.length} {t("rows")}</span>
            </div>
            <TableContainer
              className="data-table results-table"
              tabIndex={0}
              aria-label={t("tableScroll")}
            >
              <Table stickyHeader aria-label={t("results")}>
                <TableHead>
                  <TableRow>
                    {mainColumns.map((key) => (
                      <TableCell
                        key={key}
                        rowSpan={2}
                        align={["year", "score", "qsos"].includes(key)
                          ? "right"
                          : "left"}
                      >
                        {t(key)}
                      </TableCell>
                    ))}
                    {([
                      "categoryWorld",
                      "categoryEntity",
                      "overlayWorld",
                      "overlayEntity",
                    ] as const).map((key) => (
                      <TableCell
                        key={key}
                        colSpan={2}
                        align="center"
                        className="rank-group"
                      >
                        {t(key)}
                      </TableCell>
                    ))}
                    <TableCell rowSpan={2}>{t("source")}</TableCell>
                    <TableCell rowSpan={2}>{t("details")}</TableCell>
                  </TableRow>
                  <TableRow>
                    {rankFields.map((key, index) => (
                      <TableCell
                        key={key}
                        align="right"
                        className="rank-subheading"
                      >
                        {t(index % 2 ? "calculated" : "official")}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.entry_id} hover>
                      <TableCell className="mono station-cell">
                        {row.station_callsign}
                      </TableCell>
                      <TableCell className="nowrap">
                        {name(row.contest_id)}
                      </TableCell>
                      <TableCell align="right">{row.edition_year}</TableCell>
                      <TableCell>{name(row.mode)}</TableCell>
                      <TableCell>
                        {t(
                          row.match_type === "station"
                            ? "stationMatch"
                            : "operatorMatch",
                        )}
                      </TableCell>
                      <TableCell className="category-cell">
                        {row.category_source}
                      </TableCell>
                      <TableCell>
                        {value(
                          row.dxcc_entity_source ?? row.dxcc_entity_inferred,
                        )}
                        {row.dxcc_resolution === "callsign" && (
                          <Typography
                            component="span"
                            variant="caption"
                            display="block"
                          >
                            {t("dxccCallsign")}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {value(row.overlay_category_source)}
                      </TableCell>
                      <TableCell align="right" className="mono nowrap">
                        {value(row.score_source ?? row.score)}
                      </TableCell>
                      <TableCell align="right" className="mono">
                        {value(row.qso_count)}
                      </TableCell>
                      {rankFields.map((key, index) => (
                        <TableCell
                          key={key}
                          align="right"
                          className={`mono ${
                            index % 2 ? "calculated-cell" : ""
                          }`}
                        >
                          {value(row[key])}
                        </TableCell>
                      ))}
                      <TableCell>{sourceLink(row.source_url)}</TableCell>
                      <TableCell>
                        <Button
                          onClick={() => setSelected(row)}
                          aria-label={`${
                            t("details")
                          } ${row.station_callsign} ${row.edition_year} ${
                            name(row.contest_id)
                          }`}
                        >
                          {t("details")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!data.rows.length && (
                    <TableRow>
                      <TableCell
                        colSpan={20}
                        className="table-message"
                        role={data.error ? "alert" : undefined}
                      >
                        {message}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography
              variant="caption"
              color="text.secondary"
              className="rank-note"
            >
              {t("rankNote")}
            </Typography>
            {(data.hasMore || data.offset > 0) && (
              <Box
                component="nav"
                className="pagination"
                aria-label={t("page")}
              >
                <Button
                  disabled={!data.offset}
                  href={data.offset
                    ? pageLink(data, {
                      offset: String(Math.max(0, data.offset - data.pageSize)),
                    })
                    : undefined}
                >
                  {t("previous")}
                </Button>
                <span>
                  {t("page")} {Math.floor(data.offset / data.pageSize) + 1}
                </span>
                <Button
                  disabled={!data.hasMore ||
                    data.offset + data.pageSize > 100000}
                  href={data.hasMore
                    ? pageLink(data, {
                      offset: String(data.offset + data.pageSize),
                    })
                    : undefined}
                >
                  {t("next")}
                </Button>
              </Box>
            )}
          </>
        )}
        {data.page === "statistics" && (
          <>
            <Typography component="h1" variant="h6" className="page-title">
              {t("coverage")}
            </Typography>
            {status}
            {data.release && (
              <div className="metadata-strip">
                <span>
                  {t("partitions")}:{" "}
                  <strong>{data.release.partition_count}</strong>
                </span>
                <span>
                  {t("contests")}: <strong>{data.contestCount}</strong>
                </span>
                <span>
                  {t("memberships")}:{" "}
                  <strong>
                    {number(data.release.operator_membership_count)}
                  </strong>
                </span>
                <span>
                  {t("latest")}:{" "}
                  <strong>{date(data.release.latest_retrieved_at_utc)}</strong>
                </span>
              </div>
            )}
            <Box
              component="form"
              method="get"
              action="/statistics"
              className="compact-form statistics-form"
            >
              <input type="hidden" name="lang" value={data.locale} />
              {([
                ["contest", contests],
                ["year", data.yearOptions.map(String)],
                ["mode", modes],
              ] as const).map(([field, options]) => (
                <TextField
                  key={field}
                  select
                  name={field}
                  label={t(field)}
                  defaultValue={data.filters[field]}
                  slotProps={{
                    select: { native: true },
                    inputLabel: { shrink: true },
                  }}
                >
                  <option value="">{t("all")}</option>
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {field === "year" ? option : name(option)}
                    </option>
                  ))}
                </TextField>
              ))}
              <Button type="submit" variant="contained">{t("filter")}</Button>
              <Button href={`/statistics?lang=${data.locale}`}>
                {t("reset")}
              </Button>
            </Box>
            <div className="table-toolbar">
              <Typography variant="body2" color="text.secondary">
                {t("coverageHelp")}
              </Typography>
              <span>{t("shown")}: {data.partitions.length}</span>
            </div>
            <TableContainer
              className="data-table statistics-table"
              tabIndex={0}
              aria-label={t("coverage")}
            >
              <Table stickyHeader aria-label={t("coverage")}>
                <TableHead>
                  <TableRow>
                    {([
                      "contest",
                      "year",
                      "mode",
                      "records",
                      "eligibleRecords",
                      "officialRecords",
                      "retrieved",
                      "source",
                    ] as const).map((key) => (
                      <TableCell
                        key={key}
                        align={[
                            "year",
                            "records",
                            "eligibleRecords",
                            "officialRecords",
                          ].includes(key)
                          ? "right"
                          : "left"}
                      >
                        {t(key)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.partitions.map((p) => (
                    <TableRow
                      key={`${p.contest_id}/${p.edition_year}/${p.mode}`}
                      hover
                    >
                      <TableCell>{name(p.contest_id)}</TableCell>
                      <TableCell align="right">{p.edition_year}</TableCell>
                      <TableCell>{name(p.mode)}</TableCell>
                      <TableCell align="right" className="mono">
                        {number(p.entry_count)}
                      </TableCell>
                      <TableCell align="right" className="mono">
                        {number(p.eligible_count)}
                      </TableCell>
                      <TableCell align="right" className="mono">
                        {number(p.official_rank_count)}
                      </TableCell>
                      <TableCell className="nowrap">
                        {date(p.retrieved_at_utc)}
                      </TableCell>
                      <TableCell>{sourceLink(p.source_url)}</TableCell>
                    </TableRow>
                  ))}
                  {!data.partitions.length && (
                    <TableRow>
                      <TableCell colSpan={8} className="table-message">
                        {data.error
                          ? t("invalidQuery")
                          : data.state === "ready"
                          ? t("noPartitions")
                          : t("unavailableHelp")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
        {data.page === "about" && (
          <Box className="about-content">
            <Typography component="h1" variant="h6" className="page-title">
              {t("project")}
            </Typography>
            <Typography paragraph variant="body2">
              {t("projectBody")}
            </Typography>
            {([["dataHeading", "dataBody"], ["rankingHeading", "rankingBody"], [
              "rightsHeading",
              "rightsBody",
            ]] as const).map(([heading, body]) => (
              <section key={heading}>
                <Typography component="h2" variant="subtitle1">
                  {t(heading)}
                </Typography>
                <Typography paragraph variant="body2">{t(body)}</Typography>
              </section>
            ))}
            <Typography component="h2" variant="subtitle1">
              {t("release")}
            </Typography>
            {status}
            {data.release && (
              <TableContainer className="data-table">
                <Table aria-label={t("release")}>
                  <TableBody>
                    {([
                      ["digest", data.release.release_id],
                      ["built", date(data.release.built_at_utc)],
                      ["latest", date(data.release.latest_retrieved_at_utc)],
                      ["records", number(data.release.entry_count)],
                      ["partitions", data.release.partition_count],
                      ["license", data.release.dataset_license],
                      ["attribution", data.release.attribution],
                    ] as const).map(([label, val]) => (
                      <TableRow key={label}>
                        <TableCell component="th" scope="row">
                          {t(label)}
                        </TableCell>
                        <TableCell className="breakable">{val}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
        {data.page === "notFound" && (
          <>
            <Typography component="h1" variant="h6">{t("notFound")}</Typography>
            <Typography>{t("missingPage")}</Typography>
            <Button href={`/?lang=${data.locale}`}>{t("main")}</Button>
          </>
        )}
      </Box>
      <Box component="footer" className="site-footer">
        <Divider />
        <Typography variant="caption" color="text.secondary">
          {t("footer")} · {t("appLicense")} · {t("dataLicense")}
        </Typography>
      </Box>
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        fullWidth
        maxWidth="md"
        aria-labelledby="entry-dialog-title"
      >
        <DialogTitle id="entry-dialog-title">
          {t("detailsTitle")}
          {selected &&
            ` · ${selected.station_callsign} · ${selected.edition_year} ${
              name(selected.contest_id)
            }`}
        </DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Table size="small" aria-label={t("detailsTitle")}>
              <TableBody>
                {fields.map(([label, key]) => (
                  <TableRow key={key}>
                    <TableCell component="th" scope="row">{t(label)}</TableCell>
                    <TableCell className="breakable">
                      {value(selected[key])}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell component="th" scope="row">
                    {t("dxccBasis")}
                  </TableCell>
                  <TableCell>
                    {t(dxccLabels[selected.dxcc_resolution])}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    {t("eligibility")}
                  </TableCell>
                  <TableCell>{name(selected.award_eligibility)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    {t("lateEntry")}
                  </TableCell>
                  <TableCell>{t(selected.late_entry ? "yes" : "no")}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    {t("operators")}
                  </TableCell>
                  <TableCell className="breakable mono">
                    {value(selected.operators.join(", "))}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    {t("operatorsComplete")}
                  </TableCell>
                  <TableCell>
                    {t(selected.operator_list_complete ? "yes" : "no")}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    {t("sourceRetrieved")}
                  </TableCell>
                  <TableCell>{date(selected.retrieved_at_utc)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    {t("officialSource")}
                  </TableCell>
                  <TableCell>{sourceLink(selected.source_url)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    {t("metrics")}
                  </TableCell>
                  <TableCell className="breakable mono">
                    {value(selected.metrics_json)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>{t("close")}</Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
