import { expect, it } from "vitest";
import { calculateCriteria, CriteriaWin, pointsForPlacement } from "./seedingCriteria";

it("caps sectional opponent wins at two and applies both loss reductions", () => {
	const wins: CriteriaWin[] = [1, 2, 3].map(n => ({ boutId: String(n), opponentIdentityPersonId: "same-person", opponentName: "Opponent", opponentHighestType: "sectional", opponentHighestPoints: 6, date: `2026-01-0${n}` }));
	const result = calculateCriteria({ startingPoints: 16, wins, losses: [
		{ boutId: "loss1", opponentIdentityPersonId: "strong", opponentName: null, strong: true, date: null },
		{ boutId: "loss2", opponentIdentityPersonId: "weak", opponentName: null, strong: false, date: null },
	] });
	expect(result.stepOnePoints).toBe(12);
	expect(result.uncountedWins).toHaveLength(1);
	expect(result.lossMultiplier).toBeCloseTo(0.93);
	expect(result.finalPoints).toBe(26);
});

it("does not cap wins over state placers", () => {
	const wins: CriteriaWin[] = [1, 2, 3].map(n => ({ boutId: String(n), opponentIdentityPersonId: "state-person", opponentName: null, opponentHighestType: "divisionalState", opponentHighestPoints: 16, date: null }));
	expect(calculateCriteria({ startingPoints: 0, wins, losses: [] }).stepOnePoints).toBe(48);
});

it("never produces negative criteria points", () => {
	const losses = Array.from({ length: 30 }, (_, n) => ({ boutId: String(n), opponentIdentityPersonId: "opponent", opponentName: null, strong: false, date: null }));
	expect(calculateCriteria({ startingPoints: 34, wins: [], losses }).finalPoints).toBe(0);
});

it("scores placements at the boundaries of each tournament", () => {
	expect(pointsForPlacement("sectional", 5)).toBe(1);
	expect(pointsForPlacement("sectional", 6)).toBe(0);
	expect(pointsForPlacement("divisionalState", 7)).toBe(8);
	expect(pointsForPlacement("allState", 1)).toBe(25);
	expect(pointsForPlacement("newEngland", 6)).toBe(28);
	expect(pointsForPlacement("newEngland", 7)).toBe(0);
});
