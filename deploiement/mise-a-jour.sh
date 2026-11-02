#!/bin/sh
# Mise à jour automatique (doc 10, section 5 F) : lancé toutes les 5 minutes par cron sur le serveur.
# Tire l'image de l'application ; si elle a changé, redémarre l'application avec (les migrations
# s'appliquent à son démarrage) et retire les anciennes images. Sinon, ne fait rien.
# Journal : journalctl -t aeemci
set -eu
cd "$(dirname "$0")"

image=$(docker compose config --images app)
# Sortie affichée sur un échec seulement (jeton GitHub expiré, réseau) : sinon le journal reste vide.
if ! sortie=$(docker compose pull --quiet app 2>&1); then
  echo "$sortie"
  exit 1
fi
nouvelle=$(docker image inspect --format '{{.Id}}' "$image")
conteneur=$(docker compose ps --quiet app)
actuelle=$([ -n "$conteneur" ] && docker inspect --format '{{.Image}}' "$conteneur" || true)

[ "$nouvelle" = "$actuelle" ] && exit 0

echo "Nouvelle image $image ($nouvelle) : redémarrage."
docker compose up --detach --quiet-pull
docker image prune --force > /dev/null
echo "Application redémarrée."
