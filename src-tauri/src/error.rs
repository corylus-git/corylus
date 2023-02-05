use std::{error::Error, fmt::Display, backtrace::Backtrace};

use serde::Serialize;

#[derive(Debug)]
pub struct BackendError {
    pub message: String,
    pub backtrace: String,
}

impl BackendError {
    pub fn new<S: Into<String>>(message: S) -> Self {
        Self {
            message: message.into(),
            backtrace: format!("{}", Backtrace::capture())
        }
    }
}

impl From<git2::Error> for BackendError {
    fn from(err: git2::Error) -> Self {
        Self::new(err.message())
    }
}

impl From<tauri::Error> for BackendError {
    fn from(err: tauri::Error) -> Self {
        Self::new(&err.to_string())
    }
}

impl Display for BackendError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.message.as_str())
    }
}

impl Error for BackendError {
}

impl Serialize for BackendError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
        where
            S: serde::Serializer {
        serializer.serialize_str(&self.message) // TODO for now we're just serializing the message to stay compatible with the GUI. May change later
    }
}

pub type Result<T> = std::result::Result<T, BackendError>;

pub type DefaultResult = Result<()>;
