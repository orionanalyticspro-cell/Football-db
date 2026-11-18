// Source gratuite (non officielle) : endpoint « scoreboard » d'ESPN.
// Utile pour les ligues absentes de football-data.co.uk (MENA, Afrique, Asie...).
// ⚠ Endpoint non documenté : il peut changer ou limiter l'accès. Vérifiez les conditions d'ESPN.
import type { MatchInput } from "../db.js";
import { getJson } from "../http.js";
import { toInt } from "../normalize.js";

export const SOURCE_ESPN = "espn";

export interface EspnLeague {
  slug: string;                       // ex. "sau.1"
  code: string;                       // clé interne, ex. "SAU-1"
  name: string;
  country: string;
  level?: number;
  seasonMode: "split" | "calendar";   // split = août→mai (2026/2027), calendar = année civile (2026)
  enabled?: boolean;
}

export function seasonFor(iso: string, mode: "split" | "calendar"): string {
  const y = Number(iso.slice(0, 4));
  if (mode === "calendar") return String(y);
  const month = Number(iso.slice(5, 7));
  return month >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

interface EspnEvent {
  date: string;
  status?: { type?: { state?: string; name?: string; completed?: boolean } };
  competitions?: { competitors?: { homeAway: string; score?: string; team?: { displayName?: string; name?: string } }[] }[];
}

export function parseEspn(json: { events?: EspnEvent[] }, lg: EspnLeague): MatchInput[] {
  const out: MatchInput[] = [];
  for (const ev of json.events ?? []) {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c) => c.homeAway === "home");
    const away = comp?.competitors?.find((c) => c.homeAway === "away");
    const hn = home?.team?.displayName ?? home?.team?.name;
    const an = away?.team?.displayName ?? away?.team?.name;
    if (!hn || !an || !ev.date) continue;

    const state = ev.status?.type?.state;           // pre | in | post
    const name = ev.status?.type?.name ?? "";
    let status: MatchInput["status"] = "scheduled";
    if (state === "in") status = "live";
    else if (state === "post" && ev.status?.type?.completed !== false) status = "finished";
    if (/POSTPONED|CANCELED|CANCELLED|SUSPENDED/i.test(name)) status = "postponed";

    const hasScore = status === "finished" || status === "live";
    const kickoff = new Date(ev.date).toISOString();
    out.push({
      competition: { code: lg.code, name: lg.name, country: lg.country, level: lg.level ?? 1 },
      season: seasonFor(kickoff, lg.seasonMode),
      kickoffUtc: kickoff,
      homeName: hn, awayName: an,
      homeGoals: hasScore ? toInt(home?.score) : null,
      awayGoals: hasScore ? toInt(away?.score) : null,
      status, source: SOURCE_ESPN,
    });
  }
  return out;
}

export async function fetchEspn(lg: EspnLeague, from: Date, to: Date): Promise<MatchInput[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg.slug}/scoreboard?dates=${ymd(from)}-${ymd(to)}&limit=500`;
  return parseEspn(await getJson(url), lg);
}
