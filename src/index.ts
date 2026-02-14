import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { env } from "@/env";
import { GoogleGenAi } from "@/impl/google/aiGoogle";
import { GoogleGenAiTranscriber } from "@/impl/google/transcriberGoogle";
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

	const googleTextModel = env.GOOGLE_TEXT_MODEL ?? env.GOOGLE_MODEL;

	const transcriber = new GoogleGenAiTranscriber({
		apiKey: env.GOOGLE_API_KEY,
		model: env.GOOGLE_MODEL,
	});
	const ai = new GoogleGenAi({ apiKey: env.GOOGLE_API_KEY, model: googleTextModel });
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
