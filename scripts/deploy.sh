#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

command -v rcli >/dev/null || {
    echo "rcli is required to pull deployment secrets" >&2
    exit 1
}

rcli tool secrets pull

set -a
source .env
set +a

DOCKER_IMAGE="${DOCKER_IMAGE:-tg-userbot}"
DEPLOY_HOST="${DEPLOY_HOST:?DEPLOY_HOST is required}"
DEPLOY_PATH="${DEPLOY_PATH:-/root/tg-userbot}"

if [ -z "${TG_SESSION:-}" ]; then
    echo "TG_SESSION is empty. Generate it locally and store it in tg-userbot-production before deploying." >&2
    exit 1
fi

docker compose build
docker tag tg-userbot-tg-userbot "${DOCKER_IMAGE}:latest"
docker push "${DOCKER_IMAGE}:latest"

ssh "root@$DEPLOY_HOST" "mkdir -p '$DEPLOY_PATH'"
scp .env docker-compose.prod.yml "root@$DEPLOY_HOST:$DEPLOY_PATH/"
ssh -t "root@$DEPLOY_HOST" "cd '$DEPLOY_PATH' && chmod 600 .env && DOCKER_IMAGE='$DOCKER_IMAGE' docker compose -f docker-compose.prod.yml pull tg-userbot && DOCKER_IMAGE='$DOCKER_IMAGE' docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps tg-userbot"
