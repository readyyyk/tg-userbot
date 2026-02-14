import type { Api, TelegramClient } from "telegram";
import type { AI } from "@/domain/ai";
import type { Transcriber } from "@/domain/transcriber";
import { MESSAGES } from "@/messages";
import { getRepliedMessage, isVoiceMessage, replyTo } from "@/telegram/utils";
import { saveVoiceFromMessage } from "@/telegram/voice";

const buildTldrPrompt = (text: string): string => {
	return `Твоя задача — преобразовать большой объём текста в краткие, но информативные пункты.

КРИТИЧЕСКИ ВАЖНЫЕ ТРЕБОВАНИЯ:

1. СОХРАНЕНИЕ КОНТЕКСТА:
   - Сохрани ВСЮ важную информацию из исходного текста
   - Не удаляй никакие факты, данные, имена, даты, числа, ссылки, технические детали
   - Не делай предположений о том, что можно опустить
   - Если в тексте есть конкретные примеры, цитаты, или детали — они должны быть включены

2. ФОРМАТ ВЫВОДА:
   - Используй формат маркированного списка (bullet points)
   - Каждый пункт должен быть самостоятельным и информативным
   - Пункты могут быть как одним предложением, так и несколькими, если это необходимо для сохранения контекста
   - Используй простой, прямой язык без лишних слов
   - НАЧИНАЙ СРАЗУ С ПУНКТОВ, БЕЗ ВСТУПИТЕЛЬНЫХ ФРАЗ

3. ЧТО УБРАТЬ (только это):
   - Повторы одной и той же информации
   - Водные фразы типа "как известно", "стоит отметить", "необходимо подчеркнуть"
   - Избыточные вводные конструкции
   - НО: если даже "водная" фраза содержит важную информацию — сохрани её в переформулированном виде

4. ЧТО ОБЯЗАТЕЛЬНО СОХРАНИТЬ:
   - Все факты и данные
   - Все имена собственные (люди, места, организации, продукты)
   - Все даты, числа, проценты, метрики
   - Все ссылки, названия файлов, команды, коды
   - Все причинно-следственные связи
   - Все условия, ограничения, требования
   - Контекст и обстоятельства, в которых происходят события

5. СТРУКТУРИРОВАНИЕ:
   - Если текст содержит несколько логических блоков — раздели их на отдельные пункты или группы пунктов
   - Сохрани логическую последовательность информации
   - Если есть иерархия информации — отрази её через вложенные пункты или нумерацию

6. ПРИМЕРЫ ПРАВИЛЬНОГО ПРЕОБРАЗОВАНИЯ:
   - ❌ ПЛОХО: "Обсудили проект" (потерян контекст)
   - ✅ ХОРОШО: "Обсудили проект X: сроки — до 15 марта, бюджет — 500к, ответственный — Иван Петров"
   
   - ❌ ПЛОХО: "Есть проблемы" (потеряны детали)
   - ✅ ХОРОШО: "Проблема: сервер падает при нагрузке >1000 RPS, ошибка в логах 'Connection timeout', воспроизводится с 10:00 UTC"

ВХОДНОЙ ТЕКСТ ДЛЯ ОБРАБОТКИ:

${text}

Теперь преобразуй этот текст в краткие, но полные пункты, сохранив всю важную информацию.`;
};

export async function commandTldr(
	ctx: { client: TelegramClient; message: Api.Message },
	deps: { ai: AI; transcriber: Transcriber },
): Promise<void> {
	const { client, message } = ctx;
	try {
		const replied = await getRepliedMessage(client, message);

		if (!replied) {
			await replyTo(
				client,
				message,
				"Использование: ответьте командой /tldr на сообщение с текстом (или голосовым сообщением).",
			);
			return;
		}

		let textToProcess: string;

		// Handle voice messages
		if (isVoiceMessage(replied)) {
			const filePath = await saveVoiceFromMessage(client, replied);
			textToProcess = (
				await deps.transcriber.transcribeOggFile(filePath, {
					language: "Russian",
				})
			).trim();
		} else {
			// Handle text messages
			textToProcess = replied.message?.trim() || "";
		}

		if (!textToProcess) {
			await replyTo(
				client,
				message,
				"В ответном сообщении нет текста для обработки.",
			);
			return;
		}

		// Build the extensive prompt
		const prompt = buildTldrPrompt(textToProcess);

		// Get TLDR from AI
		const tldr = await deps.ai.generateText(prompt);

		// Send TLDR back
		await replyTo(client, message, tldr);
	} catch (error) {
		console.error("Error handling /tldr:", error);
		await replyTo(client, message, MESSAGES.error);
	}
}

