import { Api, type TelegramClient } from "telegram";
import { commandAi } from "@/application/useCases/commandAi";
import { commandGoogle } from "@/application/useCases/commandGoogle";
import { commandN } from "@/application/useCases/commandN";
import { commandSummary } from "@/application/useCases/commandSummary";
import { commandTldr } from "@/application/useCases/commandTldr";
import { commandTranscribeVoice } from "@/application/useCases/commandTranscribeVoice";
import { privateTranscribeVoice } from "@/application/useCases/privateTranscribeVoice";
import type { AI } from "@/domain/ai";
import type { Transcriber } from "@/domain/transcriber";
import { getPeerId, isPrivatePeer, isVoiceMessage } from "@/telegram/utils";

export type Handler = Array<{
	name: string;
	isTriggered: (ctx: {
		client: TelegramClient;
		message: Api.Message;
		selfUserId?: string | null;
	}) => Promise<boolean>;
	handler: (ctx: {
		client: TelegramClient;
		message: Api.Message;
	}) => Promise<void>;
}>;

const isSenderSelf = (
	message: Parameters<Handler[number]["isTriggered"]>["0"]["message"],
	selfUserId: Parameters<Handler[number]["isTriggered"]>["0"]["selfUserId"],
): boolean => {
	if (!selfUserId) return false;

	const sender = message.fromId;
	const senderId =
		sender instanceof Api.PeerUser ? String(sender.userId) : null;
	if (!senderId) return false;

	return senderId === selfUserId;
};

export function createHandlers(deps: {
	transcriber: Transcriber;
	ai: AI;
	autoTranscribePeerIds: Set<string>;
	transcribeDisabledPeerIds: Set<string>;
}): Handler {
	return [
		{
			name: "Private auto voice",
			isTriggered: async ({ message }) => {
				if (!isVoiceMessage(message)) return false;
				const peerId = getPeerId(message);
				if (peerId && deps.transcribeDisabledPeerIds.has(peerId)) return false;
				return isPrivatePeer(message.peerId) || (!!peerId && deps.autoTranscribePeerIds.has(peerId));
			},
			handler: async (ctx) =>
				privateTranscribeVoice(ctx, { transcriber: deps.transcriber }),
		},
		{
			name: "Group/Private command /convert",
			isTriggered: async ({ message, selfUserId }) => {
				if (!isSenderSelf(message, selfUserId)) return false;

				const text = (message.message ?? "").trim();
				return text.startsWith("/convert");
			},
			handler: async (ctx) =>
				commandTranscribeVoice(ctx, { transcriber: deps.transcriber }),
		},
		{
			name: "Group/Private command /ai {prompt}",
			isTriggered: async ({ message, selfUserId }) => {
				if (!isSenderSelf(message, selfUserId)) return false;

				const text = (message.message ?? "").trim();
				return text.startsWith("/ai");
			},
			handler: async (ctx) =>
				commandAi(ctx, { ai: deps.ai, transcriber: deps.transcriber }),
		},
		{
			name: "Group/Private command /tldr",
			isTriggered: async ({ message, selfUserId }) => {
				if (!isSenderSelf(message, selfUserId)) return false;

				const text = (message.message ?? "").trim();
				return text.startsWith("/tldr");
			},
			handler: async (ctx) =>
				commandTldr(ctx, { ai: deps.ai, transcriber: deps.transcriber }),
		},
		{
			name: "Group/Private command /g {query}",
			isTriggered: async ({ message, selfUserId }) => {
				if (!isSenderSelf(message, selfUserId)) return false;

				const text = (message.message ?? "").trim();
				return text.startsWith("/g");
			},
			handler: async (ctx) => commandGoogle(ctx),
		},
		{
			name: "Group command /summary {count} [prompt]",
			isTriggered: async ({ message, selfUserId }) => {
				if (!isSenderSelf(message, selfUserId)) return false;

				const text = (message.message ?? "").trim();
				return text.startsWith("/summary");
			},
			handler: async (ctx) => commandSummary(ctx, { ai: deps.ai }),
		},
		{
			name: "Group/Private command /n",
			isTriggered: async ({ message, selfUserId }) => {
				if (!isSenderSelf(message, selfUserId)) return false;

				const text = (message.message ?? "").trim();
				return text.startsWith("/n");
			},
			handler: async (ctx) => commandN(ctx),
		},
	];
}
