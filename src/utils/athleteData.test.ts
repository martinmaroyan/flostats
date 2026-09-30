import { beforeEach, expect, it, vi } from "vitest";
import FloAPI from "../api/FloAPI";
import { WrestlerObject } from "../api/types/objects/wrestler";
import { AthleteBouts, AthleteWrestlers, fetchMergedAthleteData } from "./athleteData";
import { mergeIds } from "./aliases";
import { findCommonOpponents, findHeadToHeadMatches } from "./commonOpponents";
import { lookup, PlacementIndex } from "./placementIndex";

function wrestler(id: string, person: string): WrestlerObject {
	return { id, type: "wrestler", attributes: { identityPersonId: person, firstName: person, lastName: "Wrestler", fullName: person } } as WrestlerObject;
}

function bouts(top: WrestlerObject, bottom: WrestlerObject): AthleteBouts {
	return {
		data: [{ id: "match", type: "bout", attributes: { topWrestlerId: top.id, bottomWrestlerId: bottom.id, winnerWrestlerId: top.id, winType: "DEC" } }],
		included: [top, bottom], meta: { total: 1 },
	} as AthleteBouts;
}

beforeEach(() => {
	const storage = new Map<string, string>();
	vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
});

it("deduplicates merged records and normalizes both athlete and opponent identities", async () => {
	mergeIds(["athlete-a", "athlete-b"]);
	mergeIds(["opponent-a", "opponent-b"]);
	const registration = wrestler("registration", "athlete-b");
	const opponent = wrestler("opponent-registration", "opponent-b");
	vi.spyOn(FloAPI, "fetchAllWrestlers").mockResolvedValue({ data: [registration], included: [], meta: { total: 1 } } as unknown as AthleteWrestlers);
	vi.spyOn(FloAPI, "fetchAllBouts").mockImplementation(() => Promise.resolve(structuredClone(bouts(registration, opponent))));
	const merged = await fetchMergedAthleteData("athlete-b");
	expect(merged.canonicalId).toBe("athlete-a");
	expect(merged.wrestlers.data).toHaveLength(1);
	expect(merged.wrestlers.meta.total).toBe(1);
	expect(merged.bouts.data).toHaveLength(1);
	expect(merged.bouts.meta.total).toBe(1);
	expect(merged.wrestlers.data[0].attributes.identityPersonId).toBe("athlete-a");
	expect(findHeadToHeadMatches(merged.bouts, "athlete-a", "opponent-a")).toHaveLength(1);
});

it("compares person IDs across different event registration IDs", () => {
	const first = bouts(wrestler("registration-a", "person-a"), wrestler("opponent-registration-1", "opponent"));
	const second = bouts(wrestler("opponent-registration-2", "opponent"), wrestler("registration-b", "person-b"));
	const common = findCommonOpponents(first, second, "person-a", "person-b");
	expect(common).toHaveLength(1);
	expect(common[0]).toMatchObject({ athlete1Wins: 1, athlete2Losses: 1, opponentId: "opponent" });
});

it("looks up the highest seeding placement across all aliases", () => {
	mergeIds(["a", "b"]);
	const index = { byPerson: {
		a: { fullName: "Athlete", highestPoints: 6, highestType: "sectional", placements: [] },
		b: { fullName: "Athlete", highestPoints: 25, highestType: "allState", placements: [] },
	} } as unknown as PlacementIndex;
	expect(lookup(index, "a")?.highestPoints).toBe(25);
	expect(lookup(index, "missing")).toBeNull();
});
