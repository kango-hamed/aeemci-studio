# 10 · Installer et déployer AEEMCI Studio

Date : 30/10/2026, **révisé le 01/11/2026** : hébergement provisoire sur **AWS EC2** (offre gratuite du compte de Kango), pour la présentation et les premiers mois. Google Cloud demandait un prépaiement de 30 $, Oracle une carte bancaire, et Azure for Students ne reconnaît pas le domaine de l'ESATIC. **La section devra choisir un hébergement durable** (« Après AWS », en fin de document) : la base Neon et les fichiers R2 ne bougent pas, seul le serveur change.

Application Next.js dans une image Docker publiée sur GitHub, base Neon, fichiers sur Cloudflare R2. Sur le serveur, Docker lance l'application derrière Caddy, qui fournit le HTTPS (obligatoire pour installer l'application sur téléphone et recevoir les notifications).

## Ce qu'il faut

- Node.js 22 (version notée dans `.nvmrc`) et Git.
- Un compte **Neon** (base Postgres, gratuit).
- Un compte **Cloudflare** avec un seau R2 (gratuit).
- Un compte **AWS** avec son offre gratuite (crédits).
- Le dépôt GitHub privé `kango-hamed/aeemci-studio` : l'intégration continue y construit l'image et la publie.

Rien à installer pour le serveur : on s'y connecte en SSH depuis PowerShell, avec la clé créée au lancement de la machine (section 5).

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

1. https://console.neon.tech → **New project**, nom `aeemci-studio`, Postgres 16 ou plus, région **AWS Europe Central 1 (Frankfurt)**.
2. **Connect** → cocher **Connection pooling** → copier la chaîne (`postgresql://…-pooler…/neondb?sslmode=require`). C'est la `DATABASE_URL` de production.
3. Depuis ton ordinateur, appliquer les migrations et créer ton compte sur cette base. Sous Windows, dans PowerShell, à la racine du dépôt :

```powershell
$env:DATABASE_URL = "postgresql://…-pooler…/neondb?sslmode=require"
npm run db:migrer -w @aeemci-studio/web
npm run admin:creer -w @aeemci-studio/web -- --email prenom.nom@esatic.edu.ci --nom "Prénom Nom" --role president --mandat 2025-2026
Remove-Item Env:DATABASE_URL
```

Ensuite, plus rien à faire à la main : l'application applique elle-même les nouvelles migrations de `apps/web/drizzle/` à chaque démarrage (section 5 F).

## 3. Le stockage R2

Le serveur ne garde aucun fichier : tout va dans R2, ce qui permet de changer d'hébergeur sans rien perdre.

1. https://dash.cloudflare.com → **R2 Object Storage** → **Create bucket** (par exemple `aeemci-studio`), emplacement automatique. Le seau reste **privé** : l'application lit les fichiers et vérifie les droits avant de les servir.
2. R2 → **Manage R2 API Tokens** → **Create API token** : permission **Object Read & Write**, limitée à ce seau. Noter l'**Access Key ID** (`R2_CLE`) et le **Secret Access Key** (`R2_SECRET`), affichés une seule fois.
3. L'identifiant du compte (`R2_COMPTE`) figure dans l'adresse du tableau de bord et sur la page R2 (« Account ID »). Le nom du seau est `R2_SEAU`.

## 4. L'image sur GitHub

À chaque envoi sur `main`, l'intégration continue (`.github/workflows/ci.yml`) vérifie le code puis publie l'image sur `ghcr.io/kango-hamed/aeemci-studio` (étiquettes `latest` et numéro du commit). Le paquet reste **privé**, comme le dépôt.

1. Onglet **Actions** du dépôt : les deux jobs (« Lint, types, tests, build » et « Image Docker ») doivent être verts. Le paquet apparaît alors dans **Packages** sur la page du compte GitHub.
2. Créer le jeton qui permettra au serveur de tirer l'image : GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**, nom `serveur-aeemci`, expiration un an, **une seule case : `read:packages`**. Noter le jeton (`ghp_…`).

## 5. Le serveur AWS

### A. Vérifier l'offre gratuite (une fois)

Console AWS → **Facturation et gestion des coûts** → **Offre gratuite** (ou **Crédits**).

- **Compte ouvert après le 15/07/2025** (« plan gratuit », 100 à 200 $ de crédits, 6 mois) : prendre une **t3.small** (2 vCPU, 2 Go), éligible au plan gratuit. C'est le cas prévu ci-dessous.
- **Compte plus ancien** (offre de 12 mois, 750 h par mois) : seule la **t3.micro** (1 Go) est gratuite. Elle suffit pour la présentation avec 3 Go de swap (étape D) et `RENDUS_SIMULTANES=1` dans `.env`, au prix d'aperçus plus lents ; une t3.small serait facturée (environ 17 $ par mois).

Puis **Budgets** → **Créer un budget** → modèle **Budget de dépenses nulles** (« Zero spend budget »), avec ton e-mail : AWS prévient au premier centime facturé hors crédits.

### B. Créer la machine

Console AWS, région **Europe (Francfort) eu-central-1** ou **Europe (Paris) eu-west-3** (en haut à droite ; proches de Neon à Francfort, Paris l'est un peu plus d'Abidjan ; l'instance de la section est à Paris) → **EC2** → **Lancer une instance** :

| Réglage | Valeur |
|---|---|
| Nom | `aeemci-studio` |
| Image (AMI) | **Ubuntu Server 24.04 LTS**, architecture 64 bits (x86) |
| Type d'instance | **t3.small** (ou t3.micro, voir A) |
| Paire de clés | **Créer une paire de clés** : nom `aeemci-studio`, type ED25519, format `.pem` (téléchargée une seule fois, voir C) |
| Réseau | Créer un groupe de sécurité : cocher **Autoriser le trafic SSH**, **Autoriser HTTPS** et **Autoriser HTTP depuis Internet** |
| Stockage | **20 Gio**, gp3 |

**Lancer l'instance.** Ensuite, pour que l'adresse ne change pas à chaque redémarrage : EC2 → **Adresses IP Elastic** → **Allouer l'adresse IP Elastic** → **Allouer**, puis **Actions** → **Associer l'adresse IP Elastic** → choisir l'instance → **Associer**. Noter cette adresse, par exemple `13.39.112.125`.

**Adresse publique de l'application** : l'IP avec des tirets, suivie de `.sslip.io`, par exemple `13-39-112-125.sslip.io`. Ce service gratuit renvoie vers l'IP écrite dans le nom, ce qui permet d'avoir un certificat HTTPS sans acheter de domaine. Avec un vrai domaine plus tard, il suffit de le pointer sur l'IP et de changer `DOMAINE` et `BETTER_AUTH_URL`.

### C. Se connecter

Ranger la clé téléchargée dans `%USERPROFILE%\.ssh` et la rendre lisible par toi seul (sinon `ssh` la refuse), dans PowerShell :

```powershell
icacls "$env:USERPROFILE\.ssh\aeemci-studio.pem" /inheritance:r /grant:r "$($env:USERNAME):R"
```

Puis `ssh -i "$env:USERPROFILE\.ssh\aeemci-studio.pem" ubuntu@<IP élastique>` (répondre `yes` à la première connexion). La clé n'est jamais envoyée par WhatsApp ni mise dans le dépôt ; en garder une copie sûre : perdue, elle ne se retélécharge pas. Sans la clé, la console reste possible : EC2 → **Instances** → `aeemci-studio` → **Se connecter** → **EC2 Instance Connect**.

### D. Docker et swap (une fois)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
exit
```

Le swap (`3G` sur une t3.micro) évite un arrêt brutal si Chromium dépasse la mémoire. Se **reconnecter** (étape C) pour que Docker soit utilisable sans `sudo`.

### E. Fichiers de l'application (une fois)

Depuis ton ordinateur, à la racine du dépôt, envoyer les fichiers de [`deploiement/`](../deploiement/compose.yaml) :

```powershell
ssh -i "$env:USERPROFILE\.ssh\aeemci-studio.pem" ubuntu@<IP> "mkdir -p ~/aeemci"
scp -i "$env:USERPROFILE\.ssh\aeemci-studio.pem" deploiement\compose.yaml deploiement\Caddyfile deploiement\mise-a-jour.sh ubuntu@<IP>:~/aeemci/
scp -i "$env:USERPROFILE\.ssh\aeemci-studio.pem" deploiement\.env.exemple ubuntu@<IP>:~/aeemci/.env
```

Sur le serveur, `cd ~/aeemci && openssl rand -base64 32 && nano .env` : remplacer **chaque** valeur entre `<…>` (la valeur affichée par `openssl` va dans `BETTER_AUTH_SECRET`), enregistrer (**Ctrl+O**, Entrée) et quitter (**Ctrl+X**). Contrôle : `grep -n '<' .env | cut -d= -f1` ne doit rien afficher (une valeur oubliée, par exemple `DOMAINE`, empêche Caddy d'obtenir le certificat : « Timeout during connect »). Puis :

```bash
chmod 600 .env
read -rsp "Jeton GitHub read:packages : " GHCR; echo; echo "$GHCR" | docker login ghcr.io -u kango-hamed --password-stdin; unset GHCR
docker compose up -d
docker compose logs -f
```

Attendre la ligne de Caddy indiquant que le certificat est obtenu (`certificate obtained successfully`), puis **Ctrl+C** pour quitter les journaux (l'application continue de tourner).

**Vérifier** : `https://13-39-112-125.sslip.io/api/sante` doit répondre `"etat":"ok"` et `"stockage":"r2"`, puis se connecter avec le compte créé à l'étape 2. En cas d'erreur : `docker compose logs app` ou `docker compose logs caddy`.

### F. Publier une nouvelle version

**Automatique** : envoyer sur `main` suffit. L'intégration continue publie l'image ; dans les 5 minutes, le serveur la tire et redémarre l'application, qui applique les migrations éventuelles avant de démarrer. Une version dont la migration échoue ne démarre pas (`docker compose logs app`) : revenir à la précédente (ci-dessous) et corriger.

Mise en place, une fois, sur le serveur (le script [`mise-a-jour.sh`](../deploiement/mise-a-jour.sh) envoyé à l'étape E) :

```bash
chmod +x ~/aeemci/mise-a-jour.sh && ~/aeemci/mise-a-jour.sh
(crontab -l 2>/dev/null | grep -v mise-a-jour; echo '*/5 * * * * flock -n /tmp/aeemci-maj.lock $HOME/aeemci/mise-a-jour.sh 2>&1 | logger -t aeemci') | crontab -
```

Le script ne fait rien tant que l'image n'a pas changé. Journal des mises à jour : `journalctl -t aeemci`. Il se sert de la connexion à ghcr.io de l'étape E : si le jeton GitHub expire, les mises à jour s'arrêtent (`journalctl -t aeemci` affiche `denied` ou `unauthorized`) ; refaire le `docker login` avec un nouveau jeton. Mise à jour immédiate, sans attendre : `~/aeemci/mise-a-jour.sh`.

Revenir à une version précise : ajouter la ligne `VERSION=<numéro du commit>` à `~/aeemci/.env`, puis `~/aeemci/mise-a-jour.sh` (dans la commande seule, `VERSION=… docker compose up -d` serait défait par la mise à jour suivante). Retirer la ligne pour revenir aux mises à jour. Une migration déjà appliquée reste en place : l'ancienne version fonctionne avec tant que la migration ne fait qu'ajouter (tables, colonnes). Le serveur redémarre seul l'application après un redémarrage de la machine (`restart: unless-stopped`).

## 6. Publier le premier gabarit

1. Dans Photoshop, marquer les calques avec le plugin DesignHub puis générer le dossier (doc 07).
2. Dans AEEMCI Studio, compte administrateur ou designer : **Créer** → **Gérer les gabarits** → **Importer un dossier** → choisir ce dossier. Le PSD et les exports ne sont pas envoyés ; le dossier envoyé doit faire 30 Mo au plus.

## 7. Notifications (facultatif)

Sans cette étape, la plateforme marche sans notifications (l'écran Notifications l'indique).

1. Générer la paire de clés, une fois, sur ton ordinateur (ne plus la changer : les téléphones abonnés seraient perdus) : `npx web-push generate-vapid-keys`.
2. Sur le serveur, `nano ~/aeemci/.env` : décommenter et remplir `VAPID_PUBLIQUE`, `VAPID_PRIVEE`, `VAPID_CONTACT`, et `RAPPELS_SECRET` (valeur de `openssl rand -base64 32`). Puis `cd ~/aeemci && docker compose up -d`.
3. Rappel de la veille des activités, chaque jour à 18 h (Abidjan) : la tâche `.github/workflows/rappels.yml` du dépôt. GitHub → dépôt → **Settings** → **Secrets and variables** → **Actions** :
   - onglet **Secrets** : `RAPPELS_SECRET` = la même valeur que dans `.env` ;
   - onglet **Variables** : `ADRESSE_APPLICATION` = l'adresse de l'application (`https://13-39-112-125.sslip.io`, sans `/` final).

Vérifier : **Actions** → « Rappels des activités » → **Run workflow** ; le job doit être vert et afficher `{"activites":…}`. GitHub peut retarder une tâche planifiée de quelques minutes, et la suspend après 60 jours sans activité sur le dépôt (un e-mail prévient ; la réactiver dans l'onglet Actions).

## 8. E-mails d'activation (facultatif)

Sans cette étape, les liens d'activation d'un import CSV s'affichent à l'écran, à transmettre un par un. Avec elle, chaque membre importé reçoit son lien par e-mail.

1. Une adresse Gmail de la section, avec la **validation en deux étapes** activée (Compte Google → Sécurité).
2. Compte Google → Sécurité → **Mots de passe des applications** : créer « AEEMCI Studio ». Google affiche 16 lettres une seule fois : les garder pour l'étape suivante, nulle part ailleurs.
3. Sur le serveur, `nano ~/aeemci/.env` : décommenter et remplir `SMTP_HOTE=smtp.gmail.com`, `SMTP_UTILISATEUR` (l'adresse Gmail), `SMTP_MOT_DE_PASSE` (les 16 lettres, sans espaces) et, si on veut, `COURRIEL_EXPEDITEUR="AEEMCI ESATIC <adresse>"`. Puis `cd ~/aeemci && docker compose up -d`.

Vérifier : importer un fichier d'une ligne avec ta propre adresse ; l'écran indique « 1 lien d'activation est parti par e-mail ». Un envoi raté est écrit dans le journal (`docker compose logs app | grep "E-mail non envoyé"`). Gmail limite à environ 500 e-mails par jour : bien assez pour un mandat. Quand la section aura son domaine, remplacer ces valeurs par celles de son adresse.

## Réglages et coûts

- **Toujours allumé** : pas d'attente à la première visite, contrairement à un service qui s'éteint au repos.
- **Mémoire** : Chromium (moteur de rendu) a besoin de place. Mesuré sur le gabarit « panéliste » (fond de 5400 × 6414 px) : pic de 1,4 Go pour l'import, les aperçus, la création et la haute définition. Pour tenir, l'import prépare des fonds réduits (1620 px) pour l'aperçu et le fichier réseaux, la haute définition est plafonnée à 3600 px de large (impression A4 et A3 ; réglable par `LARGEUR_HD`) et rendue seule. Si l'application s'arrête faute de mémoire (`docker compose logs app`, ou `dmesg | grep -i kill`), ajouter `RENDUS_SIMULTANES=1` dans `.env`.
- **Processeur** : sur la t3.small (2 vCPU, sans carte graphique), la haute définition du panéliste prend plus de 30 s ; elle a 3 minutes au plus, une seule fois par document (gardée ensuite). Le premier téléchargement HD fait donc patienter. Si elle échoue encore (`page.screenshot: Timeout` dans `docker compose logs app`), baisser `LARGEUR_HD` (par exemple 2480, A4 à 300 dpi) dans `.env`. Une t3 qui calcule longtemps au-dessus de son régime de base consomme un peu plus de crédits (mode « unlimited »).
- **Consommation des crédits** (ordre de grandeur, Francfort) : t3.small environ 17 $ par mois, disque de 20 Gio environ 2 $, adresse IPv4 publique environ 4 $ : un peu plus de 20 $ par mois. À suivre dans **Facturation** → **Crédits**.
- **Fin du plan gratuit** : au bout de 6 mois ou quand les crédits sont épuisés, AWS ferme le compte s'il n'est pas passé en payant. Avant cette date, déménager (« Après AWS ») : rien à copier, la base et les fichiers sont ailleurs.
- **Sécurité** : la machine n'accepte que SSH (par clé, poussée par la console) et le web ; les secrets ne vivent que dans `~/aeemci/.env` (lisible par `ubuntu` seul). Mises à jour du système de temps en temps : `sudo apt update && sudo apt upgrade -y`.

## Après AWS : hébergement durable

La même image et les mêmes variables tournent ailleurs sans modification :

- **Petit serveur virtuel payant** (quelques euros par mois, chez un hébergeur au choix) : exactement la section 5, étapes C à F.
- **Azure Container Apps** (Azure for Students, sans carte, si un étudiant peut faire vérifier son statut) : service qui s'éteint au repos, 1 vCPU et 2 Go ; commandes Cloud Shell dans la version du doc 10 du commit `1d693ca`.
- **Google Cloud Run** : `gcloud run deploy --image ghcr.io/…` avec les mêmes variables, 2 Gio de mémoire (prépaiement demandé).
- **Neon** : passage à l'offre payante pour plus de stockage et une base qui ne se met pas en veille.
- **R2** : au-delà de la part gratuite, facturé au stockage ; les documents sont légers (PNG réseaux d'environ 2 Mo, HD faite à la demande).

## Intégration continue

`.github/workflows/ci.yml`, à chaque push : lint, types, tests (avec une base Postgres de test et Chromium), build de l'application, puis construction de l'image Docker, publiée sur ghcr.io seulement depuis `main` et si les vérifications passent. Une pull request ne doit être fusionnée que si les deux jobs sont verts. `.github/workflows/rappels.yml` : rappels quotidiens (section 7).
