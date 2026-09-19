# Mises à jour

Source : https://github.com/Kevdacosta07/cobblemine_launcher/releases

Windows NSIS et Linux AppImage vérifient les nouvelles versions au démarrage. L'écran dédié télécharge et installe la mise à jour avant d'ouvrir le launcher. En cas d'erreur réseau, il propose de réessayer ou de continuer. Une partie en cours interdit le redémarrage de mise à jour.

macOS 0.1.15 est une édition de test sans certificat Apple Developer ID : les mises à jour automatiques sont désactivées. Le bouton de vérification ouvre la page des versions pour télécharger le DMG correspondant à Intel ou Apple Silicon. Les installations Linux depuis tar.gz se mettent aussi à jour manuellement.

La publication multiplateforme exige les quatre builds natifs du workflow Build Cobblemine. Publier en une seule version les installateurs, ZIP Mac, AppImage, archive Linux, blockmaps Windows/Linux et métadonnées `latest.yml`, `latest-linux.yml`. Le workflow historique Publish Windows release ne doit pas remplacer cette publication complète.

Pour activer les mises à jour macOS ultérieurement : configurer la signature et la notarisation, retirer l'exclusion macOS dans `src/main.cjs`, publier DMG, ZIP et métadonnées macOS avec les architectures correspondantes, puis vérifier une installation et une mise à jour natives.

Documentation : https://www.electron.build/docs/features/auto-update/
