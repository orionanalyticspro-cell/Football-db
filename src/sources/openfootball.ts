// Source OpenFootball (CC0) : dépôts et fichiers de ligues vérifiés.
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
  timeZone: string;
  yearFallback?: number;
  enabled?: boolean;
}

export const OPENFOOTBALL_LEAGUES: OpenFootballLeague[] = [
  { slug: "eng.1", code: "ENGLAND-1", name: "Premier League", country: "England", level: 1, repo: "openfootball/england", seasonDir: "2026-27", files: ["1-premierleague.txt"], seasonMode: "split", timeZone: "Europe/London", enabled: true },
  { slug: "eng.2", code: "ENGLAND-2", name: "Championship", country: "England", level: 2, repo: "openfootball/england", seasonDir: "2026-27", files: ["2-championship.txt"], seasonMode: "split", timeZone: "Europe/London", enabled: true },
  { slug: "esp.1", code: "SPAIN-1", name: "Primera División", country: "Spain", level: 1, repo: "openfootball/espana", seasonDir: "2026-27", files: ["1-liga.txt"], seasonMode: "split", timeZone: "Europe/Madrid", enabled: true },
  { slug: "ger.1", code: "GERMANY-1", name: "Bundesliga", country: "Germany", level: 1, repo: "openfootball/deutschland", seasonDir: "2026-27", files: ["1-bundesliga.txt"], seasonMode: "split", timeZone: "Europe/Berlin", enabled: true },
  { slug: "ita.1", code: "ITALY-1", name: "Serie A", country: "Italy", level: 1, repo: "openfootball/italy", seasonDir: "2026-27", files: ["1-seriea.txt"], seasonMode: "split", timeZone: "Europe/Rome", enabled: true },
  { slug: "bel.1", code: "BELGIUM-1", name: "Jupiler Pro League", country: "Belgium", level: 1, repo: "openfootball/belgium", seasonDir: "2026-27", files: ["be1.txt"], seasonMode: "split", timeZone: "Europe/Brussels", enabled: true },
  { slug: "aut.1", code: "AUSTRIA-1", name: "Bundesliga", country: "Austria", level: 1, repo: "openfootball/austria", seasonDir: "2026-27", files: ["1-bundesliga.txt"], seasonMode: "split", timeZone: "Europe/Vienna", enabled: true },
  { slug: "fra.1", code: "FRANCE-1", name: "Ligue 1", country: "France", level: 1, repo: "openfootball/europe", seasonDir: "france", files: ["{season}_fr1.txt"], seasonMode: "split", timeZone: "Europe/Paris", enabled: true },
  { slug: "ned.1", code: "NETHERLANDS-1", name: "Eredivisie", country: "Netherlands", level: 1, repo: "openfootball/europe", seasonDir: "netherlands", files: ["{season}_nl1.txt"], seasonMode: "split", timeZone: "Europe/Amsterdam", enabled: true },
  { slug: "por.1", code: "PORTUGAL-1", name: "Primeira Liga", country: "Portugal", level: 1, repo: "openfootball/europe", seasonDir: "portugal", files: ["{season}_pt1.txt"], seasonMode: "split", timeZone: "Europe/Lisbon", enabled: true },
  { slug: "sco.1", code: "SCOTLAND-1", name: "Premiership", country: "Scotland", level: 1, repo: "openfootball/europe", seasonDir: "scotland", files: ["{season}_sco1.txt"], seasonMode: "split", timeZone: "Europe/London", enabled: true },
  { slug: "sui.1", code: "SWITZERLAND-1", name: "Super League", country: "Switzerland", level: 1, repo: "openfootball/europe", seasonDir: "switzerland", files: ["{season}_ch1.txt"], seasonMode: "split", timeZone: "Europe/Zurich", enabled: true },
  { slug: "bra.1", code: "BRAZIL-1", name: "Série A", country: "Brazil", level: 1, repo: "openfootball/south-america", seasonDir: "brazil", files: ["{year}_br1.txt"], seasonMode: "calendar", timeZone: "America/Sao_Paulo", enabled: true },
  { slug: "arg.1", code: "ARGENTINA-1", name: "Primera División", country: "Argentina", level: 1, repo: "openfootball/south-america", seasonDir: "argentina", files: ["{year}_ar1.txt"], seasonMode: "calendar", timeZone: "America/Argentina/Buenos_Aires", yearFallback: 3, enabled: true },
  { slug: "col.1", code: "COLOMBIA-1", name: "Primera A", country: "Colombia", level: 1, repo: "openfootball/south-america", seasonDir: "colombia", files: ["{year}_co1.txt"], seasonMode: "calendar", timeZone: "America/Bogota", yearFallback: 3, enabled: true },
  { slug: "ecu.1", code: "ECUADOR-1", name: "Serie A", country: "Ecuador", level: 1, repo: "openfootball/south-america", seasonDir: "ecuador", files: ["{year}_ec1.txt"], seasonMode: "calendar", timeZone: "America/Guayaquil", yearFallback: 3, enabled: true },
  { slug: "par.1", code: "PARAGUAY-1", name: "Primera División", country: "Paraguay", level: 1, repo: "openfootball/south-america", seasonDir: "paraguay", files: ["{year}_py1.txt"], seasonMode: "calendar", timeZone: "America/Asuncion", yearFallback: 3, enabled: true },

  { slug: "ken.1", code: "KENYA-1", name: "Premier League", country: "Kenya", level: 1, repo: "openfootball/world", seasonDir: "africa/kenya", files: ["{season}_ke1.txt"], seasonMode: "split", timeZone: "Africa/Nairobi", yearFallback: 3, enabled: true },
  { slug: "sen.1", code: "SENEGAL-1", name: "Ligue 1", country: "Senegal", level: 1, repo: "openfootball/world", seasonDir: "africa/senegal", files: ["{season}_sn1.txt"], seasonMode: "split", timeZone: "Africa/Dakar", yearFallback: 3, enabled: true },
  { slug: "nga.1", code: "NIGERIA-1", name: "Nigeria Premier Football League", country: "Nigeria", level: 1, repo: "openfootball/world", seasonDir: "africa/nigeria", files: ["{season}_ng1.txt"], seasonMode: "split", timeZone: "Africa/Lagos", yearFallback: 3, enabled: true },
  { slug: "alg.1", code: "ALGERIA-1", name: "Ligue Professionnelle 1", country: "Algeria", level: 1, repo: "openfootball/world", seasonDir: "africa/algeria", files: ["{season}_dz1.txt"], seasonMode: "split", timeZone: "Africa/Algiers", yearFallback: 3, enabled: true },
  { slug: "egy.1", code: "EGYPT-1", name: "Premier League", country: "Egypt", level: 1, repo: "openfootball/world", seasonDir: "africa/egypt", files: ["{season}_eg1.txt"], seasonMode: "split", timeZone: "Africa/Cairo", yearFallback: 3, enabled: true },
  { slug: "mar.1", code: "MOROCCO-1", name: "Botola Pro", country: "Morocco", level: 1, repo: "openfootball/world", seasonDir: "africa/morocco", files: ["{season}_ma1.txt"], seasonMode: "split", timeZone: "Africa/Casablanca", yearFallback: 3, enabled: true },
  { slug: "gha.1", code: "GHANA-1", name: "Premier League", country: "Ghana", level: 1, repo: "openfootball/world", seasonDir: "africa/ghana", files: ["{season}_gh1.txt"], seasonMode: "split", timeZone: "Africa/Accra", yearFallback: 3, enabled: true },
  { slug: "rsa.1", code: "SOUTH-AFRICA-1", name: "Premier Division", country: "South Africa", level: 1, repo: "openfootball/world", seasonDir: "africa/south-africa", files: ["{season}_za1.txt"], seasonMode: "split", timeZone: "Africa/Johannesburg", yearFallback: 3, enabled: true },
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

export function openFootballSeasonDir(date = new Date(), mode: "split" | "calendar" = "split"): string {
  if (mode === "calendar") return String(date.getUTCFullYear());
  const start = date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  const yy = (n: number) => String(n).slice(-2);
  return `${yy(start)}-${yy(start + 1)}`;
}

function kickoffIso(date: Date, time: string, timeZone: string): string {
  const [h, m] = time.split(":").map(Number);
  const isoDate = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return localToUtcIso(isoDate, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, timeZone);
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

    const match = line.match(/^([0-2]?\d:[0-5]\d)\s+(.+?)\s+v\s+(.+?)(?:\s+(\d+)-(\d+)(?:\s+\(\d+-\d+\))?)?\s*$/);
    if (!match || !date) continue;
    const [, time, homeName, awayName, hg, ag] = match;
    const finished = hg !== undefined && ag !== undefined;
    const kickoffUtc = kickoffIso(date, time, lg.timeZone);
    out.push({
      competition: { code: lg.code, name: lg.name, country: lg.country, level: lg.level },
      season: seasonFor(new Date(kickoffUtc), lg.seasonMode), kickoffUtc,
      homeName: homeName.trim(), awayName: awayName.trim(),
      homeGoals: finished ? Number(hg) : null, awayGoals: finished ? Number(ag) : null,
      status: finished ? "finished" : "scheduled", source: SOURCE_OPENFOOTBALL,
    });
  }
  return out;
}

export async function fetchOpenFootball(lg: OpenFootballLeague, date = new Date()): Promise<MatchInput[]> {
  const branch = lg.branch ?? "master";
  const currentYear = date.getUTCFullYear();
  let lastError: unknown;
  const split = openFootballSeasonDir(date, "split");

  for (let offset = 0; offset <= (lg.yearFallback ?? 0); offset++) {
    const year = String(currentYear - offset);
    const season = lg.seasonMode === "calendar" ? year : (lg.yearFallback && offset ? openFootballSeasonDir(new Date(Date.UTC(currentYear - offset, 6, 1)), "split") : split);
    for (const fileTemplate of lg.files) {
      const file = fileTemplate.replaceAll("{season}", season).replaceAll("{year}", year);
      const path = lg.seasonDir ? `${lg.seasonDir}/${file}` : file;
      const url = `https://raw.githubusercontent.com/${lg.repo}/${branch}/${path}`;
      try {
        return parseOpenFootballText(await getText(url), lg);
      } catch (e) {
        lastError = e;
      }
    }
  }
  throw lastError ?? new Error(`No OpenFootball file found for ${lg.slug}`);
}

export function leaguesForCurrentSeason(_date = new Date()): OpenFootballLeague[] {
  return OPENFOOTBALL_LEAGUES.map((lg) => ({ ...lg }));
}
