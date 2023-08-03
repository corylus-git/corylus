use git2::{AutotagOption, FetchOptions, FetchPrune};
use tracing::debug;

use crate::error::DefaultResult;

pub fn do_fetch(
    repo: &git2::Repository,
    name: &str,
    prune: bool,
    fetch_tags: bool,
    ref_spec: Option<&str>,
) -> DefaultResult {
    debug!("Fetching changes from remote {}", name);
    let mut r = repo.find_remote(name)?;
    let mut options = FetchOptions::new();
    options.prune(if prune {
        FetchPrune::On
    } else {
        FetchPrune::Off
    });
    options.download_tags(if fetch_tags {
        AutotagOption::All
    } else {
        AutotagOption::None
    });
    let fetch_refspec = r.fetch_refspecs()?;
    let default_refspec: Vec<&str> = fetch_refspec.iter().flatten().collect();
    r.fetch(
        &ref_spec.map_or(default_refspec, |rs| vec![rs]),
        Some(&mut options),
        None,
    )?;
    debug!("Fetched changes from {}", name);
    Ok(())
}
