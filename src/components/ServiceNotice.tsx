import { Alert, Button, Stack, Text } from "@mantine/core";
import { IconInfoCircle, IconArrowRight } from "@tabler/icons-react";
import { ARCHIVE_API } from "../api/FloAPI";

export default function ServiceNotice() {
	if (ARCHIVE_API) return null;
	return (
		<Alert icon={<IconInfoCircle size={22} />} title="Live Data Temporarily Unavailable" color="blue" radius="md" ta="left" role="note">
			<Stack gap="sm">
				<Text size="sm">FloWrestling recently restricted access to historical match results that were previously publicly available. FloStats can no longer retrieve much of its live wrestling data.</Text>
				<Text size="sm">Explore the original analytics, comparisons, and seeding tools with simulated wrestling records. I am actively working on restoring access through an independently maintained dataset.</Text>
				<Button component="a" href="/demo" rightSection={<IconArrowRight size={17} />} w="fit-content">Explore Interactive Demo</Button>
			</Stack>
		</Alert>
	);
}
