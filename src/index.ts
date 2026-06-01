import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { env } from "@/env";
import { GroqAi } from "@/impl/groq/aiGroq";
import { GroqTranscriber } from "@/impl/groq/transcriberGroq";
import { TgUserbot } from "@/presentation/bot";
import { createHandlers } from "@/presentation/handlers";

async function prompt(question: string): Promise<string> {
	const { createInterface } = await import("node:readline/promises");
	const { stdin, stdout } = await import("node:process");
	const rl = createInterface({ input: stdin, output: stdout });
	try {
		const answer = await rl.question(question);
		return answer.trim();
	} finally {
		rl.close();
	}
}

async function main() {
	const stringSession = new StringSession(env.TG_SESSION);
	const client = new TelegramClient(stringSession, env.TG_API_ID, env.TG_API_HASH, {
		connectionRetries: 5,
	});

	await client.start({
		phoneNumber: async () =>
			env.TG_PHONE_NUMBER ?? (await prompt("Phone number: ")),
		password: async () =>
			env.TG_PASSWORD ?? (await prompt("2FA password (if any): ")),
		phoneCode: async () =>
			env.TG_PHONE_CODE ?? (await prompt("Code you received: ")),
		onError: (err) => console.error("Login error:", err),
	});

	console.log("Userbot started");
	const exportedSession = client.session.save();
	if (!env.TG_SESSION && exportedSession) {
		console.log("Save this TG_SESSION for future runs:");
		console.log(exportedSession);
	}

	const transcriber = new GroqTranscriber({
		apiKey: env.GROQ_API_KEY,
		model: env.WHISPER_MODEL,
		// No default language → Whisper auto-detects per message (multilingual).
		// Set WHISPER_LANGUAGE (ISO-639-1, e.g. "ru") to pin a single language.
		defaultLanguage: env.WHISPER_LANGUAGE,
	});
	const ai = new GroqAi({ apiKey: env.GROQ_API_KEY, model: env.GROQ_TEXT_MODEL });
	const handlers = createHandlers({
		transcriber,
		ai,
		autoTranscribePeerIds: env.AUTO_TRANSCRIBE_PEER_IDS,
		transcribeDisabledPeerIds: env.TRANSCRIBE_DISABLED_PEER_IDS,
	});
	const bot = new TgUserbot(client, handlers);
	await bot.start();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

process.once("SIGINT", () => process.exit(0));
process.once("SIGTERM", () => process.exit(0));
