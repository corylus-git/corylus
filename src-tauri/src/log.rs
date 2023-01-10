use std::fmt::Display;

use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all="UPPERCASE")]
pub enum Level {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl Display for Level {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(
            match self {
                Self::Trace => "TRACE",
                Self::Debug => "DEBUG",
                Self::Info => "INFO",
                Self::Warn => "WARN",
                Self::Error => "ERROR",
            }
        )
    }
}

impl From<Level> for log::Level 
{
    fn from(level: Level) -> Self {
        match level {
            Level::Trace => log::Level::Trace,
            Level::Debug => log::Level::Debug,
            Level::Info => log::Level::Info,
            Level::Warn => log::Level::Warn,
            Level::Error => log::Level::Error,
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
