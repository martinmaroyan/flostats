import { BoutsResponse } from "../api/types/responses";
import { BoutObject } from "../api/types/objects/bout";
import { WrestlerObject } from "../api/types/objects/wrestler";
import { UUID } from "../api/types/types";
import FloAPI from "../api/FloAPI";

export type CommonOpponentData = {
	opponentId: UUID;
	opponentName: string;
	athlete1Bouts: BoutWithMetadata[];
	athlete2Bouts: BoutWithMetadata[];
	athlete1Wins: number;
	athlete1Losses: number;
	athlete2Wins: number;
	athlete2Losses: number;
	totalBouts: number;
};

export type BoutWithMetadata = {
	bout: BoutObject;
	isWin: boolean;
	opponent: WrestlerObject;
};

/**
 * Extracts all opponent identityPersonIds from an athlete's bouts
 */
function extractOpponentIds(
	boutsResponse: BoutsResponse<any, any>,
	athleteId: UUID
): Set<UUID> {
	const opponentIds = new Set<UUID>();

	boutsResponse.data.forEach(bout => {
		const topWrestler = FloAPI.findIncludedObjectById<WrestlerObject>(
			bout.attributes.topWrestlerId,
			"wrestler",
			boutsResponse
		);
		const bottomWrestler = FloAPI.findIncludedObjectById<WrestlerObject>(
			bout.attributes.bottomWrestlerId,
			"wrestler",
			boutsResponse
		);

		// Determine which wrestler is the opponent
		const opponent = topWrestler?.attributes.identityPersonId === athleteId
			? bottomWrestler
			: topWrestler;

		if (opponent?.attributes.identityPersonId) {
			opponentIds.add(opponent.attributes.identityPersonId);
		}
	});

	return opponentIds;
}

/**
 * Gets bouts against a specific opponent
 */
function getBoutsAgainstOpponent(
	boutsResponse: BoutsResponse<any, any>,
	athleteId: UUID,
	opponentId: UUID
): BoutWithMetadata[] {
	const bouts: BoutWithMetadata[] = [];

	boutsResponse.data.forEach(bout => {
		const topWrestler = FloAPI.findIncludedObjectById<WrestlerObject>(
			bout.attributes.topWrestlerId,
			"wrestler",
			boutsResponse
		);
		const bottomWrestler = FloAPI.findIncludedObjectById<WrestlerObject>(
			bout.attributes.bottomWrestlerId,
			"wrestler",
			boutsResponse
		);

		// Determine which wrestler is the opponent
		const opponent = topWrestler?.attributes.identityPersonId === athleteId
			? bottomWrestler
			: topWrestler;

		if (opponent?.attributes.identityPersonId === opponentId) {
			// Get the winner
			const winner = FloAPI.findIncludedObjectById<WrestlerObject>(
				bout.attributes.winnerWrestlerId,
				"wrestler",
				boutsResponse
			);

			const isWin = winner?.attributes.identityPersonId === athleteId;

			bouts.push({
				bout,
				isWin,
				opponent,
			});
		}
	});

	return bouts;
}

/**
 * Finds all common opponents between two athletes and returns detailed comparison data
 */
export function findCommonOpponents(
	athlete1Bouts: BoutsResponse<any, any>,
	athlete2Bouts: BoutsResponse<any, any>,
	athlete1Id: UUID,
	athlete2Id: UUID
): CommonOpponentData[] {
	// Extract opponent IDs for both athletes
	const athlete1OpponentIds = extractOpponentIds(athlete1Bouts, athlete1Id);
	const athlete2OpponentIds = extractOpponentIds(athlete2Bouts, athlete2Id);

	// Find intersection (common opponents)
	const commonOpponentIds = new Set<UUID>(
		[...athlete1OpponentIds].filter(id => athlete2OpponentIds.has(id))
	);

	// Build detailed data for each common opponent
	const commonOpponents: CommonOpponentData[] = [];

	commonOpponentIds.forEach(opponentId => {
		// Get all bouts for each athlete against this opponent
		const athlete1BoutsVsOpponent = getBoutsAgainstOpponent(
			athlete1Bouts,
			athlete1Id,
			opponentId
		);
		const athlete2BoutsVsOpponent = getBoutsAgainstOpponent(
			athlete2Bouts,
			athlete2Id,
			opponentId
		);

		// Calculate win/loss records
		const athlete1Wins = athlete1BoutsVsOpponent.filter(b => b.isWin).length;
		const athlete1Losses = athlete1BoutsVsOpponent.filter(b => !b.isWin).length;
		const athlete2Wins = athlete2BoutsVsOpponent.filter(b => b.isWin).length;
		const athlete2Losses = athlete2BoutsVsOpponent.filter(b => !b.isWin).length;

		// Get opponent name (from first bout)
		const opponentName = athlete1BoutsVsOpponent[0]?.opponent?.attributes.fullName ||
		                     athlete2BoutsVsOpponent[0]?.opponent?.attributes.fullName ||
		                     "Unknown";

		commonOpponents.push({
			opponentId,
			opponentName,
			athlete1Bouts: athlete1BoutsVsOpponent,
			athlete2Bouts: athlete2BoutsVsOpponent,
			athlete1Wins,
			athlete1Losses,
			athlete2Wins,
			athlete2Losses,
			totalBouts: athlete1BoutsVsOpponent.length + athlete2BoutsVsOpponent.length,
		});
	});

	// Sort by total number of bouts (most bouts first)
	return commonOpponents.sort((a, b) => b.totalBouts - a.totalBouts);
}

/**
 * Calculates summary statistics for common opponents comparison
 */
export type CommonOpponentsSummary = {
	totalCommonOpponents: number;
	athlete1TotalWins: number;
	athlete1TotalLosses: number;
	athlete1WinPercentage: number;
	athlete2TotalWins: number;
	athlete2TotalLosses: number;
	athlete2WinPercentage: number;
};

export function calculateCommonOpponentsSummary(
	commonOpponents: CommonOpponentData[]
): CommonOpponentsSummary {
	let athlete1TotalWins = 0;
	let athlete1TotalLosses = 0;
	let athlete2TotalWins = 0;
	let athlete2TotalLosses = 0;

	commonOpponents.forEach(opponent => {
		athlete1TotalWins += opponent.athlete1Wins;
		athlete1TotalLosses += opponent.athlete1Losses;
		athlete2TotalWins += opponent.athlete2Wins;
		athlete2TotalLosses += opponent.athlete2Losses;
	});

	const athlete1Total = athlete1TotalWins + athlete1TotalLosses;
	const athlete2Total = athlete2TotalWins + athlete2TotalLosses;

	return {
		totalCommonOpponents: commonOpponents.length,
		athlete1TotalWins,
		athlete1TotalLosses,
		athlete1WinPercentage: athlete1Total > 0 ? (athlete1TotalWins / athlete1Total) * 100 : 0,
		athlete2TotalWins,
		athlete2TotalLosses,
		athlete2WinPercentage: athlete2Total > 0 ? (athlete2TotalWins / athlete2Total) * 100 : 0,
	};
}

/**
 * Finds all head-to-head matches between two athletes
 */
export type HeadToHeadMatch = {
	bout: BoutObject;
	winner: WrestlerObject;
	loser: WrestlerObject;
	athlete1Won: boolean;
};

export function findHeadToHeadMatches(
	athlete1Bouts: BoutsResponse<any, any>,
	athlete2Bouts: BoutsResponse<any, any>,
	athlete1Id: UUID,
	athlete2Id: UUID
): HeadToHeadMatch[] {
	const h2hMatches: HeadToHeadMatch[] = [];

	// Check athlete1's bouts to see if they faced athlete2
	athlete1Bouts.data.forEach(bout => {
		const topWrestler = FloAPI.findIncludedObjectById<WrestlerObject>(
			bout.attributes.topWrestlerId,
			"wrestler",
			athlete1Bouts
		);
		const bottomWrestler = FloAPI.findIncludedObjectById<WrestlerObject>(
			bout.attributes.bottomWrestlerId,
			"wrestler",
			athlete1Bouts
		);

		const opponent = topWrestler?.attributes.identityPersonId === athlete1Id
			? bottomWrestler
			: topWrestler;

		// Check if the opponent is athlete2
		if (opponent?.attributes.identityPersonId === athlete2Id) {
			const winner = FloAPI.findIncludedObjectById<WrestlerObject>(
				bout.attributes.winnerWrestlerId,
				"wrestler",
				athlete1Bouts
			);

			const athlete1Won = winner?.attributes.identityPersonId === athlete1Id;

			h2hMatches.push({
				bout,
				winner: athlete1Won ? (topWrestler?.attributes.identityPersonId === athlete1Id ? topWrestler : bottomWrestler)! : opponent,
				loser: athlete1Won ? opponent : (topWrestler?.attributes.identityPersonId === athlete1Id ? topWrestler : bottomWrestler)!,
				athlete1Won,
			});
		}
	});

	return h2hMatches;
}
