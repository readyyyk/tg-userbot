import pRetry from "p-retry";
import type { FailedAttemptError } from "p-retry";
import type { AI, GenerateOptions } from "@/domain/ai";

export type GroqAiConfig = {
    apiKey: string;
    model?: string;
    baseUrl?: string;
};

const DEFAULT_SYSTEM = `Tell it like it is; NEVER sugar-coat responses. Get right to the point. Be practical above all.`;

type ChatCompletion = {
    choices?: Array<{ message?: { content?: string } }>;
};

export class GroqAi implements AI {
    private readonly apiKey: string;
    private readonly model: string;
    private readonly endpoint: string;

    constructor(config: GroqAiConfig) {
        if (!config.apiKey) {
            throw new Error("GROQ_API_KEY is required for AI generation");
        }
        this.apiKey = config.apiKey;
        this.model = config.model ?? "groq/compound";
        const baseUrl = (config.baseUrl ?? "https://api.groq.com/openai/v1").replace(/\/+$/, "");
        this.endpoint = `${baseUrl}/chat/completions`;
    }

    async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
        const system = options?.system ?? DEFAULT_SYSTEM;
        const body = {
            model: this.model,
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt },
            ],
        };

        const result = await pRetry(
            async () => {
                const res = await fetch(this.endpoint, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const detail = await res.text().catch(() => "");
                    throw new Error(
                        `Groq chat completion failed (${res.status} ${res.statusText}): ${detail.slice(0, 500)}`,
                    );
                }
                return (await res.json()) as ChatCompletion;
            },
            {
                retries: 3,
                onFailedAttempt: (error: FailedAttemptError) => {
                    console.warn(
                        `AI call attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
                        error.message,
                    );
                },
            },
        );

        const text = result.choices?.[0]?.message?.content ?? "";
        const trimmed = typeof text === "string" ? text.trim() : "";
        if (!trimmed) throw new Error("Groq returned empty AI response text");
        return trimmed;
    }
}
