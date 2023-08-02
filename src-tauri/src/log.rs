use std::fmt::Display;

use serde::Deserialize;
use tracing::{debug, error, info, instrument, trace, warn};

#[derive(Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Level {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl Display for Level {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Trace => "TRACE",
            Self::Debug => "DEBUG",
            Self::Info => "INFO",
            Self::Warn => "WARN",
            Self::Error => "ERROR",
        })
    }
}

impl From<Level> for tracing::Level {
    fn from(level: Level) -> Self {
        match level {
            Level::Trace => tracing::Level::TRACE,
            Level::Debug => tracing::Level::DEBUG,
            Level::Info => tracing::Level::INFO,
            Level::Warn => tracing::Level::WARN,
            Level::Error => tracing::Level::ERROR,
        }
    }
}

#[instrument(name = "ui", parent=None, skip_all)]
#[tauri::command]
pub fn send_log(
    level: Level,
    context: &str,
    message: &str,
    meta: Option<serde_json::Value>,
) -> Result<(), String> {
    // let fields = FieldSet::new(&[], Identifier());
    // let metadata = Metadata::new(
    //     context,
    //     "ui",
    //     level.into(),
    //     None,
    //     None,
    //     None,
    //     fields,
    //     Kind::EVENT,
    // );
    // let fields = meta.map(|m| if m.is_object() {
    //     ValueSet::
    // } else {

    // })
    // Event::dispatch(&metadata, fields)
    match level {
        Level::Trace => {
            trace!(
                message = message,
                context = context,
                meta = serde_json::to_string(&meta).unwrap_or_else(|_| format!("{:?}", &meta))
            )
        }
        Level::Debug => debug!(
            message = message,
            context = context,
            meta = serde_json::to_string(&meta).unwrap_or_else(|_| format!("{:?}", &meta))
        ),
        Level::Info => info!(
            message = message,
            context = context,
            meta = serde_json::to_string(&meta).unwrap_or_else(|_| format!("{:?}", &meta))
        ),
        Level::Warn => warn!(
            message = message,
            context = context,
            meta = serde_json::to_string(&meta).unwrap_or_else(|_| format!("{:?}", &meta))
        ),
        Level::Error => error!(
            message = message,
            context = context,
            meta = serde_json::to_string(&meta).unwrap_or_else(|_| format!("{:?}", &meta))
        ),
    };
    Ok(())
}
