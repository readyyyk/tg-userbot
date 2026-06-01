import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Api, TelegramClient } from "telegram";
import { getDocumentMimeType, getPeerLabelFromMessage } from "@/telegram/utils";

const voicesDir = join(process.cwd(), "voices");

async function ensureVoicesDir(): Promise<void> {
    await mkdir(voicesDir, { recursive: true });
}

const MIME_TO_EXT: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/flac": "flac",
    "audio/aac": "aac",
    "video/mp4": "mp4",
    "video/webm": "webm",
};

export function buildAudioFileName(message: Api.Message): string {
    const peerId = getPeerLabelFromMessage(message);
    const mime = getDocumentMimeType(message) ?? "audio/ogg";
    const ext = MIME_TO_EXT[mime] ?? "ogg";
    return `voice-${peerId}-${String(message.id)}-${Date.now()}.${ext}`;
}

export async function saveAudioFromMessage(client: TelegramClient, message: Api.Message): Promise<string> {
    await ensureVoicesDir();
    const fileName = buildAudioFileName(message);
    const destPath = join(voicesDir, fileName);
    const data = await client.downloadMedia(message, {});
    if (!data) throw new Error("Failed to download audio media");
    if (data instanceof Uint8Array) {
        await writeFile(destPath, Buffer.from(data));
    } else {
        throw new Error("Unexpected media type returned while downloading audio message");
    }
    return destPath;
}
