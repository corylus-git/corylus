use std::{collections::HashSet, path::Path};

use git2::{Cred, CredentialType, ErrorClass, ErrorCode, Repository};

pub fn make_credentials_callback<'a>(
    repo: &'a Repository,
) -> (impl FnMut(&str, Option<&str>, CredentialType) -> std::result::Result<Cred, git2::Error> + 'a)
{
    let mut previous_calls = HashSet::<String>::new();
    move |url, username, cred_type| {
        get_credentials(repo, &mut previous_calls, url, username, cred_type)
    }
}

fn get_credentials(
    repo: &Repository,
    previous_calls: &mut HashSet<String>,
    url: &str,
    username: Option<&str>,
    cred_type: CredentialType,
) -> std::result::Result<Cred, git2::Error> {
    log::debug!("Received request for credential type {:?}", cred_type);
    if cred_type.is_username() {
        // git needs to know the username first and couldn't extract it from the URL -> request
        // this from the user
        log::error!("SSH without username in the URL is currently not supported");
        return Err(git2::Error::new(
            git2::ErrorCode::GenericError,
            git2::ErrorClass::None,
            "SSH without username in the URL is currently not supported",
        ));
    } else if cred_type.is_ssh_key() {
        let call_key = format!("{}||{}||{:?}", url, username.unwrap(), cred_type);
        if previous_calls.contains(&call_key) {
            // libgit2 will keep on requesting more credentials if the login fails -> prevent a
            // second round with the exact same parameters
            return Err(git2::Error::new(
                git2::ErrorCode::Auth,
                git2::ErrorClass::Ssh,
                "Authentication via SSH key failed.",
            ));
        }
        previous_calls.insert(call_key);
        return get_ssh_key(repo, url, username);
    } else if cred_type.is_user_pass_plaintext() {
        // return get_user_password(window: Window, url, username);
    }
    Err(git2::Error::new(
        git2::ErrorCode::GenericError,
        git2::ErrorClass::None,
        format!("Unsupported credential type {:?}", cred_type),
    ))
}

fn get_ssh_key(
    repo: &Repository,
    url: &str,
    username: Option<&str>,
) -> std::result::Result<Cred, git2::Error> {
    let key_path = get_key_path(repo, url)?;
    if let Some(kp) = key_path {
        let cred = Cred::ssh_key(username.unwrap(), None, Path::new(&kp), None);
        if let Err(e) = &cred {
            log::error!("SSH error: {}", e);
        } else {
            log::debug!("Successfully loaded key from file.");
        }
        return cred;
    }
    Err(git2::Error::new(
        git2::ErrorCode::NotFound,
        git2::ErrorClass::Ssh,
        "No SSH key configured for the URL",
    ))
}

fn get_key_path(repo: &Repository, url: &str) -> std::result::Result<Option<String>, git2::Error> {
    let config = repo.config()?;
    let config_key = format!("corylus.{}.ssh-pub-key", url);
    let config_value_result = config.get_string(&config_key);
    if let Err(config_error) = config_value_result {
        if config_error.code() == ErrorCode::NotFound && config_error.class() == ErrorClass::Config
        {
            Ok(None)
        } else {
            Err(config_error)
        }
    } else {
        config_value_result.map(Some)
    }
}
