# Football-db

## Sources OpenFootball additionnelles

Le collecteur OpenFootball CC0 est intégré au pipeline. Il couvre actuellement les premières divisions d'Angleterre, d'Espagne, d'Allemagne, d'Italie, de Belgique, d'Autriche, de France, des Pays-Bas, du Portugal, d'Écosse et de Suisse, plus le Brésil Série A. Les données ne sont ingérées que depuis les fichiers effectivement publiés pour la saison.

Lancement ciblé : `npm run update -- --source openfootball --only fra.1,sui.1`. Les dates/heures sont converties depuis le fuseau local indiqué par la compétition. La collecte ne représente pas un flux temps réel et la disponibilité varie selon la ligue.

Les compétitions nationales non listées et les coupes internationales restent à auditer avant d'être annoncées comme couvertes.
