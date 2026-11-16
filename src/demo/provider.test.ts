import { beforeEach, expect, it, vi } from "vitest";
import FloAPI from "../api/FloAPI";
import { fetchMergedAthleteData } from "../utils/athleteData";
import { loadManifest, loadPlacementIndex } from "../utils/placementIndex";
import { personId } from "./generator";

beforeEach(() => {
	vi.stubGlobal("window", { location: { pathname: "/demo" } });
	vi.stubGlobal("XMLHttpRequest", class { constructor() { throw new Error("Demo must never open live API requests"); } });
	vi.stubGlobal("fetch", () => { throw new Error("Demo must never fetch live placement files"); });
});

it("uses the existing full athlete loader, preserves pagination, and never calls live services", async () => {
	const first = await fetchMergedAthleteData(personId(0));
	expect(first.bouts.data.length).toBeGreaterThan(80);
	expect(first.wrestlers.data.length).toBeGreaterThan(40);
	expect(first.basicInfo.name).not.toBe("Unknown Wrestler");
	const originalName = first.wrestlers.data[0].attributes.fullName;
	first.wrestlers.data[0].attributes.fullName = "Mutated response";
	const again = await fetchMergedAthleteData(personId(0));
	expect(again.wrestlers.data[0].attributes.fullName).toBe(originalName);
	expect(again.bouts).toEqual(first.bouts);
	const manifest = await loadManifest();
	expect(manifest.indexes).toHaveLength(4);
	expect((await loadPlacementIndex(2026)).source).toContain("Synthetic");
});

it("supports narrow search, broader team search, pagination, and node details with consistent identities", async () => {
	const narrow = await FloAPI.searchByName("a", { limit: 10, page: 1, onProgress: () => {}, useOfp: false });
	const next = await FloAPI.searchByName("a", { limit: 10, page: 2, onProgress: () => {}, useOfp: false });
	expect(narrow.data).toHaveLength(10);
	expect(next.data![0].id).not.toBe(narrow.data![0].id);
	const broad = await FloAPI.searchByName("Alderhaven", { limit: 20, page: 1, onProgress: () => {}, useOfp: true });
	expect(broad.data).toHaveLength(12);
	const node = await FloAPI.fetchFromNode(broad.data![0].node.id);
	expect(node.data.original_entity.arena_person_identity_id).toBe(personId(0));
	const profile = await fetchMergedAthleteData(node.data.original_entity.arena_person_identity_id);
	expect(profile.basicInfo.name).toBe(node.data.original_entity.name);
});

it("rejects unknown athletes and unsupported requests instead of falling through to FloWrestling", async () => {
	await expect(FloAPI.fetchAllBouts("real-live-id")).rejects.toThrow("fictional dataset");
	await expect(FloAPI.fetchWithProgress("https://api.flowrestling.org/unknown")).rejects.toThrow("not supported");
});
