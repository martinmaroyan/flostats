import { beforeAll, describe, expect, it } from "vitest";
import { generateDataset, personId, type DemoDataset } from "./generator";
import { includedFor } from "./provider";
import { findCommonOpponents, findHeadToHeadMatches } from "../utils/commonOpponents";
import type { AthleteBouts } from "../utils/athleteData";
import { pointsForPlacement, calculateCriteria } from "../utils/seedingCriteria";

let league: DemoDataset;
beforeAll(() => { league = generateDataset(); });
function response(id: string): AthleteBouts {
	const data = league.boutsByPerson.get(id)!;
	return { data, included: includedFor(data, league) as AthleteBouts["included"], meta: { total: data.length } };
}

describe("synthetic league integrity", () => {
	it("has a substantial, connected dataset without imported personal information", () => {
		expect(league.people).toHaveLength(384);
		expect(league.teams).toHaveLength(32);
		expect(league.events.length).toBeGreaterThan(300);
		expect(league.bouts.length).toBeGreaterThan(10000);
		expect(league.bouts.length).toBeLessThan(30000);
		expect(new Set(league.people.map(p => `${p.first} ${p.last}`)).size).toBe(384);
		expect(league.people.every(p => league.boutsByPerson.has(p.id))).toBe(true);
		expect(league.registrations.every(r => r.attributes.dateOfBirth === null)).toBe(true);
	});
	it("reproduces identities, every bout, and every placement for the same seed", () => {
		const other = generateDataset();
		expect(other.people).toEqual(league.people);
		expect(other.bouts).toEqual(league.bouts);
		expect(other.indexes).toEqual(league.indexes);
		expect(generateDataset(41, 16).people).not.toEqual(league.people.slice(0, 192));
	});
	it("conserves wins and losses, reciprocal histories, scores, weights, teams, and dates for EVERY bout", () => {
		let totalWins = 0, totalLosses = 0;
		for (const bout of league.bouts) {
			const a = bout.attributes;
			const top = league.registrationsById.get(a.topWrestlerId)!;
			const bottom = league.registrationsById.get(a.bottomWrestlerId)!;
			const event = league.objects.get(`event:${a.eventId}`)!;
			expect(event.type).toBe("event");
			if (event.type !== "event") throw new Error("Missing event");
			expect(top.attributes.identityPersonId).not.toBe(bottom.attributes.identityPersonId);
			expect(top.attributes.teamId).not.toBe(bottom.attributes.teamId);
			expect(top.attributes.weightClassId).toBe(a.weightClassId);
			expect(bottom.attributes.weightClassId).toBe(a.weightClassId);
			expect(top.attributes.eventId).toBe(a.eventId);
			expect(bottom.attributes.eventId).toBe(a.eventId);
			expect([top.id, bottom.id]).toContain(a.winnerWrestlerId);
			for (const wrestler of [top, bottom]) {
				expect(league.boutsByPerson.get(wrestler.attributes.identityPersonId)).toContain(bout);
				if (wrestler.id === a.winnerWrestlerId) totalWins++; else totalLosses++;
			}
			expect(a.goDateTime >= event.attributes.startDateTime && a.endDateTime <= event.attributes.endDateTime).toBe(true);
			const delta = Math.abs(a.topWrestlerScore - a.bottomWrestlerScore);
			if (a.winType !== "FF") expect(a.winnerWrestlerId === top.id ? a.topWrestlerScore > a.bottomWrestlerScore : a.bottomWrestlerScore > a.topWrestlerScore).toBe(true);
			if (a.winType === "DEC") expect(delta >= 1 && delta <= 7).toBe(true);
			if (a.winType === "MD") expect(delta >= 8 && delta <= 14).toBe(true);
			if (a.winType === "TF") expect(delta).toBe(15);
		}
		expect(totalWins).toBe(league.bouts.length);
		expect(totalLosses).toBe(totalWins);
		expect([...league.boutsByPerson.values()].reduce((sum, bouts) => sum + bouts.length, 0)).toBe(2 * league.bouts.length);
	});
	it("derives all placements from bracket finals and supplies matching MIAA paperwork", () => {
		for (const object of league.objects.values()) {
			if (object.type !== "bracketPlacement") continue;
			const p = object.attributes;
			const final = league.objects.get(`bout:${p.boutId}`)!;
			expect(final.type).toBe("bout");
			if (final.type !== "bout") throw new Error("Missing final");
			expect([final.attributes.topWrestlerId, final.attributes.bottomWrestlerId]).toContain(p.wrestlerId);
			expect(final.attributes.winnerWrestlerId === p.wrestlerId).toBe(p.placement % 2 === 1);
			expect(final.attributes.boutPoolId).toBe(p.boutPoolId);
		}
		for (const index of league.indexes.values()) for (const [id, record] of Object.entries(index.byPerson)) {
			expect(record.highestPoints).toBe(Math.max(...record.placements.map(p => p.points)));
			for (const placement of record.placements) {
				expect(placement.points).toBe(pointsForPlacement(placement.type, placement.place));
				const registration = league.registrationsByPerson.get(id)!.find(r => league.events.find(e => e.id === r.attributes.eventId)?.attributes.name === placement.tournament)!;
				expect(registration).toBeDefined();
				const actual = league.objects.get(`bracketPlacement:${registration.relationships.bracketPlacements.data[0].id}`)!;
				expect(actual.type === "bracketPlacement" && actual.attributes.placement).toBe(placement.place);
			}
		}
	});
	it("aggregates career totals from seasons, has varied skill records, and progresses weights plausibly", () => {
		const rates: number[] = [];
		for (const person of league.people) {
			const bouts = league.boutsByPerson.get(person.id)!;
			const wins = bouts.filter(b => league.registrationsById.get(b.attributes.winnerWrestlerId)!.attributes.identityPersonId === person.id);
			rates.push(wins.length / bouts.length);
			const seasons = new Map<number, number>();
			for (const bout of bouts) { const date = new Date(bout.attributes.goDateTime); const year = date.getUTCFullYear() + (date.getUTCMonth() >= 10 ? 1 : 0); seasons.set(year, (seasons.get(year) ?? 0) + 1); }
			expect([...seasons.values()].reduce((a, b) => a + b, 0)).toBe(bouts.length);
			const weights = league.registrationsByPerson.get(person.id)!.map(r => r.attributes.weightClassId).map(id => league.objects.get(`weightClass:${id}`)!).filter(w => w.type === "weightClass").map(w => w.attributes.maxWeight);
			expect(Math.max(...weights) - Math.min(...weights)).toBeLessThanOrEqual(100);
		}
		expect(Math.max(...rates)).toBeGreaterThan(.9);
		expect(Math.min(...rates)).toBeLessThan(.15);
	});
	it("feeds the existing head-to-head, common-opponent, and MIAA algorithms", () => {
		const first = personId(0), second = personId(12);
		const a = response(first), b = response(second);
		const h2h = findHeadToHeadMatches(a, first, second);
		expect(h2h.length).toBeGreaterThan(0);
		expect(findHeadToHeadMatches(b, second, first)).toHaveLength(h2h.length);
		expect(findCommonOpponents(a, b, first, second).length).toBeGreaterThan(5);
		const previous = league.indexes.get(2025)!;
		const wins = a.data.filter(b => b.attributes.goDateTime >= "2025-11" && league.registrationsById.get(b.attributes.winnerWrestlerId)!.attributes.identityPersonId === first && b.attributes.winType !== "FF").flatMap(bout => {
			const other = [bout.attributes.topWrestlerId, bout.attributes.bottomWrestlerId].map(id => league.registrationsById.get(id)!).find(w => w.attributes.identityPersonId !== first)!;
			const record = previous.byPerson[other.attributes.identityPersonId];
			return record ? [{ boutId: bout.id, opponentIdentityPersonId: other.attributes.identityPersonId, opponentName: other.attributes.fullName, opponentHighestType: record.highestType, opponentHighestPoints: record.highestPoints, date: bout.attributes.goDateTime }] : [];
		});
		const criteria = calculateCriteria({ startingPoints: previous.byPerson[first].highestPoints, wins, losses: [] });
		expect(criteria.stepOnePoints).toBeGreaterThan(0);
		expect(criteria.finalPoints).toBe(criteria.startingPoints + criteria.stepOnePoints);
	});
});
