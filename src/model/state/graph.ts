import { invoke } from "@tauri-apps/api";
import { LayoutListEntry } from "../../util/graphLayout";


/**
 * Retrieves a list of graph entries within a specified range.
 *
 * @param {number} startIdx - The starting index of the range.
 * @param {number} endIdx - The ending index of the range. Inclusive.
 * @return {Promise<LayoutListEntry[]>} A promise that resolves to an array of layout list entries.
 */
export async function getGraphEntries(startIdx: number, endIdx: number): Promise<LayoutListEntry[]> {
    return invoke<LayoutListEntry[]>('get_graph_entries', { startIdx, endIdx })
}
