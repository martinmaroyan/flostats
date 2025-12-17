import {
	TextInput,
	Button,
	Group,
	Stack,
	Title,
	Text,
	Paper,
	Tooltip,
	Box,
	Kbd,
	ActionIcon,
} from "@mantine/core";
import {
	IconSearch,
	IconHistory,
	IconChartBar,
	IconTrophy,
	IconScale,
	IconUsers,
	IconX,
} from "@tabler/icons-react";
import React from "react";
import { useNavigate, Link } from "react-router";
import { ID_REGEX } from "../main";
import styles from "./HomePage.module.css";

const RECENT_SEARCHES_KEY = "flostats_recent_searches";
const MAX_RECENT_SEARCHES = 5;

type RecentSearch = {
	query: string;
	timestamp: number;
};

function getRecentSearches(): RecentSearch[] {
	try {
		const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
		if (!stored) return [];
		return JSON.parse(stored);
	} catch {
		return [];
	}
}

function saveRecentSearch(query: string): void {
	const trimmed = query.trim();
	if (!trimmed) return;

	const searches = getRecentSearches().filter(s => s.query.toLowerCase() !== trimmed.toLowerCase());
	searches.unshift({ query: trimmed, timestamp: Date.now() });

	localStorage.setItem(
		RECENT_SEARCHES_KEY,
		JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES))
	);
}

function removeRecentSearch(query: string): RecentSearch[] {
	const searches = getRecentSearches().filter(s => s.query !== query);
	localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
	return searches;
}

export default function HomePage() {
	const [inputValue, setInputValue] = React.useState("");
	const [recentSearches, setRecentSearches] = React.useState<RecentSearch[]>([]);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const navigate = useNavigate();

	React.useEffect(() => {
		setRecentSearches(getRecentSearches());

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "/" && document.activeElement !== inputRef.current) {
				e.preventDefault();
				inputRef.current?.focus();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	const searchFor = (query: string, useOfp: boolean) => {
		const trimmed = query.trim();
		if (!trimmed) return;

		const test = ID_REGEX.exec(trimmed);
		if (!test) {
			saveRecentSearch(trimmed);
			setRecentSearches(getRecentSearches());
			navigate(`/search?q=${encodeURIComponent(trimmed)}&page=1&ofp=${useOfp}`);
		} else {
			navigate(`/athletes/${test[0]}`);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			searchFor(inputValue, false);
		}
	};

	const handleRemoveRecent = (query: string, e: React.MouseEvent) => {
		e.stopPropagation();
		setRecentSearches(removeRecentSearch(query));
	};

	const features = [
		{
			icon: IconHistory,
			title: "Match History",
			description: "View complete match records with opponents, scores, and results",
		},
		{
			icon: IconChartBar,
			title: "Season Summaries",
			description: "Stats organized by wrestling year with win/loss breakdowns",
		},
		{
			icon: IconTrophy,
			title: "Tournament Placements",
			description: "Track placements across events with division and weight class info",
		},
		{
			icon: IconScale,
			title: "Weight Tracking",
			description: "See weight class progression and exact weigh-in data over time",
		},
		{
			icon: IconUsers,
			title: "Compare Athletes",
			description: "Find common opponents and head-to-head matchups between wrestlers",
		},
	];

	return (
		<Stack gap="xl" className={styles.container}>
			{/* Header Section */}
			<Box className={styles.header}>
				<Title order={1} className={styles.title}>
					FloStats
				</Title>
				<Text size="lg" c="dimmed" className={styles.subtitle}>
					Search for high school wrestlers and explore their match records, tournament results, and season statistics.
				</Text>
			</Box>

			{/* Search Section */}
			<Paper className={styles.searchCard} p="xl" radius="md">
				<Stack gap="md">
					<TextInput
						ref={inputRef}
						value={inputValue}
						onChange={(e) => setInputValue(e.currentTarget.value)}
						onKeyDown={handleKeyDown}
						placeholder="Search by wrestler name"
						size="lg"
						leftSection={<IconSearch size={20} />}
						rightSection={
							<Kbd size="xs" className={styles.kbd}>/</Kbd>
						}
						spellCheck={false}
						autoComplete="off"
						classNames={{ input: styles.searchInput }}
					/>

					<Group justify="center" gap="sm">
						<Tooltip
							label="Faster search with focused results. Best for common names."
							position="bottom"
							withArrow
							multiline
							w={220}
						>
							<Button
								variant="filled"
								size="md"
								onClick={() => searchFor(inputValue, false)}
								leftSection={<IconSearch size={18} />}
							>
								Narrow Search
							</Button>
						</Tooltip>

						<Tooltip
							label="Wider search that may find more results. Use if narrow search misses someone."
							position="bottom"
							withArrow
							multiline
							w={220}
						>
							<Button
								variant="outline"
								size="md"
								onClick={() => searchFor(inputValue, true)}
							>
								Broad Search
							</Button>
						</Tooltip>
					</Group>

					<Text size="sm" c="dimmed" ta="center">
						Press <Kbd size="xs">Enter</Kbd> to search, or paste a wrestler ID to go directly to their profile
					</Text>
				</Stack>
			</Paper>

			{/* Recent Searches */}
			{recentSearches.length > 0 && (
				<Box className={styles.recentSection}>
					<Text size="sm" c="dimmed" mb="xs" fw={500}>
						Recent Searches
					</Text>
					<Group gap="xs">
						{recentSearches.map((search) => (
							<Button
								key={search.query}
								variant="default"
								size="xs"
								className={styles.recentChip}
								onClick={() => {
									setInputValue(search.query);
									searchFor(search.query, false);
								}}
								rightSection={
									<ActionIcon
										size="xs"
										variant="subtle"
										color="gray"
										onClick={(e) => handleRemoveRecent(search.query, e)}
									>
										<IconX size={12} />
									</ActionIcon>
								}
							>
								{search.query}
							</Button>
						))}
					</Group>
				</Box>
			)}

			{/* Features Section */}
			<Box className={styles.featuresSection}>
				<Text size="sm" c="dimmed" mb="md" fw={500} ta="center">
					What you can view
				</Text>
				<Box className={styles.featuresGrid}>
					{features.map((feature) => (
						<Paper
							key={feature.title}
							p="md"
							radius="md"
							className={styles.featureCard}
						>
							<Group gap="sm" wrap="nowrap" align="flex-start">
								<Box className={styles.featureIcon}>
									<feature.icon size={20} stroke={1.5} />
								</Box>
								<Box>
									<Text size="sm" fw={600}>
										{feature.title}
									</Text>
									<Text size="xs" c="dimmed">
										{feature.description}
									</Text>
								</Box>
							</Group>
						</Paper>
					))}
				</Box>
			</Box>

			{/* Compare Button */}
			<Box ta="center">
				<Button
					component={Link}
					to="/compare"
					variant="light"
					size="md"
					leftSection={<IconUsers size={18} />}
				>
					Compare Two Wrestlers
				</Button>
			</Box>
		</Stack>
	);
}
