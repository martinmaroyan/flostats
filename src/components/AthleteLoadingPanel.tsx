import { Card, Group, Loader, Progress, Stack, Text, Title } from "@mantine/core";

export type LoadCounters = {
	wrestlersLoaded: number;
	wrestlersTotal: number | null;
	boutsLoaded: number;
	boutsTotal: number | null;
	overallProgress: number | null;
};

export default function AthleteLoadingPanel({ counters }: { counters: LoadCounters }) {
	const wrestlersPct = pct(counters.wrestlersLoaded, counters.wrestlersTotal);
	const boutsPct = pct(counters.boutsLoaded, counters.boutsTotal);
	const overallPct = counters.overallProgress == null ? null : Math.round(counters.overallProgress);

	return (
		<Card withBorder w={420} maw="100%" p="lg" radius="md" shadow="sm">
			<Stack gap="md">
				<Group gap="sm" align="center">
					<Loader size="sm" />
					<Title order={4}>Loading athlete data</Title>
				</Group>

				<Stack gap={6}>
					<Group justify="space-between">
						<Text size="sm">Event placements</Text>
						<Text size="sm" c="dimmed">{counterText(counters.wrestlersLoaded, counters.wrestlersTotal)}</Text>
					</Group>
					<Progress value={wrestlersPct} animated={counters.wrestlersTotal == null || counters.wrestlersLoaded < counters.wrestlersTotal} />
				</Stack>

				<Stack gap={6}>
					<Group justify="space-between">
						<Text size="sm">Match history</Text>
						<Text size="sm" c="dimmed">{counterText(counters.boutsLoaded, counters.boutsTotal)}</Text>
					</Group>
					<Progress value={boutsPct} animated={counters.boutsTotal == null || counters.boutsLoaded < counters.boutsTotal} />
				</Stack>

				{overallPct != null ? (
					<Text size="xs" c="dimmed" ta="center">{overallPct}% overall</Text>
				) : (
					<Text size="xs" c="dimmed" ta="center">Connecting…</Text>
				)}
			</Stack>
		</Card>
	);
}

function pct(loaded: number, total: number | null): number {
	if (total == null) return 0;
	if (total <= 0) return 100;
	return Math.min(100, Math.round((loaded / total) * 100));
}

function counterText(loaded: number, total: number | null): string {
	if (total == null) return "…";
	if (total === 0) return "none";
	return `${loaded.toLocaleString()} / ${total.toLocaleString()}`;
}
