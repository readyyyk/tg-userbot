import type { Api, TelegramClient } from "telegram";
import type { Transcriber } from "@/domain/transcriber";
import { MESSAGES } from "@/messages";
import {
    getDocumentMimeType,
    getRepliedMessage,
    isAudioDocument,
    isVideoNote,
    isVoiceMessage,
    replyTo,
} from "@/telegram/utils";
import { saveAudioFromMessage } from "@/telegram/voice";

export async function commandTranscribeVoice(
    ctx: { client: TelegramClient; message: Api.Message },
    deps: { transcriber: Transcriber },
): Promise<void> {
    const { client, message } = ctx;
    const replied = await getRepliedMessage(client, message);
    if (!replied || (!isVoiceMessage(replied) && !isAudioDocument(replied) && !isVideoNote(replied))) {
        await replyTo(client, message, MESSAGES.notVoiceReply);
        return;
    }
    try {
        const filePath = await saveAudioFromMessage(client, replied);
        const mimeType = getDocumentMimeType(replied) ?? "audio/ogg";
        const text = await deps.transcriber.transcribeAudio(filePath, { mimeType });
        const cleaned = text.trim();
        if (cleaned) {
            await replyTo(client, message, `Расшифровка:\n${cleaned}`);
        } else {
            await replyTo(client, message, "Расшифровка: <empty>");
        }
    } catch (error) {
        console.error("Error transcribing group/private convert:", error);
        await replyTo(client, message, MESSAGES.error);
    }
}
