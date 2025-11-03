import React, { useMemo } from "react";
import { Badge, Group, Stack, Text } from "@mantine/core";
import { Link } from "react-router";
import { MantineReactTable, MRT_ColumnDef, MRT_ExpandedState, useMantineReactTable } from "mantine-react-table";
import dayjs from "dayjs";

import { CommonOpponentData } from "../../utils/commonOpponents";
import { BoutsResponse } from "../../api/types/responses";
import FloAPI from "../../api/FloAPI";
import { EventObject } from "../../api/types/objects/event";
import { TeamObject } from "../../api/types/objects/team";
import { WeightClassObject } from "../../api/types/objects/weightClass";
import { DivisionObject } from "../../api/types/objects/division";

type Props = {
	commonOpponents: CommonOpponentData[];
	athlete1Bouts: BoutsResponse<any, any>;
	athlete2Bouts: BoutsResponse<any, any>;
};

export default function CommonOpponentsTable({ commonOpponents, athlete1Bouts, athlete2Bouts }: Props) {
	const [expanded, setExpanded] = React.useState<MRT_ExpandedState>({});

	const columns = useMemo<MRT_ColumnDef<CommonOpponentData>[]>(() => [
		{
			header: "Opponent",
			accessorKey: "opponentName",
			Cell: ({ row }) => (
				<Link to={`/athletes/${row.original.opponentId}`} style={{ textDecoration: "none" }}>
					<Text fw={500}>{row.original.opponentName}</Text>
				</Link>
			),
		},
		{
			header: "Wrestler 1 Record",
			accessorFn: row => `${row.athlete1Wins}-${row.athlete1Losses}`,
			id: "athlete1Record",
			Cell: ({ row }) => {
				const wins = row.original.athlete1Wins;
				const losses = row.original.athlete1Losses;
				const total = wins + losses;
				const winPct = total > 0 ? (wins / total) * 100 : 0;
				const color = wins > losses ? "var(--mantine-win-color)" : wins < losses ? "red" : "dimmed";

				return (
					<Stack gap={2}>
						<Group gap="xs">
							<Text c={color} fw={600}>{wins}-{losses}</Text>
							{wins > 0 && <Badge size="sm" color="green">{wins}W</Badge>}
							{losses > 0 && <Badge size="sm" color="red">{losses}L</Badge>}
						</Group>
						<Text size="xs" c="dimmed">Win %: {winPct.toFixed(1)}%</Text>
					</Stack>
				);
			},
			sortingFn: (rowA, rowB) => {
				const aWinPct = rowA.original.athlete1Wins / (rowA.original.athlete1Wins + rowA.original.athlete1Losses);
				const bWinPct = rowB.original.athlete1Wins / (rowB.original.athlete1Wins + rowB.original.athlete1Losses);
				return aWinPct - bWinPct;
			},
		},
		{
			header: "Wrestler 2 Record",
			accessorFn: row => `${row.athlete2Wins}-${row.athlete2Losses}`,
			id: "athlete2Record",
			Cell: ({ row }) => {
				const wins = row.original.athlete2Wins;
				const losses = row.original.athlete2Losses;
				const total = wins + losses;
				const winPct = total > 0 ? (wins / total) * 100 : 0;
				const color = wins > losses ? "var(--mantine-win-color)" : wins < losses ? "red" : "dimmed";

				return (
					<Stack gap={2}>
						<Group gap="xs">
							<Text c={color} fw={600}>{wins}-{losses}</Text>
							{wins > 0 && <Badge size="sm" color="green">{wins}W</Badge>}
							{losses > 0 && <Badge size="sm" color="red">{losses}L</Badge>}
						</Group>
						<Text size="xs" c="dimmed">Win %: {winPct.toFixed(1)}%</Text>
					</Stack>
				);
			},
			sortingFn: (rowA, rowB) => {
				const aWinPct = rowA.original.athlete2Wins / (rowA.original.athlete2Wins + rowA.original.athlete2Losses);
				const bWinPct = rowB.original.athlete2Wins / (rowB.original.athlete2Wins + rowB.original.athlete2Losses);
				return aWinPct - bWinPct;
			},
		},
		{
			header: "Total Matches",
			accessorKey: "totalBouts",
			Cell: ({ cell }) => (
				<Text ta="center" fw={500}>{cell.getValue<number>()}</Text>
			),
		},
		{
			header: "Advantage",
			accessorFn: row => {
				const athlete1WinPct = row.athlete1Wins / (row.athlete1Wins + row.athlete1Losses);
				const athlete2WinPct = row.athlete2Wins / (row.athlete2Wins + row.athlete2Losses);

				if (athlete1WinPct > athlete2WinPct) return "Wrestler 1";
				if (athlete2WinPct > athlete1WinPct) return "Wrestler 2";
				return "Tied";
			},
			id: "advantage",
			Cell: ({ cell }) => {
				const value = cell.getValue<string>();
				const color = value === "Wrestler 1" ? "green" : value === "Wrestler 2" ? "blue" : "gray";
				return (
					<Badge color={color} variant="light">
						{value}
					</Badge>
				);
			},
		},
	], []);

	const table = useMantineReactTable({
		columns,
		data: commonOpponents,
		enableColumnResizing: true,
		enableDensityToggle: false,
		enableFullScreenToggle: false,
		enableExpanding: true,
		enableExpandAll: true,
		initialState: {
			sorting: [{ id: "totalBouts", desc: true }],
			density: "xs",
		},
		state: {
			expanded,
		},
		onExpandedChange: setExpanded,
		renderDetailPanel: ({ row }) => {
			const opponent = row.original;

			return (
				<Stack gap="md" p="md" bg="var(--mantine-color-dark-7)">
					<Text fw={600} size="lg">Individual Matches</Text>

					<Group align="start" grow>
						{/* Wrestler 1 Matches */}
						<Stack gap="xs">
							<Text fw={600} c="dimmed">Wrestler 1 vs {opponent.opponentName}</Text>
							{opponent.athlete1Bouts.map((boutData, idx) => {
								const bout = boutData.bout;
								const event = FloAPI.findIncludedObjectById<EventObject>(
									bout.attributes.eventId,
									"event",
									athlete1Bouts
								);
								const weightClass = FloAPI.findIncludedObjectById<WeightClassObject>(
									bout.attributes.weightClassId,
									"weightClass",
									athlete1Bouts
								);
								const division = FloAPI.findIncludedObjectById<DivisionObject>(
									boutData.opponent.attributes.divisionId,
									"division",
									athlete1Bouts
								);
								const date = dayjs(bout.attributes.goDateTime ?? bout.attributes.endDateTime);

								return (
									<Group key={idx} gap="xs" wrap="nowrap">
										<Badge color={boutData.isWin ? "green" : "red"} size="sm">
											{boutData.isWin ? "W" : "L"}
										</Badge>
										<Text size="sm">{date.format("MM/DD/YY")}</Text>
										<Text size="sm" c="dimmed">-</Text>
										<Text size="sm">{bout.attributes.winType} {bout.attributes.result}</Text>
										<Text size="sm" c="dimmed">-</Text>
										<Text size="sm">{weightClass?.attributes.name} {division?.attributes.measurementUnit}</Text>
										<Text size="sm" c="dimmed">@</Text>
										<Link
											to={`https://arena.flowrestling.org/event/${event?.id}`}
											target="_blank"
											style={{ textDecoration: "none", fontSize: "0.875rem" }}
										>
											{event?.attributes.name}
										</Link>
									</Group>
								);
							})}
						</Stack>

						{/* Wrestler 2 Matches */}
						<Stack gap="xs">
							<Text fw={600} c="dimmed">Wrestler 2 vs {opponent.opponentName}</Text>
							{opponent.athlete2Bouts.map((boutData, idx) => {
								const bout = boutData.bout;
								const event = FloAPI.findIncludedObjectById<EventObject>(
									bout.attributes.eventId,
									"event",
									athlete2Bouts
								);
								const weightClass = FloAPI.findIncludedObjectById<WeightClassObject>(
									bout.attributes.weightClassId,
									"weightClass",
									athlete2Bouts
								);
								const division = FloAPI.findIncludedObjectById<DivisionObject>(
									boutData.opponent.attributes.divisionId,
									"division",
									athlete2Bouts
								);
								const date = dayjs(bout.attributes.goDateTime ?? bout.attributes.endDateTime);

								return (
									<Group key={idx} gap="xs" wrap="nowrap">
										<Badge color={boutData.isWin ? "green" : "red"} size="sm">
											{boutData.isWin ? "W" : "L"}
										</Badge>
										<Text size="sm">{date.format("MM/DD/YY")}</Text>
										<Text size="sm" c="dimmed">-</Text>
										<Text size="sm">{bout.attributes.winType} {bout.attributes.result}</Text>
										<Text size="sm" c="dimmed">-</Text>
										<Text size="sm">{weightClass?.attributes.name} {division?.attributes.measurementUnit}</Text>
										<Text size="sm" c="dimmed">@</Text>
										<Link
											to={`https://arena.flowrestling.org/event/${event?.id}`}
											target="_blank"
											style={{ textDecoration: "none", fontSize: "0.875rem" }}
										>
											{event?.attributes.name}
										</Link>
									</Group>
								);
							})}
						</Stack>
					</Group>
				</Stack>
			);
		},
	});

	return (
		<Stack gap="md">
			<Text size="lg" fw={600}>Common Opponents Details</Text>
			<Text size="sm" c="dimmed">
				Click on any row to expand and see individual match details.
			</Text>
			<MantineReactTable table={table} />
		</Stack>
	);
}
