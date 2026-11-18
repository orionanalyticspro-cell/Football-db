// Contrôle qualité : signale les compétitions « en saison » sans résultat récent
// et les sources dont la dernière exécution a échoué. Code de sortie 1 si problème.
import { openDb } from "./db.js";

const STALE_DAYS = Number(process.env.STALE_DAYS ?? 4);
const db = openDb();
let problems = 0;

const stale = db.prepare(`
  SELECT c.code, c.name, c.country,
         MAX(CASE WHEN m.status='finished' THEN m.match_date END) AS last_result,
         MAX(m.match_date) AS last_match,
         SUM(CASE WHEN m.status='scheduled' AND m.match_date <= date('now') AND m.match_date >= date('now', ?) THEN 1 ELSE 0 END) AS overdue
  FROM competitions c JOIN matches m ON m.competition_id = c.id
  GROUP BY c.id
  HAVING overdue > 0
`).all(`-${STALE_DAYS} days`) as { code: string; name: string; country: string; last_result: string | null; overdue: number }[];

for (const s of stale) {
  problems++;
  console.log(`⚠ ${s.code} (${s.country} – ${s.name}) : ${s.overdue} match(s) passé(s) sans score ; dernier résultat le ${s.last_result ?? "jamais"}`);
}

const failures = db.prepare(`
  SELECT l.source, l.target, l.error, l.started_at FROM ingest_logs l
  JOIN (SELECT source, target, MAX(id) AS id FROM ingest_logs GROUP BY source, target) x ON x.id = l.id
  WHERE l.ok = 0
`).all() as { source: string; target: string; error: string; started_at: string }[];
for (const f of failures) { problems++; console.log(`✗ ${f.source} ${f.target} (${f.started_at}) : ${f.error}`); }

const empty = db.prepare(`
  SELECT source, target FROM ingest_logs
  WHERE id IN (SELECT MAX(id) FROM ingest_logs GROUP BY source, target) AND ok = 1 AND rows_read = 0
`).all() as { source: string; target: string }[];
for (const e of empty) { problems++; console.log(`⚠ ${e.source} ${e.target} : 0 ligne lue (le format de la source a peut-être changé)`); }

console.log(problems ? `\n${problems} problème(s) détecté(s).` : "Tout est OK.");
process.exit(problems ? 1 : 0);
