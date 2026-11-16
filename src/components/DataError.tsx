import { Alert, Button, Stack, Text } from "@mantine/core";
import { isDemoMode } from "../demo/mode";

export default function DataError({ title, message }: { title: string; message: string }) {
	return <Alert color="orange" title={title} w="100%" ta="left">
		<Stack gap="sm">
			<Text size="sm">{message}</Text>
			{!isDemoMode() && <Button component="a" href="/demo" w="fit-content">Explore Interactive Demo</Button>}
		</Stack>
	</Alert>;
}
