# Rust Telegram Bot

This is a Rust implementation of the AI/Transcription bot using `teloxide` and Google Gemini.

## Prerequisites

1.  **Rust**: Install from [rustup.rs](https://rustup.rs/).
2.  **Telegram Bot Token**: Get one from [@BotFather](https://t.me/BotFather).
3.  **Google Gemini API Key**: Get one from [Google AI Studio](https://aistudio.google.com/).

## Setup

1.  Navigate to the `rust_bot` directory:
    ```bash
    cd rust_bot
    ```

2.  Create a `.env` file (or set environment variables):
    ```env
    TELOXIDE_TOKEN=your_telegram_bot_token
    GOOGLE_API_KEY=your_google_api_key
    # Optional:
    GOOGLE_MODEL=gemini-2.5-flash
    RUST_LOG=info
    ```

3.  Run the bot:
    ```bash
    cargo run
    ```

## Features

-   **Voice Transcription**: Send a voice message to the bot in a private chat, and it will transcribe it using Google Gemini.
-   **/convert**: Reply to a voice message with `/convert` to transcribe it.
-   **/ai <prompt>**: Ask Gemini a question. You can reply to a text or voice message to include it as context.
-   **/g <query>**: Get a Google Search link.

## Note on Architecture

This bot uses the Telegram Bot API (via `teloxide`), unlike the original TypeScript version which was a Userbot (using `gramjs`/MTProto). This means:
-   It runs as a separate bot user (e.g., `@MyAiBot`), not as your personal account.
-   It cannot intercept messages sent to your personal account.
-   You must forward messages to it or add it to groups to use it.

