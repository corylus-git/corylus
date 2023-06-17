// TODO this should actually be part of git2-rs -> prepare PR at some point

use core::slice;
use std::marker::PhantomData;

use crate::error::BackendError;

#[repr(C)]
#[derive(Debug)]
pub struct git_merge_file_input {
    /** */
    version: core::ffi::c_uint,

    /** Pointer to the contents of the input file file */
    ptr: *const core::ffi::c_char,

    /** Size of the contents pointed to in `ptr`. */
    size: cty::size_t,

    /** File name of the conflicted file, or `NULL` to not merge the path. */
    path: *const core::ffi::c_char,

    /** File mode of the conflicted file, or `0` to not merge the mode. */
    mode: core::ffi::c_uint,
}

#[derive(Debug)]
pub struct MergeFileInput<'a> {
    raw: git_merge_file_input,
    _phantom: PhantomData<&'a str>,
}

impl<'a> MergeFileInput<'a> {
    pub fn raw(&'a self) -> &'a git_merge_file_input {
        &self.raw
    }

    pub fn new(
        input: &'a [u8],
        path: &'a [u8],
        mode: u32,
    ) -> std::result::Result<Self, std::ffi::NulError> {
        Ok(Self {
            raw: git_merge_file_input {
                version: 1,
                ptr: input.as_ptr() as *const core::ffi::c_char,
                size: input.len() as cty::size_t,
                path: path.as_ptr() as *const core::ffi::c_char,
                mode,
            },
            _phantom: PhantomData::default(),
        })
    }
}

/**
 * Information about file-level merging
 */
#[repr(C)]
#[derive(Debug)]
pub struct git_merge_file_result {
    /**
     * True if the output was automerged, false if the output contains
     * conflict markers.
     */
    automergeable: core::ffi::c_uint,

    /**
     * The path that the resultant merge file should use, or NULL if a
     * filename conflict would occur.
     */
    path: *const core::ffi::c_char,

    /**
     * The mode that the resultant merge file should use.
     */
    mode: core::ffi::c_uint,

    /** The contents of the merge. */
    ptr: *const core::ffi::c_char,

    /** The length of the merge contents. */
    len: cty::size_t,
}

extern "C" {
    pub fn git_merge_file(
        out: *mut git_merge_file_result,
        ancestor: *const git_merge_file_input,
        ours: *const git_merge_file_input,
        theirs: *const git_merge_file_input,
        opts: *const libgit2_sys::git_merge_options,
    ) -> core::ffi::c_int;

    pub fn git_merge_file_result_free(out: *mut git_merge_file_result);
}

pub fn get_merge_conflict(
    repo: &git2::Repository,
    conflict: git2::IndexConflict,
    opts: git2::MergeOptions,
) -> std::result::Result<String, BackendError> {
    let our_blob = conflict
        .our
        .as_ref()
        .and_then(|c| repo.find_blob(c.id).ok());
    let their_blob = conflict
        .their
        .as_ref()
        .and_then(|c| repo.find_blob(c.id).ok());
    let ancestor_blob = conflict
        .ancestor
        .as_ref()
        .and_then(|c| repo.find_blob(c.id).ok());

    let our_input = conflict
        .our
        .as_ref()
        .map(|c| MergeFileInput::new(our_blob.as_ref().unwrap().content(), &c.path, c.mode))
        .transpose()
        .map_err(|_| BackendError::new("Failed to parse our path"))?;
    let their_input = conflict
        .their
        .as_ref()
        .map(|c| MergeFileInput::new(their_blob.as_ref().unwrap().content(), &c.path, c.mode))
        .transpose()
        .map_err(|_| BackendError::new("Failed to parse their path"))?;
    let ancestor_input = conflict
        .ancestor
        .as_ref()
        .map(|c| MergeFileInput::new(ancestor_blob.as_ref().unwrap().content(), &c.path, c.mode))
        .transpose()
        .map_err(|_| BackendError::new("Failed to parse ancestor path"))?;
    let mut merge_output = git_merge_file_result {
        automergeable: 0,
        path: std::ptr::null(),
        mode: 0,
        ptr: std::ptr::null(),
        len: 0,
    };
    unsafe {
        let result = git_merge_file(
            &mut merge_output,
            ancestor_input
                .as_ref()
                .map_or(std::ptr::null(), |i| i.raw()),
            our_input.as_ref().map_or(std::ptr::null(), |i| i.raw()),
            their_input.as_ref().map_or(std::ptr::null(), |i| i.raw()),
            opts.raw(),
        );
        let res = if result == 0 {
            let data = slice::from_raw_parts(merge_output.ptr as *const u8, merge_output.len);
            Ok(String::from_utf8_lossy(data).into_owned())
        } else {
            Err(BackendError::new("Failed to merge"))
        };
        git_merge_file_result_free(&mut merge_output);
        res
    }
}
