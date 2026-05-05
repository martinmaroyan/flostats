export type MaTournamentType = "sectional" | "divisionalState" | "allState" | "newEngland";

export const TOURNAMENT_LABELS: Record<MaTournamentType, string> = {
	sectional: "Sectional",
	divisionalState: "Divisional State",
	allState: "All-State",
	newEngland: "New England",
};

const SECTIONAL_RE = /^\s*20\d{2}\s+MIAA\s+D[123][A-Z](?:\/[A-Z])?\b/i;
const DIV_STATE_RE = /^\s*20\d{2}\s+MIAA\s+D[123](?:\s+(?:Girls|Boys))?\s+State\s+(?:Tournament|Championships?)\b/i;
const ALL_STATE_RE = /^\s*20\d{2}\s+MIAA\s+(?:Girls\s+)?All[-\s]State(?:\s+\/\s+Girls\s+All[-\s]State)?\s+(?:Tournament|Championships?)\b/i;
const NEW_ENGLAND_RE = /^\s*20\d{2}\s+New\s+England\s+Interscholastic\s+(?:Girls\s+)?Wrestling\s+Championship\b/i;

export function classifyMaTournament(eventName: string | undefined | null): MaTournamentType | null {
	if (!eventName) return null;
	if (SECTIONAL_RE.test(eventName)) return "sectional";
	if (DIV_STATE_RE.test(eventName)) return "divisionalState";
	if (ALL_STATE_RE.test(eventName)) return "allState";
	if (NEW_ENGLAND_RE.test(eventName)) return "newEngland";
	return null;
}

export type CriteriaWin = {
	boutId: string;
	opponentIdentityPersonId: string;
	opponentName: string | null;
	opponentHighestType: MaTournamentType;
	opponentHighestPoints: number;
	date: string | null;
};

export type CriteriaLoss = {
	boutId: string;
	opponentIdentityPersonId: string;
	opponentName: string | null;
	strong: boolean;
	date: string | null;
};

export type CriteriaBreakdown = {
	startingPoints: number;
	stepOnePoints: number;
	rawTotal: number;
	strongLosses: number;
	weakLosses: number;
	lossMultiplier: number;
	finalPoints: number;
	countedWins: CriteriaWin[];
	uncountedWins: CriteriaWin[];
	losses: CriteriaLoss[];
};

/** Implements the PDF rule: wrestlers can only earn points twice for wins
 * over the same sectional placer; State placers and higher are unlimited. */
export function aggregateWins(wins: CriteriaWin[]): { counted: CriteriaWin[]; uncounted: CriteriaWin[] } {
	const byOpponent = new Map<string, CriteriaWin[]>();
	for (const w of wins) {
		const arr = byOpponent.get(w.opponentIdentityPersonId) ?? [];
		arr.push(w);
		byOpponent.set(w.opponentIdentityPersonId, arr);
	}
	const counted: CriteriaWin[] = [];
	const uncounted: CriteriaWin[] = [];
	for (const arr of byOpponent.values()) {
		arr.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
		const cap = arr[0].opponentHighestType === "sectional" ? 2 : Infinity;
		arr.forEach((w, i) => (i < cap ? counted : uncounted).push(w));
	}
	return { counted, uncounted };
}

export function calculateCriteria(input: {
	startingPoints: number;
	wins: CriteriaWin[];
	losses: CriteriaLoss[];
}): CriteriaBreakdown {
	const { counted, uncounted } = aggregateWins(input.wins);
	const stepOnePoints = counted.reduce((s, w) => s + w.opponentHighestPoints, 0);
	const rawTotal = input.startingPoints + stepOnePoints;
	const strongLosses = input.losses.filter(l => l.strong).length;
	const weakLosses = input.losses.length - strongLosses;
	const reduction = strongLosses * 0.020 + weakLosses * 0.050;
	const lossMultiplier = Math.max(0, 1 - reduction);
	const finalPoints = Math.round(rawTotal * lossMultiplier);
	return {
		startingPoints: input.startingPoints,
		stepOnePoints,
		rawTotal,
		strongLosses,
		weakLosses,
		lossMultiplier,
		finalPoints,
		countedWins: counted,
		uncountedWins: uncounted,
		losses: input.losses,
	};
}

export function pointsForPlacement(type: MaTournamentType, placement: number): number {
	switch (type) {
		case "sectional":
			if (placement === 1 || placement === 2) return 6;
			if (placement === 3 || placement === 4) return 2;
			if (placement === 5) return 1;
			return 0;
		case "divisionalState":
			if (placement === 1 || placement === 2) return 16;
			if (placement === 3 || placement === 4) return 12;
			if (placement === 5 || placement === 6) return 10;
			if (placement === 7) return 8;
			return 0;
		case "allState":
			if (placement === 1 || placement === 2) return 25;
			if (placement === 3 || placement === 4) return 22;
			if (placement === 5 || placement === 6) return 20;
			if (placement === 7) return 18;
			return 0;
		case "newEngland":
			if (placement === 1 || placement === 2) return 34;
			if (placement >= 3 && placement <= 6) return 28;
			return 0;
	}
}
