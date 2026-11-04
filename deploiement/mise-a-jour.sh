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

if [ "$nouvelle" = "$actuelle" ]; then
  # Même image : relancer l'application si elle ne répond plus depuis 3 contrôles (bloquée sans être tombée ;
  # un arrêt brutal est déjà relancé par Docker).
  if [ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$conteneur")" = "unhealthy" ]; then
    echo "Application sans réponse : redémarrage."
    docker compose restart app
  fi
  exit 0
fi

echo "Nouvelle image $image ($nouvelle) : redémarrage."
docker compose up --detach --quiet-pull
docker image prune --force > /dev/null
echo "Application redémarrée."
