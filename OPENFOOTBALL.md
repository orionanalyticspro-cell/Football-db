# Football-db

## Sources OpenFootball

Le collecteur OpenFootball couvre notamment les premières divisions vérifiées d'Europe, d'Amérique du Sud et d'Afrique. Le lot africain comprend actuellement le Kenya, le Sénégal, le Nigeria, l'Algérie, l'Égypte, le Maroc, le Ghana et l'Afrique du Sud.

Les fichiers sont lus dans `openfootball/world/africa/{pays}`. Lorsqu'une saison récente n'est pas publiée, le collecteur essaie jusqu'à trois saisons précédentes. Les limites doivent être confirmées par un test réseau avant de considérer la couverture réelle sur toute une saison.

Lancement ciblé : `npm run update -- --source openfootball --only ken.1,sen.1,nga.1,alg.1,egy.1,mar.1,gha.1,rsa.1`.
