import { useSyncExternalStore } from "react";

export type AliasGroup = string[];

const STORAGE_KEY = "flostats.aliasGroups.v1";

/** Hardcoded alias groups for known FloWrestling identity splits.
 *  Built-in groups can't be unmerged via the UI. */
const BUILT_IN_GROUPS: AliasGroup[] = [
	// Martin Maroyan — split when changing schools.
	["8cfcfc17-011a-4fca-b571-7a5e42e6794f", "064ad7f4-8d16-4dd2-94b1-1dd1c45c3832"],
];

const subscribers = new Set<() => void>();

function notify() {
	for (const cb of subscribers) cb();
}

function readUserGroups(): AliasGroup[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((g): g is string[] => Array.isArray(g) && g.every(x => typeof x === "string"))
			.map(g => Array.from(new Set(g)).sort())
			.filter(g => g.length >= 2);
	} catch {
		return [];
	}
}

function writeUserGroups(groups: AliasGroup[]): void {
	const cleaned = groups
		.map(g => Array.from(new Set(g)).sort())
		.filter(g => g.length >= 2);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
	notify();
}

/** Union groups that share any id (transitive merge). */
function unionGroups(groups: AliasGroup[]): AliasGroup[] {
	const idToIndex = new Map<string, number>();
	const buckets: Set<string>[] = [];

	for (const g of groups) {
		const indices = new Set<number>();
		for (const id of g) {
			const i = idToIndex.get(id);
			if (i != null) indices.add(i);
		}
		if (indices.size === 0) {
			buckets.push(new Set(g));
			const newIndex = buckets.length - 1;
			for (const id of g) idToIndex.set(id, newIndex);
		} else {
			const sorted = [...indices].sort((a, b) => a - b);
			const target = sorted[0];
			for (const id of g) buckets[target].add(id);
			for (let k = 1; k < sorted.length; k++) {
				const fromIdx = sorted[k];
				for (const id of buckets[fromIdx]) buckets[target].add(id);
				buckets[fromIdx].clear();
			}
			for (const id of buckets[target]) idToIndex.set(id, target);
		}
	}

	return buckets.filter(b => b.size > 0).map(b => [...b].sort());
}

/** All alias groups, with built-in and user-defined unioned together. */
export function getAllGroups(): AliasGroup[] {
	return unionGroups([...BUILT_IN_GROUPS, ...readUserGroups()]);
}

export function getAliasGroup(id: string): AliasGroup | null {
	for (const g of getAllGroups()) {
		if (g.includes(id)) return g;
	}
	return null;
}

/** All ids that should be treated as the same person — at minimum the input id itself. */
export function expandToAliases(id: string): string[] {
	return getAliasGroup(id) ?? [id];
}

/** A stable representative id for the group containing `id`. Used so downstream
 *  comparisons (`wrestler.identityPersonId === athleteId`) work after merging
 *  data from multiple profiles. */
export function getCanonicalId(id: string): string {
	const g = getAliasGroup(id);
	return g ? g[0] : id;
}

export function isBuiltInGroup(group: AliasGroup): boolean {
	return BUILT_IN_GROUPS.some(b => b.length === group.length && b.every(id => group.includes(id)));
}

export function mergeIds(ids: string[]): void {
	const cleaned = Array.from(new Set(ids.filter(Boolean))).sort();
	if (cleaned.length < 2) return;
	const user = readUserGroups();
	writeUserGroups(unionGroups([...user, cleaned]));
}

/** Remove an id from any user-defined group that contains it. Built-in groups
 *  stay intact — those are not user-modifiable. */
export function unmergeId(id: string): void {
	const user = readUserGroups();
	const next: AliasGroup[] = [];
	for (const g of user) {
		if (!g.includes(id)) {
			next.push(g);
			continue;
		}
		const without = g.filter(x => x !== id);
		if (without.length >= 2) next.push(without);
	}
	writeUserGroups(next);
}

/** Remove an entire user-defined group. No-op for built-in groups. */
export function deleteGroup(group: AliasGroup): void {
	const user = readUserGroups();
	const target = new Set(group);
	writeUserGroups(user.filter(g => !g.some(id => target.has(id))));
}

function subscribe(cb: () => void): () => void {
	subscribers.add(cb);
	const onStorage = (e: StorageEvent) => {
		if (e.key === STORAGE_KEY) cb();
	};
	window.addEventListener("storage", onStorage);
	return () => {
		subscribers.delete(cb);
		window.removeEventListener("storage", onStorage);
	};
}

let snapshotCache: AliasGroup[] | null = null;
let snapshotKey = "";

function getSnapshot(): AliasGroup[] {
	const groups = getAllGroups();
	const key = groups.map(g => g.join("|")).join(";");
	if (!snapshotCache || key !== snapshotKey) {
		snapshotKey = key;
		snapshotCache = groups;
	}
	return snapshotCache;
}

/** React hook returning the current list of merged groups. Re-renders on changes. */
export function useAliasGroups(): AliasGroup[] {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
