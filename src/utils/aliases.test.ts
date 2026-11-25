import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteGroup, expandToAliases, getCanonicalId, isBuiltInGroup, mergeIds, unmergeId } from "./aliases";

const MARTIN = ["064ad7f4-8d16-4dd2-94b1-1dd1c45c3832", "849118d4-8dfb-496f-a2e8-484434d9a7cb", "8cfcfc17-011a-4fca-b571-7a5e42e6794f"];

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
	it("permanently groups all three Martin Maroyan identities under the existing canonical ID", () => {
		for (const id of MARTIN) {
			expect(expandToAliases(id)).toEqual(MARTIN);
			expect(getCanonicalId(id)).toBe(MARTIN[0]);
		}
		expect(isBuiltInGroup(MARTIN)).toBe(true);
		deleteGroup(MARTIN);
		unmergeId(MARTIN[1]);
		expect(expandToAliases(MARTIN[1])).toEqual(MARTIN);
	});
	it("allows extending a permanent group with another multi-profile group without changing its URL", () => {
		mergeIds(["000-extra", "extra-b", "extra-c"]);
		mergeIds([MARTIN[1], "extra-b"]);
		expect(expandToAliases("extra-c")).toHaveLength(6);
		expect(getCanonicalId("000-extra")).toBe(MARTIN[0]);
		deleteGroup(expandToAliases("extra-b"));
		expect(expandToAliases(MARTIN[0])).toEqual(MARTIN);
	});
	it("ignores malformed persisted storage", () => {
		localStorage.setItem("flostats.aliasGroups.v1", "not json");
		expect(expandToAliases("unknown")).toEqual(["unknown"]);
	});
});
