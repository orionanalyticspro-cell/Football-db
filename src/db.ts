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

const NOT_SAME_TEAM = new Set([
  "b", "c", "ii", "iii", "2", "3", "u17", "u18", "u19", "u20", "u21", "u23",
  "reserves", "reserve", "res", "youth", "juniors", "w", "women", "ladies", "fem", "femenino",
]);

function fuzzyTeam(db: Db, norm: string, country: string): number | null {
  const a = norm.split(" ");
  const rows = db.prepare(`SELECT alias_norm, team_id FROM team_aliases WHERE country = ?`)
    .all(country) as { alias_norm: string; team_id: number }[];
  const hits = new Set<number>();
  for (const r of rows) {
    const b = r.alias_norm.split(" ");
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    if (!short.every((t) => long.includes(t))) continue;
    const shortStr = short.join(" ");
    if (short.length < 2 && shortStr.length < 5) continue;       // trop court pour être sûr
    const extra = long.filter((t) => !short.includes(t));
    if (extra.some((t) => NOT_SAME_TEAM.has(t))) continue;       // équipe B, jeunes, féminines...
    hits.add(r.team_id);
  }
  return hits.size === 1 ? [...hits][0] : null;
}

export function resolveTeam(db: Db, rawName: string, country: string, source: string): number {
  const norm = normalizeName(rawName);
  const found = db.prepare(`SELECT team_id FROM team_aliases WHERE alias_norm = ? AND country = ?`)
    .get(norm, country) as { team_id: number } | undefined;
  if (found) return found.team_id;

  // Rapprochement approximatif : « young boys » ⊂ « bsc young boys ».
  // Refusé s'il y a plusieurs candidats ou si la différence est une équipe B/réserve/jeunes/féminine.
  const fuzzy = fuzzyTeam(db, norm, country);
  if (fuzzy) {
    db.prepare(`INSERT OR IGNORE INTO team_aliases (alias_norm, country, team_id, source) VALUES (?, ?, ?, ?)`)
      .run(norm, country, fuzzy, `${source}:fuzzy`); // auditable : SELECT * FROM team_aliases WHERE source LIKE '%fuzzy'
    return fuzzy;
  }
  db.prepare(`INSERT OR IGNORE INTO teams (name, country) VALUES (?, ?)`).run(rawName.trim(), country);
  const team = db.prepare(`SELECT id FROM teams WHERE name = ? AND country = ?`)
    .get(rawName.trim(), country) as { id: number };
  db.prepare(`INSERT OR IGNORE INTO team_aliases (alias_norm, country, team_id, source) VALUES (?, ?, ?, ?)`)
    .run(norm, country, team.id, source);
  return team.id;
}

// Charge config/aliases.json : [{ country, team, aliases: [...] }]
export function loadAliases(db: Db, file = "config/aliases.json"): number {
  if (!existsSync(file)) return 0;
  const list = JSON.parse(readFileSync(file, "utf8")) as { country: string; team: string; aliases: string[] }[];
  let n = 0;
  const tx = db.transaction(() => {
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
  });
  tx();
  return n;
}

export function upsertMatch(db: Db, m: MatchInput): number {
  const compId = ensureCompetition(db, m.competition);
  const country = m.competition.country;
  const homeId = resolveTeam(db, m.homeName, country, m.source);
  const awayId = resolveTeam(db, m.awayName, country, m.source);
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
