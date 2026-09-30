import { Card, Divider, Group, Loader, Stack, Table, Text, Title, Tooltip } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { AthleteDataProps } from "../Athletes";
import FloAPI from "../api/FloAPI";
import { EventObject } from "../api/types/objects/event";
import { WrestlerObject } from "../api/types/objects/wrestler";
import {
	calculateCriteria,
	CriteriaBreakdown,
	CriteriaLoss,
	CriteriaWin,
	TOURNAMENT_LABELS,
} from "../utils/seedingCriteria";
import { loadManifest, loadPlacementIndex, lookup, ManifestEntry, PersonRecord, PlacementIndex } from "../utils/placementIndex";
import { isForfeit } from "../utils/boutResults";

type SeasonBlock = {
	/** Calendar year of the postseason at the END of this season (also the index year). */
	postseasonYear: number;
	/** "2025-26" label. */
	label: string;
	/** Athlete's record in this season's postseason, if any. */
	postseason: PersonRecord | null;
	/** Athlete's record in the previous season's postseason — i.e. starting paperwork. */
	startingFrom: PersonRecord | null;
	/** Whether previous-season index was available at all. */
	hasPreviousIndex: boolean;
	/** Did we find any bouts in this season? */
	hasBouts: boolean;
	calc: CriteriaBreakdown;
};

function seasonLabelFor(postseasonYear: number): string {
	const start = postseasonYear - 1;
	return `${start}-${String(postseasonYear % 100).padStart(2, "0")}`;
}

function buildSeasonBlock(
	postseasonYear: number,
	athleteId: string,
	bouts: AthleteDataProps["bouts"],
	currIndex: PlacementIndex | null,
	prevIndex: PlacementIndex | null,
): SeasonBlock {
	const seasonStart = new Date(postseasonYear - 1, 10, 1).getTime();
	const seasonEnd = new Date(postseasonYear, 10, 1).getTime();

	const postseason = currIndex ? lookup(currIndex, athleteId) : null;
	const startingFrom = prevIndex ? lookup(prevIndex, athleteId) : null;
	const startingPoints = startingFrom?.highestPoints ?? 0;

	const wins: CriteriaWin[] = [];
	const losses: CriteriaLoss[] = [];
	let hasBouts = false;

	if (bouts) {
		for (const bout of bouts.data) {
			const winType = bout.attributes.winType;
			if (winType === "NC" || winType === "BYE") continue;

			const dateStr = bout.attributes.goDateTime
				?? bout.attributes.endDateTime
				?? FloAPI.findIncludedObjectById<EventObject>(bout.attributes.eventId, "event", bouts)?.attributes.startDateTime
				?? null;
			if (!dateStr) continue;
			const t = new Date(dateStr).getTime();
			if (t < seasonStart || t >= seasonEnd) continue;
			hasBouts = true;

			const top = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.topWrestlerId, "wrestler", bouts);
			const bottom = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.bottomWrestlerId, "wrestler", bouts);
			if (!top || !bottom) continue;

			const isAthleteTop = top.attributes.identityPersonId === athleteId;
			const opponent = isAthleteTop ? bottom : top;
			const opponentId = opponent.attributes.identityPersonId;
			if (!opponentId) continue;

			const winner = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.winnerWrestlerId, "wrestler", bouts);
			const isAWin = winner?.attributes.identityPersonId === athleteId;

			const opponentRecord = prevIndex ? lookup(prevIndex, opponentId) : null;
			const opponentName = opponent.attributes.fullName
				?? ([opponent.attributes.firstName, opponent.attributes.lastName].filter(Boolean).join(" ") || opponentRecord?.fullName)
				?? null;

			if (isAWin) {
				if (isForfeit(winType)) continue;
				if (!opponentRecord) continue;
				wins.push({
					boutId: bout.id,
					opponentIdentityPersonId: opponentId,
					opponentName,
					opponentHighestType: opponentRecord.highestType,
					opponentHighestPoints: opponentRecord.highestPoints,
					date: dateStr,
				});
			} else {
				losses.push({
					boutId: bout.id,
					opponentIdentityPersonId: opponentId,
					opponentName,
					strong: !!opponentRecord,
					date: dateStr,
				});
			}
		}
	}

	return {
		postseasonYear,
		label: seasonLabelFor(postseasonYear),
		postseason,
		startingFrom,
		hasPreviousIndex: !!prevIndex,
		hasBouts,
		calc: calculateCriteria({ startingPoints, wins, losses }),
	};
}

export default function SeedingCriteria({ bouts, identityPersonId }: AthleteDataProps) {
	const [manifest, setManifest] = useState<ManifestEntry[] | null>(null);
	const [indexes, setIndexes] = useState<Map<number, PlacementIndex>>(new Map());
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const m = await loadManifest();
				if (cancelled) return;
				setManifest(m.indexes);
				const loaded = await Promise.all(m.indexes.map(e => loadPlacementIndex(e.year).then(idx => [e.year, idx] as const)));
				if (cancelled) return;
				setIndexes(new Map(loaded));
			} catch (e) {
				if (!cancelled) setLoadError(e instanceof Error ? e.message : "Unable to load placement indexes");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => { cancelled = true; };
	}, []);

	const seasons = useMemo<SeasonBlock[]>(() => {
		if (!manifest?.length || indexes.size === 0) return [];
		// Postseason years are the years we have indexes for, plus one beyond the latest
		// (so we can show the most recent season even if its postseason is the latest index).
		// Actually each manifest year Y is itself the postseason for season (Y-1)→Y, so just iterate manifest.
		// Include manifest years (each represents a completed season's postseason) plus
		// one beyond the latest, so an in-progress season with starting paperwork but no
		// postseason yet still shows up if there are bouts in range.
		const sortedYears = manifest.map(m => m.year).sort((a, b) => a - b);
		const latest = sortedYears[sortedYears.length - 1];
		const years = [...sortedYears, latest + 1].sort((a, b) => b - a);
		const blocks = years.map(y => buildSeasonBlock(
			y,
			identityPersonId,
			bouts,
			indexes.get(y) ?? null,
			indexes.get(y - 1) ?? null,
		));
		// Hide seasons with no postseason placements AND no bouts AND no Step 1 wins.
		return blocks.filter(b => b.postseason || b.hasBouts);
	}, [manifest, indexes, bouts, identityPersonId]);

	return (
		<Card w="100%" style={{ border: "1px solid var(--mantine-color-gray-7)" }}>
			<Stack align="center" w="100%">
				<Group gap={6} align="center">
					<Title order={2}>Seeding Criteria</Title>
					<Tooltip
						multiline
						w={340}
						label="MIAA Criteria #2 — Superior Record Against Strong Opposition. Each season's number is computed from starting points (previous-season postseason placement), wins this season against opponents who placed last season (Step 1, with sectional 2-cap), and a loss multiplier (Step 2)."
					>
						<IconInfoCircle size={20} />
					</Tooltip>
				</Group>

				{loading ? (
					<Group gap="xs"><Loader size="sm" /><Text size="sm" c="dimmed">Loading placement indexes…</Text></Group>
				) : loadError ? (
					<Text c="red">{loadError}</Text>
				) : seasons.length === 0 ? (
					<Text c="dimmed">No MA postseason activity found for this athlete.</Text>
				) : (
					<Stack w="100%" gap="md">
						{seasons.map((s, i) => (
							<SeasonCard key={s.postseasonYear} season={s} isFirst={i === 0} />
						))}
					</Stack>
				)}
			</Stack>
		</Card>
	);
}

function SeasonCard({ season, isFirst }: { season: SeasonBlock; isFirst: boolean }) {
	const c = season.calc;
	return (
		<Card withBorder padding="md" radius="md" style={isFirst ? { borderColor: "var(--mantine-color-blue-6)" } : undefined}>
			<Stack gap="sm">
				<Group justify="space-between" align="center" wrap="wrap">
					<Title order={3}>{season.label} Season</Title>
					<Group gap="lg" wrap="wrap">
						<Stat label="Starting" value={c.startingPoints} />
						<Stat label="+ Step 1" value={c.stepOnePoints} />
						<Stat label="× Loss Mult." value={c.lossMultiplier.toFixed(3)} />
						<Stat label="Final" value={c.finalPoints} valueColor="var(--mantine-win-color)" bold />
					</Group>
				</Group>

				<Divider />

				{/* Postseason placements earned this season */}
				{season.postseason && season.postseason.placements.length > 0 ? (
					<Stack gap={4}>
						<Text fw={600} size="sm">Postseason placements (this season's results)</Text>
						<PlacementList record={season.postseason} />
					</Stack>
				) : (
					<Text size="sm" c="dimmed">No MA postseason placements this season.</Text>
				)}

				{/* Starting paperwork — previous season's postseason */}
				{season.startingFrom ? (
					<Text size="sm">
						<Text span fw={600}>Starting paperwork (from prior season): </Text>
						<Text span>{season.startingFrom.placements[0]?.tournament}</Text>
						<Text span c="dimmed"> — {season.startingFrom.placements[0]?.place && ordinal(season.startingFrom.placements[0].place)} = {season.startingFrom.highestPoints} pts</Text>
					</Text>
				) : season.hasPreviousIndex ? (
					<Text size="sm" c="dimmed">No previous-season postseason paperwork.</Text>
				) : (
					<Text size="sm" c="dimmed">No prior-season placement index available — starting at 0.</Text>
				)}

				{/* Step 1 — wins against placers */}
				{c.countedWins.length > 0 ? (
					<Stack gap={4}>
						<Text fw={600} size="sm">Step 1 — wins against opponents with prior-season paperwork ({c.countedWins.length})</Text>
						<Table striped withTableBorder withColumnBorders highlightOnHover>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Date</Table.Th>
									<Table.Th>Opponent</Table.Th>
									<Table.Th>Opp. Highest Placement</Table.Th>
									<Table.Th>Pts</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{c.countedWins.map(w => (
									<Table.Tr key={w.boutId}>
										<Table.Td>{w.date?.slice(0, 10) ?? "—"}</Table.Td>
										<Table.Td>{w.opponentName ?? w.opponentIdentityPersonId.slice(0, 8)}</Table.Td>
										<Table.Td>{TOURNAMENT_LABELS[w.opponentHighestType]}</Table.Td>
										<Table.Td fw={600}>{w.opponentHighestPoints}</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
						{c.uncountedWins.length > 0 && (
							<Text size="xs" c="dimmed">
								{c.uncountedWins.length} additional win(s) excluded by the 2-wins-per-sectional-placer cap.
							</Text>
						)}
					</Stack>
				) : season.hasBouts && season.hasPreviousIndex ? (
					<Text size="sm" c="dimmed">No wins this season counted toward Step 1.</Text>
				) : null}

				{/* Step 2 — losses */}
				{c.losses.length > 0 ? (
					<Stack gap={4}>
						<Text fw={600} size="sm">
							Step 2 — losses: {c.strongLosses} to placer{c.strongLosses === 1 ? "" : "s"} (×0.020 each), {c.weakLosses} to non-placer{c.weakLosses === 1 ? "" : "s"} (×0.050 each)
						</Text>
						<Text size="xs" c="dimmed">
							Reduction: {(1 - c.lossMultiplier).toFixed(3)} → multiplier {c.lossMultiplier.toFixed(3)}
						</Text>
					</Stack>
				) : null}

				<Divider variant="dashed" />
				<Text size="sm" ta="center">
					({c.startingPoints} + {c.stepOnePoints}) × {c.lossMultiplier.toFixed(3)} ={" "}
					<Text span fw={700} c="var(--mantine-win-color)">{c.finalPoints} pts</Text>
				</Text>
			</Stack>
		</Card>
	);
}

function PlacementList({ record }: { record: PersonRecord }) {
	return (
		<Table withTableBorder withColumnBorders striped highlightOnHover>
			<Table.Thead>
				<Table.Tr>
					<Table.Th>Tournament</Table.Th>
					<Table.Th>Type</Table.Th>
					<Table.Th>Weight</Table.Th>
					<Table.Th>Place</Table.Th>
					<Table.Th>Pts</Table.Th>
				</Table.Tr>
			</Table.Thead>
			<Table.Tbody>
				{record.placements.map((p, i) => (
					<Table.Tr key={`${p.tournament}-${i}`}>
						<Table.Td>{p.tournament}</Table.Td>
						<Table.Td>{TOURNAMENT_LABELS[p.type]}</Table.Td>
						<Table.Td>{p.weightClass ?? "—"}</Table.Td>
						<Table.Td>{ordinal(p.place)}</Table.Td>
						<Table.Td fw={600}>{p.points}</Table.Td>
					</Table.Tr>
				))}
			</Table.Tbody>
		</Table>
	);
}

function Stat({ label, value, valueColor, bold }: { label: string; value: string | number; valueColor?: string; bold?: boolean }) {
	return (
		<Stack gap={0} align="center">
			<Text size="xs" c="dimmed">{label}</Text>
			<Text size="lg" fw={bold ? 700 : 600} c={valueColor}>{value}</Text>
		</Stack>
	);
}

function ordinal(n: number): string {
	const s = ["th", "st", "nd", "rd"];
	const v = n % 100;
	return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
