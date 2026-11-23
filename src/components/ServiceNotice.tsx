import { Alert, Anchor, Button, Group, Modal, Stack, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconInfoCircle } from "@tabler/icons-react";

export default function ServiceNotice() {
	const [opened, { open, close }] = useDisclosure(false);

	return (
		<>
			<Alert icon={<IconInfoCircle size={22} />} title="Live Data Temporarily Unavailable" color="blue" radius="md" ta="left" role="note">
				<Stack gap="sm">
					<Text size="sm">FloWrestling has moved previously free detailed athlete results behind a subscription. Access restrictions now prevent FloStats from retrieving much of the match history its statistics and comparisons rely on.</Text>
					<Text size="sm">I am working on an independently maintained dataset, but there is no confirmed date for restoring live results.</Text>
					<Group gap="md">
						<Button variant="light" leftSection={<IconInfoCircle size={17} />} onClick={open} aria-haspopup="dialog">Why is live data unavailable?</Button>
						<Anchor href="/demo" size="sm">Explore Interactive Demo</Anchor>
					</Group>
				</Stack>
			</Alert>
			<Modal opened={opened} onClose={close} title="Why is live data unavailable?" size="lg">
				<Stack gap="md">
					<div>
						<Title order={3} size="h5">What changed?</Title>
						<Text size="sm">In its October 22, 2026 announcement about updated athlete profiles, FloWrestling said that detailed athlete results previously available for free now require a FloWrestling subscription. Match history is included in its subscriber features.</Text>
					</div>
					<div>
						<Title order={3} size="h5">How does this affect FloStats?</Title>
						<Text size="sm">FloStats relied on FloWrestling’s publicly accessible data services to retrieve match records and calculate statistics, head-to-head comparisons, and seeding information. Those requests now return authorization errors (401 Unauthorized), so affected records and calculations cannot load. This is the access problem observed by FloStats; FloWrestling’s announcement describes the subscription change, rather than the technical restrictions on third-party tools.</Text>
					</div>
					<div>
						<Title order={3} size="h5">What happens next?</Title>
						<Text size="sm">I am working toward an independently maintained dataset. There is no confirmed restoration date, and a FloWrestling subscription does not currently restore access through FloStats.</Text>
					</div>
					<Anchor href="https://www.flowrestling.org/articles/16186324-athlete-profiles-rankings-results-more" target="_blank" rel="noopener noreferrer" size="sm">Read FloWrestling’s announcement (October 22, 2026)</Anchor>
				</Stack>
			</Modal>
		</>
	);
}
