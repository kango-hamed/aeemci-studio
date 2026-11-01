# 10 · Installer et déployer AEEMCI Studio

Date : 30/10/2026, **révisé le 01/11/2026** : hébergement sur **Azure Container Apps** (Azure for Students) au lieu de Google Cloud Run, qui demandait un prépaiement de 30 $. Application Next.js, base Neon, fichiers sur Cloudflare R2, image Docker publiée sur GitHub. Aucune carte bancaire n'est demandée par Azure for Students ; le crédit annuel couvre largement l'usage d'une section.

## Ce qu'il faut

- Node.js 22 (version notée dans `.nvmrc`) et Git.
- Un compte **Neon** (base Postgres, gratuit).
- Un compte **Cloudflare** avec un seau R2 (gratuit ; une carte peut être demandée pour activer R2).
- Un abonnement **Azure for Students** : https://azure.microsoft.com/free/students, avec l'adresse étudiante de l'ESATIC. 100 $ de crédit valables un an, renouvelables chaque année tant que le titulaire est étudiant, sans carte.
- Le dépôt GitHub privé `kango-hamed/aeemci-studio` : l'intégration continue y construit l'image et la publie.

Rien à installer pour Azure : les commandes passent par **Cloud Shell**, le terminal du portail Azure (bouton `>_` en haut de https://portal.azure.com, choisir **Bash**, puis « Pas de compte de stockage » / session éphémère).

## 1. Lancer l'application sur ton ordinateur

```bash
npm install
npx playwright install chromium          # pour le moteur de rendu et ses tests
cp apps/web/.env.exemple apps/web/.env   # puis remplir DATABASE_URL, BETTER_AUTH_SECRET
npm run db:migrer -w @aeemci-studio/web
npm run admin:creer -w @aeemci-studio/web -- --email prenom.nom@esatic.edu.ci --nom "Prénom Nom" --role president --mandat 2025-2026
npm run dev                               # http://localhost:3000
```

En local, les fichiers (gabarits importés, photos, documents) vont dans `apps/web/.stockage` : rien à configurer.

`DATABASE_URL` peut pointer vers une base Neon de développement (une **branche** `dev` du projet Neon, gratuite) ou vers un Postgres local.

Tests : `npm test`. Les tests d'authentification ont besoin d'une base jetable dans `TEST_DATABASE_URL` (elle est vidée à chaque lancement) ; sans elle, ils sont sautés.

## 2. Créer la base Neon

1. https://console.neon.tech → **New project**, nom `aeemci-studio`, Postgres 16 ou plus, région **Europe (Frankfurt)**.
2. **Connect** → cocher **Connection pooling** → copier la chaîne (`postgresql://…-pooler…/neondb?sslmode=require`). C'est la `DATABASE_URL` de production.
3. Depuis ton ordinateur, appliquer les migrations et créer ton compte sur cette base. Sous Windows, dans PowerShell, à la racine du dépôt :

```powershell
$env:DATABASE_URL = "postgresql://…-pooler…/neondb?sslmode=require"
npm run db:migrer -w @aeemci-studio/web
npm run admin:creer -w @aeemci-studio/web -- --email prenom.nom@esatic.edu.ci --nom "Prénom Nom" --role president --mandat 2025-2026
Remove-Item Env:DATABASE_URL
```

À refaire (`db:migrer` seulement) **avant** de déployer une version qui ajoute une migration dans `apps/web/drizzle/`.

## 3. Le stockage R2

Le disque du conteneur est effacé à chaque redémarrage : les fichiers doivent vivre ailleurs.

1. https://dash.cloudflare.com → **R2 Object Storage** → **Create bucket** (par exemple `aeemci-studio`), emplacement automatique. Le seau reste **privé** : l'application lit les fichiers et vérifie les droits avant de les servir.
2. R2 → **Manage R2 API Tokens** → **Create API token** : permission **Object Read & Write**, limitée à ce seau. Noter l'**Access Key ID** (`R2_CLE`) et le **Secret Access Key** (`R2_SECRET`), affichés une seule fois.
3. L'identifiant du compte (`R2_COMPTE`) figure dans l'adresse du tableau de bord et sur la page R2 (« Account ID »). Le nom du seau est `R2_SEAU`.

## 4. L'image sur GitHub

À chaque envoi sur `main`, l'intégration continue (`.github/workflows/ci.yml`) vérifie le code puis publie l'image sur `ghcr.io/kango-hamed/aeemci-studio` (étiquettes `latest` et numéro du commit). Le paquet reste **privé**, comme le dépôt.

1. Onglet **Actions** du dépôt : les deux jobs (« Lint, types, tests, build » et « Image Docker ») doivent être verts. Le paquet apparaît alors dans **Packages** sur la page du compte GitHub.
2. Créer le jeton qui permettra à Azure de tirer l'image : GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**, nom `azure-aeemci`, expiration **No expiration** (ou un an, à renouveler), **une seule case : `read:packages`**. Noter le jeton (`ghp_…`).

## 5. Déployer sur Azure

Dans Cloud Shell (Bash). Une fois :

```bash
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait
az group create --name aeemci-studio --location francecentral
az containerapp env create --name aeemci-env --resource-group aeemci-studio --location francecentral
```

Si Azure refuse la région (`RequestDisallowedByAzure` : l'abonnement étudiant limite les régions), reprendre ces deux dernières commandes avec `westeurope`, `northeurope` ou `germanywestcentral` (le message d'erreur liste les régions permises).

Puis saisir les secrets **sans qu'ils restent dans l'historique** (chaque `read` attend une valeur collée puis Entrée, rien ne s'affiche) :

```bash
read -rsp "Chaîne Neon pooled : " DB; echo
read -rsp "Access Key ID R2 : " R2CLE; echo
read -rsp "Secret Access Key R2 : " R2SECRET; echo
read -rsp "Jeton GitHub read:packages : " GHCR; echo
AUTH=$(openssl rand -base64 32 | tr -d '\n')
```

Créer l'application (remplacer `<COMPTE>` par l'identifiant du compte Cloudflare et `<SEAU>` par le nom du seau) :

```bash
az containerapp create --name aeemci-studio --resource-group aeemci-studio --environment aeemci-env \
  --image ghcr.io/kango-hamed/aeemci-studio:latest \
  --registry-server ghcr.io --registry-username kango-hamed --registry-password "$GHCR" \
  --ingress external --target-port 8080 \
  --cpu 1 --memory 2Gi --min-replicas 0 --max-replicas 2 \
  --scale-rule-name http --scale-rule-type http --scale-rule-http-concurrency 20 \
  --secrets database-url="$DB" auth-secret="$AUTH" r2-cle="$R2CLE" r2-secret="$R2SECRET" \
  --env-vars DATABASE_URL=secretref:database-url BETTER_AUTH_SECRET=secretref:auth-secret \
    R2_CLE=secretref:r2-cle R2_SECRET=secretref:r2-secret STOCKAGE=r2 R2_COMPTE=<COMPTE> R2_SEAU=<SEAU>
```

Donner son adresse à l'application, une fois :

```bash
ADRESSE=https://$(az containerapp show --name aeemci-studio --resource-group aeemci-studio --query properties.configuration.ingress.fqdn -o tsv)
az containerapp update --name aeemci-studio --resource-group aeemci-studio --set-env-vars BETTER_AUTH_URL=$ADRESSE
echo $ADRESSE
```

Vérifier : `https://…azurecontainerapps.io/api/sante` doit répondre `"etat":"ok"` et `"stockage":"r2"` (la première visite attend le démarrage, jusqu'à une minute), puis se connecter avec le compte créé à l'étape 2. En cas d'erreur, les journaux :

```bash
az containerapp logs show --name aeemci-studio --resource-group aeemci-studio --follow
```

**Publier une nouvelle version** : envoyer sur `main`, attendre que l'intégration continue soit verte (migration éventuelle d'abord, section 2), puis dans Cloud Shell :

```bash
az containerapp update --name aeemci-studio --resource-group aeemci-studio --image ghcr.io/kango-hamed/aeemci-studio:latest --revision-suffix v$(date +%Y%m%d%H%M)
```

Le suffixe force une nouvelle révision, qui retire l'image `latest`. Pour revenir en arrière : même commande avec `:<numéro du commit>` à la place de `:latest`.

## 6. Publier le premier gabarit

1. Dans Photoshop, marquer les calques avec le plugin DesignHub puis générer le dossier (doc 07).
2. Dans AEEMCI Studio, compte administrateur ou designer : **Créer** → **Gérer les gabarits** → **Importer un dossier** → choisir ce dossier. Le PSD et les exports ne sont pas envoyés ; le dossier envoyé doit faire 30 Mo au plus.

## 7. Notifications (facultatif)

Sans cette étape, la plateforme marche sans notifications (l'écran Notifications l'indique).

1. Générer la paire de clés, une fois, sur ton ordinateur (ne plus la changer : les téléphones abonnés seraient perdus) : `npx web-push generate-vapid-keys`.
2. Dans Cloud Shell :

```bash
read -rsp "Clé privée VAPID : " VAPID; echo
RAPPELS=$(openssl rand -base64 32 | tr -d '\n'); echo "Secret des rappels : $RAPPELS"
az containerapp secret set --name aeemci-studio --resource-group aeemci-studio --secrets vapid-privee="$VAPID" rappels-secret="$RAPPELS"
az containerapp update --name aeemci-studio --resource-group aeemci-studio \
  --set-env-vars VAPID_PRIVEE=secretref:vapid-privee RAPPELS_SECRET=secretref:rappels-secret \
    VAPID_PUBLIQUE=<clé publique> VAPID_CONTACT=mailto:<adresse du bureau>
```

3. Rappel de la veille des activités, chaque jour à 18 h (Abidjan) : la tâche `.github/workflows/rappels.yml` du dépôt. GitHub → dépôt → **Settings** → **Secrets and variables** → **Actions** :
   - onglet **Secrets** : `RAPPELS_SECRET` = le secret des rappels affiché ci-dessus ;
   - onglet **Variables** : `ADRESSE_APPLICATION` = l'adresse de l'application (`https://…azurecontainerapps.io`, sans `/` final).

Vérifier : **Actions** → « Rappels des activités » → **Run workflow** ; le job doit être vert et afficher `{"activites":…}`. GitHub peut retarder une tâche planifiée de quelques minutes, et la suspend après 60 jours sans activité sur le dépôt (un e-mail prévient ; la réactiver dans l'onglet Actions).

## Réglages et coûts

- `--min-replicas 0` : le service s'éteint quand personne ne s'en sert (gratuit au repos). La première visite après une pause attend son démarrage (tirage de l'image, puis Chromium), de quelques secondes à une minute.
- `--memory 2Gi` : Chromium (moteur de rendu) a besoin de place. Mesuré sur le gabarit « panéliste » (fond de 5400 × 6414 px) : pic de 1,4 Go pour l'import, les aperçus, la création et la haute définition. Pour tenir, l'import prépare des fonds réduits (1620 px) pour l'aperçu et le fichier réseaux, la haute définition est plafonnée à 3600 px de large (impression A4 et A3 ; réglable par `LARGEUR_HD`) et rendue seule. Si les journaux signalent un manque de mémoire, passer à `--cpu 2 --memory 4Gi` ou `RENDUS_SIMULTANES=1`.
- **Part gratuite de Container Apps**, chaque mois : 180 000 vCPU-secondes, 360 000 Gio-secondes et 2 millions de requêtes, soit environ 50 heures d'activité à 1 vCPU. Le temps compte tant qu'une instance tourne, y compris les quelques minutes avant qu'elle s'éteigne. Au-delà, le crédit étudiant paie.
- **Crédit épuisé** : l'abonnement Azure for Students s'arrête (le service est coupé) au lieu de facturer. Suivre la consommation : portail Azure → **Abonnements** → **Analyse des coûts**.
- `--max-replicas 2` : plafond de sécurité contre un emballement.
- L'environnement crée un espace de journaux (Log Analytics) : 5 Go gratuits par mois, suffisants.
- **Passation** : l'abonnement appartient à un étudiant. Avant son départ, ajouter un membre du nouveau bureau comme **Propriétaire** de l'abonnement (portail → abonnement → **Contrôle d'accès (IAM)**), puis recréer le service sur l'abonnement d'un autre étudiant (sections 5 et 7, mêmes secrets : la base et les fichiers ne bougent pas).

## Si l'association investit

La même image tourne ailleurs sans modification :

- **Container Apps payant** : `--min-replicas 1` supprime l'attente de la première visite.
- **Google Cloud Run** : `gcloud run deploy --image ghcr.io/…` avec les mêmes variables (Secret Manager pour les secrets), 2 Gio de mémoire.
- **Petit serveur virtuel** (quelques euros par mois) : `docker run -p 80:8080 --env-file .env ghcr.io/kango-hamed/aeemci-studio:latest`.
- **Neon** : passage à l'offre payante pour plus de stockage et une base qui ne se met pas en veille.
- **R2** : au-delà de la part gratuite, facturé au stockage ; les documents sont légers (PNG réseaux d'environ 2 Mo, HD faite à la demande).

## Intégration continue

`.github/workflows/ci.yml`, à chaque push : lint, types, tests (avec une base Postgres de test et Chromium), build de l'application, puis construction de l'image Docker, publiée sur ghcr.io seulement depuis `main` et si les vérifications passent. Une pull request ne doit être fusionnée que si les deux jobs sont verts. `.github/workflows/rappels.yml` : rappels quotidiens (section 7).
