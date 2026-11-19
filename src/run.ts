// Point d'entrée des mises à jour.
//   npm run update                       -> mise à jour courante de toutes les sources
//   npm run update -- --source fd-main --backfill 2223,2324,2425,2526,2627
//   npm run update -- --source fd-extra --backfill
//   npm run update -- --source espn --days-back 3 --days-forward 10
import { existsSync, readFileSync, rmSync } from "node:fs";
import { loadAliases, logRun, openDb, upsertMatch, type Db, type MatchInput } from "./db.js";
import {
  EXTRA_FILES, MAIN_DIVISIONS, SOURCE_EXTRA, SOURCE_MAIN, fetchExtraFile, fetchExtraFixtures, fetchExtraLatest,
  fetchFixturesMain, fetchMain, seasonCodeFor,
} from "./sources/footballData.js";
import { SOURCE_ESPN, fetchEspn, type EspnLeague } from "./sources/espn.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : "true";
}

export function ingest(db: Db, matches: MatchInput[]): number {
  let n = 0;
  db.transaction(() => { for (const m of matches) { upsertMatch(db, m); n++; } })();
  return n;
}

async function step(db: Db, source: string, target: string, job: () => Promise<MatchInput[]>) {
  const startedAt = new Date().toISOString();
  try {
    const rows = await job();
    const upserted = ingest(db, rows);
    logRun(db, { source, target, startedAt, read: rows.length, upserted, ok: true });
    console.log(`✓ ${source} ${target}: ${rows.length} lignes`);
  } catch (e) {
    // Une source en panne ne doit jamais bloquer les autres.
    logRun(db, { source, target, startedAt, read: 0, upserted: 0, ok: false, error: String(e) });
    console.warn(`✗ ${source} ${target}: ${e}`);
  }
}

/** Ligues ESPN = découvertes automatiquement (sources.auto.json) + choix manuels (sources.json, prioritaires). */
export function loadEspnLeagues(): EspnLeague[] {
  const read = (f: string): EspnLeague[] => (existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as { espn: EspnLeague[] }).espn : []);
  const bySlug = new Map<string, EspnLeague>();
  for (const l of read("config/sources.auto.json")) bySlug.set(l.slug, l);
  for (const l of read("config/sources.json")) bySlug.set(l.slug, l); // le manuel gagne (et peut désactiver avec enabled:false)
  return [...bySlug.values()];
}

async function main() {
  // --reset : repart d'une base vide (utile après une correction du rapprochement des équipes).
  if (arg("reset")) {
    const f = process.env.FOOTBALL_DB ?? "data/football.db";
    for (const suffix of ["", "-wal", "-shm"]) rmSync(f + suffix, { force: true });
    console.log(`Base ${f} supprimée : reconstruction complète.`);
  }
  const db = openDb();
  loadAliases(db);
  const source = arg("source") ?? "all";
  const backfill = arg("backfill");
  const only = arg("only")?.split(",");

  if (source === "all" || source === SOURCE_MAIN) {
    const seasons = backfill && backfill !== "true" ? backfill.split(",") : [seasonCodeFor()];
    for (const div of MAIN_DIVISIONS.filter((d) => !only || only.includes(d.div))) {
      for (const s of seasons) await step(db, SOURCE_MAIN, `${div.div}/${s}`, () => fetchMain(div, s));
    }
    if (!only) await step(db, SOURCE_MAIN, "fixtures", fetchFixturesMain);
  }

  if (source === "all" || source === SOURCE_EXTRA) {
    if (backfill) {
      for (const code of EXTRA_FILES.filter((c) => !only || only.includes(c)))
        await step(db, SOURCE_EXTRA, code, () => fetchExtraFile(code));
    } else {
      await step(db, SOURCE_EXTRA, "Latest_Results", fetchExtraLatest);
      await step(db, SOURCE_EXTRA, "fixtures", fetchExtraFixtures);
    }
  }

  if (source === "all" || source === SOURCE_ESPN) {
    const cfg = { espn: loadEspnLeagues() };
    const back = Number(arg("days-back") ?? 3), fwd = Number(arg("days-forward") ?? 10);
    const from = new Date(Date.now() - back * 864e5), to = new Date(Date.now() + fwd * 864e5);
    for (const lg of cfg.espn.filter((l) => l.enabled !== false && (!only || only.includes(l.slug))))
      await step(db, SOURCE_ESPN, lg.slug, () => fetchEspn(lg, from, to));
  }
  // Un match resté « à venir » depuis plus de 7 jours sans score a été reporté/déplacé : on le retire.
  const purged = db.prepare(
    `DELETE FROM matches WHERE status = 'scheduled' AND home_goals IS NULL AND match_date < date('now', '-7 days')`
  ).run().changes;
  if (purged) console.log(`${purged} match(s) à venir périmé(s) retiré(s)`);
  db.close();
}

// Ne lance main() que si le fichier est exécuté directement (pas importé par les tests).
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
