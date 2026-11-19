// Source OpenFootball (CC0) : datasets textuels vérifiés pour certaines ligues nationales.
// Ce collecteur est volontairement limité aux ligues dont le dépôt et le format sont connus.
import { getText } from "../http.js";
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

export const OPENFOOTBALL_LEAGUES: OpenFootballLeague[] = [
  { slug: "eng.1", code: "ENGLAND-1", name: "Premier League", country: "England", level: 1,
    repo: "openfootball/england", seasonDir: "2026-27", files: ["1-premierleague.txt"], seasonMode: "split" },
  { slug: "eng.2", code: "ENGLAND-2", name: "Championship", country: "England", level: 2,
    repo: "openfootball/england", seasonDir: "2026-27", files: ["2-championship.txt"], seasonMode: "split" },
];

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6,
  Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function seasonFor(date: Date, mode: "split" | "calendar"): string {
  const y = date.getUTCFullYear();
  if (mode === "calendar") return String(y);
  return date.getUTCMonth() >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

function isoUtc(date: Date, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, m));
  return d.toISOString();
}

export function parseOpenFootballText(text: string, lg: OpenFootballLeague): MatchInput[] {
  const out: MatchInput[] = [];
  let year: number | null = null;
  let date: Date | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();

    const fullDate = line.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?$/);
    if (fullDate) {
      const month = MONTHS[fullDate[1]];
      if (fullDate[3]) year = Number(fullDate[3]);
      if (year !== null && month !== undefined) date = new Date(Date.UTC(year, month, Number(fullDate[2])));
      continue;
    }

    const shortDate = line.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})$/);
    if (shortDate) {
      const month = MONTHS[shortDate[1]];
      if (year !== null && month !== undefined) date = new Date(Date.UTC(year, month, Number(shortDate[2])));
      continue;
    }

    const match = line.match(/^([0-2]?\d:[0-5]\d)\s+(.+?)\s+v\s+(.+?)(?:\s+(\d+)-(\d+)(?:\s+\(\d+-\d+\))?)?\s*$/);
    if (!match || !date) continue;
    const [, time, homeName, awayName, hg, ag] = match;
    const finished = hg !== undefined && ag !== undefined;
    const kickoffUtc = isoUtc(date, time);
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

export async function fetchOpenFootball(lg: OpenFootballLeague): Promise<MatchInput[]> {
  const branch = lg.branch ?? "master";
  const out: MatchInput[] = [];
  for (const file of lg.files) {
    const url = `https://raw.githubusercontent.com/${lg.repo}/${branch}/${lg.seasonDir}/${file}`;
    try {
      out.push(...parseOpenFootballText(await getText(url), lg));
    } catch (e) {
      // Une variante absente est ignorée, mais une erreur d'accès est visible via le run.
      const fatal = (e as { fatal?: boolean }).fatal;
      if (!fatal) throw e;
    }
  }
  return out;
}

export function openFootballSeasonDir(date = new Date(), mode: "split" | "calendar" = "split"): string {
  if (mode === "calendar") return String(date.getUTCFullYear());
  const start = date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  const yy = (n: number) => String(n).slice(-2);
  return `${yy(start)}-${yy(start + 1)}`;
}
