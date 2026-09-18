# Connexion Cobblemine — Fabric 1.21.1

Le serveur exige une session Cobblemine et un ticket API à usage unique avant la fin du login Minecraft. Le contrôle s'applique également aux opérateurs. Le pseudo et l'UUID sont vérifiés côté serveur, avec la casse enregistrée sur le site.

## Installation

- Serveur : placer le JAR dans `mods` avec Fabric API. Configurer `.private/api.json` avec `apiUrl`, `serverId` et `serverKey`. Ne jamais distribuer ce fichier. Une configuration absente empêche le démarrage.
- Client : le launcher 0.1.12 installe automatiquement `assets/cobblemine-auth.jar` dans chaque instance Fabric avant de lancer Java.
- Le launcher reste ouvert pendant le jeu. Il fournit à son processus Java un accès temporaire à un service local lié à `127.0.0.1`, avec un secret aléatoire en mémoire. Le mot de passe et la session API ne sont jamais transmis au mod.
- Les couples serveur/adresses autorisés sont définis dans `launcher-config.json` (`authServers`). Actuellement : `local-test`, `127.0.0.1:25565` et `localhost:25565`. Ajouter explicitement l'identifiant et l'adresse du serveur de production lors de son déploiement.

## Protocole

1. Le serveur interroge le canal de login `cobblemine:login` : version 1, identifiant du serveur, clé publique RSA.
2. Le mod client demande un ticket frais au launcher pour l'adresse réellement sélectionnée dans Minecraft. Le launcher valide sa session en HTTPS et appelle `/v1/join-tickets`.
3. Le client chiffre le ticket avec RSA-OAEP SHA-256 et le transmet au serveur. Le serveur le consomme en HTTPS avec sa propre clé. Durée du ticket : 60 secondes, usage unique, lié au compte, à sa session et au serveur.
4. Le serveur conserve le bail de connexion et le renouvelle toutes les 30 secondes. Révocation : exclusion. Panne API prolongée : exclusion avant expiration du bail. Déconnexion : libération du bail ; s'il est impossible de joindre l'API, il expire après 90 secondes au maximum.
5. Chaque reconnexion demande un nouveau ticket, sans redémarrer Minecraft.

Réponse client : octet 0 + tableau d'octets chiffrés ; 1 = launcher requis, 2 = reconnexion nécessaire, 3 = service indisponible. Toutes ces erreurs refusent l'accès. Un client sans mod reçoit le message d'inscription / launcher obligatoire.

## Portée de la protection

Cette intégration bloque les clients ordinaires lancés sans la session du launcher, les pseudos usurpés et le rejeu des tickets. Elle authentifie un compte et son autorisation d'accès, pas l'intégrité d'un programme exécuté sur le PC du joueur : un client volontairement modifié disposant de ses propres identifiants peut reproduire un protocole public. Aucun secret serveur n'est embarqué dans le launcher.

Le chiffrement du ticket protège contre l'écoute passive du transport Minecraft offline ; il ne remplace pas une identité serveur certifiée contre un intermédiaire actif. Le serveur de test reste lié à `127.0.0.1`. Avant une ouverture publique, prévoir un transport authentifié ou un épinglage de la clé serveur.

## Construire et vérifier

Java 21, `gradlew.bat build`. Sources Gradle/Loom, Minecraft 1.21.1 et Fabric API identiques au serveur de test. Les tests du launcher vérifient le service local, les destinations autorisées et les refus. Le test d'intégration de travail vérifie le protocole contre le serveur Minecraft et l'API réels avec un compte QA ensuite supprimé.
