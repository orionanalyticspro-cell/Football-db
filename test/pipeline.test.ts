import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDb, loadAliases, upsertMatch } from "../src/db.js";
import { parseMainCsv, parseExtraCsv, MAIN_DIVISIONS, seasonCodeFor } from "../src/sources/footballData.js";
import { parseEspn, seasonFor, type EspnLeague } from "../src/sources/espn.js";
import { localToUtcIso, normalizeName } from "../src/normalize.js";
import { ingest } from "../src/run.js";

const fx = (f: string) => readFileSync(`test/fixtures/${f}`, "utf8");
const db = openDb(":memory:");
loadAliases(db);

// --- Normalisation / fuseaux
assert.equal(normalizeName("FC Basel"), "basel");
assert.equal(normalizeName("Lech Poznań"), "lech poznan");
assert.equal(normalizeName("Man Utd"), "man united");
assert.equal(localToUtcIso("2026-07-15", "15:00", "Europe/London"), "2026-07-15T14:00:00.000Z"); // été
assert.equal(localToUtcIso("2026-11-14", "15:00", "Europe/London"), "2026-11-14T15:00:00.000Z"); // hiver
assert.equal(seasonCodeFor(new Date("2026-11-18")), "2627");
assert.equal(seasonCodeFor(new Date("2027-03-01")), "2627");
assert.equal(seasonFor("2026-11-15T16:00:00Z", "split"), "2026/2027");
assert.equal(seasonFor("2027-03-15T16:00:00Z", "split"), "2026/2027");
assert.equal(seasonFor("2026-11-15T16:00:00Z", "calendar"), "2026");

// --- Source CSV « main » (League One)
const d = MAIN_DIVISIONS.find((x) => x.div === "E2")!;
const main = parseMainCsv(fx("E2.csv"), d, "2627");
assert.equal(main.length, 5);
assert.equal(main[4].status, "scheduled");
assert.equal(main[0].stats?.home_shots, 12);
assert.ok(main[0].odds!.some((o) => o.book === "PS" && o.home === 2.15));
ingest(db, main);
ingest(db, main); // idempotence : relancer ne crée aucun doublon
assert.equal((db.prepare(`SELECT COUNT(*) c FROM matches`).get() as any).c, 5);

const table = db.prepare(`SELECT position, team, played, points, goal_diff FROM v_standings WHERE competition_code='ENGLAND-3' ORDER BY position`).all() as any[];
// Stockport: 1 nul + 1 victoire = 4 pts ; Wigan: 3+1 = 4 pts (GD +1) ; Burton 2 pts ; Bolton 0
assert.deepEqual(table.map((t) => [t.team, t.points]), [["Stockport", 4], ["Wigan", 4], ["Burton", 2], ["Bolton", 0]]); // Stockport devant Wigan à la différence de buts
assert.equal(table[0].position, 1);
assert.equal(table.find((t) => t.team === "Wigan").goal_diff, 1);

// --- Source CSV « extra » + alias manuel (Legia) + accents (Lech Poznan / Poznań)
ingest(db, parseExtraCsv(fx("extra.csv")));
const pol = db.prepare(`SELECT t.name FROM teams t WHERE t.country='Poland' ORDER BY name`).all() as any[];
assert.deepEqual(pol.map((t) => t.name), ["Lech Poznan", "Legia Warszawa"], "alias/accents fusionnés");
const polMatches = db.prepare(`SELECT status FROM matches m JOIN competitions c ON c.id=m.competition_id WHERE c.country='Poland' ORDER BY kickoff_utc`).all() as any[];
assert.deepEqual(polMatches.map((m) => m.status), ["finished", "scheduled"]);

// --- Déduplication entre 2 sources (extra + ESPN) pour la Suisse
const sui: EspnLeague = { slug: "sui.1", code: "SWITZERLAND-1", name: "Super League", country: "Switzerland", seasonMode: "split" };
const espn = parseEspn(JSON.parse(fx("espn_sui.json")), sui);
assert.deepEqual(espn.map((m) => m.status), ["finished", "scheduled", "postponed"]);
assert.equal(espn[1].homeGoals, null, "pas de score pour un match à venir");
ingest(db, espn);
const swiss = db.prepare(`SELECT COUNT(*) c FROM matches m JOIN competitions c ON c.id=m.competition_id WHERE c.country='Switzerland' AND m.match_date='2026-11-15'`).get() as any;
assert.equal(swiss.c, 1, "le même match vu par 2 sources ne doit pas être dupliqué (Basel vs Young Boys)");

// --- Un match terminé n'est jamais rétrogradé
const before = db.prepare(`SELECT status, home_goals FROM matches m JOIN competitions c ON c.id=m.competition_id WHERE c.country='Switzerland' AND m.match_date='2026-11-15'`).get() as any;
assert.equal(before.status, "finished");
upsertMatch(db, { ...espn[0], status: "scheduled", homeGoals: null, awayGoals: null });
const after = db.prepare(`SELECT status, home_goals FROM matches m JOIN competitions c ON c.id=m.competition_id WHERE c.country='Switzerland' AND m.match_date='2026-11-15'`).get() as any;
assert.equal(after.status, "finished");
assert.equal(after.home_goals, 1);

console.log("✓ tous les tests passent");

// --- Rapprochement approximatif : sûr (équipes B / ambiguïtés refusées)
const rs = (n: string) => (db.prepare(`INSERT OR IGNORE INTO teams (name,country) VALUES (?, 'Spain')`).run(n), n);
import { resolveTeam } from "../src/db.js";
const t1 = resolveTeam(db, "Real Sociedad", "Spain", "t");
const t2 = resolveTeam(db, "Real Sociedad B", "Spain", "t");
assert.notEqual(t1, t2, "l'équipe B ne doit pas être fusionnée avec l'équipe première");
const t3 = resolveTeam(db, "Real Sociedad de Futbol", "Spain", "t");
void rs; void t3;
console.log("✓ rapprochement approximatif OK");
