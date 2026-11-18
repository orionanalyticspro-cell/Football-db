PRAGMA foreign_keys = ON;

-- Compétitions (une ligne par championnat/division)
CREATE TABLE IF NOT EXISTS competitions (
  id        INTEGER PRIMARY KEY,
  code      TEXT NOT NULL UNIQUE,      -- clé stable interne, ex: 'POL-1', 'ENG-3'
  name      TEXT NOT NULL,             -- ex: 'Ekstraklasa'
  country   TEXT NOT NULL,
  level     INTEGER NOT NULL DEFAULT 1 -- 1 = D1, 2 = D2...
);

-- Équipes canoniques
CREATE TABLE IF NOT EXISTS teams (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL,
  country  TEXT NOT NULL,
  UNIQUE (name, country)
);

-- Alias de noms d'équipes (une même équipe a des noms différents selon la source)
CREATE TABLE IF NOT EXISTS team_aliases (
  alias_norm TEXT NOT NULL,            -- nom normalisé (minuscule, sans accents ni FC/AFC...)
  country    TEXT NOT NULL,
  team_id    INTEGER NOT NULL REFERENCES teams(id),
  source     TEXT NOT NULL,
  PRIMARY KEY (alias_norm, country)
);

-- Matchs
CREATE TABLE IF NOT EXISTS matches (
  id             INTEGER PRIMARY KEY,
  competition_id INTEGER NOT NULL REFERENCES competitions(id),
  season         TEXT NOT NULL,        -- ex: '2026/2027' ou '2026'
  kickoff_utc    TEXT NOT NULL,        -- ISO 8601, toujours en UTC
  match_date     TEXT NOT NULL,        -- AAAA-MM-JJ (UTC), sert à l'identité du match
  home_id        INTEGER NOT NULL REFERENCES teams(id),
  away_id        INTEGER NOT NULL REFERENCES teams(id),
  home_goals     INTEGER,
  away_goals     INTEGER,
  ht_home_goals  INTEGER,
  ht_away_goals  INTEGER,
  status         TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled | finished | live | postponed
  source         TEXT NOT NULL,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Identité d'un match = compétition + saison + date (jour) + domicile + extérieur.
-- Cela évite les doublons quand 2 sources donnent le même match.
CREATE UNIQUE INDEX IF NOT EXISTS ux_match_identity
  ON matches (competition_id, season, match_date, home_id, away_id);

-- Stats détaillées (quand la source les fournit)
CREATE TABLE IF NOT EXISTS match_stats (
  match_id INTEGER PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  home_shots INTEGER, away_shots INTEGER,
  home_shots_on_target INTEGER, away_shots_on_target INTEGER,
  home_corners INTEGER, away_corners INTEGER,
  home_fouls INTEGER, away_fouls INTEGER,
  home_yellow INTEGER, away_yellow INTEGER,
  home_red INTEGER, away_red INTEGER
);

-- Cotes (marché 1X2) historiques / de fermeture quand disponibles
CREATE TABLE IF NOT EXISTS odds (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  book     TEXT NOT NULL,              -- 'PS' (Pinnacle), 'AVG', 'MAX'...
  home     REAL, draw REAL, away REAL,
  PRIMARY KEY (match_id, book)
);

-- Matrice de couverture : quelle source alimente quelle compétition
CREATE TABLE IF NOT EXISTS competition_sources (
  competition_id   INTEGER NOT NULL REFERENCES competitions(id),
  source           TEXT NOT NULL,
  source_league_id TEXT NOT NULL,
  priority         INTEGER NOT NULL DEFAULT 1,
  last_success_at  TEXT,
  PRIMARY KEY (competition_id, source)
);

-- Journal des exécutions (pour détecter les sources cassées)
CREATE TABLE IF NOT EXISTS ingest_logs (
  id          INTEGER PRIMARY KEY,
  source      TEXT NOT NULL,
  target      TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  rows_read   INTEGER NOT NULL DEFAULT 0,
  rows_upsert INTEGER NOT NULL DEFAULT 0,
  ok          INTEGER NOT NULL,
  error       TEXT
);

-- Classement recalculé à partir des résultats (3 pts victoire, 1 nul)
-- NB : les règles de départage (confrontations directes, etc.) varient par ligue ;
-- ici : points, puis différence de buts, puis buts marqués.
CREATE VIEW IF NOT EXISTS v_standings AS
WITH results AS (
  SELECT competition_id, season, home_id AS team_id,
         home_goals AS gf, away_goals AS ga, 1 AS is_home
  FROM matches WHERE status = 'finished' AND home_goals IS NOT NULL
  UNION ALL
  SELECT competition_id, season, away_id,
         away_goals, home_goals, 0
  FROM matches WHERE status = 'finished' AND away_goals IS NOT NULL
),
agg AS (
  SELECT competition_id, season, team_id,
    COUNT(*) AS played,
    SUM(gf > ga) AS won,
    SUM(gf = ga) AS drawn,
    SUM(gf < ga) AS lost,
    SUM(gf) AS goals_for,
    SUM(ga) AS goals_against,
    SUM(gf) - SUM(ga) AS goal_diff,
    SUM(CASE WHEN gf > ga THEN 3 WHEN gf = ga THEN 1 ELSE 0 END) AS points
  FROM results
  GROUP BY competition_id, season, team_id
)
SELECT
  a.competition_id, c.code AS competition_code, a.season,
  RANK() OVER (PARTITION BY a.competition_id, a.season
               ORDER BY a.points DESC, a.goal_diff DESC, a.goals_for DESC) AS position,
  t.name AS team, a.played, a.won, a.drawn, a.lost,
  a.goals_for, a.goals_against, a.goal_diff, a.points
FROM agg a
JOIN teams t ON t.id = a.team_id
JOIN competitions c ON c.id = a.competition_id;

-- Forme sur les 5 derniers matchs
CREATE VIEW IF NOT EXISTS v_form AS
WITH r AS (
  SELECT competition_id, season, kickoff_utc, home_id AS team_id,
         CASE WHEN home_goals > away_goals THEN 'W' WHEN home_goals = away_goals THEN 'D' ELSE 'L' END AS res
  FROM matches WHERE status='finished' AND home_goals IS NOT NULL
  UNION ALL
  SELECT competition_id, season, kickoff_utc, away_id,
         CASE WHEN away_goals > home_goals THEN 'W' WHEN away_goals = home_goals THEN 'D' ELSE 'L' END
  FROM matches WHERE status='finished' AND away_goals IS NOT NULL
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY competition_id, season, team_id ORDER BY kickoff_utc DESC) AS rn
  FROM r
)
SELECT competition_id, season, team_id,
       group_concat(res, '') AS last5
FROM (SELECT * FROM ranked WHERE rn <= 5 ORDER BY kickoff_utc DESC)
GROUP BY competition_id, season, team_id;
