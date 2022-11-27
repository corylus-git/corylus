use serde::Serialize;

#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RemoteMeta {
    pub remote: String,
    pub url: String 
}