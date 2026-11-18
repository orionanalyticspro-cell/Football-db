// Exporte des fichiers JSON statiques lisibles par votre application (aucun serveur nécessaire).
//   out/index.json            -> liste des compétitions couvertes
//   out/<CODE>.json           -> classement + forme + derniers résultats + prochains matchs
import { mkdirSync, writeFileSync } from "node:fs";
import { openDb } from "./db.js";

const OUT = process.env.EXPORT_DIR ?? "data/export";
const db = openDb();
mkdirSync(OUT, { recursive: true });

const comps = db.prepare(`SELECT id, code, name, country, level FROM competitions ORDER BY country, level`).all() as
  { id: number; code: string; name: string; country: string; level: number }[];

const index: unknown[] = [];
for (const c of comps) {
  const season = (db.prepare(
    `SELECT season FROM matches WHERE competition_id = ? ORDER BY match_date DESC LIMIT 1`
  ).get(c.id) as { season: string } | undefined)?.season;
  if (!season) continue;

  const standings = db.prepare(
    `SELECT position, team, played, won, drawn, lost, goals_for, goals_against, goal_diff, points
     FROM v_standings WHERE competition_id = ? AND season = ? ORDER BY position, team`
  ).all(c.id, season);

  const form = db.prepare(
    `SELECT t.name AS team, f.last5 FROM v_form f JOIN teams t ON t.id = f.team_id
     WHERE f.competition_id = ? AND f.season = ?`
  ).all(c.id, season);

  const matchCols = `m.match_date AS date, m.kickoff_utc, h.name AS home, a.name AS away,
                     m.home_goals, m.away_goals, m.status`;
  const recent = db.prepare(
    `SELECT ${matchCols} FROM matches m JOIN teams h ON h.id = m.home_id JOIN teams a ON a.id = m.away_id
     WHERE m.competition_id = ? AND m.season = ? AND m.status = 'finished'
     ORDER BY m.kickoff_utc DESC LIMIT 30`
  ).all(c.id, season);
  const upcoming = db.prepare(
    `SELECT ${matchCols} FROM matches m JOIN teams h ON h.id = m.home_id JOIN teams a ON a.id = m.away_id
     WHERE m.competition_id = ? AND m.season = ? AND m.status IN ('scheduled','live')
       AND m.kickoff_utc >= datetime('now','-1 day')
     ORDER BY m.kickoff_utc ASC LIMIT 30`
  ).all(c.id, season);

  const updated = new Date().toISOString();
  writeFileSync(`${OUT}/${c.code}.json`, JSON.stringify({ competition: c, season, updated, standings, form, recent, upcoming }, null, 1));
  index.push({ code: c.code, name: c.name, country: c.country, level: c.level, season, teams: standings.length });
}
writeFileSync(`${OUT}/index.json`, JSON.stringify({ updated: new Date().toISOString(), competitions: index }, null, 1));
console.log(`Exporté ${index.length} compétition(s) dans ${OUT}/`);
