import React from "react";
import { Card, Flex, Group, Stack, Text, Title } from "@mantine/core";
import { CommonOpponentsSummary } from "../../utils/commonOpponents";

type Props = {
	summary: CommonOpponentsSummary;
	athlete1Name: string;
	athlete2Name: string;
};

export default function ComparisonSummary({ summary, athlete1Name, athlete2Name }: Props) {
	// Determine which athlete has the advantage
	const athlete1HasAdvantage = summary.athlete1WinPercentage > summary.athlete2WinPercentage;
	const athlete2HasAdvantage = summary.athlete2WinPercentage > summary.athlete1WinPercentage;
	const isTied = summary.athlete1WinPercentage === summary.athlete2WinPercentage;

	return (
		<Card w="100%" p="lg" bg="var(--mantine-color-body)" bd="1px solid var(--mantine-color-gray-7)">
			<Stack gap="lg">
				<Title order={2} ta="center">Common Opponents Summary</Title>

				{/* Total Common Opponents */}
				<Flex justify="center">
					<Group gap={4}>
						<Text fw={600} size="xl">Total Common Opponents:</Text>
						<Text size="xl" c="blue">{summary.totalCommonOpponents}</Text>
					</Group>
				</Flex>

				{/* Side-by-Side Comparison */}
				<Group align="center" grow justify="center">
					{/* Athlete 1 Stats */}
					<Card p="md" withBorder>
						<Stack gap="sm" align="center">
							<Text fw={700} size="lg" ta="center" c={athlete1HasAdvantage ? "var(--mantine-win-color)" : athlete2HasAdvantage ? "red" : "dimmed"}>{athlete1Name}</Text>

							<Group gap={4}>
								<Text fw={600}>Record:</Text>
								<Text c={summary.athlete1TotalWins > summary.athlete1TotalLosses ? "var(--mantine-win-color)" : "red"}>
									{summary.athlete1TotalWins}-{summary.athlete1TotalLosses}
								</Text>
							</Group>

							<Group gap={4}>
								<Text fw={600}>Win %:</Text>
								<Text
									c={athlete1HasAdvantage ? "var(--mantine-win-color)" : athlete2HasAdvantage ? "red" : "dimmed"}
									fw={athlete1HasAdvantage ? 700 : 400}
								>
									{summary.athlete1WinPercentage.toFixed(1)}%
								</Text>
							</Group>
						</Stack>
					</Card>

					{/* VS Divider */}
					<Stack align="center" justify="center" style={{ flexGrow: 0, flexShrink: 0, width: "auto" }}>
						<Text size="xl" fw={700} c="dimmed">VS</Text>
					</Stack>

					{/* Athlete 2 Stats */}
					<Card p="md" withBorder>
						<Stack gap="sm" align="center">
							<Text fw={700} size="lg" ta="center" c={athlete2HasAdvantage ? "var(--mantine-win-color)" : athlete1HasAdvantage ? "red" : "dimmed"}>{athlete2Name}</Text>

							<Group gap={4}>
								<Text fw={600}>Record:</Text>
								<Text c={summary.athlete2TotalWins > summary.athlete2TotalLosses ? "var(--mantine-win-color)" : "red"}>
									{summary.athlete2TotalWins}-{summary.athlete2TotalLosses}
								</Text>
							</Group>

							<Group gap={4}>
								<Text fw={600}>Win %:</Text>
								<Text
									c={athlete2HasAdvantage ? "var(--mantine-win-color)" : athlete1HasAdvantage ? "red" : "dimmed"}
									fw={athlete2HasAdvantage ? 700 : 400}
								>
									{summary.athlete2WinPercentage.toFixed(1)}%
								</Text>
							</Group>
						</Stack>
					</Card>
				</Group>
			</Stack>
		</Card>
	);
}
