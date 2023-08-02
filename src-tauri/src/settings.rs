use std::{
    fs::File,
    path::Path,
    time::{Instant, SystemTime, UNIX_EPOCH},
};

use config::Config;
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use tauri::Window;
use tracing::instrument;

use crate::{
    error::{BackendError, DefaultResult, Result},
    git::{with_state, with_state_mut, StateType},
    window_events::{TypedEmit, WindowEvents},
};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub path: String,
    pub date: u64,
    #[serde(default)]
    pub title: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
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
    repository_history: Vec<HistoryEntry>, // TODO perhaps use a map type from serde?

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

pub fn settings_file_path() -> Result<String> {
    let project_dirs = ProjectDirs::from("dev", "corylus", "corylus");
    project_dirs
        .and_then(|p| {
            p.config_dir()
                .join("settings.json")
                .to_str()
                .map(|fp| fp.to_owned())
        })
        .ok_or_else(|| BackendError::new("Invalid settings file path."))
}

fn title_from_path(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|p| p.to_str())
        .unwrap_or("<invalid path>")
        .to_owned()
}

fn fixup_titles(settings: &mut Settings) {
    for mut entry in &mut settings.repository_history {
        if entry.title.is_empty() {
            entry.title = title_from_path(&entry.path);
        }
    }
}

pub fn load_settings() -> Settings {
    if let Ok(sfp) = settings_file_path() {
        let config_file = config::File::with_name(&sfp);
        let settings = Config::builder().add_source(config_file).build();
        let settings_result = settings.map(|config| config.try_deserialize::<Settings>());
        if let Err(e) = &settings_result {
            tracing::error!("Could not load settings. {}", e.to_string());
        }

        let mut settings = settings_result
            .map(|r| r.unwrap_or_default())
            .unwrap_or_default();
        fixup_titles(&mut settings);
        settings
    } else {
        Settings::default()
    }
}

fn store_settings(settings: &Settings) -> DefaultResult {
    let path = settings_file_path()?;
    let file_path = Path::new(&path);
    let config_dir = file_path
        .parent()
        .ok_or_else(|| BackendError::new("Could not determine parent path of the settings file"))?;
    std::fs::create_dir_all(config_dir)
        .map_err(|e| BackendError::new(format!("Could not create config directory. {}", e)))?;
    let file = File::create(file_path)
        .map_err(|e| BackendError::new(format!("Could not open settings file. {}", e)))?;
    serde_json::to_writer(file, &settings)
        .map_err(|e| BackendError::new(format!("Could not serialize settings. {}", e)))?;
    tracing::info!("Stored updated settings {:?}", &settings);
    Ok(())
}

#[instrument(skip(state), err, ret)]
#[tauri::command]
pub async fn get_settings(state: StateType<'_>) -> Result<Settings> {
    with_state(state, |s| Ok(s.settings.clone())).await
}

#[instrument(skip(state, window), err, ret)]
#[tauri::command]
pub async fn update_settings(
    state: StateType<'_>,
    window: Window,
    settings: Settings,
) -> Result<Settings> {
    with_state_mut(&state, |s| {
        s.settings = settings;
        window.typed_emit(WindowEvents::SettingsChanged, ())?;
        store_settings(&s.settings)?;
        Ok(s.settings.clone())
    })
    .await
}

fn current_time_millis() -> Result<u64> {
    SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|e| BackendError::new(format!("Could not get current time. {}", e)))?
                .as_millis().try_into().map_err(|_| BackendError::new("If you see this error, you live > 584 Mio years in the future and really shouldn'nt be using this program anymore"))
}

#[instrument(skip(state), err, ret)]
#[tauri::command]
pub async fn update_history(state: StateType<'_>, path: &str) -> Result<Settings> {
    with_state_mut(&state, |s| {
        let history_entry = s
            .settings
            .repository_history
            .iter_mut()
            .find(|entry| entry.path == path);
        if let Some(entry) = history_entry {
            entry.date = current_time_millis()?;
        } else {
            s.settings.repository_history.push(HistoryEntry {
                path: path.to_owned(),
                date: current_time_millis()?,
                title: title_from_path(path),
            })
        }
        // truncate the history if necessary
        if s.settings.repository_history.len() > 100 {
            s.settings.repository_history.sort_by_key(|e| e.date);
            s.settings.repository_history.truncate(100);
        }

        Ok(s.settings.clone())
    })
    .await
}
