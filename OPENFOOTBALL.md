# Football-db

## Sources OpenFootball additionnelles

Le collecteur OpenFootball CC0 est intégré à `npm run update` et aux mises à jour régulières. Les ligues actuellement configurées à partir de chemins de saison vérifiés sont : Angleterre D1-D2, Espagne D1, Allemagne D1, Italie D1, Belgique D1, Autriche D1 et Brésil D1.

Lancement ciblé : `npm run update -- --source openfootball --only eng.1,bra.1`. Les calendriers et résultats disponibles dans les fichiers publics sont ingérés; les horaires sont convertis depuis l'heure locale britannique pour les ligues européennes. Le Brésil utilise des fichiers annuels.

Les jeux OpenFootball ne garantissent pas une couverture exhaustive ni des mises à jour en temps réel. Les autres compétitions de la liste restent à auditer et ne sont pas déclarées couvertes par ce collecteur.
