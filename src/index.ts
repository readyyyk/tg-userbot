import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { GoogleGenAi } from "@/impl/google/aiGoogle";
import { GoogleGenAiTranscriber } from "@/impl/google/transcriberGoogle";
import { TgUserbot } from "@/presentation/bot";
import { createHandlers } from "@/presentation/handlers";

async function prompt(question: string): Promise<string> {
    const { createInterface } = await import("node:readline/promises");
    const { stdin, stdout } = await import("node:process");
    const rl = createInterface({ input: stdin, output: stdout });
    try {
        const answer = await rl.question(question);
        return answer.trim();
    } finally {
        rl.close();
    }
}

const apiIdEnv = process.env.TG_API_ID;
const apiHashEnv = process.env.TG_API_HASH;
const sessionStringEnv = process.env.TG_SESSION ?? "";

if (!apiIdEnv || !apiHashEnv) {
    console.error("TG_API_ID and TG_API_HASH are required");
    process.exit(1);
}

const apiId = Number(apiIdEnv);
if (!Number.isFinite(apiId)) {
    console.error("TG_API_ID must be a number");
    process.exit(1);
}
const apiHash: string = apiHashEnv;

async function main() {
    const stringSession = new StringSession(sessionStringEnv);
    const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });

    await client.start({
        phoneNumber: async () => process.env.TG_PHONE_NUMBER ?? (await prompt("Phone number: ")),
        password: async () => process.env.TG_PASSWORD ?? (await prompt("2FA password (if any): ")),
        phoneCode: async () => process.env.TG_PHONE_CODE ?? (await prompt("Code you received: ")),
        onError: (err) => console.error("Login error:", err),
    });

    console.log("Userbot started");
    const exportedSession = client.session.save();
    if (!sessionStringEnv && exportedSession) {
        console.log("Save this TG_SESSION for future runs:");
        console.log(exportedSession);
    }

    const googleApiKey = process.env.GOOGLE_API_KEY ?? "";
    const googleModel = process.env.GOOGLE_MODEL ?? "gemini-2.5-flash";
    const googleTextModel = process.env.GOOGLE_TEXT_MODEL ?? googleModel;

    const transcriber = new GoogleGenAiTranscriber({ apiKey: googleApiKey, model: googleModel });
    const ai = new GoogleGenAi({ apiKey: googleApiKey, model: googleTextModel });
    const handlers = createHandlers({ transcriber, ai });
    const bot = new TgUserbot(client, handlers);
    await bot.start();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

process.once("SIGINT", () => process.exit(0));
process.once("SIGTERM", () => process.exit(0));
