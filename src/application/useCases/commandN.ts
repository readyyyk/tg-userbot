import { Api, type TelegramClient } from "telegram";
import { MESSAGES } from "@/messages";
import { getRepliedMessage } from "@/telegram/utils";

const DISCLAIMER_TEXT = `Не является финансовым, инвестиционным или юридическим советом.
Вся информация приведена исключительно в образовательных и исследовательских целях.
Любые совпадения с реальными действиями и событиями случайны.
Все описанное рассматривается только в теоретическом ключе.
Происходит в вымышленном контексте (в GTA 5 RP).
Не призывает к каким-либо действиям в реальной жизни.
Ответственность за интерпретацию и применение информации лежит на читателе.`;

function parseMessageText(text: string | undefined): string {
	const raw = (text ?? "").trim();
	if (!raw.startsWith("/n")) return raw;
	return raw.replace(/^\/n\s*/i, "").trim();
}

async function getSelfUserId(client: TelegramClient): Promise<string | null> {
	const me = await client.getMe();
	return me instanceof Api.User ? String(me.id) : null;
}

function isMessageFromSelf(
	message: Api.Message,
	selfUserId: string | null,
): boolean {
	if (!selfUserId) return false;
	const sender = message.fromId;
	const senderId =
		sender instanceof Api.PeerUser ? String(sender.userId) : null;
	return senderId === selfUserId;
}

function addDisclaimerToText(text: string): {
	fullText: string;
	entities: Api.TypeMessageEntity[];
} {
	const mainText = text || "";
	const separator = mainText ? "\n\n" : "";
	const fullText = `${mainText}${separator}${DISCLAIMER_TEXT}`;

	// Calculate entity offsets for the minified quote (disclaimer part)
	const disclaimerStart = mainText.length + separator.length;
	const entities: Api.TypeMessageEntity[] = [
		new Api.MessageEntityBlockquote({
			offset: disclaimerStart,
			length: DISCLAIMER_TEXT.length,
			collapsed: true,
		}),
	];

	return { fullText, entities };
}

export async function commandN(ctx: {
	client: TelegramClient;
	message: Api.Message;
}): Promise<void> {
	const { client, message } = ctx;
	try {
		const selfUserId = await getSelfUserId(client);
		const repliedMessage = await getRepliedMessage(client, message);
		const messageText = parseMessageText(message.message);

		// Case 1: /n is a reply to another message
		if (repliedMessage && messageText === "") {
			// Only edit if the replied message is from the bot itself
			if (!isMessageFromSelf(repliedMessage, selfUserId)) {
				console.warn("Cannot edit message: replied message is not from self");
				return;
			}

			// Edit the replied message to add disclaimer
			const repliedText = repliedMessage.message || "";
			const { fullText, entities } = addDisclaimerToText(repliedText);

			await client.editMessage(repliedMessage.peerId, {
				message: repliedMessage.id,
				text: fullText,
				formattingEntities: entities,
			});

			// Delete the /n message
			await client.deleteMessages(message.peerId, [message.id], {
				revoke: true,
			});
			return;
		}

		// Case 2: /n with text (edit current message)
		const { fullText, entities } = addDisclaimerToText(messageText);

		await client.editMessage(message.peerId, {
			message: message.id,
			text: fullText,
			formattingEntities: entities,
		});
	} catch (error) {
		console.error("Error handling /n:", error);
		// If editing fails, try to reply with error
		try {
			await client.sendMessage(message.peerId, {
				message: MESSAGES.error,
				replyTo: message.id,
			});
		} catch (replyError) {
			console.error("Error replying with error message:", replyError);
		}
	}
}
