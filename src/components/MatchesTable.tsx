import { em, Text } from "@mantine/core";
import { BoutObject } from "../api/types/objects/bout";
import { useMemo } from "react";
import FloAPI from "../api/FloAPI";
import { WrestlerObject } from "../api/types/objects/wrestler";
import dayjs from "dayjs";
import { EventObject } from "../api/types/objects/event";
import { Link } from "react-router";
import { RoundNameObject } from "../api/types/objects/roundName";
import { WeightClassObject } from "../api/types/objects/weightClass";
import { DivisionObject } from "../api/types/objects/division";

import { MantineReactTable, MRT_ColumnDef, useMantineReactTable } from "mantine-react-table";

import styles from "./MatchesTable.module.css";
import { useMediaQuery } from "@mantine/hooks";
import { TeamObject } from "../api/types/objects/team";
import { AthleteDataProps } from "../Athletes";
import { isForfeit } from "../utils/boutResults";

type UsableData = {
	date: dayjs.Dayjs;
	winner?: WrestlerObject;
	noOpponent: boolean;
	noOpponentString: string;
	isAWin: boolean;
	opponent?: WrestlerObject;
	opponentTeam?: TeamObject;
	thisWrestler?: WrestlerObject;
	thisTeam?: TeamObject;
	weightClass?: WeightClassObject;
	roundName?: RoundNameObject;
	event?: EventObject;
	division?: DivisionObject;
	bout: BoutObject;
};

export default function MatchesTable({ bouts, identityPersonId }: AthleteDataProps) {
	const mobile = useMediaQuery(`(max-width: ${em(750)})`);

	const columns = useMemo<MRT_ColumnDef<UsableData>[]>(() => [
		{
			header: "W/L",
			accessorFn: row => row.isAWin ? "W" : "L",
			id: "winLoss",
			Cell: ({ cell }) => <Text ta="center" size="sm" c={cell.getValue<string>() == "W" ? "var(--mantine-win-color)" : "var(--mantine-loss-color)"}>{cell.getValue<string>()}</Text>,
			size: 50,
			enableSorting: false,
			Header: () => <Text ta="center" size="sm">W/L</Text>,
			mantineTableBodyCellProps: {
				styles: {
					td: {
						justifyContent: "center"
					}
				}
			},
			enableColumnActions: false,
		},
		{
			header: "Date",
			accessorFn: row => row.date.unix(),
			id: "date",
			enablePinning: false,
			size: 100,
			Cell: ({ row }) => (
				<Text>{row.original.date.format("MM/DD/YY")}</Text>
			),
		},
		{
			header: "Opponent",
			accessorFn: row => row.noOpponent ? row.noOpponentString : row.opponent?.attributes.fullName ?? "Unknown opponent",
			id: "opponent",
			enablePinning: false,
			Cell: ({ row, renderedCellValue}) => (
				row.original.noOpponent ?
					<Text fs={row.original.noOpponent ? "italic" : undefined} c={row.original.noOpponent ? "dimmed" : undefined}>
						{renderedCellValue}
					</Text> :
					<Link target="_blank" to={`/athletes/${row.original.opponent?.attributes.identityPersonId}`} style={{ textDecoration: "none" }}>
						{renderedCellValue}
					</Link>
			),
		},
		{
			header: "Opp. Team",
			accessorFn: row => row.opponentTeam?.attributes.name,
			id: "opponentTeam",
			enablePinning: false,
		},
		{
			header: "Result",
			accessorFn: row => row.noOpponent ? row.bout.attributes.winType : `${row.bout.attributes.winType} ${row.bout.attributes.result}`,
			id: "result",
			enablePinning: false,
			maxSize: 120,
		},
		{
			header: "Event",
			accessorFn: row => row.event?.attributes.name ?? "Unknown event",
			id: "event",
			enableResizing: true,
			size: mobile ? 200 : 300,
			Cell: ({ row, renderedCellValue }) => (
				<Link to={`https://arena.flowrestling.org/event/${row.original.event?.id ?? ""}`} target="_blank" style={{ textDecoration: "none", textOverflow: "ellipsis", overflow: "hidden" }}>
					{renderedCellValue}
				</Link>
			),
		},
		{
			header: "Round",
			accessorFn: row => row.roundName?.attributes.displayName,
			id: "round",
			maxSize: 130,
		},
		{
			header: "Weight",
			accessorFn: row => `${row.weightClass?.attributes.name} ${row.division?.attributes.measurementUnit ?? ""}`,
			id: "weight",
		}
	], [mobile]);

	const tableData = useMemo(() => bouts?.data.slice().sort((a, b) => {
		const aDateTime = dayjs(a.attributes.goDateTime ?? a.attributes.endDateTime ?? FloAPI.findIncludedObjectById<EventObject>(a.attributes.eventId, "event", bouts)?.attributes.startDateTime);
		const bDateTime = dayjs(b.attributes.goDateTime ?? b.attributes.endDateTime ?? FloAPI.findIncludedObjectById<EventObject>(b.attributes.eventId, "event", bouts)?.attributes.startDateTime);

		return aDateTime.isBefore(bDateTime) ? 1 : aDateTime.isAfter(bDateTime) ? -1 : 0;
	}).map(bout => {
		const date = dayjs(bout.attributes.goDateTime ?? bout.attributes.endDateTime ?? FloAPI.findIncludedObjectById<EventObject>(bout.attributes.eventId, "event", bouts)?.attributes.startDateTime);
		const winner = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.winnerWrestlerId, "wrestler", bouts);

		const noOpponent = isForfeit(bout.attributes.winType) || bout.attributes.winType == "BYE";
		const noOpponentString = isForfeit(bout.attributes.winType) ? "Forfeit" : "Bye";

		const isAWin = winner?.attributes.identityPersonId == identityPersonId;

		const topWrestler = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.topWrestlerId, "wrestler", bouts);
		const bottomWrestler = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.bottomWrestlerId, "wrestler", bouts);

		const opponent = topWrestler?.attributes.identityPersonId == identityPersonId ? bottomWrestler : topWrestler;
		const thisWrestler = topWrestler?.attributes.identityPersonId == identityPersonId ? topWrestler : bottomWrestler;

		const opponentTeam = FloAPI.findIncludedObjectById<TeamObject>(opponent?.attributes.teamId, "team", bouts);
		const thisTeam = FloAPI.findIncludedObjectById<TeamObject>(thisWrestler?.attributes.teamId, "team", bouts);

		const weightClass = FloAPI.findIncludedObjectById<WeightClassObject>(bout.attributes.weightClassId, "weightClass", bouts);
		const roundName = FloAPI.findIncludedObjectById<RoundNameObject>(bout.attributes.roundNameId, "roundName", bouts);
		const event = FloAPI.findIncludedObjectById<EventObject>(bout.attributes.eventId, "event", bouts);
		const division = thisWrestler ? FloAPI.findIncludedObjectById<DivisionObject>(thisWrestler?.attributes.divisionId, "division", bouts) : undefined;
		return {
			date,
			winner,
			noOpponent,
			noOpponentString,
			isAWin,
			opponent,
			opponentTeam,
			thisWrestler,
			thisTeam,
			weightClass,
			roundName,
			event,
			division,
			bout,
		};
	}) ?? [], [bouts, identityPersonId]);

	const table = useMantineReactTable({
		columns,
		data: tableData,
		enablePagination: false,
		enableColumnPinning: true,
		enableBottomToolbar: false,
		mantineTopToolbarProps: {
			className: styles.matchesTopToolbar,
		},
		initialState: {
			density: "xs",
			sorting: [{ id: "date", desc: true }],
			columnPinning: {
				left: ["winLoss"],
			}
		},
		mantineTableBodyCellProps: {
			style: {
				overflow: "hidden",
				textOverflow: "ellipsis",
			}
		},
		layoutMode: "grid-no-grow",
	});

	return (
		<MantineReactTable
			table={table}
		/>
	);
}
