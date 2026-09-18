# Mises à jour de Cobblemine

Source : https://github.com/Kevdacosta07/cobblemine_launcher/releases

Au démarrage, une fenêtre blanche avec le logo centré recherche les mises à jour avant d’ouvrir le launcher. Une nouvelle version est téléchargée puis installée avec redémarrage automatique. Sans mise à jour, le launcher s’ouvre. En cas d’erreur réseau, l’écran propose de réessayer ou de continuer. Le bouton de vérification manuelle dans les paramètres utilise aussi cet écran ; il est indisponible pendant une partie ou une opération. Les données du joueur restent dans son dossier utilisateur.

Les versions 0.1.2 et antérieures nécessitent une dernière installation manuelle. Utiliser l’installateur NSIS pour recevoir les mises à jour Windows ; win-unpacked sert au développement.

Pour publier une prochaine version Windows : augmenter la version dans package.json et package-lock.json, pousser le code, puis lancer « Publish Windows release » dans GitHub Actions. Ce workflow teste, construit et publie l’installateur, sa blockmap et latest.yml via une version brouillon. Ne pas remplacer les fichiers d’une ancienne version.

Le workflow de construction multiplateforme fournit aussi les métadonnées. macOS nécessite une application signée, avec les cibles DMG et ZIP ; Linux utilise AppImage. Ces plateformes restent à valider sur leur système.

Référence : https://www.electron.build/docs/features/auto-update/
