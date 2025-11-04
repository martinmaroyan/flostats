import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import InlineAthleteSearch from "./InlineAthleteSearch";

export default function AthleteSelector() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	// State for both athletes
	const [athlete1Query, setAthlete1Query] = useState<string>(
		searchParams.get("athlete1") || ""
	);
	const [athlete2Query, setAthlete2Query] = useState<string>(
		searchParams.get("athlete2") || ""
	);
	const [athlete1Id, setAthlete1Id] = useState<string | null>(
		searchParams.get("athlete1")
	);
	const [athlete2Id, setAthlete2Id] = useState<string | null>(
		searchParams.get("athlete2")
	);

	// Handle athlete 1 selection
	const handleAthlete1Select = (id: string | null, name: string) => {
		setAthlete1Id(id);
		if (id) {
			setAthlete1Query(name); // Set input to show selected name
		}
	};

	// Handle athlete 2 selection
	const handleAthlete2Select = (id: string | null, name: string) => {
		setAthlete2Id(id);
		if (id) {
			setAthlete2Query(name);
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
				<Title order={2} ta="center">
					Select Two Wrestlers to Compare
				</Title>

				<Group align="start" grow>
					{/* Athlete 1 Inline Search */}
					<InlineAthleteSearch
						athleteNumber={1}
						value={athlete1Query}
						selectedId={athlete1Id}
						onQueryChange={setAthlete1Query}
						onAthleteSelect={handleAthlete1Select}
						label="Wrestler 1"
					/>

					{/* Athlete 2 Inline Search */}
					<InlineAthleteSearch
						athleteNumber={2}
						value={athlete2Query}
						selectedId={athlete2Id}
						onQueryChange={setAthlete2Query}
						onAthleteSelect={handleAthlete2Select}
						label="Wrestler 2"
					/>
				</Group>

				{/* Error messages */}
				{athlete1Id && athlete2Id && athlete1Id === athlete2Id && (
					<Text c="red" size="sm" ta="center">
						Cannot compare a wrestler with themselves. Please select two different
						wrestlers.
					</Text>
				)}

				{/* Compare Button */}
				<Button size="lg" onClick={handleCompare} disabled={!canCompare} fullWidth>
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
					Start typing a wrestler's name to see search results, or paste a UUID
					directly.
				</Text>
			</Stack>
		</Card>
	);
}
