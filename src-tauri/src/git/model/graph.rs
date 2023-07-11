use std::{
    fmt::{Debug, Write},
    sync::Arc,
};

use serde::Serialize;

use super::git::Commit;

/**
 * A rail entry representing a single rail running through one LayoutListEntry
 */
#[derive(Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RailEntry {
    /**
     * ID of the parent expected on this line
     */
    pub expected_parent: String,
    /**
     * Is this line running through, i.e. was the same parent already expected on this rail above
     */
    pub has_through_line: bool,
}

impl Debug for RailEntry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!(
            "RailEntry({}{})",
            self.expected_parent,
            if self.has_through_line { " | " } else { "" }
        ))
    }
}

/**
 * The type of a rail. A rail is represented by the OID of the ID of the last commit assigned to the rail
 */
pub type Rail = Option<RailEntry>;

/**
 * A layout list entry representing one specific line in the graph
 */
#[derive(Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LayoutListEntry {
    /**
     * The index of the rail the node of this entry is on
     */
    pub rail: usize,
    /**
     * The entry has a parent line, i.e. a downward line
     */
    pub has_parent_line: bool,
    /**
     * The line has a child, i.e. an upward line
     */
    pub has_child_line: bool,
    /**
     * The line has an outgoing connection to another rail. Outgoing is relative to the direction of the list (top down),
     * i.e. an outgoing connection is a merge (Corylus currently only supports merges with two parent, no Octopus merges)
     */
    pub outgoing: Arc<[usize]>,
    /**
     * The line has incoming connections from other rails. Incoming lines are in top-down direction, i.e. branch lines.
     */
    pub incoming: Arc<[usize]>,
    /**
     * The rails currently assigned a line
     */
    pub rails: Vec<Rail>,
    /**
     * The commit displayed on this line in the graph
     */
    pub commit: Commit,
}

impl Debug for LayoutListEntry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!(
            "oid: {}, rail: {}, has_parent: {}, has_child: {}, outgoing: {:?}, incoming: {:?}, rails: {:?}",
            self.commit.as_graph_node().oid(), self.rail, self.has_parent_line, self.has_child_line, self.outgoing, self.incoming, self.rails
        ))
    }
}

/**
 * Data structure representing a graph state
 */
#[derive(Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphLayoutData {
    /**
     * The lines of the graph list
     */
    pub lines: Vec<LayoutListEntry>,
    /**
     * The rails currently in use with the OIDs of the last commits on each rail
     */
    pub rails: Vec<Rail>,
}

impl Debug for GraphLayoutData {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("{\n")?;
        f.write_str("  lines: [\n")?;
        for line in &self.lines {
            f.write_fmt(format_args!("    {:?}\n", line))?;
        }
        f.write_str("  ],\n")?;
        f.write_fmt(format_args!("  rails: {:?}\n", self.rails))?;
        f.write_char('}')?;
        Ok(())
    }
}

/**
 * Information about the area of a change in the history graph
 */
#[derive(Clone, Serialize, PartialEq, Debug, Eq)]
#[serde(rename_all = "camelCase")]
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
    pub change_end_idx: usize,
}
