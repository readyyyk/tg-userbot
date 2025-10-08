import { Api, type TelegramClient } from "telegram";
import { MESSAGES } from "@/messages";

export function isVoiceMessage(message: Api.Message | undefined): boolean {
    if (!message) return false;
    const media = message.media;
    if (!(media instanceof Api.MessageMediaDocument)) return false;
    const document = media.document;
    if (!(document instanceof Api.Document)) return false;
    const hasVoiceAttribute = document.attributes?.some((attr: Api.TypeDocumentAttribute) => {
        return attr instanceof Api.DocumentAttributeAudio && Boolean((attr as Api.DocumentAttributeAudio).voice);
    });
    if (hasVoiceAttribute) return true;
    const mime = document.mimeType?.toLowerCase();
    return mime === "audio/ogg";
}

export function isPrivatePeer(peer: Api.TypePeer | undefined): boolean {
    return Boolean(peer && peer instanceof Api.PeerUser);
}

export function isGroupPeer(peer: Api.TypePeer | undefined): boolean {
    return Boolean(peer && (peer instanceof Api.PeerChat || peer instanceof Api.PeerChannel));
}

export function getPeerLabelFromMessage(message: Api.Message): string {
    const p = message.peerId;
    if (p instanceof Api.PeerUser) return `user-${String(p.userId)}`;
    if (p instanceof Api.PeerChat) return `chat-${String(p.chatId)}`;
    if (p instanceof Api.PeerChannel) return `channel-${String(p.channelId)}`;
    return "unknown";
}

export function getSenderUserId(message: Api.Message): string | null {
    const f = message.fromId;
    if (f instanceof Api.PeerUser) return String(f.userId);
    return null;
}

export async function getRepliedMessage(client: TelegramClient, message: Api.Message): Promise<Api.Message | null> {
    const repliedMsgId = message.replyTo?.replyToMsgId;
    if (!repliedMsgId) return null;
    const fetched = await client.getMessages(message.peerId, { ids: repliedMsgId });
    const replied = Array.isArray(fetched) ? fetched[0] : fetched;
    return replied instanceof Api.Message ? replied : null;
}

const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
const PREFIX_LENGTH = MESSAGES.userBotMark.length + 1; // userBotMark + \n
const MAX_TEXT_LENGTH = TELEGRAM_MAX_MESSAGE_LENGTH - PREFIX_LENGTH;

function splitText(text: string): string[] {
    if (text.length <= MAX_TEXT_LENGTH) {
        return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > MAX_TEXT_LENGTH) {
        // Try to split at a newline first
        let splitIndex = remaining.lastIndexOf('\n', MAX_TEXT_LENGTH);
        
        // If no newline found, try to split at a space (word boundary)
        if (splitIndex === -1 || splitIndex < MAX_TEXT_LENGTH * 0.5) {
            splitIndex = remaining.lastIndexOf(' ', MAX_TEXT_LENGTH);
        }
        
        // If still no good split point, just split at max length
        if (splitIndex === -1 || splitIndex < MAX_TEXT_LENGTH * 0.5) {
            splitIndex = MAX_TEXT_LENGTH;
        }

        chunks.push(remaining.substring(0, splitIndex).trimEnd());
        remaining = remaining.substring(splitIndex).trimStart();
    }

    if (remaining.length > 0) {
        chunks.push(remaining);
    }

    return chunks;
}

export async function replyTo(client: TelegramClient, message: Api.Message, text: string): Promise<void> {
    const chunks = splitText(text);

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const finalText = `${MESSAGES.userBotMark}\n${chunk}`;

        const entities: Api.TypeMessageEntity[] = [
            new Api.MessageEntityBlockquote({
                offset: MESSAGES.userBotMark.length + 1,
                length: finalText.length - MESSAGES.userBotMark.length - 1,
                collapsed: true,
            }),
        ];

        await client.sendMessage(message.peerId, {
            message: finalText,
            replyTo: i === 0 ? message.id : undefined, // Only first message replies to original
            formattingEntities: entities,
        });
    }
}
