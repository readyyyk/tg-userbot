use teloxide::prelude::*;
use teloxide::net::Download;
use teloxide::types::{InputFile, Voice};
use std::sync::Arc;
use crate::google_ai::GoogleAiClient;
use anyhow::Result;

pub async fn ai_command(bot: Bot, msg: Message, prompt: String, ai_client: Arc<GoogleAiClient>) -> ResponseResult<()> {
    let mut final_prompt = prompt.trim().to_string();
    
    // Handle reply
    if let Some(replied) = msg.reply_to_message() {
        let replied_text = replied.text().map(|t| t.to_string()).unwrap_or_default();
        
        if let Some(replied_voice) = replied.voice() {
            // If replying to voice, transcribe it first
            match transcribe_voice_file(&bot, replied_voice, &ai_client).await {
                Ok(transcript) => {
                    if final_prompt.is_empty() {
                        final_prompt = format!("Ответь по содержанию голосового сообщения:\n{}", transcript);
                    } else {
                        final_prompt = format!("{}\n\nКонтекст (расшифровка голосового сообщения):\n{}", final_prompt, transcript);
                    }
                },
                Err(e) => {
                    log::error!("Failed to transcribe voice for AI context: {}", e);
                    bot.send_message(msg.chat.id, "Не удалось расшифровать голосовое сообщение для контекста.").await?;
                    return Ok(());
                }
            }
        } else if !replied_text.is_empty() {
            if final_prompt.is_empty() {
                 final_prompt = format!("Ответь по содержанию сообщения:\n{}", replied_text);
            } else {
                 final_prompt = format!("{}\n\nКонтекст (сообщение):\n{}", final_prompt, replied_text);
            }
        }
    }

    if final_prompt.is_empty() {
        bot.send_message(msg.chat.id, "Использование: /ai {prompt} (можно ответом на сообщение)").await?;
        return Ok(());
    }

    let sent = bot.send_message(msg.chat.id, "Thinking...").await?;

    match ai_client.generate_text(&final_prompt).await {
        Ok(response) => {
            bot.edit_message_text(msg.chat.id, sent.id, response).await?;
        },
        Err(e) => {
            log::error!("AI generation failed: {}", e);
            bot.edit_message_text(msg.chat.id, sent.id, "Error generating response.").await?;
        }
    }

    Ok(())
}

pub async fn google_command(bot: Bot, msg: Message, query: String) -> ResponseResult<()> {
    let mut search_query = query.trim().to_string();
    
    if let Some(replied) = msg.reply_to_message() {
        if let Some(text) = replied.text() {
            if search_query.is_empty() {
                search_query = text.to_string();
            } else {
                search_query = format!("{} {}", search_query, text);
            }
        }
    }

    if search_query.is_empty() {
        bot.send_message(msg.chat.id, "Использование: /g {текст} (можно ответом на сообщение)").await?;
        return Ok(());
    }

    let encoded = urlencoding::encode(&search_query);
    let url = format!("https://google.com/search?q={}", encoded);
    
    bot.send_message(msg.chat.id, url).await?;
    Ok(())
}

pub async fn convert_command(bot: Bot, msg: Message, ai_client: Arc<GoogleAiClient>) -> ResponseResult<()> {
    let replied = match msg.reply_to_message() {
        Some(m) => m,
        None => {
            bot.send_message(msg.chat.id, "Команда должна быть ответом на голосовое сообщение.").await?;
            return Ok(());
        }
    };

    if let Some(voice) = replied.voice() {
         handle_transcription(&bot, &msg, voice, &ai_client).await?;
    } else {
        bot.send_message(msg.chat.id, "Сообщение, на которое вы ответили, не является голосовым.").await?;
    }

    Ok(())
}

pub async fn private_voice_handler(bot: Bot, msg: Message, ai_client: Arc<GoogleAiClient>) -> ResponseResult<()> {
    if let Some(voice) = msg.voice() {
        handle_transcription(&bot, &msg, voice, &ai_client).await
    } else {
        Ok(())
    }
}

async fn handle_transcription(bot: &Bot, msg: &Message, voice: &Voice, ai_client: &GoogleAiClient) -> ResponseResult<()> {
    let sent = bot.send_message(msg.chat.id, "Transcribing...").await?;

    match transcribe_voice_file(bot, voice, ai_client).await {
        Ok(text) => {
            let response = if text.trim().is_empty() {
                "Расшифровка: <empty>".to_string()
            } else {
                format!("Расшифровка:\n{}", text)
            };
            bot.edit_message_text(msg.chat.id, sent.id, response).await?;
        },
        Err(e) => {
            log::error!("Transcription failed: {}", e);
            bot.edit_message_text(msg.chat.id, sent.id, "Error transcribing voice.").await?;
        }
    }

    Ok(())
}

async fn transcribe_voice_file(bot: &Bot, voice: &Voice, ai_client: &GoogleAiClient) -> Result<String> {
    let file = bot.get_file(&voice.file.id).await?;
    let mut dst = Vec::new();
    bot.download_file(&file.path, &mut dst).await?;

    // Assuming OGG as Telegram uses OGG Opus for voice messages
    ai_client.transcribe_voice(dst, "audio/ogg").await
}

