# Cobblemine — launcher 0.1.3

Application de bureau avec l’identité blanche, le logo fourni et le décor d’exploration validé.

## Démarrage sous Windows

Ouvrir l’installateur **Cobblemine-Setup-0.1.3-x64.exe**, puis lancer Cobblemine. L’application télécharge elle-même son Java 21 ; Node.js et Java ne sont pas nécessaires pour l’utilisateur final.

1. Cliquer sur **Installer** pour télécharger Minecraft 1.21.1 et la base Cobblemon.
2. Choisir un profil local dans Paramètres, ou configurer Microsoft (voir ci-dessous).
3. En mode Microsoft, cliquer sur le bouton du compte et terminer la connexion dans le navigateur.
4. Cliquer sur **Jouer**. Avec l’option « Rejoindre automatiquement », le jeu rejoint **play.cobblemine.com**.

La base fournie est figée : Cobblemon **1.8.1**, Fabric **0.19.5**, Fabric API **0.116.17+1.21.1**. Le serveur doit utiliser un ensemble compatible. Ce n’est pas encore un modpack spécifique au serveur.

## Configuration Microsoft (uniquement pour le mode Microsoft)

Le code de connexion est implémenté, mais aucun identifiant d’application appartenant à Cobblemine n’a été fourni. La connexion et une vraie partie avec compte Microsoft n’ont donc pas été validées de bout en bout. Il ne suffit pas de renseigner un identifiant quelconque.

Pour le propriétaire du projet :
- Enregistrer une application Microsoft Entra acceptant les comptes Microsoft personnels et autorisant les flux clients publics.
- Utiliser son **Application (client) ID**, qui est public. Ne pas créer ni envoyer de secret client ou de mot de passe.
- Vérifier que cette application est autorisée à accéder aux services Xbox/Minecraft. Si Microsoft renvoie « Invalid app registration » ou un refus 403, l’enregistrement doit être autorisé côté Microsoft/Mojang ; un changement d’interface ne peut pas résoudre ce refus.
- Dans le launcher, ouvrir **Paramètres → Connexion Microsoft · configuration du projet**, saisir cet ID et enregistrer.
- Pour distribuer le launcher aux joueurs sans cette étape manuelle, renseigner cet ID dans `launcher-config.json`, puis reconstruire les applications.

Le parcours utilise le protocole [Microsoft Device Code](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code). Les mots de passe restent sur les pages Microsoft. Les jetons sont chiffrés par le système avec Electron safeStorage ; si un stockage chiffré n’est pas disponible sur Linux, ils restent uniquement en mémoire pour la session.

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
- Les tests réels de connexion Microsoft, d’entrée en jeu et de connexion au serveur restent à effectuer avec l’application Microsoft autorisée et le compte du joueur.
- La branche NeoForge est intégrée pour les imports, mais n’a pas été testée avec un vrai pack NeoForge.

## macOS et Linux

Le code est prévu pour Windows x64, macOS Intel/Apple Silicon et Linux x64. La construction macOS nécessite macOS. La création de l’AppImage Linux a été bloquée sur cet ordinateur Windows par la création de liens symboliques ; aucun AppImage ni application macOS validée n’est livré.

Le fichier `.github/workflows/build.yml` prépare la construction sur les trois systèmes avec GitHub Actions. Il n’a pas été exécuté ni publié dans un dépôt. Les applications macOS et Linux nécessitent encore leur construction et un test sur leurs systèmes.

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
