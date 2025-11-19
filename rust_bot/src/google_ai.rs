use base64::prelude::*;
use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Clone)]
pub struct GoogleAiClient {
    client: Client,
    api_key: String,
    model_text: String,
    model_voice: String,
}

impl GoogleAiClient {
    pub fn from_env() -> Result<Self> {
        let api_key = env::var("GOOGLE_API_KEY").context("GOOGLE_API_KEY not set")?;
        let model_text = env::var("GOOGLE_TEXT_MODEL")
            .or_else(|_| env::var("GOOGLE_MODEL"))
            .unwrap_or_else(|_| "gemini-2.5-flash".to_string());
        let model_voice = env::var("GOOGLE_MODEL").unwrap_or_else(|_| "gemini-2.5-flash".to_string());

        Ok(Self {
            client: Client::new(),
            api_key,
            model_text,
            model_voice,
        })
    }

    pub async fn generate_text(&self, prompt: &str) -> Result<String> {
        let system_instruction = "Tell it like it is; NEVER sugar-coat responses. Get right to the point. Be practical above all.";
        let full_prompt = format!("{}\n\n{}", system_instruction, prompt);
        
        self.call_generate(&self.model_text, vec![Part::Text { text: full_prompt }]).await
    }

    pub async fn transcribe_voice(&self, voice_data: Vec<u8>, mime_type: &str) -> Result<String> {
        let base64_data = BASE64_STANDARD.encode(voice_data);
        
        let parts = vec![
            Part::InlineData {
                inline_data: InlineData {
                    mime_type: mime_type.to_string(),
                    data: base64_data,
                },
            },
            Part::Text {
                text: "You are a transcription model. Transcribe the provided voice message into Russian with maximum accuracy, preserving meaning and natural flow. Do not include explanations, metadata, timestamps, or any additional text — only the transcription result".to_string(),
            },
        ];

        self.call_generate(&self.model_voice, parts).await
    }

    async fn call_generate(&self, model: &str, parts: Vec<Part>) -> Result<String> {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            model, self.api_key
        );

        let request_body = GenerateContentRequest {
            contents: vec![Content { parts }],
        };

        let response = self.client.post(&url)
            .json(&request_body)
            .send()
            .await
            .context("Failed to send request to Google AI")?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!("Google AI API error: {}", error_text);
        }

        let response_body: GenerateContentResponse = response.json().await.context("Failed to parse response")?;
        
        if let Some(candidate) = response_body.candidates.first() {
            if let Some(content) = &candidate.content {
                if let Some(part) = content.parts.first() {
                    if let Part::Text { text } = part {
                        return Ok(text.trim().to_string());
                    }
                }
            }
        }

        Ok(String::new())
    }
}

#[derive(Serialize)]
struct GenerateContentRequest {
    contents: Vec<Content>,
}

#[derive(Serialize, Deserialize)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Serialize, Deserialize)]
#[serde(untagged)]
enum Part {
    InlineData { inline_data: InlineData },
    Text { text: String },
}

#[derive(Serialize, Deserialize)]
struct InlineData {
    mime_type: String,
    data: String,
}

#[derive(Deserialize)]
struct GenerateContentResponse {
    candidates: Vec<Candidate>,
}

#[derive(Deserialize)]
struct Candidate {
    content: Option<Content>,
}

