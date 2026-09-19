# Cobblemine Launcher

Launcher Electron pour Minecraft 1.21.1, Fabric et Cobblemon 1.8.1. Connexion avec le compte créé sur https://cobblemine.com/inscription ; le pseudo et l'UUID sont imposés par l'API centrale. Le mod client embarqué échange les tickets à usage unique avec le serveur via un pont local protégé. Aucun jeton API n'est transmis à Java.

## Plateformes de la version 0.1.15

- Windows x64 : installateur NSIS, mises à jour automatiques.
- macOS Intel (x64) et Apple Silicon (arm64) : DMG distincts et archives ZIP. Cette édition de test n'est pas signée avec un certificat Developer ID ni notariée ; Gatekeeper peut en bloquer l'ouverture. Ne pas désactiver globalement les protections macOS. Installer les versions suivantes manuellement ; le bouton de mise à jour ouvre les téléchargements GitHub. Une signature Apple et une notarisation sont nécessaires pour une distribution Mac transparente et les mises à jour automatiques.
- Linux x64 : AppImage (nécessite un environnement de bureau et FUSE 2), plus archive tar.gz en alternative. Autoriser l'exécution du fichier dans ses propriétés. Les mises à jour automatiques sont disponibles avec l'AppImage ; l'archive se remplace manuellement. Linux ARM n'est pas encore distribué.

Java 21 est téléchargé et vérifié pour le système et l'architecture de l'application. Les versions Mac utilisent leur Java natif Intel ou ARM. Les données restent dans le dossier utilisateur Electron `Cobblemine` et sont accessibles depuis les paramètres.

Le serveur public reste en préparation. L'autorisation du serveur dans `launcher-config.json` doit correspondre au serveur inscrit dans l'API. Le serveur de test configuré par défaut est local ; il ne devient pas accessible publiquement en publiant le launcher.

## Connexion et confidentialité

Le processus principal contacte l'API en HTTPS. Aucun mot de passe n'est conservé. Les sessions sont chiffrées avec Electron safeStorage ; en l'absence de stockage sécurisé, notamment Linux `basic_text`, elles restent en mémoire. La session est revalidée au redémarrage et avant le lancement. Les clés techniques du serveur ne doivent jamais être embarquées.

## Développement

Node.js 24 et npm : `npm ci`, `npm test`, `npm start`.

Distribution sur le système cible : `npm run dist:win`, `npm run dist:mac`, `npm run dist:linux`. Les versions et dépendances sont verrouillées. Les paquets `.mrpack` peuvent être importés depuis les paramètres ; le pack doit cibler Fabric 1.21.1 pour l'authentification Cobblemine.

## Construction et validation

Le workflow manuel **Build Cobblemine** construit quatre architectures sur des runners natifs : Windows x64, macOS Intel, macOS ARM et Linux x64. Il exécute les tests, lance Java 21 téléchargé puis démarre le launcher empaqueté pour vérifier ses fenêtres, son preload et son interface. Les archives et rapports `platform-check.json` sont conservés comme artifacts. Cela ne remplace pas un test complet en jeu sur chaque système.

Le drapeau Chromium `--no-sandbox` utilisé pour le smoke test Linux concerne exclusivement le runner CI isolé. Il n'est ni enregistré dans le launcher ni proposé aux utilisateurs.

Publier tous les fichiers d'une nouvelle version depuis ces artifacts après validation. Conserver `latest.yml` et `latest-linux.yml`, ainsi que les blockmaps associées. Les fichiers macOS sont installés manuellement tant que la signature Apple n'est pas configurée. Ne pas écraser les fichiers d'une version publiée.
