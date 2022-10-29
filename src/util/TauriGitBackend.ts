import { invoke } from "@tauri-apps/api";
import { IGitConfig } from "../model/IGitConfig";
import { BranchInfo, RemoteMeta, Tag, Commit, CommitStats, IndexStatus, Stash, BlameInfo, RebaseStatusInfo } from "../model/stateObjects";
import { GitBackend } from "./GitBackend";
import { Maybe } from "./maybe";

export class TauriGitBackend implements GitBackend {
    
    dir: string = "";
    gitDir: string = "";
    
    async open(directory: string): Promise<void> {
        await invoke('git_open', { path: directory });
        this.dir = directory; 
    }
    getBranches(): Promise<BranchInfo[]> {
        throw new Error("Method not implemented.");
    }
    getRemotes(): Promise<RemoteMeta[]> {
        throw new Error("Method not implemented.");
    }
    getTags(): Promise<readonly Tag[]> {
        throw new Error("Method not implemented.");
    }
    getHistorySize(): Promise<number> {
        throw new Error("Method not implemented.");
    }
    getHistory(path?: string, skip?: number, limit?: number, range?: string, remotes?: boolean): Promise<readonly Commit[]> {
        throw new Error("Method not implemented.");
    }
    getCommit(ref: string): Promise<Commit> {
        throw new Error("Method not implemented.");
    }
    checkout(refOrPath: string, localTarget?: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    checkoutWorktree(refOrPath: string, worktreePath: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    resolveConflict(path: string, source: "ours" | "theirs" | "merge"): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getCommitStats(commit: Commit): Promise<CommitStats> {
        throw new Error("Method not implemented.");
    }
    getDiff(options: { source: "workdir" | "index" | "commit" | "stash"; commitId?: string | undefined; toParent?: string | undefined; path?: string | undefined; untracked?: boolean | undefined; }): Promise<string> {
        throw new Error("Method not implemented.");
    }
    getStatus(): Promise<readonly IndexStatus[]> {
        throw new Error("Method not implemented.");
    }
    addPath(path: string, intentToAdd?: boolean): Promise<void> {
        throw new Error("Method not implemented.");
    }
    removePath(path: string, alreadyGone: boolean): Promise<void> {
        throw new Error("Method not implemented.");
    }
    applyDiff(diff: string, revert: boolean, onWorkinCopy: boolean): Promise<void> {
        throw new Error("Method not implemented.");
    }
    resetPath(path: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    commit(message: string, amend?: boolean): Promise<void> {
        throw new Error("Method not implemented.");
    }
    push(options?: { remote?: string | undefined; branch?: string | undefined; upstream?: string | undefined; setUpstream?: boolean | undefined; force?: boolean | undefined; pushTags?: boolean | undefined; }): Promise<void> {
        throw new Error("Method not implemented.");
    }
    fetch(options: { remote: Maybe<string>; branch: Maybe<string>; prune: boolean; fetchTags: boolean; }): Promise<void> {
        throw new Error("Method not implemented.");
    }
    pull(remote: string, remoteBranch: string, noFF: boolean): Promise<void> {
        throw new Error("Method not implemented.");
    }
    init(path: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    clone(url: string, dir: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    branch(name: string, source: string, noCheckout: boolean): Promise<void> {
        throw new Error("Method not implemented.");
    }
    deleteBranch(branch: BranchInfo, force: boolean, removeRemote: boolean): Promise<void> {
        throw new Error("Method not implemented.");
    }
    renameBranch(oldName: string, newName: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getUnmergedBranches(name: Maybe<string>): Promise<Maybe<string[]>> {
        throw new Error("Method not implemented.");
    }
    merge(from: string, noFF: boolean): Promise<string | undefined> {
        throw new Error("Method not implemented.");
    }
    abortMerge(): Promise<string | undefined> {
        throw new Error("Method not implemented.");
    }
    getPendingCommitMessage(): string {
        throw new Error("Method not implemented.");
    }
    stash(message: string, untracked: boolean): Promise<void> {
        throw new Error("Method not implemented.");
    }
    listStashes(): Promise<readonly Stash[]> {
        throw new Error("Method not implemented.");
    }
    getStashDetails(stash: Stash): Promise<CommitStats> {
        throw new Error("Method not implemented.");
    }
    applyStash(stash: Stash, deleteAfterApply: boolean): Promise<void> {
        throw new Error("Method not implemented.");
    }
    dropStash(stash: Stash): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getConfig(): Promise<IGitConfig> {
        throw new Error("Method not implemented.");
    }
    setConfigValue(key: string, value: string, target: "local" | "global"): Promise<void> {
        throw new Error("Method not implemented.");
    }
    reset(branch: string, toRef: string, mode: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    createTag(tag: string, ref: string, message: Maybe<string>): Promise<void> {
        throw new Error("Method not implemented.");
    }
    deleteTag(tag: Tag): Promise<string> {
        throw new Error("Method not implemented.");
    }
    getFiles(): Promise<string[]> {
        throw new Error("Method not implemented.");
    }
    blame(path: string): Promise<readonly BlameInfo[]> {
        throw new Error("Method not implemented.");
    }
    restore(path: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    addRemote(name: string, url: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    updateRemote(name: string, url: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    deleteRemote(name: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    rebase(target: string, commands?: readonly { action: string; commit: Commit; }[]): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getRebaseStatus(): Promise<Maybe<RebaseStatusInfo>> {
        throw new Error("Method not implemented.");
    }
    abortRebase(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    continueRebase(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getAffectedRefs(ref: string, branches: boolean, tags: boolean, commits: boolean): Promise<{ branches: string[]; tags: string[]; refs: string[]; }> {
        throw new Error("Method not implemented.");
    }
    getFileContents(ref: string, path: string): Promise<Maybe<Buffer>> {
        throw new Error("Method not implemented.");
    }

}