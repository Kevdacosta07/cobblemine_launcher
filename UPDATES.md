# Mises à jour de Cobblemine

Source : https://github.com/Kevdacosta07/cobblemine_launcher/releases

L’application installée recherche une version stable plus récente à chaque démarrage et la télécharge. Sans interaction, elle redémarre après cinq secondes. Une interaction, une partie ou une opération en cours reporte le redémarrage ; le bouton « Redémarrer » permet de l’appliquer ensuite. Une panne réseau laisse le launcher utilisable. Les données du joueur restent dans son dossier utilisateur.

Les versions 0.1.2 et antérieures nécessitent une dernière installation manuelle. Utiliser l’installateur NSIS pour recevoir les mises à jour Windows ; win-unpacked sert au développement.

Pour publier une prochaine version Windows : augmenter la version dans package.json et package-lock.json, pousser le code, puis lancer « Publish Windows release » dans GitHub Actions. Ce workflow teste, construit et publie l’installateur, sa blockmap et latest.yml via une version brouillon. Ne pas remplacer les fichiers d’une ancienne version.

Le workflow de construction multiplateforme fournit aussi les métadonnées. macOS nécessite une application signée, avec les cibles DMG et ZIP ; Linux utilise AppImage. Ces plateformes restent à valider sur leur système.

Référence : https://www.electron.build/docs/features/auto-update/
