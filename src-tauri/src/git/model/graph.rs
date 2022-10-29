use serde::{Serialize, Deserialize};

use super::git::Commit;

/**
 * The type of a rail. A rail is represented by the OID of the ID of the last commit assigned to the rail
 */
pub type Rail = Option<String>;

/**
 * A layout list entry representing one specific line in the graph
 */
#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all="camelCase")]
pub struct LayoutListEntry {
    /**
     * The index of the rail the node of this entry is on
     */
    pub rail: usize,
    /**
     * The entry has a parent, i.e. a downward line
     */
    pub has_parent: bool,
    /**
     * The line has a child, i.e. an upward line
     */
    pub has_child: bool,
    /**
     * The line has an outgoing connection to another rail. Outgoing is relative to the direction of the list (top down),
     * i.e. an outgoing connection is a merge (Corylus currently only supports merges with two parent, no Octopus merges)
     */
    pub outgoing: Vec<usize>,
    /**
     * The line has incoming connections from other rails. Incoming lines are in top-down direction, i.e. branch lines.
     */
    pub incoming: Vec<usize>,
    /**
     * The rails currently assigned a line
     */
    pub rails: Vec<Rail>,
    /**
     * The commit displayed on this line in the graph
     */
    pub commit: Commit
}

/**
 * Data structure representing a graph state
 */
#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all="camelCase")]
pub struct GraphLayoutData {
    /**
     * The lines of the graph list
     */
    pub lines: Vec<LayoutListEntry>,
    /**
     * The rails currently in use with the OIDs of the last commits on each rail
     */
    pub rails: Vec<Rail>
}

/**
 * Information about the area of a change in the history graph
 */
#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all="camelCase")]
pub struct GraphChangeData {
    /**
     * The total number of entries in the graph
     */
    pub total: usize,
    /**
     * The first changed entry in the graph
     */
    pub change_start_idx: usize,
    /**
     * The first unchanged entry in the graph
     */
    pub change_end_idx: usize
}