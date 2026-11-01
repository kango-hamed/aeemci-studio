# 10 · Installer et déployer AEEMCI Studio

Date : 30/10/2026, mis à jour pour le lot 1b (génération). Application Next.js, base Neon, fichiers sur Cloudflare R2, hébergement Google Cloud Run. Tout tient dans les offres gratuites tant que l'usage reste celui d'une section.

## Ce qu'il faut

- Node.js 22 (version notée dans `.nvmrc`) et Git.
- Un compte **Neon** (base Postgres, gratuit).
- Un compte **Cloudflare** (stockage R2, gratuit ; une carte peut être demandée pour activer R2).
- Un compte **Google Cloud** avec un compte de facturation (une carte est demandée même pour rester dans le gratuit).
- Le Google Cloud CLI (`gcloud`) : https://cloud.google.com/sdk/docs/install
- Un dépôt GitHub privé pour le code (l'intégration continue y tourne à chaque push).

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
3. Depuis ton ordinateur, appliquer les migrations et créer ton compte sur cette base :

```bash
DATABASE_URL="postgresql://…" npm run db:migrer -w @aeemci-studio/web
DATABASE_URL="postgresql://…" npm run admin:creer -w @aeemci-studio/web -- --email … --nom "…" --role president --mandat 2025-2026
```

À refaire (`db:migrer` seulement) à chaque version qui ajoute une migration dans `apps/web/drizzle/`.

## 3. Créer le stockage R2

Sur Cloud Run, le disque du conteneur est effacé à chaque redémarrage : les fichiers doivent vivre ailleurs.

1. https://dash.cloudflare.com → **R2 Object Storage** → **Create bucket**, nom `aeemci-studio`, emplacement automatique. Le seau reste **privé** : l'application lit les fichiers et vérifie les droits avant de les servir.
2. R2 → **Manage R2 API Tokens** → **Create API token** : permission **Object Read & Write**, limitée au seau `aeemci-studio`. Noter l'**Access Key ID** (`R2_CLE`) et le **Secret Access Key** (`R2_SECRET`), affichés une seule fois.
3. L'identifiant du compte (`R2_COMPTE`) figure dans l'adresse du tableau de bord et sur la page R2 (« Account ID »).

## 4. Préparer Google Cloud (une fois)

```bash
gcloud auth login
gcloud projects create aeemci-studio-esatic --name="AEEMCI Studio"   # l'identifiant doit être unique : adapte-le
gcloud config set project aeemci-studio-esatic
gcloud billing projects link aeemci-studio-esatic --billing-account=XXXXXX-XXXXXX-XXXXXX
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

**Alerte de budget, à faire tout de suite** : console Google Cloud → Facturation → Budgets et alertes → budget de 1 € avec alertes à 50 %, 90 % et 100 %. Tu es prévenu par e-mail au premier centime dépensé.

Les secrets ne sont jamais écrits en clair dans la configuration du service : ils vont dans Secret Manager.

```bash
printf '%s' 'postgresql://…' | gcloud secrets create aeemci-database-url --data-file=-
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" | gcloud secrets create aeemci-auth-secret --data-file=-
printf '%s' 'clé d accès R2' | gcloud secrets create aeemci-r2-cle --data-file=-
printf '%s' 'secret R2' | gcloud secrets create aeemci-r2-secret --data-file=-

NUMERO=$(gcloud projects describe aeemci-studio-esatic --format='value(projectNumber)')
for s in aeemci-database-url aeemci-auth-secret aeemci-r2-cle aeemci-r2-secret; do
  gcloud secrets add-iam-policy-binding $s --member="serviceAccount:${NUMERO}-compute@developer.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
done
```

## 5. Déployer

Depuis la racine du dépôt. Cloud Build construit l'image à partir du `Dockerfile`, puis Cloud Run la lance.

```bash
gcloud run deploy aeemci-studio --source . --region europe-west1 \
  --allow-unauthenticated --memory 2Gi --cpu 1 --min-instances 0 --max-instances 2 --concurrency 20 \
  --set-secrets DATABASE_URL=aeemci-database-url:latest,BETTER_AUTH_SECRET=aeemci-auth-secret:latest,R2_CLE=aeemci-r2-cle:latest,R2_SECRET=aeemci-r2-secret:latest \
  --set-env-vars STOCKAGE=r2,R2_COMPTE=<identifiant du compte Cloudflare>,R2_SEAU=aeemci-studio
```

La commande affiche l'adresse du service (`https://aeemci-studio-….run.app`). Donne-la à l'application, une fois :

```bash
gcloud run services update aeemci-studio --region europe-west1 --update-env-vars BETTER_AUTH_URL=https://aeemci-studio-….run.app
```

Vérifier : `https://…/api/sante` doit répondre `"etat":"ok"` et `"stockage":"r2"`, puis se connecter avec le compte créé à l'étape 2.

## 6. Publier le premier gabarit

1. Dans Photoshop, marquer les calques avec le plugin DesignHub puis générer le dossier (doc 07).
2. Dans AEEMCI Studio, compte administrateur ou designer : **Créer** → **Gérer les gabarits** → **Importer un dossier** → choisir ce dossier. Le PSD et les exports ne sont pas envoyés ; le dossier envoyé doit faire 30 Mo au plus.
3. Dans l'écran du gabarit qui s'ouvre : écrire les libellés, vérifier l'aperçu (texte le plus long compris), cliquer sur **Publier** (doc 08).
4. Le gabarit apparaît pour les membres. Une nouvelle version depuis Photoshop reprend les réglages ; les documents déjà créés gardent leur révision.

Pour publier une nouvelle version : relancer la commande `gcloud run deploy` ci-dessus.

## 7. Notifications (facultatif)

Sans cette étape, la plateforme marche sans notifications (l'écran Notifications l'indique).

1. Générer la paire de clés, une fois (ne plus la changer : les téléphones abonnés seraient perdus) : `npx web-push generate-vapid-keys`.
2. Secret Manager : `aeemci-vapid-privee` (clé privée) et `aeemci-rappels-secret` (32 caractères aléatoires, même commande que `aeemci-auth-secret`), lisibles par Cloud Run comme les autres (section 4).
3. Les donner au service :

```bash
gcloud run services update aeemci-studio --region europe-west1   --update-secrets VAPID_PRIVEE=aeemci-vapid-privee:latest,RAPPELS_SECRET=aeemci-rappels-secret:latest   --update-env-vars VAPID_PUBLIQUE=<clé publique>,VAPID_CONTACT=mailto:<adresse du bureau>
```

4. Rappel de la veille des activités, chaque jour à 18 h (Abidjan) :

```bash
gcloud services enable cloudscheduler.googleapis.com
gcloud scheduler jobs create http aeemci-rappels --location europe-west1 --schedule "0 18 * * *" --time-zone "Africa/Abidjan"   --http-method POST --uri https://aeemci-studio-….run.app/api/notifications/rappels   --headers "Authorization=Bearer <valeur de aeemci-rappels-secret>"
```

Cloud Scheduler : 3 tâches gratuites par mois. Vérifier : **Exécuter maintenant** dans la console Cloud Scheduler doit répondre 200.

### Réglages et coûts

- `--min-instances 0` : le service s'éteint quand personne ne s'en sert (gratuit au repos). La première visite après une pause attend quelques secondes.
- `--memory 2Gi` : Chromium (moteur de rendu) a besoin de place. Mesuré sur le gabarit « panéliste » (fond de 5400 × 6414 px) : pic de 1,4 Go pour l'import, les aperçus, la création et la haute définition. Pour tenir, l'import prépare des fonds réduits (1620 px) pour l'aperçu et le fichier réseaux, la haute définition est plafonnée à 3600 px de large (impression A4 et A3 ; réglable par `LARGEUR_HD`) et rendue seule. Si les journaux Cloud Run signalent un manque de mémoire, passer à `--memory 4Gi` ou `RENDUS_SIMULTANES=1`.
- Offre gratuite : 360 000 Gio-secondes par mois, soit environ 50 heures d'activité à 2 Gio (facturation à la requête : le temps compte seulement pendant les requêtes).
- `--max-instances 2` : plafond de sécurité contre un emballement.
- L'image (Node + Chromium) fait plusieurs centaines de Mo : son stockage dans Artifact Registry peut dépasser la part gratuite de quelques centimes par mois. Supprimer les anciennes images de temps en temps (console → Artifact Registry → `cloud-run-source-deploy`).

## Depuis Windows : la mise en ligne pas à pas

Les commandes ci-dessus sont écrites pour un terminal Linux ou macOS. Sous Windows, dans **PowerShell**, à la racine du dépôt (`D:\work\aeemci-studio`) :

**A. Code sur GitHub** (l'intégration continue construit l'image Docker à chaque envoi)

1. Créer un dépôt **privé** vide `aeemci-studio` sur https://github.com/new (sans README ni .gitignore).
2. Puis :

```powershell
git init -b main
git add .
git commit -m "AEEMCI Studio : lots 1a et 1b"
git remote add origin https://github.com/kango-hamed/aeemci-studio.git
git push -u origin main
```

3. Onglet **Actions** du dépôt : les deux jobs (« Lint, types, tests, build » et « Image Docker ») doivent passer au vert.

**B. Base Neon** (section 2), puis migrations et premier compte depuis ton ordinateur (Node 22.18 ou plus) :

```powershell
npm install
$env:DATABASE_URL = "postgresql://…-pooler…/neondb?sslmode=require"
npm run db:migrer -w @aeemci-studio/web
npm run admin:creer -w @aeemci-studio/web -- --email prenom.nom@esatic.edu.ci --nom "Prénom Nom" --role president --mandat 2025-2026
Remove-Item Env:DATABASE_URL
```

**C. Stockage R2** : section 3.

**D. Google Cloud**

1. Installer le Google Cloud CLI pour Windows (https://cloud.google.com/sdk/docs/install), puis dans un **nouveau** PowerShell : `gcloud auth login`.
2. Projet, facturation, services et alerte de budget : section 4 (les commandes `gcloud projects …`, `gcloud billing …`, `gcloud services enable …` sont identiques sous Windows).
3. **Secrets, dans la console** plutôt qu'en ligne de commande (PowerShell ajoute un retour à la ligne aux valeurs envoyées par `|`, ce qui casserait la connexion à la base) : console Google Cloud → **Secret Manager** → **Créer un secret**, quatre fois :

| Nom du secret | Valeur |
|---|---|
| `aeemci-database-url` | chaîne Neon « pooled » |
| `aeemci-auth-secret` | résultat de `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `aeemci-r2-cle` | Access Key ID R2 |
| `aeemci-r2-secret` | Secret Access Key R2 |

4. Autoriser Cloud Run à les lire :

```powershell
$numero = gcloud projects describe aeemci-studio-esatic --format="value(projectNumber)"
foreach ($s in "aeemci-database-url","aeemci-auth-secret","aeemci-r2-cle","aeemci-r2-secret") {
  gcloud secrets add-iam-policy-binding $s --member="serviceAccount:$numero-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
}
```

**E. Déployer** (une seule ligne ; remplacer `<COMPTE>` par l'identifiant du compte Cloudflare) :

```powershell
gcloud run deploy aeemci-studio --source . --region europe-west1 --allow-unauthenticated --memory 2Gi --cpu 1 --min-instances 0 --max-instances 2 --concurrency 20 --set-secrets "DATABASE_URL=aeemci-database-url:latest,BETTER_AUTH_SECRET=aeemci-auth-secret:latest,R2_CLE=aeemci-r2-cle:latest,R2_SECRET=aeemci-r2-secret:latest" --set-env-vars "STOCKAGE=r2,R2_COMPTE=<COMPTE>,R2_SEAU=aeemci-studio"
```

Accepter la création du dépôt Artifact Registry si `gcloud` la propose. À la fin, copier l'adresse affichée (`https://aeemci-studio-….run.app`) :

```powershell
gcloud run services update aeemci-studio --region europe-west1 --update-env-vars "BETTER_AUTH_URL=https://aeemci-studio-….run.app"
```

**F. Vérifier** : `https://…/api/sante` (« ok », stockage « r2 »), connexion avec le compte de l'étape B, puis import du premier gabarit (section 6). En cas d'erreur : console → Cloud Run → `aeemci-studio` → **Journaux**.

## Si l'association investit

La même image tourne ailleurs sans modification :

- **Cloud Run payant** : `--min-instances 1` supprime l'attente de la première visite.
- **Petit serveur virtuel** (quelques euros par mois) : `docker build -t aeemci-studio . && docker run -p 80:8080 --env-file .env aeemci-studio`.
- **Neon** : passage à l'offre payante pour plus de stockage et une base qui ne se met pas en veille.
- **R2** : au-delà de la part gratuite, facturé au stockage ; les documents sont légers (PNG réseaux d'environ 2 Mo, HD faite à la demande).

## Intégration continue

`.github/workflows/ci.yml`, à chaque push : lint, types, tests (avec une base Postgres de test et Chromium), build de l'application, puis construction de l'image Docker. Une pull request ne doit être fusionnée que si les deux jobs sont verts.
