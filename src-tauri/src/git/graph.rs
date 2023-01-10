use super::model::{
    git::Commit,
    graph::{GraphLayoutData, LayoutListEntry, Rail},
};

/// Place the given entry on the first usable rail
///
/// # Arguments
/// * `rails` - The current state of the rails with expected entries for each rails
/// * `new_entry` - The new entry to place on the rail. The entry is placed on the left-most rail
///     that expects it as a parent or on a new empty rail
///
/// # Returns
/// This method returns the position the item was placed and whether the rail was empty before or not
fn find_first_available_rail(rails: &mut Vec<Rail>, new_entry: &str, may_replace: Option<&str>) -> (usize, bool) {
    // preferably try to place the entry on a rail where it was requested
    let requested_idx = rails
        .iter()
        .position(|r| r.is_some() && (r.as_ref().unwrap() == new_entry || may_replace.is_some() && may_replace.unwrap() == r.as_ref().unwrap()));
    if let Some(idx) = requested_idx {
        (idx, false)
    } else {
        // try to find a free rail somewhere in the existing ones
        let free_idx = rails.iter().position(|r| r.is_none());
        if let Some(idx) = free_idx {
            (idx, true)
        } else {
            // no luck, add a new rails
            rails.push(None);
            (rails.len() - 1, true)
        }
    }
}

pub fn calculate_graph_layout(ordered_history: Vec<Commit>) -> GraphLayoutData {
    let mut rails = vec![];
    let lines: Vec<LayoutListEntry> = ordered_history
        .iter()
        .map(|entry| {
            let graph_node = entry.as_graph_node();
            // 1. find rail to use: left-most rail that expects us as a parent OR is empty (if no rail expects us)
            let (my_rail, was_empty) = find_first_available_rail(&mut rails, graph_node.oid(), None);
            // 2. check whether we have any parents
            let has_parents = !graph_node.parents().is_empty();
            // 3. place our first parent on my rail
            rails[my_rail] = if graph_node.parents().is_empty() {
                None
            } else {
                Some(graph_node.parents()[0].oid.clone())
            };
            // 4. calculate outgoing lines as our place to all as-of-yet unplaced parents
            let outgoing: Vec<usize> = if graph_node.parents().len() > 1 {
                graph_node.parents()[1..]
                    .iter()
                    .filter_map(|p| {
                        let (rail, was_empty) = find_first_available_rail(&mut rails, &p.oid, Some(graph_node.oid()));
                        if was_empty || rails[rail].is_some() && rails[rail].as_ref().unwrap() == graph_node.oid() {
                            Some(rail)
                        } else {
                            None
                        }
                    })
                    .collect()
            } else {
                vec![]
            };
            // 5. calculate incoming lines as our place to all rails requesting us as parent
            let incoming: Vec<usize> = rails
                .iter()
                .enumerate()
                .filter_map(|(idx, oid)| {
                    if oid.is_some() && oid.as_ref().unwrap() == graph_node.oid() && idx != my_rail {
                        Some(idx)
                    } else {
                        None
                    }
                })
                .collect();
            // 6. place all other parents on rails as needed
            if graph_node.parents().len() > 1 {
                outgoing.iter().zip(graph_node.parents()[1..].iter()).for_each(|(&idx, p)| { rails[idx] = Some(p.oid.clone()) });
            };
            // 7. clear all rails requesting us as parent
            rails = rails
                .iter()
                .map(|r| {
                    if r.is_some() && r.as_ref().unwrap() == graph_node.oid() {
                        None
                    } else {
                        r.to_owned()
                    }
                })
                .collect();
            LayoutListEntry {
                commit: entry.clone(),
                rail: my_rail,
                has_parent: has_parents,
                has_child: !was_empty,
                outgoing,
                incoming,
                rails: rails.clone(),
            }
        })
        .collect();

    GraphLayoutData { lines, rails }
}

#[cfg(test)]
mod tests {
    use crate::git::model::git::{FullCommitData, GitPerson, ParentReference, TimeWithOffset};

    use super::*;

    fn make_commit(oid: &str, parents: Vec<&Commit>) -> Commit {
        Commit::Commit(FullCommitData {
            oid: oid.to_owned(),
            short_oid: oid[0..1].to_owned(),
            message: oid.to_owned(),
            parents: parents
                .iter()
                .map(|&p| ParentReference {
                    oid: p.as_graph_node().oid().to_owned(),
                    short_oid: p.as_graph_node().oid()[0..1].to_owned(),
                })
                .collect(),
            author: AUTHOR.clone(),
            committer: AUTHOR.clone(),
        })
    }

    lazy_static! {
        static ref AUTHOR: GitPerson = GitPerson {
            name: String::from("Test"),
            email: String::from("test@example.com"),
            timestamp: TimeWithOffset {
                utc_seconds: 1,
                offset_seconds: 0
            }
        };
    }

    #[test]
    fn simple_linear_history() {
        let parent = make_commit("2222", vec![]);
        let child = make_commit("1111", vec![&parent]);
        let input: Vec<Commit> = vec![child.clone(), parent.clone()];

        assert_eq!(
            GraphLayoutData {
                lines: vec![
                    LayoutListEntry {
                        rail: 0,
                        has_parent: true,
                        has_child: false,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![Some("2222".to_owned())],
                        commit: child
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent: false,
                        has_child: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![None],
                        commit: parent
                    }
                ],
                rails: vec![None]
            },
            calculate_graph_layout(input)
        )
    }

    #[test]
    fn branch() {
        let parent = make_commit("2222", vec![]);
        let child1 = make_commit("1111", vec![&parent]);
        let child2 = make_commit("3333", vec![&parent]);
        let input: Vec<Commit> = vec![child2.clone(), child1.clone(), parent.clone()];

        assert_eq!(
            GraphLayoutData {
                lines: vec![
                    LayoutListEntry {
                        rail: 0,
                        has_parent: true,
                        has_child: false,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![Some("2222".to_owned())],
                        commit: child2
                    },
                    LayoutListEntry {
                        rail: 1,
                        has_parent: true,
                        has_child: false,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![Some("2222".to_owned()), Some("2222".to_owned())],
                        commit: child1
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent: false,
                        has_child: true,
                        outgoing: vec![],
                        incoming: vec![1],
                        rails: vec![None, None],
                        commit: parent
                    }
                ],
                rails: vec![None, None]
            },
            calculate_graph_layout(input)
        )
    }

    #[test]
    fn merge() {
        let parent1 = make_commit("2222", vec![]);
        let parent2 = make_commit("1111", vec![]);
        let child = make_commit("3333", vec![&parent1, &parent2]);
        let input: Vec<Commit> = vec![child.clone(), parent1.clone(), parent2.clone()];

        assert_eq!(
            GraphLayoutData {
                lines: vec![
                    LayoutListEntry {
                        rail: 0,
                        has_parent: true,
                        has_child: false,
                        outgoing: vec![1],
                        incoming: vec![],
                        rails: vec![Some("2222".to_owned()), Some("1111".to_owned())],
                        commit: child
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent: false,
                        has_child: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![None, Some("1111".to_owned())],
                        commit: parent1
                    },
                    LayoutListEntry {
                        rail: 1,
                        has_parent: false,
                        has_child: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![None, None],
                        commit: parent2
                    }
                ],
                rails: vec![None, None]
            },
            calculate_graph_layout(input)
        )
    }

    #[test]
    fn branch_merge() {
        let parent = make_commit("1111", vec![]);
        let child_left = make_commit("2222", vec![&parent]);
        let child_right = make_commit("3333", vec![&parent]);
        let grandchild = make_commit("4444", vec![&child_left, &child_right]);

        let input: Vec<Commit> = vec![
            grandchild.clone(),
            child_left.clone(),
            child_right.clone(),
            parent.clone(),
        ];

        assert_eq!(
            GraphLayoutData {
                lines: vec![
                    LayoutListEntry {
                        rail: 0,
                        has_parent: true,
                        has_child: false,
                        outgoing: vec![1],
                        incoming: vec![],
                        rails: vec![Some("2222".to_owned()), Some("3333".to_owned())],
                        commit: grandchild
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent: true,
                        has_child: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![Some("1111".to_owned()), Some("3333".to_owned())],
                        commit: child_left
                    },
                    LayoutListEntry {
                        rail: 1,
                        has_parent: true,
                        has_child: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![Some("1111".to_owned()), Some("1111".to_owned())],
                        commit: child_right
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent: false,
                        has_child: true,
                        outgoing: vec![],
                        incoming: vec![1],
                        rails: vec![None, None],
                        commit: parent
                    }
                ],
                rails: vec![None, None]
            },
            calculate_graph_layout(input)
        )
    }

    #[test]
    fn branch_merge_branch_merge() {
        let greatgrandparent = make_commit("0000", vec![]);
        let grandparent = make_commit("1111", vec![&greatgrandparent]);
        let parent = make_commit("2222", vec![&greatgrandparent, &grandparent]);
        let child = make_commit("3333", vec![&parent]);
        let grandchild = make_commit("4444", vec![&parent, &child]);

        let input: Vec<Commit> = vec![
            grandchild.clone(),
            child.clone(),
            parent.clone(),
            grandparent.clone(),
            greatgrandparent.clone(),
        ];
        assert_eq!(
            GraphLayoutData {
                lines: vec![
                    LayoutListEntry {
                        rail: 0,
                        has_parent: true,
                        has_child: false,
                        outgoing: vec![1],
                        incoming: vec![],
                        rails: vec![Some("2222".to_owned()), Some("3333".to_owned())],
                        commit: grandchild
                    },
                    LayoutListEntry {
                        rail: 1,
                        has_parent: true,
                        has_child: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![Some("2222".to_owned()), Some("2222".to_owned())],
                        commit: child
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent: true,
                        has_child: true,
                        outgoing: vec![1],
                        incoming: vec![1],
                        rails: vec![Some("0000".to_owned()), Some("1111".to_owned())],
                        commit: parent
                    },
                    LayoutListEntry {
                        rail: 1,
                        has_parent: true,
                        has_child: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![Some("0000".to_owned()), Some("0000".to_owned())],
                        commit: grandparent
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent: false,
                        has_child: true,
                        outgoing: vec![],
                        incoming: vec![1],
                        rails: vec![None, None],
                        commit: greatgrandparent
                    }
                ],
                rails: vec![None, None]
            },
            calculate_graph_layout(input)
        )
    }
}
