use super::{
    model::{
        git::{Commit, FullCommitData},
        graph::{GraphLayoutData, LayoutListEntry, Rail},
    },
    with_backend, StateType,
};

use crate::error::Result;

/// Find the left-most rail that expects us as a parent, or (if none expects us) the left-most empty rail, extending the rails array if necessary
/// Returns the rail index and whether we were expected there or not
fn find_leftmost_rail(rails: &mut Vec<Rail>, for_id: &str) -> (usize, bool) {
    let mut my_rail = rails
        .iter()
        .position(|r| r.is_some() && r.as_ref().unwrap() == for_id);
    if (my_rail.is_some()) {
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

pub fn calculate_graph_layout(ordered_history: Vec<Commit>) -> GraphLayoutData {
    let mut rails: Vec<Rail> = vec![];
    let lines: Vec<LayoutListEntry> = ordered_history
        .iter()
        .map(|entry| {
            let graph_node = entry.as_graph_node();
            // 1. find our place in the world
            let (my_rail, has_child) = find_leftmost_rail(&mut rails, graph_node.oid());
            // 3. incoming are all other rails requesting us as a parent
            let incoming = rails
                .iter()
                .enumerate()
                .filter_map(|(i, r)| {
                    if r.is_some() && r.as_ref().unwrap() == graph_node.oid() && i != my_rail {
                        Some(i)
                    } else {
                        None
                    }
                })
                .collect();
            // 4. remove us from all rails
            rails.iter_mut().for_each(|r| {
                if r.is_some() && r.as_ref().unwrap() == graph_node.oid() {
                    *r = None
                }
            });
            // 5. find the first of our parents NOT YET PLACED LEFT OF US and place it on our rail
            let first_unplaced_parent = graph_node
                .parents()
                .iter()
                .find(|&p| !rails[..my_rail].contains(&Some(p.oid.clone())));
            rails[my_rail] = first_unplaced_parent.map(|p| p.oid.clone()); // may be empty, if all our parents are already expected to the left of us

            // 6. place our unplaced parents as needed
            graph_node.parents().iter().for_each(|p| {
                if !rails.contains(&Some(p.oid.clone())) {
                    let (candidate, _) = find_leftmost_rail(&mut rails, &p.oid);
                    rails[candidate] = Some(p.oid.clone());
                }
            });
            // 7. outgoing are all of our parents _except_ the one that sits on our rail (even if it sits on other rails as well)
            let outgoing = graph_node
                .parents()
                .iter()
                .filter_map(|p| {
                    if first_unplaced_parent.is_some()
                        && p.oid == first_unplaced_parent.unwrap().oid
                    {
                        None
                    } else {
                        rails
                            .iter()
                            .position(|r| r.is_some() && r.as_ref().unwrap() == &p.oid)
                    }
                })
                .collect();
            LayoutListEntry {
                commit: entry.clone(),
                rail: my_rail,
                has_parent: first_unplaced_parent.is_some(),
                has_child,
                outgoing,
                incoming,
                rails: rails.clone(),
            }
        })
        .collect();
    GraphLayoutData { rails, lines }
}

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
