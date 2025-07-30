import { ActionIcon, Modal, Text, Stack, Title } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";

export default function InfoButton() {
	const [opened, { open, close }] = useDisclosure(false);

	return (
		<>
			<ActionIcon
				onClick={open}
				color="blue"
				size="lg"
				style={{
					position: "absolute",
					top: "2rem",
					left: "2rem",
					zIndex: 1000,
				}}
			>
				<IconInfoCircle />
			</ActionIcon>

			<Modal opened={opened} onClose={close} title="About FloStats" size="md">
				<Stack gap="md">
					<div>
						<Title order={3}>What is FloStats?</Title>
						<Text>
							FloStats is a comprehensive wrestling statistics and analytics tool that provides detailed insights into wrestler and team performance.
						</Text>
					</div>

					<div>
						<Title order={3}>What information does it show?</Title>
						<Text>
							• Wrestler profiles with match history and statistics
							<br />
							• Team performance metrics and rankings
							<br />
							• Historical match data and bout analysis
							<br />
							• Weight class progression tracking
							<br />
							• Win/loss records and performance trends
							<br />
							• Tournament placements and achievements
						</Text>
					</div>

					<div>
						<Title order={3}>Where does the data come from?</Title>
						<Text>
							The data is sourced from FloWrestling APIs, providing accurate and up-to-date information on matches, tournaments, and wrestler statistics.
						</Text>
					</div>

					<div>
						<Title order={3}>API Endpoints Used</Title>
						<Text size="sm">
							• <Text component="code" size="sm">api.flowrestling.org/api/experiences/web/legacy-core/search</Text> - Search wrestlers and teams
							<br />
							• <Text component="code" size="sm">floarena-api.flowrestling.org/wrestlers/</Text> - Wrestler data and statistics
							<br />
							• <Text component="code" size="sm">floarena-api.flowrestling.org/bouts/</Text> - Match and bout information
							<br />
							• <Text component="code" size="sm">api.flowrestling.org/api/collections/from-node/</Text> - Additional data collections
						</Text>
					</div>

					<div>
						<Text>
							Created by{" "}
							<Text component="a" href="https://github.com/MartinTintin3" target="_blank" rel="noopener noreferrer" c="blue">
								MartinTintin3
							</Text>{" "}
							on GitHub
						</Text>
					</div>
				</Stack>
			</Modal>
		</>
	);
}