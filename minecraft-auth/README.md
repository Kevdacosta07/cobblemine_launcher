# Connexion intégrée au mod Cobblemine

Le code est désormais centralisé dans le dépôt `cobblemine_api`, sous `minecraft/cobblemine/modules/auth`. Le launcher distribue `assets/cobblemine.jar` et migre les anciens modules avec `src/cobblemine-mod.cjs`. Ne plus construire ni distribuer le mod de connexion séparément.
