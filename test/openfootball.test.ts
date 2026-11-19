import assert from "node:assert/strict";
import { localToUtcIso } from "../src/normalize.js";
import {
  OPENFOOTBALL_LEAGUES, parseOpenFootballText, openFootballSeasonDir,
  type OpenFootballLeague,
} from "../src/sources/openfootball.js";

const england: OpenFootballLeague = {
  slug: "eng.1", code: "ENGLAND-1", name: "Premier League", country: "England", level: 1,
  repo: "openfootball/england", seasonDir: "2026-27", files: ["1-premierleague.txt"], seasonMode: "split", timeZone: "Europe/London",
};
const sample = `= English Premier League 2026/27
  Fri Aug 21 2026
    20:00  Arsenal FC              v Coventry City FC         3-0 (2-0)
  Sat Aug 22
    15:00  Leeds United FC         v Brentford FC
`;
const matches = parseOpenFootballText(sample, england);
assert.equal(matches.length, 2);
assert.equal(matches[0].status, "finished");
assert.equal(matches[0].homeGoals, 3);
assert.equal(matches[0].awayGoals, 0);
assert.equal(matches[0].kickoffUtc, localToUtcIso("2026-08-21", "20:00", "Europe/London"));
assert.equal(matches[1].status, "scheduled");
assert.equal(matches[1].homeGoals, null);
assert.equal(openFootballSeasonDir(new Date("2026-11-19T12:00:00Z")), "26-27");
assert.equal(openFootballSeasonDir(new Date("2026-03-01T12:00:00Z")), "25-26");
assert.deepEqual(OPENFOOTBALL_LEAGUES.map((l) => l.slug), ["eng.1", "eng.2", "esp.1", "ger.1", "ita.1", "bel.1", "aut.1", "fra.1", "ned.1", "por.1", "sco.1", "sui.1", "bra.1"]);
const brazil = OPENFOOTBALL_LEAGUES.find((l) => l.slug === "bra.1")!;
const brazilMatch = parseOpenFootballText(`Wed Jan 28 2026\n19:00  CA Mineiro v SE Palmeiras 2-2 (1-1)`, brazil)[0];
assert.equal(brazilMatch.season, "2026");
assert.equal(brazilMatch.competition.code, "BRAZIL-1");

const swiss = OPENFOOTBALL_LEAGUES.find((l) => l.slug === "sui.1")!;
const swissMatches = parseOpenFootballText(`Sat Jul 25 2026\n18:00   Servette FC  0-1 (0-0)  FC Basel\n18:30   FC Luzern  v   FC Thun`, swiss);
assert.equal(swissMatches.length, 2);
assert.equal(swissMatches[0].homeName, "Servette FC");
assert.equal(swissMatches[0].awayName, "FC Basel");
assert.deepEqual([swissMatches[0].homeGoals, swissMatches[0].awayGoals], [0, 1]);
assert.equal(swissMatches[0].kickoffUtc, localToUtcIso("2026-07-25", "18:00", "Europe/Zurich"));
assert.equal(swissMatches[1].status, "scheduled");
console.log("✓ OpenFootball parser/coverage tests OK");
