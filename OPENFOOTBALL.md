# Football-db

## Sources OpenFootball

Le collecteur OpenFootball intègre des ligues vérifiées d'Europe, d'Amérique du Sud et d'Afrique. Le catalogue ajouté comprend notamment les premières divisions d'Argentine, du Brésil, de Colombie, d'Équateur et du Paraguay; d'Algérie, d'Égypte, du Ghana, du Kenya, du Maroc, du Nigeria, du Rwanda, du Sénégal, d'Afrique du Sud, de Tanzanie, d'Ouganda et de Zambie; ainsi que les championnats de Chine et du Japon.

Les fichiers sont récupérés depuis les dépôts OpenFootball CC0. Les saisons annuelles ou split tentent jusqu'à trois saisons précédentes lorsqu'un fichier n'est pas publié. Les formats sans horaire sont importés à midi dans le fuseau local du pays; les lignes explicitement annulées, reportées ou abandonnées sont ignorées. Lancer une sélection, par exemple : `npm run update -- --source openfootball --only jpn.1,chn.1,tan.1,uga.1,zam.1,rwa.1`.

La MLS nécessite un traitement spécial des fuseaux horaires par stade. Les ligues à phases/playoffs sont intégrées comme matchs, mais le classement combiné doit être interprété avec prudence.
