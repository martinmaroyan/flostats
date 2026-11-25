import { Alert, Button, Stack, Text } from "@mantine/core";
import { isDemoMode } from "../demo/mode";

export default function DataError({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
	return <Alert color="orange" title={title} w="100%" ta="left">
		<Stack gap="sm">
			<Text size="sm">{message}</Text>
			{onRetry && <Button onClick={onRetry} w="fit-content">Try again</Button>}
			{!isDemoMode() && <Button component="a" href="/demo" w="fit-content">Explore Interactive Demo</Button>}
		</Stack>
	</Alert>;
}
