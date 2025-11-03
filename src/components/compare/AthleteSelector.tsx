import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Button, Card, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { ID_REGEX } from "../../main";

export default function AthleteSelector() {
	const navigate = useNavigate();

	const [athlete1Query, setAthlete1Query] = useState("");
	const [athlete2Query, setAthlete2Query] = useState("");
	const [athlete1Id, setAthlete1Id] = useState<string | null>(null);
	const [athlete2Id, setAthlete2Id] = useState<string | null>(null);

	// Auto-detect if input is UUID or name
	const handleAthlete1Input = (value: string) => {
		setAthlete1Query(value);
		const test = ID_REGEX.exec(value);
		if (test) {
			setAthlete1Id(test[0]);
		} else {
			setAthlete1Id(null);
		}
	};

	const handleAthlete2Input = (value: string) => {
		setAthlete2Query(value);
		const test = ID_REGEX.exec(value);
		if (test) {
			setAthlete2Id(test[0]);
		} else {
			setAthlete2Id(null);
		}
	};

	// Navigate to search page for name queries
	const searchAthlete = (query: string, athleteNumber: 1 | 2) => {
		if (!query) return;

		const test = ID_REGEX.exec(query);
		if (!test) {
			// Navigate to search with a flag indicating which athlete to select
			navigate(`/search?q=${encodeURIComponent(query)}&page=1&ofp=false&selectFor=athlete${athleteNumber}&returnTo=/compare`);
		}
	};

	// Handle compare button click
	const handleCompare = () => {
		if (athlete1Id && athlete2Id) {
			navigate(`/compare?athlete1=${athlete1Id}&athlete2=${athlete2Id}`);
		}
	};

	const canCompare = athlete1Id && athlete2Id && athlete1Id !== athlete2Id;

	return (
		<Card w="100%" maw={800} p="xl" shadow="sm">
			<Stack gap="lg">
				<Title order={2} ta="center">Select Two Wrestlers to Compare</Title>

				<Group align="start" grow>
					{/* Athlete 1 Selection */}
					<Stack gap="sm">
						<Text fw={600} size="lg">Wrestler 1</Text>
						<TextInput
							value={athlete1Query}
							onChange={e => handleAthlete1Input(e.currentTarget.value)}
							placeholder="Enter name or UUID..."
							size="md"
							description={athlete1Id ? "UUID detected" : "Enter full UUID or search by name"}
						/>
						{!athlete1Id && athlete1Query && (
							<Button
								variant="light"
								onClick={() => searchAthlete(athlete1Query, 1)}
								fullWidth
							>
								Search for "{athlete1Query}"
							</Button>
						)}
						{athlete1Id && (
							<Text size="sm" c="green">
								✓ Wrestler 1 selected
							</Text>
						)}
					</Stack>

					{/* Athlete 2 Selection */}
					<Stack gap="sm">
						<Text fw={600} size="lg">Wrestler 2</Text>
						<TextInput
							value={athlete2Query}
							onChange={e => handleAthlete2Input(e.currentTarget.value)}
							placeholder="Enter name or UUID..."
							size="md"
							description={athlete2Id ? "UUID detected" : "Enter full UUID or search by name"}
						/>
						{!athlete2Id && athlete2Query && (
							<Button
								variant="light"
								onClick={() => searchAthlete(athlete2Query, 2)}
								fullWidth
							>
								Search for "{athlete2Query}"
							</Button>
						)}
						{athlete2Id && (
							<Text size="sm" c="green">
								✓ Wrestler 2 selected
							</Text>
						)}
					</Stack>
				</Group>

				{/* Error messages */}
				{athlete1Id && athlete2Id && athlete1Id === athlete2Id && (
					<Text c="red" size="sm" ta="center">
						Cannot compare a wrestler with themselves. Please select two different wrestlers.
					</Text>
				)}

				{/* Compare Button */}
				<Button
					size="lg"
					onClick={handleCompare}
					disabled={!canCompare}
					fullWidth
				>
					{!athlete1Id && !athlete2Id
						? "Select both wrestlers to compare"
						: !athlete1Id
						? "Select Wrestler 1"
						: !athlete2Id
						? "Select Wrestler 2"
						: athlete1Id === athlete2Id
						? "Select different wrestlers"
						: "Compare Wrestlers"}
				</Button>

				<Text size="sm" c="dimmed" ta="center">
					Tip: You can paste a wrestler's UUID directly, or search by name. To get a wrestler's UUID,
					visit their profile page and copy the ID from the URL.
				</Text>
			</Stack>
		</Card>
	);
}
