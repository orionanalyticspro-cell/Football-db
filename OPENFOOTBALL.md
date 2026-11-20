# Football-db

## Sources OpenFootball additionnelles

Le collecteur OpenFootball CC0 est intégré au pipeline. La couverture européenne actuelle comprend Angleterre D1-D2, Espagne D1, Allemagne D1, Italie D1, Belgique D1, Autriche D1, France D1, Pays-Bas D1, Portugal D1, Écosse D1 et Suisse D1. Les premières divisions d'Argentine, Colombie, Équateur et Paraguay utilisent les dernières saisons annuelles publiées par OpenFootball; le Brésil Série A est également configuré.

Lancement ciblé : `npm run update -- --source openfootball --only arg.1,col.1,ecu.1,par.1`. Les calendriers et résultats sont lus dans les fichiers publics disponibles, avec conversion des horaires depuis les fuseaux locaux. La disponibilité annuelle varie selon la ligue; certains fichiers sud-américains ne publient pas encore la saison courante et le collecteur utilise alors la dernière saison publiée (jusqu'à trois ans en arrière).

Copa Libertadores et UEFA Champions League restent à part : leurs fichiers sont identifiés, mais leurs règles de score (tirs au but, prolongations, équipe/pays) nécessitent un importeur dédié avant ingestion fiable. Elles ne sont donc pas activées comme couvertes.
