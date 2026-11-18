# football-db — base de données football gratuite, mise à jour automatiquement

Objectif : compléter vos API pour les championnats peu couverts, **sans abonnement payant**.

```
Sources gratuites ──► collecteurs (src/sources) ──► SQLite (data/football.db)
                                                       │
                       classements recalculés (vues) ◄─┤
                                                       ▼
                         JSON statiques (data/export/*.json) ──► votre application
```

## Démarrage (5 minutes)

```bash
npm install
npm test                                   # vérifie tout le pipeline sur des données de test
npm run update -- --source fd-main --backfill 2425,2526,2627   # historique D1→D5 Angleterre, Écosse, etc.
npm run update -- --source fd-extra --backfill                 # historique 16 ligues « extra » (Pologne, Suisse, Japon...)
npm run update                             # mise à jour courante (à planifier)
npm run export                             # écrit data/export/index.json et <CODE>.json
npm run health                             # signale sources cassées / ligues sans mise à jour
```

## Ce qui est couvert aujourd'hui

| Source | Ligues | Données |
|---|---|---|
| `fd-main` (football-data.co.uk) | Angleterre D1→D5, Écosse D1→D4, Allemagne, Italie, Espagne, France (D1-D2), Pays-Bas, Belgique, Portugal, Turquie, Grèce (D1) | Résultats, stats de match (tirs, corners, cartons), cotes |
| `fd-extra` (football-data.co.uk) | Argentine, Autriche, Brésil, Chine, Danemark, Finlande, Irlande, Japon, Mexique, Norvège, Pologne, Roumanie, Russie, Suède, Suisse, USA (D1) | Résultats, cotes |
| `espn` (endpoint scoreboard) | Les ligues que **vous** listez dans `config/sources.json` | Résultats, calendrier |

Les classements, la forme (5 derniers matchs) et les totaux sont **recalculés** depuis les résultats (`v_standings`, `v_form`).

## Élargir la couverture : méthode en 4 étapes

1. **Découvrir** ce qu'ESPN renvoie réellement : onglet *Actions* → « Découvrir les ligues ESPN disponibles » → *Run workflow*
   (laisser vide pour tout tester, ~6 min). Ouvrez ensuite `data/discovered.md` : la liste des codes qui ont des résultats récents.
   Pour tester seulement quelques ligues : `--slugs sau.1,civ.1,mar.1`.
2. **Activer** les ligues utiles : ajoutez-les dans `config/sources.json` (voir « Ajouter une ligue » ci-dessous).
3. **Rattraper l'historique** : *Actions* → « Mise à jour… » → args `--source espn --days-back 120`.
4. **Pour les ligues que ESPN ne couvre pas** : écrire un collecteur dédié (fédération, site de résultats). C'est la seule étape qui demande du code.

## Ajouter une ligue

- **Via ESPN** : ajoutez une entrée dans `config/sources.json` avec le code ESPN de la ligue (le même que vous utilisez déjà, ex. `sau.1`).
  `seasonMode` : `split` (août→mai, saison « 2026/2027 ») ou `calendar` (année civile, saison « 2026 »).
  Pour qu'une ligue présente chez deux sources ne soit pas dédoublée, utilisez le **même `code`** (format `PAYS-NIVEAU`, ex. `SWITZERLAND-1`).
- **Via un site de fédération / autre site** : créez `src/sources/monsite.ts` qui renvoie une liste de `MatchInput`
  (voir `espn.ts` comme modèle : c'est ~50 lignes), puis branchez-la dans `src/run.ts`.
  Tout le reste (alias d'équipes, dédoublonnage, classement, export) est déjà fait.

## Noms d'équipes

Les noms sont normalisés (accents, FC/SC/AFC...) puis rapprochés de façon prudente (une équipe B, réserve, jeunes ou féminine n'est jamais fusionnée avec l'équipe première).
Pour forcer un nom, éditez `config/aliases.json`. Pour auditer les rapprochements automatiques :

```sql
SELECT a.alias_norm, t.name, a.source FROM team_aliases a JOIN teams t ON t.id = a.team_id WHERE a.source LIKE '%fuzzy';
```

## Les 3 types de mise à jour

| Besoin | Comment |
|---|---|
| **Courante** (résultats, classements) | Automatique toutes les 6 h. Rien à faire. |
| **Rattrapage** (collecte en panne, nouvelle ligue, historique) | *Actions* → *Run workflow* avec par exemple `--source espn --days-back 120` ou `--source fd-extra --backfill`. |
| **Nouvelle saison** | Automatique : les ligues européennes basculent en juillet (code saison calculé). Pour les ligues en année civile, vérifiez `seasonMode: "calendar"`. |

Corrections : un nom d'équipe mal rapproché se règle dans `config/aliases.json`, puis relancez une collecte.

## Mise à jour automatique (gratuite)

`.github/workflows/update.yml` lance la collecte toutes les 6 h sur GitHub Actions, exporte les JSON et les publie dans le dépôt.
Lancement manuel possible (onglet Actions → « Run workflow »), par exemple avec `--source espn --days-back 30` pour rattraper un trou.

## Brancher votre application

Servez `data/export/` en fichiers statiques (GitHub Pages, Cloudflare Pages, Netlify : tous gratuits) et lisez-les avec `fetch` :

```ts
const idx = await (await fetch("https://VOTRE-SITE/export/index.json")).json();
const sw  = await (await fetch("https://VOTRE-SITE/export/SWITZERLAND-1.json")).json();
sw.standings, sw.form, sw.recent, sw.upcoming
```

Logique conseillée : si une compétition figure dans `index.json`, utilisez vos données ; sinon, gardez votre flux actuel.

## À vérifier au premier lancement (réseau non testé ici)

Les parsers sont testés sur des fichiers d'exemple, mais **les téléchargements réels n'ont pas pu être exécutés** dans l'environnement de développement.
Au premier `npm run update`, lancez `npm run health` : une URL ou un format qui a changé apparaît comme « 0 ligne lue » ou « échec ».
Points d'attention : l'endpoint ESPN est non officiel (il peut changer) ; football-data.co.uk indique ses heures en heure du Royaume-Uni (converties en UTC ici).

## Droits d'usage

Chaque source a ses conditions d'utilisation. Mettez un `SCRAPER_UA` identifiable (le workflow le fait), gardez le délai entre requêtes (`REQUEST_DELAY_MS`, 1,5 s par défaut) et vérifiez que votre usage (surtout commercial) est autorisé avant de publier les données.

## Limites à connaître

- Pas de stats détaillées (tirs, xG...) pour D3/D4/amateurs : elles n'existent pas dans les sources gratuites.
- Le départage du classement est : points, différence de buts, buts marqués. Certaines ligues utilisent d'autres règles (confrontations directes...).
- Un championnat avec phases (Apertura/Clausura, play-offs, poules) demandera une adaptation propre à la ligue.
- La base SQLite est versionnée dans le dépôt : correct pour des dizaines de milliers de matchs. Au-delà, passez à une base hébergée gratuite (Turso, Supabase, Neon) : le schéma est standard.
