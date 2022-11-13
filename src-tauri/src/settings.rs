use std::{collections::{HashMap, hash_map::Entry}, hash::Hash};

use config::Config;
use directories::ProjectDirs;
use serde::{Deserialize, Serialize, Deserializer, de::Visitor};

use crate::{
    error::BackendError,
    git::{with_state, StateType},
};



#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Settings{
    /**
     * The paths of the tabs currently open
     */
    open_tabs: Vec<String>,

    /**
     * Repositories that were opened in the past
     *
     * key: the path of the repository
     * value: the last time this repo was open
     */
    repository_history: Vec<HashMap<String, String>>, // TODO perhaps use a map type from serde?

    /**
     * The name of the theme currently in use by the app
     */
    theme: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            open_tabs: vec![],
            repository_history: vec![],
            theme: "dark".to_string(),
        }
    }
}

pub fn load_settings() -> Settings {
    let project_dirs_opt = ProjectDirs::from("dev", "corylus", "corylus");
    if let Some(project_dirs) = project_dirs_opt {
        let config_file_path = project_dirs
            .config_dir()
            .join("settings.json")
            .to_string_lossy()
            .to_string();
        let config_file = config::File::with_name(&config_file_path);
        let settings = Config::builder().add_source(config_file).build();
        let settings_result = settings.map(|config| config.try_deserialize::<Settings>());

        settings_result
            .map(|r| r.unwrap_or_default())
            .unwrap_or_default()
    } else {
        Settings::default()
    }
}

#[tauri::command]
pub async fn get_settings(state: StateType<'_>) -> Result<Settings, BackendError> {
    with_state(state, |s| Ok(s.settings.clone())).await
}
