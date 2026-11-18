// Source gratuite : football-data.co.uk (CSV).
//  - « Main leagues » : https://www.football-data.co.uk/mmz4281/<saison>/<DIV>.csv  (ex. 2627/E2.csv)
//  - « Extra leagues » : https://football-data.co.uk/new/<PAYS>.csv  et  /new/Latest_Results.csv
// Les heures sont en heure du Royaume-Uni (Europe/London) -> converties en UTC.
import { parse } from "csv-parse/sync";
import type { MatchInput } from "../db.js";
import { getText } from "../http.js";
import { localToUtcIso, normalizeName, parseDmy, slug, toInt, toNum } from "../normalize.js";

export const SOURCE_MAIN = "fd-main";
export const SOURCE_EXTRA = "fd-extra";

export interface MainDivision { div: string; country: string; name: string; level: number }

export const MAIN_DIVISIONS: MainDivision[] = [
  { div: "E0", country: "England", name: "Premier League", level: 1 },
  { div: "E1", country: "England", name: "Championship", level: 2 },
  { div: "E2", country: "England", name: "League One", level: 3 },
  { div: "E3", country: "England", name: "League Two", level: 4 },
  { div: "EC", country: "England", name: "National League", level: 5 },
  { div: "SC0", country: "Scotland", name: "Premiership", level: 1 },
  { div: "SC1", country: "Scotland", name: "Championship", level: 2 },
  { div: "SC2", country: "Scotland", name: "League One", level: 3 },
  { div: "SC3", country: "Scotland", name: "League Two", level: 4 },
  { div: "D1", country: "Germany", name: "Bundesliga", level: 1 },
  { div: "D2", country: "Germany", name: "2. Bundesliga", level: 2 },
  { div: "I1", country: "Italy", name: "Serie A", level: 1 },
  { div: "I2", country: "Italy", name: "Serie B", level: 2 },
  { div: "SP1", country: "Spain", name: "La Liga", level: 1 },
  { div: "SP2", country: "Spain", name: "Segunda División", level: 2 },
  { div: "F1", country: "France", name: "Ligue 1", level: 1 },
  { div: "F2", country: "France", name: "Ligue 2", level: 2 },
  { div: "N1", country: "Netherlands", name: "Eredivisie", level: 1 },
  { div: "B1", country: "Belgium", name: "Pro League", level: 1 },
  { div: "P1", country: "Portugal", name: "Primeira Liga", level: 1 },
  { div: "T1", country: "Turkey", name: "Süper Lig", level: 1 },
  { div: "G1", country: "Greece", name: "Super League", level: 1 },
];

// Codes des fichiers « extra » : /new/<CODE>.csv
export const EXTRA_FILES = [
  "ARG", "AUT", "BRA", "CHN", "DNK", "FIN", "IRL", "JPN",
  "MEX", "NOR", "POL", "ROU", "RUS", "SWE", "SWZ", "USA",
];

/** Code saison de football-data pour une date : juillet 2026 -> "2627" */
export function seasonCodeFor(d = new Date()): string {
  const y = d.getUTCFullYear();
  const start = d.getUTCMonth() >= 6 ? y : y - 1; // saison démarre en juillet
  const yy = (n: number) => String(n % 100).padStart(2, "0");
  return `${yy(start)}${yy(start + 1)}`;
}
/** "2627" -> "2026/2027" (même format pour toutes les sources européennes) */
export function seasonLabel(code: string): string {
  return `20${code.slice(0, 2)}/20${code.slice(2)}`;
}

const ODDS_TRIPLES: [string, string, string, string][] = [
  ["PS", "PSH", "PSD", "PSA"],
  ["PS", "PH", "PD", "PA"],
  ["PSC", "PSCH", "PSCD", "PSCA"],
  ["B365", "B365H", "B365D", "B365A"],
  ["MAX", "MaxH", "MaxD", "MaxA"],
  ["AVG", "AvgH", "AvgD", "AvgA"],
];
const STAT_COLS: Record<string, string> = {
  home_shots: "HS", away_shots: "AS", home_shots_on_target: "HST", away_shots_on_target: "AST",
  home_corners: "HC", away_corners: "AC", home_fouls: "HF", away_fouls: "AF",
  home_yellow: "HY", away_yellow: "AY", home_red: "HR", away_red: "AR",
};

type Row = Record<string, string>;

function readCsv(text: string): Row[] {
  return parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true, trim: true });
}

function buildMatch(
  r: Row, comp: MatchInput["competition"], season: string, source: string,
  home: string, away: string, hg: string, ag: string, hth?: string, hta?: string,
): MatchInput | null {
  const date = parseDmy(r.Date ?? "");
  if (!date || !home || !away) return null;
  const hgN = toInt(hg), agN = toInt(ag);
  const finished = hgN !== null && agN !== null;
  const stats: NonNullable<MatchInput["stats"]> = {};
  for (const [k, col] of Object.entries(STAT_COLS)) {
    const v = toInt(r[col]);
    if (v !== null) (stats as Record<string, number | null>)[k] = v;
  }
  const odds = ODDS_TRIPLES
    .map(([book, h, d, a]) => ({ book, home: toNum(r[h]), draw: toNum(r[d]), away: toNum(r[a]) }))
    .filter((o) => o.home !== null && o.draw !== null && o.away !== null);
  // Si plusieurs colonnes donnent le même bookmaker (PS), on garde la 1re.
  const seen = new Set<string>();
  const oddsDedup = odds.filter((o) => (seen.has(o.book) ? false : (seen.add(o.book), true)));

  return {
    competition: comp, season,
    kickoffUtc: localToUtcIso(date, r.Time || "12:00", "Europe/London"),
    homeName: home, awayName: away,
    homeGoals: hgN, awayGoals: agN,
    htHome: toInt(hth), htAway: toInt(hta),
    status: finished ? "finished" : "scheduled",
    source, stats, odds: oddsDedup,
  };
}

export function parseMainCsv(text: string, div: MainDivision, seasonCode: string): MatchInput[] {
  const comp = { code: `${slug(div.country)}-${div.level}`.toUpperCase(), name: div.name, country: div.country, level: div.level };
  const out: MatchInput[] = [];
  for (const r of readCsv(text)) {
    const m = buildMatch(r, comp, seasonLabel(seasonCode), SOURCE_MAIN, r.HomeTeam, r.AwayTeam, r.FTHG, r.FTAG, r.HTHG, r.HTAG);
    if (m) out.push(m);
  }
  return out;
}

export function parseExtraCsv(text: string): MatchInput[] {
  const out: MatchInput[] = [];
  for (const r of readCsv(text)) {
    if (!r.Country || !r.League) continue;
    const comp = {
      // Même convention que les autres sources : <PAYS>-<niveau>. Les fichiers « extra » ne contiennent que la D1.
      code: `${slug(r.Country)}-1`.toUpperCase(),
      name: r.League, country: r.Country, level: 1,
    };
    const m = buildMatch(r, comp, r.Season || "unknown", SOURCE_EXTRA, r.Home, r.Away, r.HG, r.AG);
    if (m) out.push(m);
  }
  return out;
}

const BASE_MAIN = "https://www.football-data.co.uk/mmz4281";
const BASE_EXTRA = "https://football-data.co.uk/new";

export async function fetchMain(div: MainDivision, seasonCode: string): Promise<MatchInput[]> {
  const text = await getText(`${BASE_MAIN}/${seasonCode}/${div.div}.csv`);
  return parseMainCsv(text, div, seasonCode);
}
export async function fetchExtraLatest(): Promise<MatchInput[]> {
  return parseExtraCsv(await getText(`${BASE_EXTRA}/Latest_Results.csv`));
}
export async function fetchExtraFile(code: string): Promise<MatchInput[]> {
  return parseExtraCsv(await getText(`${BASE_EXTRA}/${code}.csv`));
}
export { normalizeName };
