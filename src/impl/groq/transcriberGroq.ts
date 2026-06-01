import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import pRetry from "p-retry";
import type { FailedAttemptError } from "p-retry";
import type { TranscribeOptions, Transcriber } from "@/domain/transcriber";

export type GroqTranscriberConfig = {
    apiKey: string;
    model?: string;
    defaultLanguage?: string;
    baseUrl?: string;
};

// Whisper expects ISO-639-1 codes; callers pass human-readable language names.
const LANGUAGE_NAME_TO_ISO: Record<string, string> = {
    russian: "ru",
    english: "en",
    ukrainian: "uk",
    german: "de",
    french: "fr",
    spanish: "es",
};

// Groq accepts: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm.
// Used only to synthesize an extension when the file path has none.
const MIME_TO_EXT: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/flac": "flac",
    "audio/webm": "webm",
    "video/mp4": "mp4",
    "video/webm": "webm",
};

function resolveLanguage(language?: string, fallback?: string): string | undefined {
    const raw = language?.trim().toLowerCase();
    if (raw) {
        if (LANGUAGE_NAME_TO_ISO[raw]) return LANGUAGE_NAME_TO_ISO[raw];
        if (/^[a-z]{2}$/.test(raw)) return raw;
    }
    return fallback;
}

// Groq detects the audio format from the uploaded file name's extension.
function resolveFileName(filePath: string, mimeType?: string): string {
    const name = basename(filePath);
    if (extname(name)) return name;
    const ext = (mimeType && MIME_TO_EXT[mimeType]) || "ogg";
    return `${name}.${ext}`;
}

export class GroqTranscriber implements Transcriber {
    private readonly apiKey: string;
    private readonly model: string;
    private readonly defaultLanguage?: string;
    private readonly endpoint: string;

    constructor(config: GroqTranscriberConfig) {
        if (!config.apiKey) {
            throw new Error("GROQ_API_KEY is required for transcription");
        }
        this.apiKey = config.apiKey;
        this.model = config.model ?? "whisper-large-v3";
        this.defaultLanguage = config.defaultLanguage;
        const baseUrl = (config.baseUrl ?? "https://api.groq.com/openai/v1").replace(/\/+$/, "");
        this.endpoint = `${baseUrl}/audio/transcriptions`;
    }

    async transcribeAudio(filePath: string, options?: TranscribeOptions): Promise<string> {
        const buffer = await readFile(filePath);
        const language = resolveLanguage(options?.language, this.defaultLanguage);
        const fileName = resolveFileName(filePath, options?.mimeType);

        const result = await pRetry(
            async () => {
                // Rebuilt per attempt — a FormData body stream cannot be reused after a failed send.
                const form = new FormData();
                form.append("model", this.model);
                form.append("file", new Blob([buffer]), fileName);
                form.append("response_format", "json");
                if (language) form.append("language", language);
                if (options?.prompt) form.append("prompt", options.prompt);

                const res = await fetch(this.endpoint, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${this.apiKey}` },
                    body: form,
                });
                if (!res.ok) {
                    const detail = await res.text().catch(() => "");
                    throw new Error(
                        `Groq transcription failed (${res.status} ${res.statusText}): ${detail.slice(0, 500)}`,
                    );
                }
                return (await res.json()) as { text?: string };
            },
            {
                retries: 3,
                onFailedAttempt: (error: FailedAttemptError) => {
                    console.warn(
                        `Transcription attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
                        error.message,
                    );
                },
            },
        );

        const text = typeof result.text === "string" ? result.text.trim() : "";
        if (!text) throw new Error("Groq returned empty transcription text");
        return text;
    }
}
