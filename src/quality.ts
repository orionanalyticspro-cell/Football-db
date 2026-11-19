// Contrôles de cohérence sur les classements : repère les doublons d'équipes fusionnées,
// les équipes de barrages isolées et les ligues figées. Utilisé par l'export (champ "flag") et par `npm run health`.
import type { Db } from "./db.js";

export type TeamFlag = "duplicate" | "fragment";

export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Équipe avec beaucoup plus de matchs que la médiane = probablement 2 clubs fusionnés ;
 *  équipe avec ≤ 2 matchs dans une ligue avancée = barrages / fragment d'un nom mal rapproché. */
export function flagTeams(rows: { team: string; played: number }[]): Map<string, TeamFlag> {
  const med = median(rows.map((r) => r.played));
  const out = new Map<string, TeamFlag>();
  for (const r of rows) {
    if (r.played > Math.max(med + 6, 1.45 * med)) out.set(r.team, "duplicate");
    else if (med >= 10 && r.played <= 2) out.set(r.team, "fragment");
  }
  return out;
}

/** Ligue figée : presque aucun match joué et dernier match vieux de plus de 45 jours. */
export function isStale(maxPlayed: number, lastMatchDate: string | null, now = new Date()): boolean {
  if (!lastMatchDate) return true;
  const age = (now.getTime() - Date.parse(lastMatchDate)) / 864e5;
  return maxPlayed <= 3 && age > 45;
}

export interface Issue { competition: string; kind: string; detail: string }

export function qualityIssues(db: Db): Issue[] {
  const issues: Issue[] = [];
  const comps = db.prepare(`SELECT id, code FROM competitions`).all() as { id: number; code: string }[];
  for (const c of comps) {
    const season = (db.prepare(`SELECT season FROM matches WHERE competition_id = ? ORDER BY match_date DESC LIMIT 1`)
      .get(c.id) as { season: string } | undefined)?.season;
    if (!season) continue;
    const rows = db.prepare(`SELECT team, played FROM v_standings WHERE competition_id = ? AND season = ?`)
      .all(c.id, season) as { team: string; played: number }[];
    for (const [team, flag] of flagTeams(rows)) {
      const played = rows.find((r) => r.team === team)!.played;
      issues.push({ competition: c.code, kind: flag, detail: `${team} : ${played} matchs (médiane ${median(rows.map((r) => r.played))})` });
    }
    const last = (db.prepare(`SELECT MAX(match_date) d FROM matches WHERE competition_id = ? AND status = 'finished'`)
      .get(c.id) as { d: string | null }).d;
    if (isStale(Math.max(0, ...rows.map((r) => r.played)), last)) {
      issues.push({ competition: c.code, kind: "stale", detail: `dernier résultat : ${last ?? "jamais"}` });
    }
  }
  return issues;
}
