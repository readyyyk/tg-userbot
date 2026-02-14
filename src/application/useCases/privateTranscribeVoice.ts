import type { Api, TelegramClient } from "telegram";
import type { Transcriber } from "@/domain/transcriber";
import { MESSAGES } from "@/messages";
import { isVoiceMessage, replyTo } from "@/telegram/utils";
import { saveVoiceFromMessage } from "@/telegram/voice";

export async function privateTranscribeVoice(
    ctx: { client: TelegramClient; message: Api.Message },
    deps: { transcriber: Transcriber },
): Promise<void> {
    const { client, message } = ctx;
    if (!isVoiceMessage(message)) return;
    try {
        const filePath = await saveVoiceFromMessage(client, message);
        const text = await deps.transcriber.transcribeOggFile(filePath, { language: "Russian" });
        const cleaned = text.trim();
        if (cleaned) {
            await replyTo(client, message, `Расшифровка:\n${cleaned}`);
        } else {
            await replyTo(client, message, "Расшифровка: <empty>");
        }
    } catch (error) {
        console.error("Error transcribing private voice:", error);
        await replyTo(client, message, MESSAGES.error);
    }
}
