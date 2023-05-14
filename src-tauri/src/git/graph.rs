use super::{
    model::{
        git::{Commit, FullCommitData},
        graph::{GraphLayoutData, LayoutListEntry, Rail, RailEntry},
    },
    with_backend, StateType,
};

use crate::error::Result;

fn contains<U, V>(option: &Option<U>, item: V) -> bool
where
    U: PartialEq<V> + std::fmt::Debug,
    V: std::fmt::Debug,
{
    option.is_some() && option.as_ref().unwrap() == &item
}

/// Find the left-most rail that expects us as a parent, or (if none expects us) the left-most empty rail, extending the rails array if necessary
/// Returns the rail index and whether we were expected there or not
fn find_leftmost_rail(rails: &mut Vec<Rail>, for_id: &str) -> (usize, bool) {
    let mut my_rail = rails
        .iter()
        .position(|r| contains(&r.as_ref().map(|r| &r.expected_parent), for_id));
    if my_rail.is_some() {
        (my_rail.unwrap(), true)
    } else {
        my_rail = rails.iter().position(|r| r.is_none());
        if my_rail.is_none() {
            rails.push(None);
            my_rail = Some(rails.len() - 1);
        }
        (my_rail.unwrap(), false)
    }
}

pub fn calculate_graph_layout<Iter>(ordered_history: Iter) -> GraphLayoutData
where
    Iter: Iterator<Item = Commit> + IntoIterator<Item = Commit>,
{
    let mut rails: Vec<Rail> = vec![];
    let mut lines: Vec<LayoutListEntry> = vec![];
    for commit in ordered_history {
        let graph_node = commit.as_graph_node();
        // 1. find the left-most rail that expects us as a parent or the left-most empty rail (if none expects us)
        let (my_rail, has_child) = find_leftmost_rail(&mut rails, &graph_node.oid());
        // 2. which of our parents do not yet have a place on the graph to our left? -> we wan't to have the graph lines tend to be compact towards the left
        let unplaced_parents: Vec<String> = graph_node
            .parents()
            .iter()
            .filter_map(|p| {
                let res = rails[..my_rail].iter().enumerate().rev().find(|(_, r)| {
                    contains(&r.as_ref().map(|r| &r.expected_parent), p.oid.as_str())
                });
                if res.is_none() {
                    Some(p.oid.clone())
                } else {
                    None
                }
            })
            .collect();
        // 3. place my first unplaced parent on my rail
        rails[my_rail] = unplaced_parents.first().map(|p| RailEntry {
            expected_parent: p.clone(),
            has_through_line: false,
        });
        // 4. place all my parents as left as possible (note: this might overwrite parents with the same value)
        let mut outgoing = vec![];
        for parent in graph_node.parents() {
            let (parent_rail, has_through_line) = find_leftmost_rail(&mut rails, &parent.oid);
            rails[parent_rail] = Some(RailEntry {
                expected_parent: parent.oid.clone(),
                has_through_line: has_through_line && parent_rail != my_rail, // we don't count ourselves as a throughline
            });
            if parent_rail != my_rail {
                outgoing.push(parent_rail);
            }
        }
        // 5. incoming are all other rails requesting us as a parent
        let incoming = rails
            .iter()
            .enumerate()
            .filter_map(|(i, r)| {
                if contains(&r.as_ref().map(|r| &r.expected_parent), graph_node.oid()) {
                    Some(i)
                } else {
                    None
                }
            })
            .collect();
        // 6. remove us from all rails and set the correct thoughline values for all remaining rails
        let old_rails = lines
            .iter()
            .last()
            .map(|line| line.rails.clone())
            .unwrap_or_default();
        rails = rails
            .into_iter()
            .enumerate()
            .map(|(i, r)| {
                if contains(&r.as_ref().map(|r| &r.expected_parent), graph_node.oid()) {
                    None
                } else {
                    r.map(|r| {
                        let old_entry = old_rails.get(i).unwrap_or(&None);
                        let has_through_line = contains(
                            &old_entry.as_ref().map(|o| &o.expected_parent),
                            &r.expected_parent,
                        );
                        RailEntry {
                            expected_parent: r.expected_parent,
                            has_through_line,
                        }
                    })
                }
            })
            .collect();
        // 7. some cleanup -> filter trailing None from the list to make some layout in the UI easier
        let last_some = rails.iter().rposition(|r| r.is_some());
        rails.truncate(last_some.map_or(0, |last_some| last_some + 1));
        lines.push(LayoutListEntry {
            commit,
            rail: my_rail,
            has_parent_line: rails.get(my_rail).unwrap_or(&None).is_some(),
            has_child_line: has_child,
            outgoing,
            incoming,
            rails: rails.clone(),
        })
    }
    GraphLayoutData { lines, rails }
}

// pub fn calculate_graph_layout(ordered_history: Vec<Commit>) -> GraphLayoutData {
//     let mut rails: Vec<Rail> = vec![];
// let lines: Vec<LayoutListEntry> = ordered_history
//     .iter()
//     .map(|entry| {
//         let graph_node = entry.as_graph_node();
//         // 1. find our place in the world
//         let (my_rail, has_child) = find_leftmost_rail(&mut rails, graph_node.oid());
//         // 3. incoming are all other rails requesting us as a parent
//         let incoming = rails
//             .iter()
//             .enumerate()
//             .filter_map(|(i, r)| {
//                 if r.is_some()
//                     && r.as_ref().unwrap().expected_parent == graph_node.oid()
//                     && i != my_rail
//                 {
//                     Some(i)
//                 } else {
//                     None
//                 }
//             })
//             .collect();
//         // 4. remove us from all rails
//         rails.iter_mut().for_each(|r| {
//             if r.is_some() && r.as_ref().unwrap().expected_parent == graph_node.oid() {
//                 *r = None
//             }
//         });
//         // 5. find the first of our parents NOT YET PLACED LEFT OF US and place it on our rail
//         let first_unplaced_parent = graph_node
//             .parents()
//             .iter()
//             .find(|&p| !rails[..my_rail].contains(&Some(p.oid.clone())));
//         rails[my_rail] = first_unplaced_parent.map(|p| p.oid.clone()); // may be empty, if all our parents are already expected to the left of us

//         // 6. place our unplaced parents as needed
//         graph_node.parents().iter().for_each(|p| {
//             if !rails.contains(&Some(p.oid.clone())) {
//                 let (candidate, _) = find_leftmost_rail(&mut rails, &p.oid);
//                 rails[candidate] = Some(p.oid.clone());
//             }
//         });
//         // 7. outgoing are all of our parents _except_ the one that sits on our rail (even if it sits on other rails as well)
//         let outgoing = graph_node
//             .parents()
//             .iter()
//             .filter_map(|p| {
//                 if first_unplaced_parent.is_some()
//                     && p.oid == first_unplaced_parent.unwrap().oid
//                 {
//                     None
//                 } else {
//                     rails
//                         .iter()
//                         .position(|r| r.is_some() && r.as_ref().unwrap() == &p.oid)
//                 }
//             })
//             .collect();
//         LayoutListEntry {
//             commit: entry.clone(),
//             rail: my_rail,
//             has_parent_line: first_unplaced_parent.is_some(),
//             has_child_line: has_child,
//             outgoing,
//             incoming,
//             rails: rails.clone(),
//         }
//     })
//     .collect();
//     GraphLayoutData {
//         rails,
//         lines: vec![],
//     }
// }

#[tauri::command]
pub async fn get_index(state: StateType<'_>, oid: &str) -> Result<Option<usize>> {
    with_backend(state, |backend| {
        Ok(backend
            .graph
            .lines
            .iter()
            .position(|line| match &line.commit {
                Commit::Commit(c) => c.oid == oid,
                Commit::Stash(s) => s.oid == oid,
            }))
    })
    .await
}

fn match_commit(c: &FullCommitData, search_term: &str) -> bool {
    c.author.name.to_lowercase().contains(search_term)
        || c.author.email.to_lowercase().contains(search_term)
        || c.message.to_lowercase().contains(search_term)
        || c.short_oid.to_lowercase().contains(search_term)
        || c.oid.to_lowercase().contains(search_term)
}

#[tauri::command]
pub async fn find_commits(state: StateType<'_>, search_term: &str) -> Result<Vec<usize>> {
    with_backend(state, |backend| {
        Ok(backend
            .graph
            .lines
            .iter()
            .enumerate()
            .filter_map(|(i, c)| match &c.commit {
                Commit::Commit(c) => {
                    if match_commit(c, search_term) {
                        Some(i)
                    } else {
                        None
                    }
                }
                Commit::Stash(_) => None,
            })
            .collect())
    })
    .await
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

    fn make_rail_entry(oid: &str, has_through_line: bool) -> Option<RailEntry> {
        Some(RailEntry {
            expected_parent: oid.to_owned(),
            has_through_line,
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
                        has_parent_line: true,
                        has_child_line: false,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![make_rail_entry("2222", false)],
                        commit: child
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent_line: false,
                        has_child_line: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![],
                        commit: parent
                    }
                ],
                rails: vec![]
            },
            calculate_graph_layout(input.into_iter())
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
                        has_parent_line: true,
                        has_child_line: false,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![make_rail_entry("2222", false)],
                        commit: child2
                    },
                    LayoutListEntry {
                        rail: 1,
                        has_parent_line: false,
                        has_child_line: false,
                        outgoing: vec![0],
                        incoming: vec![],
                        rails: vec![make_rail_entry("2222", true)],
                        commit: child1
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent_line: false,
                        has_child_line: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![],
                        commit: parent
                    }
                ],
                rails: vec![]
            },
            calculate_graph_layout(input.into_iter())
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
                        has_parent_line: true,
                        has_child_line: false,
                        outgoing: vec![1],
                        incoming: vec![],
                        rails: vec![
                            make_rail_entry("2222", false),
                            make_rail_entry("1111", false)
                        ],
                        commit: child
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent_line: false,
                        has_child_line: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![None, make_rail_entry("1111", true)],
                        commit: parent1
                    },
                    LayoutListEntry {
                        rail: 1,
                        has_parent_line: false,
                        has_child_line: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![],
                        commit: parent2
                    }
                ],
                rails: vec![]
            },
            calculate_graph_layout(input.into_iter())
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
                        has_parent_line: true,
                        has_child_line: false,
                        outgoing: vec![1],
                        incoming: vec![],
                        rails: vec![
                            make_rail_entry("2222", false),
                            make_rail_entry("3333", false)
                        ],
                        commit: grandchild
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent_line: true,
                        has_child_line: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![
                            make_rail_entry("1111", false),
                            make_rail_entry("3333", true)
                        ],
                        commit: child_left
                    },
                    LayoutListEntry {
                        rail: 1,
                        has_parent_line: false,
                        has_child_line: true,
                        outgoing: vec![0],
                        incoming: vec![],
                        rails: vec![make_rail_entry("1111", true)],
                        commit: child_right
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent_line: false,
                        has_child_line: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![],
                        commit: parent
                    }
                ],
                rails: vec![]
            },
            calculate_graph_layout(input.into_iter())
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
                        has_parent_line: true,
                        has_child_line: false,
                        outgoing: vec![1],
                        incoming: vec![],
                        rails: vec![
                            make_rail_entry("2222", false),
                            make_rail_entry("3333", false)
                        ],
                        commit: grandchild
                    },
                    LayoutListEntry {
                        rail: 1,
                        has_parent_line: false,
                        has_child_line: true,
                        outgoing: vec![0],
                        incoming: vec![],
                        rails: vec![make_rail_entry("2222", true)],
                        commit: child
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent_line: true,
                        has_child_line: true,
                        outgoing: vec![1],
                        incoming: vec![],
                        rails: vec![
                            make_rail_entry("0000", false),
                            make_rail_entry("1111", false)
                        ],
                        commit: parent
                    },
                    LayoutListEntry {
                        rail: 1,
                        has_parent_line: false,
                        has_child_line: true,
                        outgoing: vec![0],
                        incoming: vec![],
                        rails: vec![make_rail_entry("0000", true)],
                        commit: grandparent
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent_line: false,
                        has_child_line: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![],
                        commit: greatgrandparent
                    }
                ],
                rails: vec![]
            },
            calculate_graph_layout(input.into_iter())
        )
    }

    #[test]
    fn incoming_correct() {
        let g = make_commit("g", vec![]);
        let p1 = make_commit("p1", vec![&g]);
        let c1 = make_commit("c1", vec![&p1]);
        let c2 = make_commit("c2", vec![&g]);
        let p2 = make_commit("p2", vec![&g]);

        let history = vec![c1.clone(), c2.clone(), p1.clone(), p2.clone(), g.clone()];

        let layout = calculate_graph_layout(history.into_iter());

        assert_eq!(
            GraphLayoutData {
                lines: vec![
                    LayoutListEntry {
                        rail: 0,
                        has_parent_line: true,
                        has_child_line: false,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![make_rail_entry("p1", false)],
                        commit: c1
                    },
                    LayoutListEntry {
                        rail: 1,
                        has_parent_line: true,
                        has_child_line: false,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![make_rail_entry("p1", true), make_rail_entry("g", false)],
                        commit: c2
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent_line: true,
                        has_child_line: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![make_rail_entry("g", false), make_rail_entry("g", true)],
                        commit: p1
                    },
                    LayoutListEntry {
                        rail: 2,
                        has_parent_line: false,
                        has_child_line: false,
                        outgoing: vec![0],
                        incoming: vec![],
                        rails: vec![make_rail_entry("g", true), make_rail_entry("g", true)],
                        commit: p2
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent_line: false,
                        has_child_line: true,
                        outgoing: vec![],
                        incoming: vec![1],
                        rails: vec![],
                        commit: g
                    }
                ],
                rails: vec![]
            },
            layout
        );
    }

    #[test]
    pub fn outgoing_correct() {
        let p2 = make_commit("p2", vec![]);
        let p1 = make_commit("p1", vec![]);
        let c3 = make_commit("c3", vec![&p1]);
        let c2 = make_commit("c2", vec![&p1, &p2]);
        let c1 = make_commit("c1", vec![&p2]);

        let history = vec![c1.clone(), c2.clone(), c3.clone(), p1.clone(), p2.clone()];

        let layout = calculate_graph_layout(history.into_iter());

        assert_eq!(
            GraphLayoutData {
                lines: vec![
                    LayoutListEntry {
                        rail: 0,
                        has_parent_line: true,
                        has_child_line: false,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![make_rail_entry("p2", false)],
                        commit: c1
                    },
                    LayoutListEntry {
                        rail: 1,
                        has_parent_line: true,
                        has_child_line: false,
                        outgoing: vec![0],
                        incoming: vec![],
                        rails: vec![make_rail_entry("p2", true), make_rail_entry("p1", false)],
                        commit: c2
                    },
                    LayoutListEntry {
                        rail: 2,
                        has_parent_line: false,
                        has_child_line: false,
                        outgoing: vec![1],
                        incoming: vec![],
                        rails: vec![make_rail_entry("p2", true), make_rail_entry("p1", true),],
                        commit: c3
                    },
                    LayoutListEntry {
                        rail: 1,
                        has_parent_line: false,
                        has_child_line: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![make_rail_entry("p2", true)],
                        commit: p1
                    },
                    LayoutListEntry {
                        rail: 0,
                        has_parent_line: false,
                        has_child_line: true,
                        outgoing: vec![],
                        incoming: vec![],
                        rails: vec![],
                        commit: p2
                    }
                ],
                rails: vec![]
            },
            layout
        )
    }
}
