import React from "react";
import { Accordion, Card, CardProps, Flex, Group, Text, Title } from "@mantine/core";
import { AthleteDataProps } from "../Athletes";
import { RadarChart, BarChart } from "@mantine/charts";
import { BoutAttributes } from "../api/types/objects/bout";
import { AllBoutRelationships } from "../api/types/relationships";
import { ObjectIdentifier } from "../api/types/types";
import FloAPI from "../api/FloAPI";
import { WrestlerObject } from "../api/types/objects/wrestler";
import { IconChevronRight } from "@tabler/icons-react";

type Ratio = [number, number];

type Bout = ObjectIdentifier & {
	type: "bout";
} & {
	attributes: BoutAttributes;
} & {
	relationships: AllBoutRelationships;
}

type Stats = {
	matches: number;
	wins: number;
	losses: number;
	pins: number;
	techs: number;
	wlRatio: Ratio;
	winPercentage: number;
	quickestWin?: { minutes: number, seconds: number, bout: Bout };
	quickestLoss?: { minutes: number, seconds: number, bout: Bout };
	finishTypes: { type: string, wins: number, losses: number }[];
	timeSeriesData: { period: string, matches: number, wins: number, losses: number, winRate: number }[];
}

function reduce(frac: Ratio): Ratio {
	let a = frac[0];
	let b = frac[1];
	let c;
	while (b) {
		c = a % b; a = b; b = c;
	}
	return [frac[0] / a, frac[1] / a];
}

export default function Analysis(props: AthleteDataProps & { children?: React.ReactNode } & CardProps) {
	const { wrestlers, bouts, identityPersonId, children } = props;
	const stats = React.useMemo(() => {
		if (wrestlers && bouts) {
			const stats: Stats = {
				matches: 0,
				wins: 0,
				losses: 0,
				pins: 0,
				techs: 0,
				wlRatio: [0, 0],
				winPercentage: 0,
				finishTypes: [],
				timeSeriesData: [],
			};

			bouts.data.forEach(bout => {
				stats.matches++;
				const winner = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.winnerWrestlerId, "wrestler", bouts);

				const isAWin = winner?.attributes.identityPersonId == identityPersonId;

				stats.wins += +isAWin;
				stats.losses += +!isAWin;
				stats.pins += +(isAWin && bout.attributes.winType == "F");
				stats.techs += +(isAWin && bout.attributes.winType == "TF");

				const finish = stats.finishTypes.find(f => f.type == bout.attributes.winType);
				if (finish) {
					finish.wins += +isAWin;
					finish.losses += +!isAWin;

					const time = /(\d?\d?):(\d\d)/.exec(bout.attributes.result);

					if (time && time.length > 1) {
						const minutes = time.length > 2 ? parseInt(time[1]) : 0;
						const seconds = time.length > 2 ? parseInt(time[2]) : parseInt(time[1]);

						const quickest = isAWin ? stats.quickestWin : stats.quickestLoss;

						if (quickest) {
							if (minutes < quickest.minutes || (minutes == quickest.minutes && seconds < quickest.seconds)) {
								quickest.minutes = minutes;
								quickest.seconds = seconds;
								quickest.bout = bout;
							}
						} else {
							stats[isAWin ? "quickestWin" : "quickestLoss"] = { minutes, seconds, bout };
						}
					}
				} else {
					stats.finishTypes.push({ type: bout.attributes.winType, wins: +isAWin, losses: +!isAWin });
				}
			});

			stats.wlRatio = reduce([stats.wins, stats.losses]);
			stats.winPercentage = stats.wins / stats.matches;

			// Process time-series data
			const boutsWithDates = bouts.data
				.map(bout => ({
					bout,
					date: bout.attributes.goDateTime ? new Date(bout.attributes.goDateTime) : null,
					isWin: FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.winnerWrestlerId, "wrestler", bouts)?.attributes.identityPersonId == identityPersonId
				}))
				.filter(b => b.date !== null)
				.sort((a, b) => a.date!.getTime() - b.date!.getTime());

			// Group by month
			const monthlyData = new Map<string, { wins: number, losses: number, matches: number }>();

			boutsWithDates.forEach(({ date, isWin }) => {
				const monthKey = `${date!.getFullYear()}-${String(date!.getMonth() + 1).padStart(2, '0')}`;

				if (!monthlyData.has(monthKey)) {
					monthlyData.set(monthKey, { wins: 0, losses: 0, matches: 0 });
				}

				const monthStats = monthlyData.get(monthKey)!;
				monthStats.matches++;
				if (isWin) {
					monthStats.wins++;
				} else {
					monthStats.losses++;
				}
			});

			// Convert to array format for chart
			stats.timeSeriesData = Array.from(monthlyData.entries())
				.map(([period, data]) => {
					const [year, month] = period.split('-');
					const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
					return {
						period: `${monthNames[parseInt(month) - 1]} ${year}`,
						matches: data.matches,
						wins: data.wins,
						losses: data.losses,
						winRate: data.matches > 0 ? (data.wins / data.matches) * 100 : 0
					};
				});

			return stats;
		}
	}, [wrestlers, bouts, identityPersonId]);

	return stats ? (
		<Card p="0" bg="var(--mantine-color-body)" bd="1px solid var(--mantine-color-gray-7)" w="100%" mx="lg">
			<Flex gap="lg" py="lg" justify="center" direction="row" wrap="wrap">
				<Group gap={4}>
					<Text fw={600}>Matches:</Text>
					<Text>{stats.matches}</Text>
				</Group>
				<Group gap={4}>
					<Text fw={600}>Wins:</Text>
					<Text c="var(--mantine-win-color)">{stats.wins}</Text>
				</Group>
				<Group gap={4}>
					<Text fw={600}>Losses:</Text>
					<Text c="var(--mantine-loss-color)">{stats.losses}</Text>
				</Group>
				<Group gap={4}>
					<Text fw={600}>Pins:</Text>
					<Text>{stats.pins}</Text>
				</Group>
				<Group gap={4}>
					<Text fw={600}>Techs:</Text>
					<Text>{stats.techs}</Text>
				</Group>
				<Group gap={4}>
					<Text fw={600}>W/L Ratio:</Text>
					<Text c="var(--mantine-win-color)">{stats.wlRatio[0]}</Text>
					<Text>-</Text>
					<Text c="var(--mantine-loss-color)">{stats.wlRatio[1]}</Text>
					<Text c={stats.wlRatio[1] != 0 ? (stats.wlRatio[0] / stats.wlRatio[1] > 1 ? "var(--mantine-win-color)" : "var(--mantine-loss-color)") : "var(--mantine-win-color)"}>({(stats.wlRatio[1] != 0 ? (stats.wlRatio[0] / stats.wlRatio[1]) : stats.wlRatio[0]).toFixed(2)})</Text>
				</Group>
				<Group gap={4}>
					<Text fw={600}>Win Percentage:</Text>
					<Text c={stats.winPercentage > 0.5 ? "var(--mantine-win-color)" : "var(--mantine-loss-color)"}>{(stats.winPercentage * 100).toFixed(1)}%</Text>
				</Group>
				<Group gap={4}>
					<Text fw={600}>Fastest Win:</Text>
					<Text c={stats.quickestWin ? "var(--mantine-win-color)" : "var(--mantine-loss-color)"}>{stats.quickestWin ? (stats.quickestWin.minutes + ":" + ((stats.quickestWin.seconds < 10 ? "0" : "") + stats.quickestWin.seconds)) : "N/A"} {stats.quickestWin ? stats.quickestWin.bout.attributes.winType : ""}</Text>
				</Group>
				<Group gap={4}>
					<Text fw={600}>Fastest Loss:</Text>
					<Text c={stats.quickestLoss ? "var(--mantine-loss-color)" : "var(--mantine-win-color)"}>{stats.quickestLoss ? (stats.quickestLoss.minutes + ":" + ((stats.quickestLoss.seconds < 10 ? "0" : "") + stats.quickestLoss.seconds)) : "N/A"} {stats.quickestLoss ? stats.quickestLoss.bout.attributes.winType : ""}</Text>
				</Group>
			</Flex>
			<Accordion variant="seperated" chevronSize="32">
				<Accordion.Item value="Statistics" style={{ borderBottom: "none" }}>
					<Accordion.Control ta="center">
						<Title order={3}>See More</Title>
					</Accordion.Control>
					<Accordion.Panel styles={{ content: { alignItems: "center", flexDirection: "column" } }}>
						<Flex gap="lg" justify="center" direction="row" wrap="wrap">
							<RadarChart
								h={300}
								w={300}
								data={stats.finishTypes}
								dataKey="type"
								withPolarAngleAxis
								withPolarRadiusAxis
								series={[
									{ name: "wins", color: "var(--mantine-win-color)", opacity: 0.2 },
									{ name: "losses", color: "var(--mantine-loss-color)", opacity: 0.2 },
								]}
								polarRadiusAxisProps={{
									scale: "sqrt",
								}}
							/>
							{stats.timeSeriesData.length > 0 && (
								<BarChart
									h={300}
									w={300}
									data={stats.timeSeriesData}
									dataKey="period"
									withLegend
									type="stacked"
									series={[
										{ name: "wins", color: "var(--mantine-win-color)", label: "Wins" },
										{ name: "losses", color: "var(--mantine-loss-color)", label: "Losses" },
									]}
									yAxisProps={{ domain: [0, 'auto'] }}
								/>
							)}
						</Flex>
						{children}
					</Accordion.Panel>
				</Accordion.Item>
			</Accordion>
		</Card>
	) : (
		<Card>
			<Text>Loading...</Text>
		</Card>
	);
}
