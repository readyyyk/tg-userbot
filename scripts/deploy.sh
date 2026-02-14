#!/usr/bin/env bash
set -euo pipefail

DOCKER_IMAGE="${DOCKER_IMAGE:-tg-userbot}"
DEPLOY_HOST="${DEPLOY_HOST:?DEPLOY_HOST is required}"
DEPLOY_PATH="${DEPLOY_PATH:-/root/tg-userbot}"

docker compose build
docker tag tg-userbot-tg-userbot "$DOCKER_IMAGE:latest"
docker push "$DOCKER_IMAGE:latest"
ssh -t "root@$DEPLOY_HOST" "cd $DEPLOY_PATH && docker compose -f docker-compose.prod.yml up -d --pull always"
