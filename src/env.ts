import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const commaSeparatedSet = z
	.string()
	.optional()
	.transform((v) => new Set(v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []));

const optionalNonEmptyString = z
	.string()
	.optional()
	.transform((v) => (v?.trim() ? v : undefined));

export const env = createEnv({
	server: {
		TG_API_ID: z.coerce.number().int().positive(),
		TG_API_HASH: z.string().min(1),
		TG_SESSION: z.string().optional().default(""),
		TG_PHONE_NUMBER: optionalNonEmptyString,
		TG_PASSWORD: optionalNonEmptyString,
		TG_PHONE_CODE: optionalNonEmptyString,
		GROQ_API_KEY: z.string().min(1),
		WHISPER_MODEL: z.string().optional().default("whisper-large-v3"),
		WHISPER_LANGUAGE: optionalNonEmptyString,
		GROQ_TEXT_MODEL: z.string().optional().default("groq/compound"),
		AUTO_TRANSCRIBE_PEER_IDS: commaSeparatedSet,
		TRANSCRIBE_DISABLED_PEER_IDS: commaSeparatedSet,
	},
	runtimeEnv: process.env,
});
