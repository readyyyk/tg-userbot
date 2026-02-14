import type { Api, TelegramClient } from "telegram";
import type { AI } from "@/domain/ai";
import type { Transcriber } from "@/domain/transcriber";
import { MESSAGES } from "@/messages";
import { getRepliedMessage, isVoiceMessage, replyTo } from "@/telegram/utils";
import { saveVoiceFromMessage } from "@/telegram/voice";

function parseAiPrompt(text: string | undefined): string {
    const raw = (text ?? "").trim();
    if (!raw.startsWith("/ai")) return raw;
    return raw.replace(/^\/ai\s*/i, "").trim();
}

type TBuildPromptArgs = { userPrompt: string; replied: Api.Message } & (
    | { transcript?: undefined }
    | { transcript: string }
);
const buildPrompt = (d: TBuildPromptArgs): string => {
    const additionalInfo = ""; // `пользователя ${d.replied.contact?.firstName} ${d.replied.contact?.lastName}`;
    if ("transcript" in d) {
        d.transcript;
        return d.userPrompt
            ? `${d.userPrompt}\n\nКонтекст (расшифровка голосового сообщения${additionalInfo}):\n${d.transcript}`
            : `Ответь по содержанию голосового сообщения${additionalInfo}:\n${d.transcript}`;
    }

    return d.userPrompt
        ? `${d.userPrompt}\n\nКонтекст (сообщение${additionalInfo}):\n${d.replied.message}`
        : `Ответь по содержанию сообщения${additionalInfo}:\n${d.replied.message}`;
};

export async function commandAi(
    ctx: { client: TelegramClient; message: Api.Message },
    deps: { ai: AI; transcriber: Transcriber },
): Promise<void> {
    const { client, message } = ctx;
    try {
        const userPrompt = parseAiPrompt(message.message);
        const replied = await getRepliedMessage(client, message);

        let finalPrompt = userPrompt;
        if (replied) {
            if (isVoiceMessage(replied)) {
                const filePath = await saveVoiceFromMessage(client, replied);
                const transcript = (await deps.transcriber.transcribeOggFile(filePath, { language: "Russian" })).trim();
                finalPrompt = buildPrompt({ userPrompt, replied, transcript });
            } else {
                finalPrompt = buildPrompt({ userPrompt, replied });
            }
        }

        if (!finalPrompt) {
            await replyTo(client, message, MESSAGES.aiUsage);
            return;
        }

        const answer = await deps.ai.generateText(finalPrompt);
        await replyTo(client, message, answer);
    } catch (error) {
        console.error("Error handling /ai:", error);
        await replyTo(client, message, MESSAGES.error);
    }
}
