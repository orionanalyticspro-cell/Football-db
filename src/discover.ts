// Découvre quelles ligues ESPN renvoient réellement des matchs récents.
//   npm run discover                    -> teste toutes les compétitions « soccer » d'ESPN
//   npm run discover -- --slugs sau.1,civ.1,mar.1 --days 45
// Écrit data/discovered.md (lisible sur GitHub) et data/discovered.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { COUNTRY_BY_PREFIX } from "./countries.js";
import { slug as slugify } from "./normalize.js";
import type { EspnLeague } from "./sources/espn.js";
import { getJson } from "./http.js";

export function extractSlugs(listJson: unknown): string[] {
  const text = JSON.stringify(listJson ?? {});
  const found = new Set<string>();
  for (const m of text.matchAll(/leagues\/([a-z0-9][a-z0-9._-]*)(?:\?|"|\/)/gi)) found.add(m[1]);
  return [...found].sort();
}

interface Scoreboard {
  leagues?: { name?: string; abbreviation?: string; season?: { startDate?: string; endDate?: string } }[];
  events?: { date?: string; status?: { type?: { state?: string } } }[];
}

export interface LeagueReport {
  slug: string; name: string; prefix: string;
  finished: number; upcoming: number; lastDate: string | null;
  seasonStart?: string; seasonEnd?: string;
}

export function summarize(slug: string, sb: Scoreboard): LeagueReport {
  const ev = sb.events ?? [];
  const finished = ev.filter((e) => e.status?.type?.state === "post").length;
  const upcoming = ev.filter((e) => e.status?.type?.state === "pre").length;
  const dates = ev.map((e) => e.date).filter(Boolean).sort() as string[];
  return {
    slug, name: sb.leagues?.[0]?.name ?? "?", prefix: slug.split(".")[0],
    finished, upcoming, lastDate: dates.length ? dates[dates.length - 1].slice(0, 10) : null,
    seasonStart: sb.leagues?.[0]?.season?.startDate, seasonEnd: sb.leagues?.[0]?.season?.endDate,
  };
}

/** Saison à cheval sur 2 années (août→mai) = « split » ; saison dans l'année civile = « calendar ». */
export function seasonModeFrom(start?: string, end?: string): "split" | "calendar" {
  if (!start || !end) return "split";
  return start.slice(0, 4) !== end.slice(0, 4) ? "split" : "calendar";
}

/** Ligues nationales régulières uniquement (xxx.1, xxx.2…) : pas de coupes ni de compétitions internationales. */
const LEAGUE_SLUG = /^([a-z]{3})\.(\d)$/;

export function buildAutoEntries(reports: LeagueReport[]): EspnLeague[] {
  const out: EspnLeague[] = [];
  for (const r of reports) {
    const m = LEAGUE_SLUG.exec(r.slug);
    if (!m || (r.finished === 0 && r.upcoming === 0)) continue;
    const level = Number(m[2]);
    const country = COUNTRY_BY_PREFIX[m[1]] ?? m[1].toUpperCase();
    out.push({
      slug: r.slug,
      code: `${slugify(country)}-${level}`.toUpperCase(),
      name: r.name, country, level,
      seasonMode: seasonModeFrom(r.seasonStart, r.seasonEnd),
      enabled: true,
    });
  }
  return out;
}

/** Fusionne avec la liste précédente : une ligue hors saison aujourd'hui n'est pas oubliée. */
export function mergeAuto(previous: EspnLeague[], fresh: EspnLeague[]): EspnLeague[] {
  const bySlug = new Map(previous.map((e) => [e.slug, e]));
  for (const e of fresh) bySlug.set(e.slug, e);
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

export const AUTO_FILE = "config/sources.auto.json";
function writeAuto(reports: LeagueReport[]) {
  const prev = existsSync(AUTO_FILE) ? (JSON.parse(readFileSync(AUTO_FILE, "utf8")) as { espn: EspnLeague[] }).espn : [];
  const merged = mergeAuto(prev, buildAutoEntries(reports));
  mkdirSync("config", { recursive: true });
  writeFileSync(AUTO_FILE, JSON.stringify({ espn: merged }, null, 1));
  console.log(`${merged.length} ligue(s) dans ${AUTO_FILE} (ajoutées automatiquement aux mises à jour)`);
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const days = Number(arg("days") ?? 30);
  let slugs = arg("slugs")?.split(",").map((s) => s.trim()).filter(Boolean);
  if (!slugs) {
    console.log("Récupération de la liste des compétitions ESPN…");
    slugs = extractSlugs(await getJson("https://sports.core.api.espn.com/v2/sports/soccer/leagues?limit=1000"));
    console.log(`${slugs.length} compétitions à tester (environ ${Math.ceil((slugs.length * 1.5) / 60)} min)`);
  }
  const from = new Date(Date.now() - days * 864e5), to = new Date(Date.now() + 14 * 864e5);
  const reports: LeagueReport[] = [];
  const t0 = Date.now();
  for (const [i, slug] of slugs.entries()) {
    try {
      const sb = await getJson<Scoreboard>(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${ymd(from)}-${ymd(to)}&limit=500`, 1);
      reports.push(summarize(slug, sb));
    } catch {
      reports.push({ slug, name: "(erreur)", prefix: slug.split(".")[0], finished: 0, upcoming: 0, lastDate: null });
    }
    const last = reports[reports.length - 1];
    console.log(`[${i + 1}/${slugs.length}] ${slug} : ${last.finished} terminés, ${last.upcoming} à venir  (${Math.round((Date.now() - t0) / 1000)} s)`);
    if ((i + 1) % 25 === 0) writeReport(reports, days, true); // sauvegarde intermédiaire
  }
  writeReport(reports, days, false);
  writeAuto(reports);
}

function writeReport(reportsIn: LeagueReport[], days: number, partial: boolean) {
  const reports = [...reportsIn].sort((a, b) => b.finished - a.finished);
  const active = reports.filter((r) => r.finished > 0);
  mkdirSync("data", { recursive: true });
  writeFileSync("data/discovered.json", JSON.stringify(reports, null, 1));
  const md = [
    `# Ligues ESPN testées (${new Date().toISOString().slice(0, 10)})${partial ? " — RAPPORT PARTIEL" : ""}`,
    "",
    `Fenêtre : ${days} derniers jours + 14 jours à venir. **${active.length}** compétition(s) avec des résultats sur ${reports.length} testée(s).`,
    "",
    "## Avec résultats récents (utilisables)",
    "| Code ESPN | Nom | Matchs terminés | À venir | Dernier match |",
    "|---|---|---:|---:|---|",
    ...active.map((r) => `| \`${r.slug}\` | ${r.name} | ${r.finished} | ${r.upcoming} | ${r.lastDate ?? ""} |`),
    "",
    "## Sans résultat récent (hors saison, ou non couvert par ESPN)",
    reports.filter((r) => r.finished === 0).map((r) => `\`${r.slug}\``).join(", "),
    "",
  ].join("\n");
  writeFileSync("data/discovered.md", md);
  if (!partial) console.log(`\n${active.length}/${reports.length} compétitions avec résultats. Voir data/discovered.md`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
