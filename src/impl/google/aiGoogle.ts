import { createUserContent, GoogleGenAI } from "@google/genai";
import pRetry from "p-retry";
import type { FailedAttemptError } from "p-retry";
import type { AI, GenerateOptions } from "@/domain/ai";

export type GoogleAiConfig = {
    apiKey: string;
    model?: string;
};

export class GoogleGenAi implements AI {
    private readonly client: GoogleGenAI;
    private readonly model: string;

    constructor(config: GoogleAiConfig) {
        if (!config.apiKey) {
            throw new Error("GOOGLE_API_KEY is required for AI generation");
        }
        this.client = new GoogleGenAI({ apiKey: config.apiKey });
        this.model = config.model ?? "gemini-2.5-flash";
    }

    async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
        const system =
            options?.system ??
            `Tell it like it is; NEVER sugar-coat responses. Get right to the point. Be practical above all.`;
        const contents = createUserContent(`${system}\n\n${prompt}`);
        
        const result = await pRetry(
            async () => {
                return await this.client.models.generateContent({ model: this.model, contents });
            },
            {
                retries: 3,
                onFailedAttempt: (error: FailedAttemptError) => {
                    console.warn(
                        `AI call attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
                        error.message
                    );
                },
            }
        );
        
        const text = (result as { text?: string }).text ?? "";
        const trimmed = typeof text === "string" ? text.trim() : "";
        if (!trimmed) throw new Error("AI returned empty response text");
        return trimmed;
    }
}
