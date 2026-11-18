// Téléchargement poli : User-Agent explicite, délai entre requêtes, nouvelle tentative.
const UA = process.env.SCRAPER_UA ?? "football-db/0.1 (+contact: remplacez-moi@exemple.com)";
const DELAY_MS = Number(process.env.REQUEST_DELAY_MS ?? 1500);
let last = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getText(url: string, tries = 3): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    const wait = last + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" } });
      if (res.status === 404) throw new Error(`404 ${url}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (String(e).startsWith("Error: 404")) break; // inutile de réessayer
      await sleep(2000 * (i + 1));
    }
  }
  throw lastErr;
}

export async function getJson<T = unknown>(url: string): Promise<T> {
  return JSON.parse(await getText(url)) as T;
}
