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
    20:00  Arsenal FC v Coventry City FC 3-0 (2-0)
  Sat Aug 22
    15:00  Leeds United FC v Brentford FC
`;
const matches = parseOpenFootballText(sample, england);
assert.equal(matches.length, 2);
assert.equal(matches[0].status, "finished");
assert.equal(matches[0].homeGoals, 3);
assert.equal(matches[0].awayGoals, 0);
assert.equal(matches[0].kickoffUtc, localToUtcIso("2026-08-21", "20:00", "Europe/London"));
assert.equal(matches[1].status, "scheduled");
assert.equal(openFootballSeasonDir(new Date("2026-11-19T12:00:00Z")), "26-27");

const africanSlugs = ["ken.1", "sen.1", "nga.1", "alg.1", "egy.1", "mar.1", "gha.1", "rsa.1"];
assert.deepEqual(africanSlugs.map((slug) => OPENFOOTBALL_LEAGUES.find((l) => l.slug === slug)?.slug), africanSlugs);

const kenya = OPENFOOTBALL_LEAGUES.find((l) => l.slug === "ken.1")!;
const kenyaMatch = parseOpenFootballText(`Sat Aug 23 2025
19:00  Gor Mahia FC v AFC Leopards 1-0 (1-0)`, kenya)[0];
assert.ok(kenyaMatch, "Kenya sample fixture should parse");
assert.equal(kenyaMatch.competition.country, "Kenya");
assert.equal(kenyaMatch.competition.code, "KENYA-1");
assert.equal(kenyaMatch.homeGoals, 1);
assert.equal(kenyaMatch.season, "2025/2026");

const nigeria = OPENFOOTBALL_LEAGUES.find((l) => l.slug === "nga.1")!;
assert.equal(nigeria.seasonMode, "split");
assert.equal(nigeria.timeZone, "Africa/Lagos");
console.log("✓ OpenFootball African coverage tests OK");
