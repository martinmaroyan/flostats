import { Button, Group, Paper, Text } from "@mantine/core";
import { Link } from "react-router";
import { Helmet } from "react-helmet-async";
import { isDemoMode } from "../demo/mode";
import { useLocation } from "react-router";
import SearchBar from "./SearchBar";
import InfoButton from "./InfoButton";
import ThemeToggle from "./ThemeToggle";

export default function Layout({ children }: { children: React.ReactNode }) {
	const location = useLocation();
	const isHomePage = location.pathname === "/";

	return (
		<>
			{isDemoMode() && <>
				<Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
				<Paper withBorder p="sm" mx="sm" mb="md" radius="md" style={{ position: "sticky", top: 0, zIndex: 110, background: "var(--mantine-color-body)" }}>
					<Group justify="space-between" gap="xs">
						<Text size="xs" fw={600} ta="left">DEMO MODE: All wrestlers and results are fictional.</Text>
						<Group gap="xs"><Button component={Link} to="/" size="compact-xs" variant="light">Demo home</Button><Button component="a" href="/" size="compact-xs" variant="default">Exit demo</Button></Group>
					</Group>
				</Paper>
			</>}
			{!isHomePage && <SearchBar loading={false} />}
			<InfoButton />
			<ThemeToggle
				styles={{
					root: {
						position: "absolute",
						top: "0.5rem",
						right: "0.5rem",
					},
				}}
				size="lg"
			/>
			{children}
		</>
	);
}
