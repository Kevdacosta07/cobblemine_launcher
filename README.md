# Cobblemine — launcher 0.1.9

Application de bureau avec l’identité blanche, le logo fourni et le décor d’exploration validé.

## Démarrage sous Windows

Ouvrir l’installateur **Cobblemine-Setup-0.1.9-x64.exe**, puis lancer Cobblemine. L’application télécharge elle-même son Java 21 ; Node.js et Java ne sont pas nécessaires pour l’utilisateur final.

1. Créer un compte sur https://cobblemine.com/inscription.
2. Après la vérification des mises à jour, se connecter avec son pseudo ou son email et son mot de passe Cobblemine.
3. Installer le jeu, puis cliquer sur Jouer. Le pseudo et l'UUID Minecraft proviennent exclusivement du compte vérifié par l'API.
4. Cliquer sur son pseudo pour consulter ses points et grades, ouvrir le site ou se déconnecter.

## Connexion Cobblemine

Le processus principal contacte uniquement https://api.cobblemine.com par HTTPS. L'interface ne reçoit jamais le jeton de session. Les mots de passe ne sont pas enregistrés et le champ est vidé après chaque tentative.

La session est conservée dans cobblemine-account.encrypted avec Electron safeStorage. Si aucun stockage chiffré n'est disponible, elle reste en mémoire. À chaque redémarrage et avant chaque lancement du jeu, l'API vérifie la session. Une panne réseau ne permet pas de jouer à partir d'une identité en cache ; un bouton permet de réessayer la session enregistrée. La déconnexion révoque la session sur l'API et efface le fichier local ; en cas de panne, elle demande de réessayer.

La sélection libre d'un pseudo et la connexion Microsoft ne sont plus proposées. Les anciens réglages de profil sont ignorés pour le lancement. Minecraft utilise l'identité offline calculée pour le pseudo canonique ; aucun jeton API n'est passé à Java ou placé dans ses arguments.

Cette version connecte le launcher, pas encore le serveur Minecraft : les mods client/serveur et l'échange protégé des tickets restent à implémenter. Un utilisateur d'un launcher tiers doit être contrôlé par le futur mod serveur ; le launcher seul ne protège pas un serveur offline contre l'usurpation de pseudo.

## Ton futur modpack

Exporter le modpack au format **Modrinth .mrpack**, puis utiliser **Paramètres → Importer un .mrpack**. Minecraft doit être en 1.21.1, avec Fabric ou NeoForge. Les archives ZIP CurseForge ordinaires ne sont pas prises en charge.

Le launcher vérifie les empreintes SHA-512 des fichiers téléchargés. Les éléments réservés au serveur sont ignorés. Les éléments client optionnels sont inclus. Les dossiers overrides et client-overrides sont pris en charge ; les configurations déjà présentes sont conservées. Chaque archive différente dispose de son propre dossier d’instance : les anciennes installations et sauvegardes restent disponibles.

Pour publier un pack distant, fournir `packUrl` (HTTPS) et `packSha512` dans `launcher-config.json`. Le bouton « Mettre à jour le pack » installe cette archive vérifiée. Une nouvelle archive nécessite une mise à jour de cette configuration et une nouvelle construction du launcher. Le launcher recherche aussi ses propres mises à jour au démarrage.

## Ce qui a été vérifié

- Tests automatisés : validation des chemins de fichiers, du format modpack, des réglages, téléchargements corrompus, reprise, annulation et préservation des configurations.
- Installation réelle sous Windows : Java 21, Minecraft 1.21.1, Fabric, Cobblemon et Fabric API.
- Vérification des dépendances déclarées par Cobblemon.
- Construction des arguments de démarrage vers play.cobblemine.com, sans utiliser de faux compte pour démarrer le jeu.
- Démarrage Electron sous Windows : interface et pont de communication chargés, stockage chiffré disponible.
- Connexion réelle à l’API, erreur de mot de passe, restauration après redémarrage, pseudo imposé et déconnexion testés dans Electron. Le compte de test a été supprimé. L’entrée sur le serveur avec les futurs mods reste à vérifier.
- La branche NeoForge est intégrée pour les imports, mais n’a pas été testée avec un vrai pack NeoForge.

## macOS et Linux

Le code est prévu pour Windows x64, macOS Intel/Apple Silicon et Linux x64. La construction macOS nécessite macOS. La création de l’AppImage Linux a été bloquée sur cet ordinateur Windows par la création de liens symboliques ; aucun AppImage ni application macOS validée n’est livré.

Le fichier `.github/workflows/build.yml` prépare la construction sur les trois systèmes avec GitHub Actions. Il est publié dans le dépôt GitHub ; son exécution multiplateforme reste à valider. Les applications macOS et Linux nécessitent encore leur construction et un test sur leurs systèmes.

Les binaires ne sont pas signés avec un certificat d’éditeur. Prévoir la signature Windows et la signature/notarisation macOS avant une diffusion publique.

## Développement

Prérequis : Node.js récent (22.16 ou supérieur ; 24 recommandé pour les constructions) et npm.

```text
npm ci
npm test
npm start
npm run dist:win
npm run dist:mac
npm run dist:linux
```

Les commandes de distribution doivent être exécutées sur le système correspondant. La sortie de construction par défaut est `../../work/desktop-build` ; le workflow GitHub la remplace par `dist`.

Dossiers :
- `src/` : application Electron, authentification, installation et validation.
- `ui/` : interface et images locales.
- `builtin-pack.json` : versions et empreintes figées de la base Cobblemon.
- `launcher-config.json` : adresse, ID Microsoft et éventuel modpack distant.
- `test/` : tests.
- `scripts/resolve-pack.cjs` : outil réservé au mainteneur pour actualiser le pack embarqué.
- `scripts/install-check.cjs` : test d’installation réelle, écrit dans le dossier work du projet initial.

Les dépendances sont verrouillées. Quelques versions de dépendances XMCL sont explicitement fixées pour éviter des paquets publiés incomplets et utiliser une version corrigée du transport HTTP.

Les données du joueur restent dans le dossier utilisateur de Cobblemine, accessible via **Dossier du jeu**. **Journal du launcher** ouvre le journal d’exécution. Les options du prototype web précédent ne sont pas importées automatiquement.

Bibliothèques principales : [Electron](https://www.electronjs.org/docs/latest/tutorial/security), [XMCL](https://github.com/Voxelum/x-minecraft-launcher), [Modrinth](https://docs.modrinth.com/api/operations/getprojectversions/). Le décor a été généré avec l’outil d’images intégré lors du prototype ; le logo est celui fourni par le propriétaire du projet.


## Jouer sans compte Microsoft
Dans Paramètres → Ton profil, choisir « Sans compte Microsoft », saisir un pseudo puis enregistrer. Le pseudo détermine une identité locale stable ; le modifier change cette identité et peut donner un inventaire différent sur le serveur. La connexion Microsoft reste disponible.

Ce mode fonctionne en solo et sur un serveur configuré pour accepter les profils non authentifiés. Il ne permet pas de rejoindre un serveur qui exige une session Microsoft valide. La configuration actuelle de play.cobblemine.com n’a pas été vérifiée. Les téléchargements du jeu nécessitent Internet.

## Mises à jour au démarrage

Voir [UPDATES.md](UPDATES.md). La version 0.1.9 est publiée sur GitHub avec son installateur Windows et ses métadonnées. Les 21 tests passent et le démarrage du binaire a été vérifié. Un essai utilisant electron-updater a détecté puis téléchargé et vérifié la version publiée depuis GitHub, sans exécuter l’installateur. Le remplacement complet d’une installation existante reste à vérifier sur une future mise à jour.

Correctif 0.1.4 : isolation du transport Undici 6 utilisé par XMCL pour éviter le dispatcher global incompatible d’Electron. Reproduction de l’erreur initiale dans Electron, puis téléchargement réel et vérification SHA-1 des métadonnées et du client Minecraft avec le code empaqueté corrigé.

Version 0.1.9 : écran de démarrage dédié avec logo centré, recherche et installation avant ouverture du launcher. 22 tests passent ; transition entre écran de démarrage et interface vérifiée dans le binaire Windows.
