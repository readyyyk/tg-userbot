import type { Api, TelegramClient } from "telegram";
import { getRepliedMessage, replyTo } from "@/telegram/utils";

function parseGoogleQuery(text: string | undefined): string {
    const raw = (text ?? "").trim();
    if (!raw.startsWith("/g")) { return raw; }
    return raw.replace(/^\/g\s*/i, "").trim();
}

function buildGoogleSearchUrl(query: string): string {
    const encodedQuery = encodeURIComponent(query);
    return `google.com/search?q=${encodedQuery}`;
}

export async function commandGoogle(
    ctx: { client: TelegramClient; message: Api.Message },
): Promise<void> {
    const { client, message } = ctx;
    try {
        const userQuery = parseGoogleQuery(message.message);
        const replied = await getRepliedMessage(client, message);

        let searchQuery = userQuery;
        if (replied && replied.message) {
            const repliedText = replied.message.trim();
            if (userQuery) {
                // Combine user query and replied message text
                searchQuery = `${userQuery} ${repliedText}`;
            } else {
                // Use only replied message text
                searchQuery = repliedText;
            }
        }

        if (!searchQuery) {
            await replyTo(client, message, "Использование: /g {текст} (можно ответом на сообщение)");
            return;
        }

        const googleUrl = buildGoogleSearchUrl(searchQuery);
        await replyTo(client, message, googleUrl);
    } catch (error) {
        console.error("Error handling /g:", error);
        await replyTo(client, message, "Произошла ошибка при обработке запроса.");
    }
}

