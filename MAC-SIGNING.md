# Signature macOS

Le workflow manuel **Build signed Mac** produit les versions Intel et Apple Silicon signées avec Developer ID Application, puis notariées par Apple. Il vérifie la signature, le Team ID, le ticket de notarisation, Gatekeeper et le démarrage natif du launcher avec Java 21. Il échoue si un secret manque ou une vérification échoue. Aucun fichier n'est publié automatiquement.

Configurer uniquement dans les secrets GitHub Actions du dépôt :

- `CSC_LINK` : contenu du fichier P12 encodé en base64.
- `CSC_KEY_PASSWORD` : mot de passe d'export du P12.
- `APPLE_APP_SPECIFIC_PASSWORD` : mot de passe d'application créé sur account.apple.com pour la notarisation. Ce n'est pas le mot de passe de connexion Apple.

Ne jamais mettre ces valeurs dans Git, les arguments d'une commande ou un message. Le P12 contient la clé privée et doit rester confidentiel même chiffré. Les secrets sont accessibles au workflow de ce dépôt ; réserver son écriture aux personnes de confiance.

L'identité publique configurée est l'équipe `4UFSUXXTCL`, avec le compte Apple `kevin.mntrc@gmail.com`. Adapter ces deux paramètres ensemble si le titulaire change.

La version 0.1.15 déjà publiée reste une édition Mac de test non signée. Pour distribuer une version signée, incrémenter d'abord la version, lancer les builds, vérifier les artifacts puis créer une nouvelle release sans remplacer les fichiers existants. Les mises à jour Mac restent manuelles tant que leur réactivation et les métadonnées communes Intel/ARM ne sont pas validées.
