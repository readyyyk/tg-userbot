# tg-userbot

Telegram userbot that auto-transcribes voice and video messages (via Groq Whisper) and provides AI-powered commands using Groq (`groq/compound`).

## Features

- Auto-transcribes voice messages and video notes (circles) in private chats (and configurable group chats)
- `/convert` — transcribe a replied voice / audio / video-note message
- `/ai {prompt}` — ask AI a question (optionally with a replied voice/video note as context)
- `/tldr` — summarize a replied voice or video-note message
- `/summary {count} [prompt]` — summarize the last N messages in a chat
- `/g {query}` — Google search
- `/n` — dismiss/delete the bot's last message

## Setup

### Prerequisites

- Node.js 22+
- pnpm 10+

### Get Telegram API credentials

1. Go to [my.telegram.org](https://my.telegram.org)
2. Log in and go to **API development tools**
3. Create an application to get your `API_ID` and `API_HASH`

### Get a Groq API key

Transcription **and** the AI commands run on [Groq](https://groq.com), so a single key
is all you need.

1. Sign in (or sign up) at [console.groq.com](https://console.groq.com) — Google, GitHub, or email.
2. Open **API Keys** → **Create API Key**, give it a name (e.g. `tg-userbot`), and copy it.
   The key starts with `gsk_` and is shown **only once**, so save it now.
3. Provide it to the bot as the `GROQ_API_KEY` environment variable (see [Run locally](#run-locally)).

The bot authenticates by sending `Authorization: Bearer $GROQ_API_KEY` to Groq's
OpenAI-compatible API — there is no other login step. One key powers both transcription
([`whisper-large-v3`](https://console.groq.com/docs/model/whisper-large-v3)) and the text AI
([`groq/compound`](https://console.groq.com/docs/agentic-tooling)).

> This is a **Groq** (groq.com inference) key — *not* Grok/xAI. The free tier is rate-limited
> but more than enough for personal use.

### Run locally

Create your `.env` from the template and fill in the three required values
(`TG_API_ID`, `TG_API_HASH`, `GROQ_API_KEY`):

```bash
cp .env.example .env
pnpm install
pnpm dev
```

On first login the bot prompts for your phone number and the code Telegram sends you. After
login it prints a `TG_SESSION` string — copy it into `.env` so future runs skip the login prompt.

> Maintainers with the secrets backend can run `rcli tool secrets pull` to generate `.env`
> automatically, and persist the session with
> `printf %s "$TG_SESSION" | rcli tool secrets set tg-userbot-production TG_SESSION`.

### Run with Docker

```bash
cp .env.example .env   # fill in your credentials first
docker compose up -d
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `TG_API_ID` | Yes | Telegram API ID (number) |
| `TG_API_HASH` | Yes | Telegram API hash |
| `GROQ_API_KEY` | Yes | Groq API key (transcription + text AI commands) |
| `TG_SESSION` | No | Session string (printed on first login) |
| `TG_PHONE_NUMBER` | No | Phone number for non-interactive login |
| `TG_PASSWORD` | No | 2FA password for non-interactive login |
| `TG_PHONE_CODE` | No | Auth code for non-interactive login |
| `WHISPER_MODEL` | No | Groq transcription model (default: `whisper-large-v3`; set `whisper-large-v3-turbo` for lower cost/latency) |
| `WHISPER_LANGUAGE` | No | Pin transcription to one ISO-639-1 language (e.g. `ru`); leave unset to auto-detect per message (multilingual) |
| `GROQ_TEXT_MODEL` | No | Groq model for text AI commands (default: `groq/compound`) |
| `AUTO_TRANSCRIBE_PEER_IDS` | No | Comma-separated peer IDs to auto-transcribe in (besides private chats) |
| `TRANSCRIBE_DISABLED_PEER_IDS` | No | Comma-separated peer IDs where auto-transcription is disabled |

## Architecture

- **Domain** — `Transcriber`, `AI` interfaces
- **Impl** — Groq adapters: Whisper transcriber (`/openai/v1/audio/transcriptions`) and `groq/compound` text AI (`/openai/v1/chat/completions`)
- **Application** — use cases (private auto-transcribe, `/convert`, `/ai`, `/tldr`, `/summary`, `/g`, `/n`)
- **Presentation** — ordered handlers registry and bot event loop

## Deployment

Secrets are managed by `rcli tool secrets` via `secrets.yaml` and the `tg-userbot-production` secrets project.

```bash
pnpm run deploy
```

The deploy script pulls `.env` from secrets, builds and pushes `${DOCKER_IMAGE}:latest`, copies `.env` plus `docker-compose.prod.yml` to `${DEPLOY_HOST}:${DEPLOY_PATH}`, then recreates the remote service.

Deployment requires `TG_SESSION` to be set in `tg-userbot-production`; the script refuses to deploy with an empty session.

## License

[MIT](LICENSE)
