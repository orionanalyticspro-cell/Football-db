
// --- Source OpenFootball CC0 ---
import { parseOpenFootballText, openFootballSeasonDir, type OpenFootballLeague } from "../src/sources/openfootball.js";
const openLg: OpenFootballLeague = { slug: "eng.1", code: "ENGLAND-1", name: "Premier League", country: "England", level: 1, repo: "openfootball/england", seasonDir: "2026-27", files: ["1-premierleague.txt"], seasonMode: "split" };
const openText = `= English Premier League 2026/27
  Fri Aug 21 2026
    20:00  Arsenal FC              v Coventry City FC         3-0 (2-0)
  Sat Aug 22
    15:00  Leeds United FC         v Brentford FC
`;
const openMatches = parseOpenFootballText(openText, openLg);
assert.equal(openMatches.length, 2);
assert.equal(openMatches[0].status, "finished");
assert.equal(openMatches[0].homeGoals, 3);
assert.equal(openMatches[0].awayGoals, 0);
assert.equal(openMatches[0].kickoffUtc, "2026-08-21T19:00:00.000Z");
assert.equal(openMatches[1].status, "scheduled");
assert.equal(openMatches[1].homeGoals, null);
assert.equal(openFootballSeasonDir(new Date("2026-11-19T12:00:00Z"), "split"), "26-27");
console.log("✓ source OpenFootball CC0 OK");
