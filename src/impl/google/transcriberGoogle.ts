import { createPartFromUri, createUserContent, GoogleGenAI } from "@google/genai";
import type { TranscribeOptions, Transcriber } from "@/domain/transcriber";

export type GoogleTranscriberConfig = {
    apiKey: string;
    model?: string;
};

export class GoogleGenAiTranscriber implements Transcriber {
    private readonly client: GoogleGenAI;
    private readonly model: string;

    constructor(config: GoogleTranscriberConfig) {
        if (!config.apiKey) {
            throw new Error("GOOGLE_API_KEY is required for transcription");
        }
        this.client = new GoogleGenAI({ apiKey: config.apiKey });
        this.model = config.model ?? "gemini-2.5-flash";
    }

    async transcribeOggFile(filePath: string, options?: TranscribeOptions): Promise<string> {
        const uploaded = await this.client.files.upload({
            file: filePath,
            config: { mimeType: "audio/ogg" },
        });

        const language = options?.language ?? "Russian";
        const userPrompt =
            options?.prompt ??
            `You are a transcription model.
Transcribe the provided voice message into ${language} with maximum accuracy, preserving meaning and natural flow.
Do not include explanations, metadata, timestamps, or any additional text — only the transcription result`;

        const uri = uploaded.uri;
        const mimeType = uploaded.mimeType;
        if (!uri || !mimeType) {
            throw new Error("Google file upload did not return a URI or mimeType");
        }
        const result = await this.client.models.generateContent({
            model: this.model,
            contents: createUserContent([createPartFromUri(uri, mimeType), userPrompt]),
        });

        const text = (result as { text?: string }).text ?? "";
        const trimmed = typeof text === "string" ? text.trim() : "";
        if (!trimmed) throw new Error("Failed to extract transcription text from Google GenAI response");
        return trimmed;
    }
}
