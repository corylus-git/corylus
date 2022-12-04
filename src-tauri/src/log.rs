use std::fmt::Display;

use serde::Deserialize;

#[derive(Deserialize)]
pub enum Level {
    TRACE,
    DEBUG,
    INFO,
    WARN,
    ERROR,
}

impl Display for Level {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(
            match self {
                TRACE => "TRACE",
                DEBUG => "DEBUG",
                INFO => "INFO",
                WARN => "WARN",
                ERROR => "ERROR",
            }
        )
    }
}

impl From<Level> for log::Level 
{
    fn from(level: Level) -> Self {
        match level {
            Level::TRACE => log::Level::Trace,
            Level::DEBUG => log::Level::Debug,
            Level::INFO => log::Level::Info,
            Level::WARN => log::Level::Warn,
            Level::ERROR => log::Level::Error,
        }
    }
}

#[tauri::command]
pub fn send_log(
    level: Level,
    context: &str,
    message: &str,
    meta: Option<serde_json::Value>,
) -> Result<(), String> {
    let full_context = format!("ui::{}", context);
    log::log!(target: full_context.as_str(), level.into(), "{} {}", message, meta.unwrap_or_default());
    Ok(())
}
