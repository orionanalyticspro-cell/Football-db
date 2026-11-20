// Source OpenFootball (CC0) : dépôts et fichiers de ligues vérifiés.
// Ne configurer que les chemins publiés et dont le format est pris en charge.
import { getText } from "../http.js";
import { localToUtcIso } from "../normalize.js";
import type { MatchInput } from "../db.js";

export const SOURCE_OPENFOOTBALL = "openfootball";

export interface OpenFootballLeague {
  slug: string;
  code: string;
  name: string;
  country: string;
  level: number;
  repo: string;
  branch?: string;
  /** Saison-directory for direct files, country directory for {season}/{year} templates. */
  seasonDir: string;
  files: string[];
  seasonMode: "split" | "calendar";
  timeZone?: string;
  /** For annual datasets that publish late, retry this many prior calendar-year files. */
  yearFallback?: number;
  enabled?: boolean;
}

export const OPENFOOTBALL_LEAGUES: OpenFootballLeague[] = [
  { slug: "eng.1", code: "ENGLAND-1", name: "Premier League", country: "England", level: 1,
    repo: "openfootball/england", seasonDir: "", files: ["{season}/1-premierleague.txt"], seasonMode: "split", timeZone: "Europe/London", enabled: true },
  { slug: "eng.2", code: "ENGLAND-2", name: "Championship", country: "England", level: 2,
    repo: "openfootball/england", seasonDir: "", files: ["{season}/2-championship.txt"], seasonMode: "split", timeZone: "Europe/London", enabled: true },
  { slug: "esp.1", code: "SPAIN-1", name: "Primera División", country: "Spain", level: 1,
    repo: "openfootball/espana", seasonDir: "", files: ["{season}/1-liga.txt"], seasonMode: "split", timeZone: "Europe/Madrid", enabled: true },
  { slug: "ger.1", code: "GERMANY-1", name: "Bundesliga", country: "Germany", level: 1,
    repo: "openfootball/deutschland", seasonDir: "", files: ["{season}/1-bundesliga.txt"], seasonMode: "split", timeZone: "Europe/Berlin", enabled: true },
  { slug: "ita.1", code: "ITALY-1", name: "Serie A", country: "Italy", level: 1,
    repo: "openfootball/italy", seasonDir: "", files: ["{season}/1-seriea.txt"], seasonMode: "split", timeZone: "Europe/Rome", enabled: true },
  { slug: "bel.1", code: "BELGIUM-1", name: "Jupiler Pro League", country: "Belgium", level: 1,
    repo: "openfootball/belgium", seasonDir: "", files: ["{season}/be1.txt"], seasonMode: "split", timeZone: "Europe/Brussels", enabled: true },
  { slug: "aut.1", code: "AUSTRIA-1", name: "Bundesliga", country: "Austria", level: 1,
    repo: "openfootball/austria", seasonDir: "", files: ["{season}/1-bundesliga.txt"], seasonMode: "split", timeZone: "Europe/Vienna", enabled: true },
  { slug: "fra.1", code: "FRANCE-1", name: "Ligue 1", country: "France", level: 1,
    repo: "openfootball/europe", seasonDir: "france", files: ["{season}_fr1.txt"], seasonMode: "split", timeZone: "Europe/Paris", enabled: true },
  { slug: "ned.1", code: "NETHERLANDS-1", name: "Eredivisie", country: "Netherlands", level: 1,
    repo: "openfootball/europe", seasonDir: "netherlands", files: ["{season}_nl1.txt"], seasonMode: "split", timeZone: "Europe/Amsterdam", enabled: true },
  { slug: "por.1", code: "PORTUGAL-1", name: "Primeira Liga", country: "Portugal", level: 1,
    repo: "openfootball/europe", seasonDir: "portugal", files: ["{season}_pt1.txt"], seasonMode: "split", timeZone: "Europe/Lisbon", enabled: true },
  { slug: "sco.1", code: "SCOTLAND-1", name: "Premiership", country: "Scotland", level: 1,
    repo: "openfootball/europe", seasonDir: "scotland", files: ["{season}_sco1.txt"], seasonMode: "split", timeZone: "Europe/London", enabled: true },
  { slug: "sui.1", code: "SWITZERLAND-1", name: "Super League", country: "Switzerland", level: 1,
    repo: "openfootball/europe", seasonDir: "switzerland", files: ["{season}_ch1.txt"], seasonMode: "split", timeZone: "Europe/Zurich", enabled: true },
  { slug: "bra.1", code: "BRAZIL-1", name: "Série A", country: "Brazil", level: 1,
    repo: "openfootball/south-america", seasonDir: "brazil", files: ["{year}_br1.txt"], seasonMode: "calendar", timeZone: "America/Sao_Paulo", enabled: true },
  { slug: "arg.1", code: "ARGENTINA-1", name: "Primera División", country: "Argentina", level: 1,
    repo: "openfootball/south-america", seasonDir: "argentina", files: ["{year}_ar1.txt"], seasonMode: "calendar", timeZone: "America/Argentina/Buenos_Aires", yearFallback: 3, enabled: true },
  { slug: "col.1", code: "COLOMBIA-1", name: "Primera A", country: "Colombia", level: 1,
    repo: "openfootball/south-america", seasonDir: "colombia", files: ["{year}_co1.txt"], seasonMode: "calendar", timeZone: "America/Bogota", yearFallback: 3, enabled: true },
  { slug: "ecu.1", code: "ECUADOR-1", name: "Serie A", country: "Ecuador", level: 1,
    repo: "openfootball/south-america", seasonDir: "ecuador", files: ["{year}_ec1.txt"], seasonMode: "calendar", timeZone: "America/Guayaquil", yearFallback: 3, enabled: true },
  { slug: "par.1", code: "PARAGUAY-1", name: "Primera División", country: "Paraguay", level: 1,
    repo: "openfootball/south-america", seasonDir: "paraguay", files: ["{year}_py1.txt"], seasonMode: "calendar", timeZone: "America/Asuncion", yearFallback: 3, enabled: true },
];

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6,
  Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

export function seasonFor(date: Date, mode: "split" | "calendar"): string {
  const y = date.getUTCFullYear();
  if (mode === "calendar") return String(y);
  return date.getUTCMonth() >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

function kickoffIso(date: Date, time: string, timeZone: string): string {
  const [h, m] = time.split(":").map(Number);
  const localDate = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return localToUtcIso(localDate, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, timeZone);
}

function toMatch(lg: OpenFootballLeague, date: Date, time: string, homeName: string, awayName: string, hg?: string, ag?: string): MatchInput {
  const kickoffUtc = kickoffIso(date, time, lg.timeZone ?? "Europe/London");
  const finished = hg !== undefined && ag !== undefined;
  return {
    competition: { code: lg.code, name: lg.name, country: lg.country, level: lg.level },
    season: seasonFor(new Date(kickoffUtc), lg.seasonMode), kickoffUtc,
    homeName: homeName.trim(), awayName: awayName.trim(),
    homeGoals: finished ? Number(hg) : null, awayGoals: finished ? Number(ag) : null,
    status: finished ? "finished" : "scheduled", source: SOURCE_OPENFOOTBALL,
  };
}

export function parseOpenFootballText(text: string, lg: OpenFootballLeague): MatchInput[] {
  const out: MatchInput[] = [];
  let year: number | null = null;
  let date: Date | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const dateLine = line.match(/^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+)?([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?$/);
    if (dateLine) {
      const month = MONTHS[dateLine[1]];
      if (dateLine[3]) year = Number(dateLine[3]);
      if (year !== null && month !== undefined) date = new Date(Date.UTC(year, month, Number(dateLine[2])));
      continue;
    }

    const vMatch = line.match(/^([0-2]?\d:[0-5]\d)\s+(.+?)\s+v\s+(.+?)(?:\s+(\d+)-(\d+)(?:\s+\(\d+-\d+\))?)?\s*$/);
    if (vMatch && date) {
      const [, time, home, away, hg, ag] = vMatch;
      out.push(toMatch(lg, date, time, home, away, hg, ag));
      continue;
    }

    // OpenFootball Europe files can place the score before the v marker.
    const scoreMatch = line.match(/^([0-2]?\d:[0-5]\d)\s+(.+?)\s+(\d+)-(\d+)(?:\s+\(\d+-\d+\))?\s+v\s+(.+?)\s*$/);
    if (scoreMatch && date) {
      const [, time, home, hg, ag, away] = scoreMatch;
      out.push(toMatch(lg, date, time, home, away, hg, ag));
    }
  }
  return out;
}

export async function fetchOpenFootball(lg: OpenFootballLeague, date = new Date()): Promise<MatchInput[]> {
  const branch = lg.branch ?? "master";
  const splitSeason = openFootballSeasonDir(date, "split");
  const currentYear = date.getUTCFullYear();
  const out: MatchInput[] = [];
  for (const template of lg.files) {
    let lastError: unknown;
    const attempts = template.includes("{year}") ? (lg.yearFallback ?? 0) + 1 : 1;
    let fetched = false;
    for (let offset = 0; offset < attempts; offset++) {
      const year = String(currentYear - offset);
      const season = lg.seasonMode === "calendar" ? year : splitSeason;
      const filename = template.replaceAll("{year}", year).replaceAll("{season}", season);
      const directory = template.includes("{season}") || template.includes("{year}") ? lg.seasonDir : splitSeason;
      const path = [directory, filename].filter(Boolean).join("/");
      const url = `https://raw.githubusercontent.com/${lg.repo}/${branch}/${path}`;
      try {
        out.push(...parseOpenFootballText(await getText(url), lg));
        fetched = true;
        break;
      } catch (e) {
        lastError = e;
        if (!(e as { fatal?: boolean }).fatal) throw e;
      }
    }
    if (!fetched) throw lastError ?? new Error(`No OpenFootball file found for ${lg.slug}`);
  }
  return out;
}

export function openFootballSeasonDir(date = new Date(), mode: "split" | "calendar" = "split"): string {
  if (mode === "calendar") return String(date.getUTCFullYear());
  const start = date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  const yy = (n: number) => String(n).slice(-2);
  return `${yy(start)}-${yy(start + 1)}`;
}

export function leaguesForCurrentSeason(_date = new Date()): OpenFootballLeague[] {
  return OPENFOOTBALL_LEAGUES.map((lg) => ({ ...lg }));
}
