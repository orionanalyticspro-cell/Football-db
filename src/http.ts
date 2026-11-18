// Téléchargement poli : User-Agent explicite, délai entre requêtes, délai maximal, nouvelle tentative.
const UA = process.env.SCRAPER_UA ?? "football-db/0.1 (+contact: remplacez-moi@exemple.com)";
const DELAY_MS = Number(process.env.REQUEST_DELAY_MS ?? 1500);
const TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 20000);
let last = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getText(url: string, tries = 3): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    const wait = last + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "*/*" },
        signal: AbortSignal.timeout(TIMEOUT_MS), // une requête qui « pend » ne bloque plus tout
      });
      // Erreurs « définitives » (page absente, requête invalide) : inutile de réessayer.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw Object.assign(new Error(`HTTP ${res.status} ${url}`), { fatal: true });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if ((e as { fatal?: boolean }).fatal) break;
      if (i < tries - 1) await sleep(2000 * (i + 1));
    }
  }
  throw lastErr;
}

export async function getJson<T = unknown>(url: string, tries = 3): Promise<T> {
  return JSON.parse(await getText(url, tries)) as T;
}
