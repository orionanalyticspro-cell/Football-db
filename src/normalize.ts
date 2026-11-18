// Normalisation des noms d'équipes et des dates.

const NOISE = new Set([
  "fc", "cf", "afc", "sc", "fk", "sk", "nk", "kf", "ks", "bk", "if", "ik", "ac",
  "club", "cd", "sd", "ud", "fsv", "tsv", "vfl", "vfb", "sv", "bv",
]);

export function normalizeName(raw: string): string {
  const base = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\butd\b/g, "united")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const tokens = base.split(" ").filter(Boolean);
  // On n'enlève les mots « bruit » qu'aux extrémités, jamais si le nom n'a qu'un mot.
  while (tokens.length > 1 && NOISE.has(tokens[0])) tokens.shift();
  while (tokens.length > 1 && NOISE.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}

export function slug(s: string): string {
  return normalizeName(s).replace(/ /g, "-");
}

// Convertit une heure locale d'un fuseau IANA en ISO UTC.
export function localToUtcIso(date: string, time: string, timeZone: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "12:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  // Décalage du fuseau à cet instant : (heure locale vue) - (instant UTC)
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const seen = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  const offset = seen - guess;
  return new Date(guess - offset).toISOString();
}

// 'dd/mm/yyyy' ou 'dd/mm/yy' -> 'yyyy-mm-dd'
export function parseDmy(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s.trim());
  if (!m) return null;
  let y = +m[3];
  if (y < 100) y += y > 70 ? 1900 : 2000;
  return `${y}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
}

export const toInt = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
export const toNum = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
