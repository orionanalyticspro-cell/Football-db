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

// --- Régression : des clubs DIFFÉRENTS ne doivent jamais être fusionnés (cas de l'audit)
import { createTeam, lookupTeam } from "../src/db.js";
const fr = { code: "FRANCE-1", name: "Ligue 1", country: "France", level: 1 };
const mk = (comp: typeof fr, h: string, a: string, day: string, hg: number, ag: number, source = "t", time = "20:00") =>
  upsertMatch(db, { competition: comp, season: "2026/2027", kickoffUtc: `${day}T${time}:00.000Z`, homeName: h, awayName: a,
    homeGoals: hg, awayGoals: ag, status: "finished", source });
mk(fr, "Paris Saint-Germain", "Lyon", "2026-09-01", 2, 0);
mk(fr, "Paris FC", "Lyon", "2026-09-08", 1, 1);
mk(fr, "Paris SG", "Nantes", "2026-09-15", 3, 0);            // alias connu -> Paris Saint-Germain
const frTable = db.prepare(`SELECT team, played FROM v_standings WHERE competition_code='FRANCE-1' ORDER BY team`).all() as any[];
assert.deepEqual(frTable.filter((r) => r.team.startsWith("Paris")).map((r) => [r.team, r.played]),
  [["Paris FC", 1], ["Paris Saint-Germain", 2]], "PSG et Paris FC restent 2 clubs distincts");
const be = { code: "BELGIUM-1", name: "Pro League", country: "Belgium", level: 1 };
mk(be, "Club Brugge", "Anderlecht", "2026-09-01", 1, 0);
mk(be, "Cercle Brugge", "Anderlecht", "2026-09-08", 0, 0);
const sc = { code: "SCOTLAND-1", name: "Premiership", country: "Scotland", level: 1 };
mk(sc, "Dundee", "Celtic", "2026-09-01", 0, 2);
mk(sc, "Dundee United", "Celtic", "2026-09-08", 1, 1);
for (const [c, n] of [["Belgium", 2], ["Scotland", 2]] as const) {
  const names = (db.prepare(`SELECT name FROM teams WHERE country=? AND name LIKE '%Brugge%' OR name LIKE 'Dundee%'`).all(c) as any[]);
  void names; void n;
}
assert.equal((db.prepare(`SELECT COUNT(*) c FROM teams WHERE name LIKE '%Brugge%'`).get() as any).c, 2, "Club Brugge ≠ Cercle Brugge");
assert.equal((db.prepare(`SELECT COUNT(*) c FROM teams WHERE name LIKE 'Dundee%'`).get() as any).c, 2, "Dundee ≠ Dundee United");

// --- Rapprochement par le match entre 2 sources (noms différents, un côté connu)
const ru = { code: "RUSSIA-1", name: "Premier League", country: "Russia", level: 1 };
mk(ru, "Zenit", "Spartak Moscow", "2026-10-03", 2, 1, "fd-extra", "16:00");
mk(ru, "Zenit St Petersburg", "Spartak Moscow", "2026-10-03", 2, 1, "espn", "16:00");
assert.equal((db.prepare(`SELECT COUNT(*) c FROM matches m JOIN competitions c ON c.id=m.competition_id WHERE c.code='RUSSIA-1'`).get() as any).c, 1, "même match = 1 ligne");
assert.equal(lookupTeam(db, "Zenit St Petersburg", "Russia"), lookupTeam(db, "Zenit", "Russia"), "alias appris via le match");
assert.ok((db.prepare(`SELECT 1 FROM team_aliases WHERE source LIKE '%matchlink'`).get()), "alias auditable");

// --- Aucun côté connu : même score + même heure + candidat unique
mk(ru, "Lokomotiv Moscow", "Rubin Kazan", "2026-10-04", 3, 1, "fd-extra", "13:00");
mk(ru, "Lokomotiv", "Rubin", "2026-10-04", 3, 1, "espn", "13:00");
assert.equal(lookupTeam(db, "Lokomotiv", "Russia"), lookupTeam(db, "Lokomotiv Moscow", "Russia"));
assert.equal(lookupTeam(db, "Rubin", "Russia"), lookupTeam(db, "Rubin Kazan", "Russia"));

// --- Ambigu (2 matchs, même heure, même score) : on NE relie PAS
mk(ru, "Krasnodar", "Akhmat", "2026-10-10", 1, 1, "fd-extra", "15:00");
mk(ru, "Sochi", "Orenburg", "2026-10-10", 1, 1, "fd-extra", "15:00");
mk(ru, "FK Alpha", "FK Beta", "2026-10-10", 1, 1, "espn", "15:00");
assert.equal(lookupTeam(db, "FK Alpha", "Russia") === lookupTeam(db, "Krasnodar", "Russia"), false, "ambiguïté : pas de fusion");
assert.equal(lookupTeam(db, "FK Alpha", "Russia") === lookupTeam(db, "Sochi", "Russia"), false);
void createTeam;

// --- Contrôle qualité : doublon fusionné / fragment de barrage
import { flagTeams, isStale, median } from "../src/quality.js";
const rowsQ = [..."ABCDEFGHIJKLMNOP"].map((t) => ({ team: t, played: 10 }));
rowsQ[0].played = 20; rowsQ[1].played = 1;
const fl = flagTeams(rowsQ);
assert.equal(fl.get("A"), "duplicate");
assert.equal(fl.get("B"), "fragment");
assert.equal(fl.has("C"), false);
assert.equal(median([1, 3, 2]), 2);
assert.equal(isStale(2, "2026-08-02", new Date("2026-11-19")), true);
assert.equal(isStale(14, "2026-11-10", new Date("2026-11-19")), false);

// --- Fixtures football-data
import { parseFixturesMain } from "../src/sources/footballData.js";
const fixCsv = "Div,Date,Time,HomeTeam,AwayTeam,B365H,B365D,B365A\nE2,22/11/2026,15:00,Wigan,Burton,2.1,3.3,3.5\nXX,22/11/2026,15:00,A,B,1,1,1\n";
const fixtures = parseFixturesMain(fixCsv);
assert.equal(fixtures.length, 1);
assert.equal(fixtures[0].status, "scheduled");
assert.equal(fixtures[0].season, "2026/2027");
console.log("✓ rapprochement sûr + qualité + fixtures OK");

// --- Découverte des ligues ESPN
import { extractSlugs, summarize } from "../src/discover.js";
const slugs = extractSlugs({ items: [
  { $ref: "http://sports.core.api.espn.com/v2/sports/soccer/leagues/sau.1?lang=en&region=us" },
  { $ref: "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1?lang=en&region=us" },
]});
assert.deepEqual(slugs, ["eng.1", "sau.1"]);
const rep = summarize("sau.1", { leagues: [{ name: "Saudi Pro League" }], events: [
  { date: "2026-11-10T17:00Z", status: { type: { state: "post" } } },
  { date: "2026-11-25T17:00Z", status: { type: { state: "pre" } } },
]});
assert.deepEqual([rep.finished, rep.upcoming, rep.lastDate], [1, 1, "2026-11-25"]);
console.log("✓ découverte OK");

// --- Configuration automatique des ligues ESPN
import { buildAutoEntries, mergeAuto, seasonModeFrom } from "../src/discover.js";
const reps = [
  { slug: "sau.1", name: "Saudi Pro League", prefix: "sau", finished: 5, upcoming: 3, lastDate: "2026-11-10", seasonStart: "2026-08-20T00:00Z", seasonEnd: "2027-05-30T00:00Z" },
  { slug: "jpn.1", name: "J1 League", prefix: "jpn", finished: 9, upcoming: 0, lastDate: "2026-11-08", seasonStart: "2026-02-01T00:00Z", seasonEnd: "2026-12-06T00:00Z" },
  { slug: "eng.fa", name: "FA Cup", prefix: "eng", finished: 4, upcoming: 0, lastDate: "2026-11-01" },
  { slug: "uefa.champions", name: "Champions League", prefix: "uefa", finished: 6, upcoming: 0, lastDate: "2026-11-05" },
  { slug: "civ.1", name: "Ligue 1", prefix: "civ", finished: 0, upcoming: 0, lastDate: null },
  { slug: "xyz.1", name: "Inconnue", prefix: "xyz", finished: 2, upcoming: 0, lastDate: "2026-11-02" },
];
const auto = buildAutoEntries(reps);
assert.deepEqual(auto.map((e) => e.slug), ["sau.1", "jpn.1", "xyz.1"], "coupes, internationales et ligues sans match exclues");
assert.equal(auto[0].code, "SAUDI-ARABIA-1");
assert.equal(auto[0].seasonMode, "split");
assert.equal(auto[1].seasonMode, "calendar");
assert.equal(auto[2].country, "XYZ");
assert.equal(seasonModeFrom(undefined, undefined), "split");
const merged = mergeAuto([{ ...auto[0], slug: "old.1", code: "OLD-1" }], auto);
assert.deepEqual(merged.map((e) => e.slug), ["jpn.1", "old.1", "sau.1", "xyz.1"], "une ligue hors saison n'est pas oubliée");
console.log("✓ config automatique OK");
