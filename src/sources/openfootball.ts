// Source OpenFootball (CC0) : dépôts et fichiers de ligues vérifiés.
// La couverture reste déclarative : n'ajouter ici que des chemins constatés dans les dépôts source.
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
  seasonDir: string;
  files: string[];
  seasonMode: "split" | "calendar";
  enabled?: boolean;
}

// Chemins de saison 2026-27 vérifiés dans les dépôts OpenFootball.
// `seasonDir` est recalculé pour les chemins en saisons européennes; Brazil utilise une année civile.
export const OPENFOOTBALL_LEAGUES: OpenFootballLeague[] = [
  { slug: "eng.1", code: "ENGLAND-1", name: "Premier League", country: "England", level: 1,
    repo: "openfootball/england", seasonDir: "2026-27", files: ["1-premierleague.txt"], seasonMode: "split", enabled: true },
  { slug: "eng.2", code: "ENGLAND-2", name: "Championship", country: "England", level: 2,
    repo: "openfootball/england", seasonDir: "2026-27", files: ["2-championship.txt"], seasonMode: "split", enabled: true },
  { slug: "esp.1", code: "SPAIN-1", name: "Primera División", country: "Spain", level: 1,
    repo: "openfootball/espana", seasonDir: "2026-27", files: ["1-liga.txt"], seasonMode: "split", enabled: true },
  { slug: "ger.1", code: "GERMANY-1", name: "Bundesliga", country: "Germany", level: 1,
    repo: "openfootball/deutschland", seasonDir: "2026-27", files: ["1-bundesliga.txt"], seasonMode: "split", enabled: true },
  { slug: "ita.1", code: "ITALY-1", name: "Serie A", country: "Italy", level: 1,
    repo: "openfootball/italy", seasonDir: "2026-27", files: ["1-seriea.txt"], seasonMode: "split", enabled: true },
  { slug: "bel.1", code: "BELGIUM-1", name: "Jupiler Pro League", country: "Belgium", level: 1,
    repo: "openfootball/belgium", seasonDir: "2026-27", files: ["be1.txt"], seasonMode: "split", enabled: true },
  { slug: "aut.1", code: "AUSTRIA-1", name: "Bundesliga", country: "Austria", level: 1,
    repo: "openfootball/austria", seasonDir: "2026-27", files: ["1-bundesliga.txt"], seasonMode: "split", enabled: true },
  { slug: "bra.1", code: "BRAZIL-1", name: "Série A", country: "Brazil", level: 1,
    repo: "openfootball/south-america", seasonDir: "brazil", files: ["{year}_br1.txt"], seasonMode: "calendar", enabled: true },
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

function dateIso(date: Date, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const iso = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return localToUtcIso(iso, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, "Europe/London");
}

export function parseOpenFootballText(text: string, lg: OpenFootballLeague): MatchInput[] {
  const out: MatchInput[] = [];
  let year: number | null = null;
  let date: Date | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const dateLine = line.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?$/);
    if (dateLine) {
      const month = MONTHS[dateLine[1]];
      if (dateLine[3]) year = Number(dateLine[3]);
      if (year !== null && month !== undefined) date = new Date(Date.UTC(year, month, Number(dateLine[2])));
      continue;
    }

    const match = line.match(/^([0-2]?\d:[0-5]\d)\s+(.+?)\s+v\s+(.+?)(?:\s+(\d+)-(\d+)(?:\s+\(\d+-\d+\))?)?\s*$/);
    if (!match || !date) continue;
    const [, time, homeName, awayName, hg, ag] = match;
    const finished = hg !== undefined && ag !== undefined;
    const kickoffUtc = dateIso(date, time);
    out.push({
      competition: { code: lg.code, name: lg.name, country: lg.country, level: lg.level },
      season: seasonFor(new Date(kickoffUtc), lg.seasonMode),
      kickoffUtc,
      homeName: homeName.trim(), awayName: awayName.trim(),
      homeGoals: finished ? Number(hg) : null,
      awayGoals: finished ? Number(ag) : null,
      status: finished ? "finished" : "scheduled",
      source: SOURCE_OPENFOOTBALL,
    });
  }
  return out;
}

export async function fetchOpenFootball(lg: OpenFootballLeague, date = new Date()): Promise<MatchInput[]> {
  const branch = lg.branch ?? "master";
  const seasonDir = lg.slug === "bra.1" ? lg.seasonDir : openFootballSeasonDir(date, lg.seasonMode);
  const out: MatchInput[] = [];
  for (const template of lg.files) {
    const file = template.replaceAll("{year}", String(date.getUTCFullYear()));
    const url = `https://raw.githubusercontent.com/${lg.repo}/${branch}/${seasonDir}/${file}`;
    out.push(...parseOpenFootballText(await getText(url), lg));
  }
  return out;
}

export function openFootballSeasonDir(date = new Date(), mode: "split" | "calendar" = "split"): string {
  if (mode === "calendar") return String(date.getUTCFullYear());
  const start = date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  const yy = (n: number) => String(n).slice(-2);
  return `${yy(start)}-${yy(start + 1)}`;
}

export function leaguesForCurrentSeason(date = new Date()): OpenFootballLeague[] {
  return OPENFOOTBALL_LEAGUES.map((lg) => ({
    ...lg,
    seasonDir: lg.slug === "bra.1" ? lg.seasonDir : openFootballSeasonDir(date, lg.seasonMode),
    files: lg.files.map((file) => file.replaceAll("{year}", String(date.getUTCFullYear()))),
  }));
}
