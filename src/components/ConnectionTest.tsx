import { useEffect, useRef, useState } from "react";
import { Alert, Anchor, Badge, Button, Code, Group, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { ConnectionResult, connectionTestUrl, testConnection } from "../api/connectionTest";

const DEFAULT_ATHLETE = "064ad7f4-8d16-4dd2-94b1-1dd1c45c3832";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ConnectionTest() {
	const [athleteId, setAthleteId] = useState(DEFAULT_ATHLETE);
	const [results, setResults] = useState<ConnectionResult[]>([]);
	const [running, setRunning] = useState(false);
	const [error, setError] = useState<string>();
	const [cooldown, setCooldown] = useState(false);
	const active = useRef<AbortController>();
	const cooldownTimer = useRef<number>();
	useEffect(() => () => { active.current?.abort(); window.clearTimeout(cooldownTimer.current); }, []);

	const run = async (credentials: "include" | "omit") => {
		if (active.current || cooldown) return;
		const id = athleteId.trim();
		if (!UUID_PATTERN.test(id)) { setError("Enter a valid athlete UUID."); return; }
		const controller = new AbortController();
		active.current = controller;
		setResults(previous => previous.filter(result => result.credentials !== credentials));
		setRunning(true);
		setError(undefined);
		try {
			for (const endpoint of ["wrestlers", "bouts"] as const) {
				const result = await testConnection(endpoint, id, credentials, controller.signal);
				if (controller.signal.aborted) return;
				setResults(previous => [...previous.filter(item => item.endpoint !== endpoint || item.credentials !== credentials), result]);
				// Stop on errors rather than continuing a rejected connection test.
				if (result.state !== "success") break;
				if (endpoint === "wrestlers") await new Promise<void>(resolve => window.setTimeout(resolve, 2000));
				if (controller.signal.aborted) return;
			}
		} catch {
			if (!controller.signal.aborted) setError("The test could not finish. Try again.");
		} finally {
			if (!controller.signal.aborted) {
				active.current = undefined;
				setRunning(false);
				setCooldown(true);
				cooldownTimer.current = window.setTimeout(() => setCooldown(false), 2000);
			}
		}
	};

	return <Stack maw={800} mx="auto" p="md" gap="lg" ta="left">
		<Helmet><title>Flo connection test - FloStats</title><meta name="robots" content="noindex, nofollow" /></Helmet>
		<Badge w="fit-content" variant="light">Browser prototype</Badge>
		<Title order={1}>Test your Flo connection</Title>
		<Text>Sign in to FloWrestling in this browser, then return here to check whether FloStats can use that session.</Text>
		<Paper withBorder p="md" radius="md">
			<Stack gap="sm">
				<Title order={2} size="h4">1. Sign in on FloWrestling</Title>
				<Text size="sm">Use the same browser profile. The login opens in a new tab; come back here when you finish.</Text>
				<Button component="a" href="https://www.flowrestling.org/login" target="_blank" rel="noopener noreferrer" w="fit-content">Open FloWrestling login</Button>
			</Stack>
		</Paper>
		<Paper withBorder p="md" radius="md">
			<Stack gap="sm">
				<Title order={2} size="h4">2. Check the API connection</Title>
				<TextInput label="Athlete identityPersonId" value={athleteId} disabled={running} onChange={event => { setAthleteId(event.currentTarget.value); setResults([]); setError(undefined); }} error={error} />
				<Group>
					<Button loading={running} disabled={cooldown} onClick={() => { void run("include"); }}>Test with browser cookies</Button>
					<Button variant="default" disabled={running || cooldown} onClick={() => { void run("omit"); }}>Compare without cookies</Button>
				</Group>
				<Text size="sm" c="dimmed" aria-live="polite">{running ? "Checking Flo directly…" : cooldown ? "Please wait before testing again." : "Each test requests at most one registration and one bout, two seconds apart. No pagination or automatic retries."}</Text>
			</Stack>
		</Paper>
		<Alert title="This page’s origin matters" color="blue">
			<Stack gap="xs">
				<Text size="sm">Testing from <Code>{window.location.origin}</Code>. A result on localhost or a preview domain may differ from https://flostats.com because CORS and cookie rules depend on the origin.</Text>
				<Text size="sm">FloStats asks the browser to send eligible Flo cookies directly to Flo. This page does not read, export, or save your login cookies.</Text>
			</Stack>
		</Alert>
		<Stack gap="sm" aria-live="polite" aria-label="Connection results">
			{results.map(result => <Paper key={`${result.endpoint}:${result.credentials}`} withBorder p="md" radius="md">
				<Stack gap="xs">
					<Group justify="space-between"><Title order={3} size="h4">/{result.endpoint} · {result.credentials === "include" ? "with cookies requested" : "without cookies"}</Title><Badge color={result.state === "success" ? "green" : "red"}>{result.status ? `HTTP ${result.status}` : result.state === "timeout" ? "Timed out" : "No readable response"}</Badge></Group>
					<Text size="sm">{result.message}</Text>
					{result.state === "success" && <Text size="sm">Records returned: {result.returned} · Total: {result.total ?? "unknown"} · Wrestler objects: {result.wrestlers} · With identityPersonId: {result.identifiedWrestlers}</Text>}
					<Code block style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{result.url}</Code>
				</Stack>
			</Paper>)}
		</Stack>
		<Stack gap="xs">
			<Title order={2} size="h4">How to interpret the test</Title>
			<Text size="sm">A readable 200 with cookies, paired with a 401 without cookies, is evidence that your browser session works here. A 200 with zero records still means the connection worked.</Text>
			<Text size="sm">A 401 or 403 means Flo rejected the request. If the browser hides the response entirely, open DevTools → Network and Console to inspect CORS and cookie warnings. “With cookies requested” does not prove the browser actually sent them.</Text>
			{UUID_PATTERN.test(athleteId.trim()) && <Anchor href={connectionTestUrl("bouts", athleteId.trim())} target="_blank" rel="noopener noreferrer" size="sm">Open the same bout request directly in a new tab</Anchor>}
		</Stack>
	</Stack>;
}
