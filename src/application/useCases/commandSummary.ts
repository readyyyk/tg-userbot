import { Api, type TelegramClient } from "telegram";
import type { AI } from "@/domain/ai";
import { MESSAGES } from "@/messages";
import { isGroupPeer, isVoiceMessage, replyTo } from "@/telegram/utils";

function parseSummaryCommand(
	text: string | undefined,
): { count: number; promptAddition?: string } | null {
	const raw = (text ?? "").trim();
	if (!raw.startsWith("/summary")) return null;

	const parts = raw
		.replace(/^\/summary\s*/i, "")
		.trim()
		.split(/\s+/);
	if (parts.length === 0 || parts[0] === "") return null;

	const count = Number.parseInt(parts[0], 10);
	if (!Number.isFinite(count) || count <= 0) return null;

	const promptAddition = parts.slice(1).join(" ").trim() || undefined;

	return { count, promptAddition };
}

async function getSenderDisplayName(
	client: TelegramClient,
	message: Api.Message,
): Promise<string> {
	if (!message.fromId) return "Unknown";

	try {
		if (message.fromId instanceof Api.PeerUser) {
			const user = await client.getEntity(message.fromId);
			if (user instanceof Api.User) {
				if (user.username) {
					return `@${user.username}`;
				}
				if (user.firstName || user.lastName) {
					return [user.firstName, user.lastName]
						.filter(Boolean)
						.join(" ")
						.trim();
				}
				return `User ${user.id}`;
			}
		}
	} catch (error) {
		console.error("Error getting sender display name:", error);
	}

	return "Unknown";
}

function formatMediaMessage(message: Api.Message): string | null {
	const media = message.media;
	if (!media) return null;

	// Photo (grouped photos are handled separately in formatMessagesWithUsernames)
	if (media instanceof Api.MessageMediaPhoto) {
		return "*photo*";
	}

	// Sticker
	if (media instanceof Api.MessageMediaDocument) {
		const document = media.document;
		if (document instanceof Api.Document) {
			const isSticker = document.attributes?.some(
				(attr) => attr instanceof Api.DocumentAttributeSticker,
			);
			if (isSticker) {
				return "*sticker*";
			}

			// Voice message
			if (isVoiceMessage(message)) {
				return "*voice message*";
			}

			// Video
			const isVideo = document.attributes?.some(
				(attr) => attr instanceof Api.DocumentAttributeVideo,
			);
			if (isVideo) {
				return "*video message*";
			}

			// Audio (music)
			const isAudio = document.attributes?.some(
				(attr) =>
					attr instanceof Api.DocumentAttributeAudio &&
					!(attr as Api.DocumentAttributeAudio).voice,
			);
			if (isAudio) {
				return "*audio file*";
			}

			// Other documents (files)
			const mimeType = document.mimeType;
			if (mimeType) {
				// Extract file extension from mime type or filename
				let fileType = "file";
				const fileNameAttr = document.attributes?.find(
					(attr) => attr instanceof Api.DocumentAttributeFilename,
				);

				if (fileNameAttr instanceof Api.DocumentAttributeFilename) {
					const ext = fileNameAttr.fileName.split(".").pop()?.toLowerCase();
					if (ext) {
						fileType = `${ext} file`;
					}
				} else {
					// Try to infer from mime type
					const mimeParts = mimeType.split("/");
					if (mimeParts.length === 2) {
						const type = mimeParts[0];
						const subtype = mimeParts[1];
						if (type === "application") {
							fileType = `${subtype} file`;
						} else {
							fileType = `${subtype} file`;
						}
					}
				}

				return `*${fileType}*`;
			}

			return "*file*";
		}
	}

	// Video (as media, not document)
	if (media instanceof Api.MessageMediaDocument) {
		const document = media.document;
		if (document instanceof Api.Document) {
			const isVideo = document.attributes?.some(
				(attr) => attr instanceof Api.DocumentAttributeVideo,
			);
			if (isVideo) {
				return "*video message*";
			}
		}
	}

	// Contact
	if (media instanceof Api.MessageMediaContact) {
		return "*contact*";
	}

	// Location
	if (
		media instanceof Api.MessageMediaGeo ||
		media instanceof Api.MessageMediaVenue
	) {
		return "*location*";
	}

	// Poll
	if (media instanceof Api.MessageMediaPoll) {
		return "*poll*";
	}

	return "*media*";
}

async function formatMessagesWithUsernames(
	client: TelegramClient,
	messages: Api.Message[],
): Promise<string> {
	const formattedMessages: string[] = [];
	const userCache = new Map<string, string>();

	// Group messages by groupedId to count photos in albums
	// Use string representation of BigInteger for Map key
	const groupedMessages = new Map<string, Api.Message[]>();
	for (const msg of messages) {
		if (msg.groupedId) {
			const groupIdStr = String(msg.groupedId);
			if (!groupedMessages.has(groupIdStr)) {
				groupedMessages.set(groupIdStr, []);
			}
			const group = groupedMessages.get(groupIdStr);
			if (group) {
				group.push(msg);
			}
		}
	}

	const processedGroupIds = new Set<string>();

	for (const msg of messages) {
		// Skip if already processed as part of a group
		if (msg.groupedId && processedGroupIds.has(String(msg.groupedId))) {
			continue;
		}

		let senderName = "Unknown";
		if (msg.fromId instanceof Api.PeerUser) {
			const userId = String(msg.fromId.userId);
			const cachedName = userCache.get(userId);
			if (cachedName) {
				senderName = cachedName;
			} else {
				senderName = await getSenderDisplayName(client, msg);
				userCache.set(userId, senderName);
			}
		}

		const timestamp = msg.date
			? new Date(msg.date * 1000).toISOString()
			: "unknown";
		const messageId = String(msg.id);
		const timestampWithId = `[${timestamp}:${messageId}]`;

		// Check if message is a reply
		const replyToMsgId = msg.replyTo?.replyToMsgId;
		const replyPrefix = replyToMsgId ? `(reply to ${replyToMsgId}) ` : "";

		// Handle grouped media (photos, documents, etc.)
		if (msg.groupedId) {
			const groupIdStr = String(msg.groupedId);
			const grouped = groupedMessages.get(groupIdStr);
			if (grouped) {
				processedGroupIds.add(groupIdStr);

				const photos = grouped.filter(
					(m) => m.media instanceof Api.MessageMediaPhoto,
				);
				const documents = grouped.filter(
					(m) => m.media instanceof Api.MessageMediaDocument,
				);

				const mediaDescriptions: string[] = [];

				if (photos.length > 0) {
					if (photos.length > 1) {
						mediaDescriptions.push(`*${photos.length} photos*`);
					} else {
						mediaDescriptions.push("*photo*");
					}
				}

				// Handle grouped documents (files)
				if (documents.length > 0) {
					const fileTypes: string[] = [];
					for (const docMsg of documents) {
						const desc = formatMediaMessage(docMsg);
						if (desc && desc !== "*media*") {
							// Remove asterisks and add to list
							const cleanDesc = desc.replace(/\*/g, "");
							fileTypes.push(cleanDesc);
						}
					}
					if (fileTypes.length > 0) {
						mediaDescriptions.push(`*${fileTypes.join(", ")}*`);
					}
				}

				const text = msg.message ? ` ${msg.message}` : "";
				const mediaText =
					mediaDescriptions.length > 0
						? mediaDescriptions.join(", ")
						: "*media*";
				formattedMessages.push(
					`${timestampWithId} ${senderName}: ${replyPrefix}${mediaText}${text}`,
				);
				continue;
			}
		}

		// Handle media messages
		const mediaDescription = formatMediaMessage(msg);
		if (mediaDescription) {
			const text = msg.message ? ` ${msg.message}` : "";
			formattedMessages.push(
				`${timestampWithId} ${senderName}: ${replyPrefix}${mediaDescription}${text}`,
			);
			continue;
		}

		// Handle text messages
		if (msg.message) {
			formattedMessages.push(
				`${timestampWithId} ${senderName}: ${replyPrefix}${msg.message}`,
			);
		}
	}

	return formattedMessages.join("\n\n");
}

export async function commandSummary(
	ctx: { client: TelegramClient; message: Api.Message },
	deps: { ai: AI },
): Promise<void> {
	const { client, message } = ctx;

	try {
		const parsed = parseSummaryCommand(message.message);
		if (!parsed) {
			await replyTo(
				client,
				message,
				"Использование: /summary {количество} [дополнительные инструкции]",
			);
			return;
		}

		const { count, promptAddition } = parsed;

		// Only work in groups
		if (!isGroupPeer(message.peerId)) {
			await replyTo(
				client,
				message,
				"Команда /summary работает только в группах.",
			);
			return;
		}

		// Check if message is in a topic (forum-style group)
		// replyToTopId is the topic's general message ID
		// In forum supergroups, messages in a topic have replyToTopId set
		// Even if the message is not a reply, if it's in a topic, replyToTopId should be set
		const topicId = message.replyTo?.replyToTopId;

		// Fetch the last N messages
		// Note: We fetch more messages if filtering by topic, since some will be filtered out
		const fetchLimit =
			topicId !== undefined && topicId !== null ? count * 2 : count;
		const messages = await client.getMessages(message.peerId, {
			limit: fetchLimit,
		});

		if (!Array.isArray(messages) || messages.length === 0) {
			await replyTo(
				client,
				message,
				"Не удалось получить сообщения из группы.",
			);
			return;
		}

		// Filter messages:
		// 1. Exclude the command message itself
		// 2. If in a topic, only include messages from the same topic
		// 3. Only include messages with text or media
		// Then reverse to get chronological order and limit to requested count
		let relevantMessages = messages
			.filter((msg): msg is Api.Message => {
				if (!(msg instanceof Api.Message)) return false;
				if (msg.id === message.id) return false;
				if (!msg.message && !msg.media) return false;

				// Topic filtering logic:
				// - If command is not in a topic (topicId is undefined/null), include all messages
				// - If command is in a topic, only include messages from the same topic
				//   In forum supergroups, messages in a topic have replyToTopId set
				if (topicId === undefined || topicId === null) {
					// Not in a topic, include all messages
					return true;
				}

				// In a topic - only include messages from the same topic
				// Messages in a topic should have replyToTopId matching the topic ID
				const msgTopicId = msg.replyTo?.replyToTopId;
				return msgTopicId === topicId;
			})
			.reverse();

		// Limit to requested count after filtering
		if (relevantMessages.length > count) {
			relevantMessages = relevantMessages.slice(0, count);
		}

		if (relevantMessages.length === 0) {
			await replyTo(client, message, "Не найдено сообщений для анализа.");
			return;
		}

		// Format messages with username annotations
		const formattedConversation = await formatMessagesWithUsernames(
			client,
			relevantMessages,
		);

		// Build the prompt for AI
		const basePrompt = `
Суммаризируй приведённую ниже переписку из Telegram-чата. Требования:
1. Формулируй выводы строго по фактам, содержащимся в тексте.
2. Не добавляй интерпретаций, оценочных суждений, предположений или субъективных выводов.
3. Структура суммаризации должна быть чёткой и краткой.
Входные данные для суммаризации:
\n${formattedConversation}
`;
		const finalPrompt = promptAddition
			? `${basePrompt}\n\nДополнительные требования: ${promptAddition}`
			: basePrompt;

		// Get summary from AI
		const summary = await deps.ai.generateText(finalPrompt);

		// Send summary back to chat
		await replyTo(
			client,
			message,
			`Краткое содержание (последние ${relevantMessages.length} сообщений):\n\n${summary}`,
		);
	} catch (error) {
		console.error("Error handling /summary:", error);
		await replyTo(client, message, MESSAGES.error);
	}
}
