import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const commaSeparatedSet = z
	.string()
	.optional()
	.transform((v) => new Set(v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []));

export const env = createEnv({
	server: {
		TG_API_ID: z.coerce.number().int().positive(),
		TG_API_HASH: z.string().min(1),
		TG_SESSION: z.string().optional().default(""),
		TG_PHONE_NUMBER: z.string().optional(),
		TG_PASSWORD: z.string().optional(),
		TG_PHONE_CODE: z.string().optional(),
		GOOGLE_API_KEY: z.string().min(1),
		GOOGLE_MODEL: z.string().optional().default("gemini-2.5-flash"),
		GOOGLE_TEXT_MODEL: z.string().optional(),
		AUTO_TRANSCRIBE_PEER_IDS: commaSeparatedSet,
		TRANSCRIBE_DISABLED_PEER_IDS: commaSeparatedSet,
	},
	runtimeEnv: process.env,
});
