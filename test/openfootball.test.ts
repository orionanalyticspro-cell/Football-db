import assert from "node:assert/strict";
import { localToUtcIso } from "../src/normalize.js";
import {
  OPENFOOTBALL_LEAGUES, parseOpenFootballText, openFootballSeasonDir,
  type OpenFootballLeague,
} from "../src/sources/openfootball.js";

const england: OpenFootballLeague = {
  slug: "eng.1", code: "ENGLAND-1", name: "Premier League", country: "England", level: 1,
  repo: "openfootball/england", seasonDir: "2026-27", files: ["1-premierleague.txt"], seasonMode: "split",
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
assert.deepEqual(OPENFOOTBALL_LEAGUES.map((l) => l.slug), ["eng.1", "eng.2", "esp.1", "ger.1", "ita.1", "bel.1", "aut.1", "bra.1"]);
const brazil = OPENFOOTBALL_LEAGUES.find((l) => l.slug === "bra.1")!;
const brazilMatch = parseOpenFootballText(`  Wed Jan 28 2026\n    19:00  CA Mineiro v SE Palmeiras 2-2 (1-1)`, brazil)[0];
assert.equal(brazilMatch.season, "2026");
assert.equal(brazilMatch.competition.code, "BRAZIL-1");
console.log("✓ OpenFootball parser/coverage tests OK");
