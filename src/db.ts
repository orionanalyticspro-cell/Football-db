import Database from "better-sqlite3";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeName } from "./normalize.js";

export type Db = Database.Database;

const here = dirname(fileURLToPath(import.meta.url));

export function openDb(path = process.env.FOOTBALL_DB ?? "data/football.db"): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(readFileSync(join(here, "..", "schema.sql"), "utf8"));
  return db;
}

export interface CompetitionInput { code: string; name: string; country: string; level?: number }

export interface MatchInput {
  competition: CompetitionInput;
  season: string;
  kickoffUtc: string;            // ISO UTC
  homeName: string;
  awayName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  htHome?: number | null;
  htAway?: number | null;
  status: "scheduled" | "finished" | "live" | "postponed";
  source: string;
  stats?: Partial<Record<
    | "home_shots" | "away_shots" | "home_shots_on_target" | "away_shots_on_target"
    | "home_corners" | "away_corners" | "home_fouls" | "away_fouls"
    | "home_yellow" | "away_yellow" | "home_red" | "away_red", number | null>>;
  odds?: { book: string; home: number | null; draw: number | null; away: number | null }[];
}

const compCache = new WeakMap<Db, Map<string, number>>();

export function ensureCompetition(db: Db, c: CompetitionInput): number {
  let cache = compCache.get(db);
  if (!cache) { cache = new Map(); compCache.set(db, cache); }
  const hit = cache.get(c.code);
  if (hit) return hit;
  db.prepare(
    `INSERT INTO competitions (code, name, country, level) VALUES (?, ?, ?, ?)
     ON CONFLICT(code) DO NOTHING`
  ).run(c.code, c.name, c.country, c.level ?? 1);
  const row = db.prepare(`SELECT id FROM competitions WHERE code = ?`).get(c.code) as { id: number };
  cache.set(c.code, row.id);
  return row.id;
}

/** Nom exact (après normalisation) ou alias connu. Jamais de rapprochement « approximatif » :
 *  « Paris FC » → « paris » ⊂ « paris sg » avait fusionné deux clubs différents. */
export function lookupTeam(db: Db, rawName: string, country: string): number | null {
  const row = db.prepare(`SELECT team_id FROM team_aliases WHERE alias_norm = ? AND country = ?`)
    .get(normalizeName(rawName), country) as { team_id: number } | undefined;
  return row ? row.team_id : null;
}

function addAlias(db: Db, rawName: string, country: string, teamId: number, source: string) {
  db.prepare(`INSERT OR IGNORE INTO team_aliases (alias_norm, country, team_id, source) VALUES (?, ?, ?, ?)`)
    .run(normalizeName(rawName), country, teamId, source);
}

export function createTeam(db: Db, rawName: string, country: string, source: string): number {
  db.prepare(`INSERT OR IGNORE INTO teams (name, country) VALUES (?, ?)`).run(rawName.trim(), country);
  const team = db.prepare(`SELECT id FROM teams WHERE name = ? AND country = ?`)
    .get(rawName.trim(), country) as { id: number };
  addAlias(db, rawName, country, team.id, source);
  return team.id;
}

export function resolveTeam(db: Db, rawName: string, country: string, source: string): number {
  return lookupTeam(db, rawName, country) ?? createTeam(db, rawName, country, source);
}

/**
 * Rapprochement par le MATCH, pas par le nom : une équipe inconnue est reliée à une équipe existante
 * seulement si le même match est déjà en base (même compétition, même créneau, même score) et sans ambiguïté.
 *  - un côté déjà connu : l'adversaire du match existant (±1 jour) donne l'autre côté ;
 *  - aucun côté connu : même score ET coup d'envoi à ±2 h ET un seul candidat.
 * En cas de doute on ne relie pas (on crée une équipe) : mieux vaut un doublon repérable qu'une fusion silencieuse.
 */
export function linkByMatch(
  db: Db, compId: number, kickoffIso: string,
  homeId: number | null, awayId: number | null, hg: number | null, ag: number | null, source = "",
): { homeId: number | null; awayId: number | null } {
  // Une équipe que CETTE source a déjà nommée ne peut pas être la cible d'un rapprochement :
  // si la source avait ce match, elle l'aurait déjà associé à ce nom (évite de fusionner 2 matchs de la même source).
  const base = source.split(":")[0];
  const knownBySource = (teamId: number) =>
    base !== "" && !!db.prepare(`SELECT 1 FROM team_aliases WHERE team_id = ? AND (source = ? OR source LIKE ?) LIMIT 1`)
      .get(teamId, base, `${base}:%`);
  const rows = db.prepare(
    `SELECT home_id, away_id, home_goals, away_goals, kickoff_utc FROM matches
     WHERE competition_id = ? AND julianday(kickoff_utc) BETWEEN julianday(?) - 1 AND julianday(?) + 1`
  ).all(compId, kickoffIso, kickoffIso) as
    { home_id: number; away_id: number; home_goals: number | null; away_goals: number | null; kickoff_utc: string }[];

  const hasScore = hg !== null && ag !== null;
  const scoreOk = (r: typeof rows[number]) =>
    !hasScore || r.home_goals === null || r.away_goals === null || (r.home_goals === hg && r.away_goals === ag);

  if (homeId !== null && awayId === null) {
    const c = rows.filter((r) => r.home_id === homeId && scoreOk(r) && !knownBySource(r.away_id));
    return { homeId, awayId: c.length === 1 && c[0].away_id !== homeId ? c[0].away_id : null };
  }
  if (awayId !== null && homeId === null) {
    const c = rows.filter((r) => r.away_id === awayId && scoreOk(r) && !knownBySource(r.home_id));
    return { homeId: c.length === 1 && c[0].home_id !== awayId ? c[0].home_id : null, awayId };
  }
  if (homeId === null && awayId === null && hasScore) {
    const t = Date.parse(kickoffIso);
    const c = rows.filter((r) =>
      r.home_goals === hg && r.away_goals === ag && Math.abs(Date.parse(r.kickoff_utc) - t) <= 2 * 3600e3
      && !knownBySource(r.home_id) && !knownBySource(r.away_id));
    if (c.length === 1) return { homeId: c[0].home_id, awayId: c[0].away_id };
  }
  return { homeId: null, awayId: null };
}

// Charge les alias : config/aliases.seed.json (fourni) puis config/aliases.json (les vôtres, prioritaires).
// Format : [{ country, team, aliases: [...] }]
export function loadAliases(db: Db, files: string[] = ["config/aliases.seed.json", "config/aliases.json"]): number {
  let n = 0;
  for (const file of files) {
    if (!existsSync(file)) continue;
    const list = JSON.parse(readFileSync(file, "utf8")) as { country: string; team: string; aliases: string[] }[];
    db.transaction(() => {
      for (const e of list) {
        db.prepare(`INSERT OR IGNORE INTO teams (name, country) VALUES (?, ?)`).run(e.team, e.country);
        const t = db.prepare(`SELECT id FROM teams WHERE name = ? AND country = ?`).get(e.team, e.country) as { id: number };
        for (const a of [e.team, ...e.aliases]) {
          db.prepare(
            `INSERT INTO team_aliases (alias_norm, country, team_id, source) VALUES (?, ?, ?, 'manual')
             ON CONFLICT(alias_norm, country) DO UPDATE SET team_id = excluded.team_id, source = 'manual'`
          ).run(normalizeName(a), e.country, t.id);
          n++;
        }
      }
    })();
  }
  return n;
}

export function upsertMatch(db: Db, m: MatchInput): number {
  const compId = ensureCompetition(db, m.competition);
  const country = m.competition.country;
  let homeId = lookupTeam(db, m.homeName, country);
  let awayId = lookupTeam(db, m.awayName, country);
  if (homeId === null || awayId === null) {
    const link = linkByMatch(db, compId, m.kickoffUtc, homeId, awayId, m.homeGoals, m.awayGoals, m.source);
    if (homeId === null && link.homeId !== null && link.homeId !== awayId) {
      homeId = link.homeId; addAlias(db, m.homeName, country, homeId, `${m.source}:matchlink`);
    }
    if (awayId === null && link.awayId !== null && link.awayId !== homeId) {
      awayId = link.awayId; addAlias(db, m.awayName, country, awayId, `${m.source}:matchlink`);
    }
  }
  homeId ??= createTeam(db, m.homeName, country, m.source);
  awayId ??= createTeam(db, m.awayName, country, m.source);
  const date = m.kickoffUtc.slice(0, 10);

  db.prepare(
    `INSERT INTO matches
       (competition_id, season, kickoff_utc, match_date, home_id, away_id,
        home_goals, away_goals, ht_home_goals, ht_away_goals, status, source)
     VALUES (@compId, @season, @kickoff, @date, @homeId, @awayId, @hg, @ag, @hth, @hta, @status, @source)
     ON CONFLICT (competition_id, season, match_date, home_id, away_id) DO UPDATE SET
       kickoff_utc   = excluded.kickoff_utc,
       home_goals    = COALESCE(excluded.home_goals, matches.home_goals),
       away_goals    = COALESCE(excluded.away_goals, matches.away_goals),
       ht_home_goals = COALESCE(excluded.ht_home_goals, matches.ht_home_goals),
       ht_away_goals = COALESCE(excluded.ht_away_goals, matches.ht_away_goals),
       -- un match « terminé » n'est jamais rétrogradé par une source moins à jour
       status = CASE WHEN matches.status = 'finished' AND excluded.status <> 'finished'
                     THEN matches.status ELSE excluded.status END,
       source = excluded.source,
       updated_at = datetime('now')`
  ).run({
    compId, season: m.season, kickoff: m.kickoffUtc, date, homeId, awayId,
    hg: m.homeGoals, ag: m.awayGoals, hth: m.htHome ?? null, hta: m.htAway ?? null,
    status: m.status, source: m.source,
  });

  const { id } = db.prepare(
    `SELECT id FROM matches WHERE competition_id = ? AND season = ? AND match_date = ? AND home_id = ? AND away_id = ?`
  ).get(compId, m.season, date, homeId, awayId) as { id: number };

  if (m.stats && Object.values(m.stats).some((v) => v !== null && v !== undefined)) {
    const cols = Object.keys(m.stats);
    db.prepare(
      `INSERT INTO match_stats (match_id, ${cols.join(", ")}) VALUES (@match_id, ${cols.map((c) => "@" + c).join(", ")})
       ON CONFLICT(match_id) DO UPDATE SET ${cols.map((c) => `${c} = COALESCE(excluded.${c}, match_stats.${c})`).join(", ")}`
    ).run({ match_id: id, ...m.stats });
  }
  for (const o of m.odds ?? []) {
    if (o.home === null && o.draw === null && o.away === null) continue;
    db.prepare(
      `INSERT INTO odds (match_id, book, home, draw, away) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(match_id, book) DO UPDATE SET home = excluded.home, draw = excluded.draw, away = excluded.away`
    ).run(id, o.book, o.home, o.draw, o.away);
  }
  return id;
}

export function logRun(db: Db, r: { source: string; target: string; startedAt: string; read: number; upserted: number; ok: boolean; error?: string }) {
  db.prepare(
    `INSERT INTO ingest_logs (source, target, started_at, rows_read, rows_upsert, ok, error) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(r.source, r.target, r.startedAt, r.read, r.upserted, r.ok ? 1 : 0, r.error ?? null);
}
