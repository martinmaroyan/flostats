import React from "react";
import { Badge, Card, Group, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router";
import dayjs from "dayjs";

import { HeadToHeadMatch } from "../../utils/commonOpponents";
import { BoutsResponse } from "../../api/types/responses";
import FloAPI from "../../api/FloAPI";
import { EventObject } from "../../api/types/objects/event";
import { WeightClassObject } from "../../api/types/objects/weightClass";
import { DivisionObject } from "../../api/types/objects/division";

type Props = {
	h2hMatches: HeadToHeadMatch[];
	athlete1Bouts: BoutsResponse<any, any>;
	athlete1Name: string;
	athlete2Name: string;
};

export default function HeadToHeadDisplay({ h2hMatches, athlete1Bouts, athlete1Name, athlete2Name }: Props) {
	if (h2hMatches.length === 0) {
		return null;
	}

	// Calculate head-to-head record
	const athlete1Wins = h2hMatches.filter(m => m.athlete1Won).length;
	const athlete2Wins = h2hMatches.length - athlete1Wins;

	return (
		<Card w="100%" p="lg" bg="var(--mantine-color-dark-6)" bd="2px solid var(--mantine-color-blue-7)">
			<Stack gap="lg">
				<Group justify="space-between" align="center">
					<Title order={2}>Direct Head-to-Head Matches</Title>
					<Badge size="xl" variant="filled" color="blue">
						{h2hMatches.length} {h2hMatches.length === 1 ? "Match" : "Matches"}
					</Badge>
				</Group>

				{/* Head-to-Head Record */}
				<Card p="md" bg="var(--mantine-color-dark-7)">
					<Group justify="center" gap="xl">
						<Stack gap="xs" align="center">
							<Text fw={700} size="lg">{athlete1Name}</Text>
							<Text size="3rem" fw={900} c={athlete1Wins > athlete2Wins ? "var(--mantine-win-color)" : athlete1Wins < athlete2Wins ? "red" : "dimmed"}>
								{athlete1Wins}
							</Text>
							<Text c="dimmed" size="sm">wins</Text>
						</Stack>

						<Text size="2rem" fw={700} c="dimmed">-</Text>

						<Stack gap="xs" align="center">
							<Text fw={700} size="lg">{athlete2Name}</Text>
							<Text size="3rem" fw={900} c={athlete2Wins > athlete1Wins ? "var(--mantine-win-color)" : athlete2Wins < athlete1Wins ? "red" : "dimmed"}>
								{athlete2Wins}
							</Text>
							<Text c="dimmed" size="sm">wins</Text>
						</Stack>
					</Group>

					{athlete1Wins !== athlete2Wins && (
						<Text ta="center" mt="md" fw={600} c="var(--mantine-win-color)" size="lg">
							{athlete1Wins > athlete2Wins ? athlete1Name : athlete2Name} leads the series
						</Text>
					)}
					{athlete1Wins === athlete2Wins && (
						<Text ta="center" mt="md" fw={600} c="dimmed" size="lg">
							Series is tied
						</Text>
					)}
				</Card>

				{/* Individual Matches */}
				<Stack gap="sm">
					<Text fw={600} size="md">Match History:</Text>
					{h2hMatches
						.sort((a, b) => {
							const aDate = dayjs(a.bout.attributes.goDateTime ?? a.bout.attributes.endDateTime);
							const bDate = dayjs(b.bout.attributes.goDateTime ?? b.bout.attributes.endDateTime);
							return bDate.unix() - aDate.unix(); // Most recent first
						})
						.map((match, idx) => {
							const bout = match.bout;
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
								match.winner.attributes.divisionId,
								"division",
								athlete1Bouts
							);
							const date = dayjs(bout.attributes.goDateTime ?? bout.attributes.endDateTime);

							return (
								<Card key={idx} p="md" withBorder bg="var(--mantine-color-dark-8)">
									<Group justify="space-between" wrap="nowrap">
										<Group gap="md" wrap="nowrap">
											<Badge
												size="lg"
												color={match.athlete1Won ? "green" : "red"}
												variant="filled"
											>
												{match.athlete1Won ? `${athlete1Name} Won` : `${athlete2Name} Won`}
											</Badge>
											<Text size="sm" c="dimmed">{date.format("MMMM D, YYYY")}</Text>
										</Group>

										<Group gap="md" wrap="nowrap">
											<Text fw={600}>
												{bout.attributes.winType} {bout.attributes.result}
											</Text>
											<Text c="dimmed">•</Text>
											<Text size="sm">
												{weightClass?.attributes.name} {division?.attributes.measurementUnit}
											</Text>
											<Text c="dimmed">•</Text>
											<Link
												to={`https://arena.flowrestling.org/event/${event?.id}`}
												target="_blank"
												style={{ textDecoration: "none" }}
											>
												<Text size="sm">{event?.attributes.name}</Text>
											</Link>
										</Group>
									</Group>
								</Card>
							);
						})}
				</Stack>
			</Stack>
		</Card>
	);
}
