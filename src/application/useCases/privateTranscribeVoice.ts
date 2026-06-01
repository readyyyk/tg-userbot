import type { Api, TelegramClient } from "telegram";
import type { Transcriber } from "@/domain/transcriber";
import { MESSAGES } from "@/messages";
import { isVoiceOrVideoNote, replyTo } from "@/telegram/utils";
import { saveAudioFromMessage } from "@/telegram/voice";

export async function privateTranscribeVoice(
    ctx: { client: TelegramClient; message: Api.Message },
    deps: { transcriber: Transcriber },
): Promise<void> {
    const { client, message } = ctx;
    if (!isVoiceOrVideoNote(message)) return;
    try {
        const filePath = await saveAudioFromMessage(client, message);
        const text = await deps.transcriber.transcribeAudio(filePath);
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
