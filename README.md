# tg-userbot

Telegram user-bot that:

- Auto-transcribes private voice messages to text
- Converts replied voice via `/convert` in groups/private
- Answers `/ai {prompt}` (optionally with a replied voice used as context)

ADR: [0002-tg-no-audio-layered-architecture.md](../../docs/adr/0002-tg-no-audio-layered-architecture.md)

## Usage (Docker)

```bash
cp env.example .env
docker compose up -d
```

On first login the container will print a `TG_SESSION`; copy it into `.env` to avoid future prompts.

## Local Development

```bash
# Node 22.15+, pnpm 10.12.4 (see monorepo README)
pnpm install
pnpm dev
```

## Env

- `TG_API_ID`, `TG_API_HASH` (required)
- `TG_SESSION` (optional; will be printed on first login)
- `GOOGLE_API_KEY` (required)
- `GOOGLE_MODEL`, `GOOGLE_TEXT_MODEL` (optional; defaults to gemini-2.5-flash)

## Architecture

- Domain: `Transcriber`, `AI`
- Impl: Google adapters (`@google/genai`)
- Application: use cases (private auto transcribe, `/convert`, `/ai`)
- Presentation: ordered handlers registry and bot loop

## Deployments

(git works very slow on my VPS, so I use docker images)

```bash
docker compose build
docker tag tg-userbot-tg-userbot YOUR_DOCKER_USERNAME/tg-userbot:latest
# docker login
docker push YOUR_DOCKER_USERNAME/tg-userbot:latest

# sad but harsh reality, ci:
ssh -t USER@IP "cd /path/to/tg-userbot && docker compose -f docker-compose.prod.yml up -d --pull always"
```
