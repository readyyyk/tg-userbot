use dotenv::dotenv;
use teloxide::prelude::*;
use teloxide::utils::command::BotCommands;
use std::sync::Arc;
use crate::google_ai::GoogleAiClient;

mod google_ai;
mod handlers;

#[derive(BotCommands, Clone)]
#[command(rename_rule = "lowercase", description = "Supported commands:")]
enum Command {
    #[command(description = "Ask AI.")]
    Ai(String),
    #[command(description = "Google search.")]
    G(String),
    #[command(description = "Convert voice to text.")]
    Convert,
}

#[tokio::main]
async fn main() {
    dotenv().ok();
    pretty_env_logger::init();
    log::info!("Starting bot...");

    let bot = Bot::from_env();
    
    let ai_client = match GoogleAiClient::from_env() {
        Ok(client) => Arc::new(client),
        Err(e) => {
            log::error!("Failed to initialize Google AI client: {}", e);
            return;
        }
    };

    let handler = Update::filter_message()
        .branch(
            dptree::entry()
                .filter_command::<Command>()
                .endpoint(|bot: Bot, msg: Message, cmd: Command, ai_client: Arc<GoogleAiClient>| async move {
                     match cmd {
                         Command::Ai(prompt) => handlers::ai_command(bot, msg, prompt, ai_client).await,
                         Command::G(query) => handlers::google_command(bot, msg, query).await,
                         Command::Convert => handlers::convert_command(bot, msg, ai_client).await,
                     }
                })
        )
        .branch(
            dptree::filter(|msg: Message| msg.voice().is_some() && msg.chat.is_private())
                .endpoint(handlers::private_voice_handler)
        );

    Dispatcher::builder(bot, handler)
        .dependencies(dptree::deps![ai_client])
        .enable_ctrlc_handler()
        .build()
        .dispatch()
        .await;
}

