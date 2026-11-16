import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Badge, Group, Pagination, Select, Stack, Table, Text, Title } from "@mantine/core";
import { getDemoDataset } from "./provider";
import DataError from "../components/DataError";

export default function DemoEvent() {
	const { id } = useParams();
	const league = getDemoDataset();
	const event = league.events.find(e => e.id === id);
	const [weight, setWeight] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const bouts = useMemo(() => league.bouts.filter(b => b.attributes.eventId === id), [league, id]);
	const weights = [...new Set(bouts.map(b => b.attributes.weightClassId))].map(id => {
		const object = league.objects.get(`weightClass:${id}`);
		return { value: id, label: object?.type === "weightClass" ? `${object.attributes.name} lbs` : id };
	});
	const filtered = bouts.filter(b => !weight || b.attributes.weightClassId === weight);
	if (!event) return <DataError title="Event unavailable" message="This event is not part of the fictional league." />;
	return <Stack p="md" gap="lg" ta="left">
		<Badge w="fit-content" variant="light">Fictional {event.attributes.isDual ? "dual meet" : "tournament"}</Badge>
		<Title order={1}>{event.attributes.name}</Title>
		<Text c="dimmed">{event.attributes.startDateTime.slice(0, 10)} · {bouts.length} bouts · All records are synthetic.</Text>
		<Group><Select label="Weight class" placeholder="All weights" clearable data={weights} value={weight} onChange={value => { setWeight(value); setPage(1); }} /></Group>
		<Table.ScrollContainer minWidth={600}>
			<Table striped highlightOnHover withTableBorder>
				<Table.Thead><Table.Tr>{["Round", "Winner", "Opponent", "Result", "Weight"].map(label => <Table.Th key={label}>{label}</Table.Th>)}</Table.Tr></Table.Thead>
				<Table.Tbody>{filtered.slice((page - 1) * 40, page * 40).map(bout => {
					const winner = league.objects.get(`wrestler:${bout.attributes.winnerWrestlerId}`);
					const other = league.objects.get(`wrestler:${bout.attributes.winnerWrestlerId === bout.attributes.topWrestlerId ? bout.attributes.bottomWrestlerId : bout.attributes.topWrestlerId}`);
					const round = league.objects.get(`roundName:${bout.attributes.roundNameId}`);
					const weight = league.objects.get(`weightClass:${bout.attributes.weightClassId}`);
					return <Table.Tr key={bout.id}>
						<Table.Td>{round?.type === "roundName" ? round.attributes.displayName : ""}</Table.Td>
						{[winner, other].map((wrestler, i) => <Table.Td key={i}>{wrestler?.type === "wrestler" && <Link to={`/athletes/${wrestler.attributes.identityPersonId}`}>{wrestler.attributes.fullName}</Link>}</Table.Td>)}
						<Table.Td>{bout.attributes.winType} {bout.attributes.result}</Table.Td>
						<Table.Td>{weight?.type === "weightClass" ? weight.attributes.name : ""}</Table.Td>
					</Table.Tr>;
				})}</Table.Tbody>
			</Table>
		</Table.ScrollContainer>
		<Pagination total={Math.ceil(filtered.length / 40)} value={page} onChange={setPage} />
	</Stack>;
}
