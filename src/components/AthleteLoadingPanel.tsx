import { Card, Group, Loader, Progress, Stack, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import type { IdentityLookupStage } from "../utils/athleteData";

export type LoadCounters = {
	wrestlersLoaded: number;
	wrestlersTotal: number | null;
	boutsLoaded: number;
	boutsTotal: number | null;
	overallProgress: number | null;
};

export function IdentityLookupStatus({ stage, label = "Identity lookup" }: { stage: IdentityLookupStage; label?: string }) {
	const [elapsed, setElapsed] = useState(0);
	useEffect(() => {
		setElapsed(0);
		if (stage !== "waiting") return;
		const started = Date.now();
		const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
		return () => clearInterval(timer);
	}, [stage]);
	return (
		<Stack gap={4} role="status">
			<Group justify="space-between">
				<Text size="sm">{label}</Text>
				<Text size="sm" c="dimmed">{stage === "loading" ? "Complete" : stage === "waiting" ? `${elapsed}s` : "Checking…"}</Text>
			</Group>
			{stage === "loading" ? <Progress value={100} /> : <Group gap="xs"><Loader size="xs" /><Text size="xs" c="dimmed">{stage === "waiting" ? "Waiting for identity lookup…" : "Checking identity…"}</Text></Group>}
			{stage === "waiting" && <Text size="xs" c="dimmed">Checking for results automatically.</Text>}
		</Stack>
	);
}

export default function AthleteLoadingPanel({ counters, lookupStage }: { counters: LoadCounters; lookupStage: IdentityLookupStage }) {
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
				<IdentityLookupStatus stage={lookupStage} />

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
					<Text size="xs" c="dimmed" ta="center">{lookupStage === "loading" ? "Connecting…" : "Match history will load when the lookup is ready."}</Text>
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
