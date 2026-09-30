import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteGroup, expandToAliases, getCanonicalId, mergeIds, unmergeId } from "./aliases";

beforeEach(() => {
	const storage = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value),
	});
});

describe("profile aliases", () => {
	it("merges overlapping groups transitively with a stable canonical ID", () => {
		mergeIds(["c", "b"]);
		mergeIds(["a", "d"]);
		mergeIds(["b", "d", "b"]);
		expect(expandToAliases("c")).toEqual(["a", "b", "c", "d"]);
		expect(getCanonicalId("d")).toBe("a");
	});
	it("unmerges a member without discarding the remaining group", () => {
		mergeIds(["a", "b", "c"]);
		unmergeId("b");
		expect(expandToAliases("b")).toEqual(["b"]);
		expect(expandToAliases("c")).toEqual(["a", "c"]);
	});
	it("preserves built-in merges when a user extension is deleted", () => {
		const builtIn = expandToAliases("8cfcfc17-011a-4fca-b571-7a5e42e6794f");
		mergeIds([...builtIn, "extra"]);
		deleteGroup(expandToAliases("extra"));
		expect(expandToAliases(builtIn[0])).toEqual(builtIn);
		expect(expandToAliases("extra")).toEqual(["extra"]);
	});
	it("ignores malformed persisted storage", () => {
		localStorage.setItem("flostats.aliasGroups.v1", "not json");
		expect(expandToAliases("unknown")).toEqual(["unknown"]);
	});
});
