use serde::Serialize;

#[derive(Clone, Serialize, PartialEq, Debug, Eq)]
#[serde(rename_all = "camelCase")]
pub enum GitConfigLevel {
    Local,
    Global,
    System
}

#[derive(Clone, Serialize, PartialEq, Debug, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitConfigEntry
{
    pub name: String,
    pub value: String,
    pub level: GitConfigLevel
}

impl From<git2::ConfigLevel> for GitConfigLevel
{
    fn from(value: git2::ConfigLevel) -> Self {
        match value {
            git2::ConfigLevel::System => Self::System,
            git2::ConfigLevel::Global => Self::Global,
            git2::ConfigLevel::Local => Self::Local,
            _ => GitConfigLevel::System // TODO introduce the other levels
        }
    }
}
