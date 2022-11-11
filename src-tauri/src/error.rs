use std::{error::Error, fmt::Display};

use serde::Serialize;

#[derive(Debug)]
pub struct BackendError {
    pub message: String
}

impl From<git2::Error> for BackendError {
    fn from(err: git2::Error) -> Self {
        Self {
            message: err.message().to_string()
        }
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
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
        where
            S: serde::Serializer {
        serializer.serialize_str(&self.message) // TODO for now we're just serializing the message to stay compatible with the GUI. May change later
    }
}