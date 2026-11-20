import assert from "node:assert/strict";
import { localToUtcIso } from "../src/normalize.js";
import { OPENFOOTBALL_LEAGUES, parseOpenFootballText, openFootballSeasonDir, type OpenFootballLeague } from "../src/sources/openfootball.js";

const england: OpenFootballLeague = { slug: "eng.1", code: "ENGLAND-1", name: "Premier League", country: "England", level: 1, repo: "openfootball/england", seasonDir: "2026-27", files: ["1-premierleague.txt"], seasonMode: "split", timeZone: "Europe/London" };
const sample = `= English Premier League 2026/27\nFri Aug 21 2026\n20:00  Arsenal FC v Coventry City FC 3-0 (2-0)\nSat Aug 22\n15:00  Leeds United FC v Brentford FC`;
const matches = parseOpenFootballText(sample, england);
assert.equal(matches.length, 2);
assert.equal(matches[0].status, "finished");
assert.equal(matches[0].homeGoals, 3);
assert.equal(matches[0].awayGoals, 0);
assert.equal(matches[0].kickoffUtc, localToUtcIso("2026-08-21", "20:00", "Europe/London"));
assert.equal(matches[1].status, "scheduled");
assert.equal(openFootballSeasonDir(new Date("2026-11-19T12:00:00Z")), "26-27");

const newSlugs = ["ken.1", "sen.1", "nga.1", "alg.1", "egy.1", "mar.1", "gha.1", "rsa.1", "tan.1", "uga.1", "zam.1", "rwa.1", "chn.1", "jpn.1"];
assert.deepEqual(newSlugs.map((slug) => OPENFOOTBALL_LEAGUES.find((l) => l.slug === slug)?.slug), newSlugs);

const kenya = OPENFOOTBALL_LEAGUES.find((l) => l.slug === "ken.1")!;
const kenyaMatch = parseOpenFootballText(`Sat Aug 23 2025\nGor Mahia FC v AFC Leopards 1-0 [awarded]`, kenya)[0];
assert.ok(kenyaMatch);
assert.equal(kenyaMatch.competition.country, "Kenya");
assert.equal(kenyaMatch.homeGoals, 1);
assert.equal(kenyaMatch.season, "2025/2026");
assert.equal(kenyaMatch.kickoffUtc, localToUtcIso("2025-08-23", "12:00", "Africa/Nairobi"));

const china = OPENFOOTBALL_LEAGUES.find((l) => l.slug === "chn.1")!;
const chinaMatch = parseOpenFootballText(`Sat Feb 22 2025\n19:35  Chengdu Rongcheng v Wuhan Three Towns 1-0 (0-0)`, china)[0];
assert.ok(chinaMatch);
assert.equal(chinaMatch.season, "2025");
assert.equal(chinaMatch.kickoffUtc, localToUtcIso("2025-02-22", "19:35", "Asia/Shanghai"));

const calendarRollover = parseOpenFootballText(`Wed Dec 31 2025\n20:00  Team A v Team B 1-0\nThu Jan 1\n20:00  Team C v Team D`, china);
assert.equal(calendarRollover[1].season, "2026");
const cancelled = parseOpenFootballText(`Sat Aug 23 2025\nTeam A v Team B [cancelled]`, kenya);
assert.equal(cancelled.length, 0);
console.log("✓ OpenFootball extended coverage/parser tests OK");
