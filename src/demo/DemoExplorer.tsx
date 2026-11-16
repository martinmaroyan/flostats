import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { Link } from "react-router";
import { getDemoDataset } from "./provider";
import type { DemoPerson } from "./generator";

export default function DemoExplorer() {
	const league = getDemoDataset();
	const veteran = league.people[0];
	// Select the opponent with the most direct bouts against the sample athlete.
	const history = league.boutsByPerson.get(veteran.id)!;
	const opponents = new Map<string, number>();
	for (const bout of history) {
		const registration = league.objects.get(`wrestler:${bout.attributes.topWrestlerId}`);
		const other = registration?.type === "wrestler" && registration.attributes.identityPersonId === veteran.id ? bout.attributes.bottomWrestlerId : bout.attributes.topWrestlerId;
		const wrestler = league.objects.get(`wrestler:${other}`);
		if (wrestler?.type === "wrestler") opponents.set(wrestler.attributes.identityPersonId, (opponents.get(wrestler.attributes.identityPersonId) ?? 0) + 1);
	}
	const rivalId = [...opponents].sort((a, b) => b[1] - a[1])[0][0];
	const rival = league.people.find(p => p.id === rivalId)!;
	const newcomer = league.people.find(p => p.graduation === 2028 && p.skill < -1)!;
	const name = (p: DemoPerson) => `${p.first} ${p.last}`;
	const examples = [
		{ person: veteran, title: "Four-season profile" },
		{ person: rival, title: "Comparison profile" },
		{ person: newcomer, title: "Two-season profile" },
	];
	return <Stack gap="lg" ta="center" w="100%">
		<Title order={1} size="h2">Demo dataset</Title>
		<Group gap="sm" justify="center">
			{[`${league.people.length} wrestlers`, `${league.teams.length} teams`, `${league.events.length} events`, `${league.bouts.length.toLocaleString("en-US")} bouts`, "4 seasons · 2022–26"].map(label => <Badge key={label} variant="outline" color="gray">{label}</Badge>)}
		</Group>
		<Card withBorder radius="md" p="lg">
			<Stack gap="sm" align="center">
				<Title order={3}>Wrestler comparison</Title>
				<Text size="sm">{name(veteran)} vs. {name(rival)}</Text>
				<Text size="sm" c="dimmed">{opponents.get(rival.id)} head-to-head bouts</Text>
				<Button component={Link} to={`/compare?athlete1=${veteran.id}&athlete2=${rival.id}`} rightSection={<IconArrowRight size={16} />}>View comparison</Button>
			</Stack>
		</Card>
		<SimpleGrid cols={{ base: 1, sm: 3 }}>
			{examples.map(({ person, title }) => <Card key={person.id} withBorder radius="md" p="md">
				<Stack gap="sm" h="100%" align="center">
					<Text c="dimmed" size="sm">{title}</Text>
					<Title order={3} size="h4" style={{ minHeight: "3.4rem", display: "flex", alignItems: "center", justifyContent: "center" }}>{name(person)}</Title>
					<Text size="xs" c="dimmed" style={{ flex: 1 }}>{league.teams[person.team].attributes.name}</Text>
					<Button component={Link} to={`/athletes/${person.id}`} variant="light" fullWidth>View profile</Button>
				</Stack>
			</Card>)}
		</SimpleGrid>
		<Group gap="sm" justify="center">
			<Button component={Link} to="/search?q=a&page=1&ofp=false" variant="default">Browse wrestlers</Button>
			<Button component={Link} to="/compare" variant="subtle">Select wrestlers to compare</Button>
		</Group>
	</Stack>;
}
