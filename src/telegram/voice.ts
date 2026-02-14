import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Api, TelegramClient } from "telegram";
import { getPeerLabelFromMessage } from "@/telegram/utils";

const voicesDir = join(process.cwd(), "voices");

async function ensureVoicesDir(): Promise<void> {
    await mkdir(voicesDir, { recursive: true });
}

export function buildVoiceFileName(message: Api.Message): string {
    const peerId = getPeerLabelFromMessage(message);
    return `voice-${peerId}-${String(message.id)}-${Date.now()}.ogg`;
}

export async function saveVoiceFromMessage(client: TelegramClient, message: Api.Message): Promise<string> {
    await ensureVoicesDir();
    const fileName = buildVoiceFileName(message);
    const destPath = join(voicesDir, fileName);
    const data = await client.downloadMedia(message, {});
    if (!data) throw new Error("Failed to download voice media");
    if (data instanceof Uint8Array) {
        await writeFile(destPath, Buffer.from(data));
    } else {
        throw new Error("Unexpected media type returned while downloading voice message");
    }
    return destPath;
}
