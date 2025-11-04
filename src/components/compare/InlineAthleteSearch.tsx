import React, { useState, useEffect } from "react";
import {
	TextInput,
	Popover,
	Stack,
	Card,
	Text,
	Loader,
	Button,
	Group,
	Badge,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import FloAPI from "../../api/FloAPI";
import { SearchResultPerson } from "../../api/types/responses";
import { ID_REGEX } from "../../main";

type Props = {
	athleteNumber: 1 | 2;
	value: string;
	selectedId: string | null;
	onQueryChange: (query: string) => void;
	onAthleteSelect: (id: string, name: string) => void;
	label: string;
};

export default function InlineAthleteSearch({
	athleteNumber,
	value,
	selectedId,
	onQueryChange,
	onAthleteSelect,
	label,
}: Props) {
	const [isSearching, setIsSearching] = useState(false);
	const [searchResults, setSearchResults] = useState<SearchResultPerson[]>([]);
	const [showResults, setShowResults] = useState(false);
	const [searchType, setSearchType] = useState<"narrow" | "broad">("narrow");

	// Debounce search query to avoid too many API calls
	const [debouncedQuery] = useDebouncedValue(value, 500);

	// Auto-search when debounced query changes
	useEffect(() => {
		if (!debouncedQuery || debouncedQuery.length < 2) {
			setSearchResults([]);
			setShowResults(false);
			return;
		}

		// Don't search if it's a UUID
		if (ID_REGEX.test(debouncedQuery)) {
			setShowResults(false);
			return;
		}

		// Don't search if already selected (input shows name)
		if (selectedId) {
			setShowResults(false);
			return;
		}

		// Execute search
		executeSearch(debouncedQuery);
	}, [debouncedQuery, selectedId]);

	const executeSearch = async (query: string) => {
		setIsSearching(true);
		setShowResults(true);

		try {
			const results = await FloAPI.searchByName(query, {
				limit: 10,
				page: 1,
				onProgress: () => {},
				useOfp: false, // Always use narrow for inline search (immediate data)
			});

			setSearchResults(results.data || []);
		} catch (error) {
			console.error("Search failed:", error);
			setSearchResults([]);
		} finally {
			setIsSearching(false);
		}
	};

	const handleResultClick = (result: SearchResultPerson) => {
		onAthleteSelect(result.arena_person_identity_id, result.name);
		setShowResults(false);
		setSearchResults([]);
	};

	const handleInputChange = (newValue: string) => {
		onQueryChange(newValue);

		// Check if it's a UUID - auto-select if valid
		const uuidMatch = ID_REGEX.exec(newValue);
		if (uuidMatch) {
			onAthleteSelect(uuidMatch[0], newValue);
			setShowResults(false);
			return;
		}

		// Show results popup if there are results and we're typing
		if (searchResults.length > 0 && newValue.length > 0 && !selectedId) {
			setShowResults(true);
		}
	};

	const handleClear = () => {
		onQueryChange("");
		onAthleteSelect(null as any, "");
		setSearchResults([]);
		setShowResults(false);
	};

	return (
		<Stack gap="sm">
			<Popover
				opened={showResults && (isSearching || searchResults.length > 0) && !selectedId}
				position="bottom-start"
				width="target"
				withArrow
				shadow="md"
				onClose={() => setShowResults(false)}
			>
				<Popover.Target>
					<TextInput
						label={label}
						value={value}
						onChange={(e) => handleInputChange(e.currentTarget.value)}
						placeholder="Enter name or UUID..."
						size="md"
						description={
							selectedId
								? "✓ Wrestler selected"
								: ID_REGEX.test(value)
								? "UUID detected"
								: value.length >= 2
								? "Searching..."
								: "Enter at least 2 characters"
						}
						rightSection={isSearching ? <Loader size="xs" /> : null}
					/>
				</Popover.Target>

				<Popover.Dropdown style={{ maxHeight: "400px", overflowY: "auto" }}>
					<Stack gap="xs">
						{isSearching ? (
							<Card p="md">
								<Group>
									<Loader size="sm" />
									<Text>Searching...</Text>
								</Group>
							</Card>
						) : searchResults.length === 0 ? (
							<Card p="md">
								<Text c="dimmed">No results found</Text>
							</Card>
						) : (
							searchResults.map((result) => (
								<Card
									key={result.arena_person_identity_id}
									p="md"
									style={{ cursor: "pointer" }}
									onClick={() => handleResultClick(result)}
									withBorder
									bg="var(--mantine-color-dark-6)"
								>
									<Stack gap="xs">
										<Group justify="space-between">
											<Text fw={600}>{result.name}</Text>
											{result.gender && (
												<Badge size="sm" variant="light">
													{result.gender === "m" ? "Male" : "Female"}
												</Badge>
											)}
										</Group>

										{result.location && (
											<Text size="sm" c="dimmed">
												{result.location.city}, {result.location.state}
											</Text>
										)}

										<Group gap="md">
											<Text size="xs" c="dimmed">
												HS Grad: {result.high_school_grad_year}
											</Text>
											{result.birth_date && (
												<Text size="xs" c="dimmed">
													Born: {new Date(result.birth_date).getFullYear()}
												</Text>
											)}
										</Group>
									</Stack>
								</Card>
							))
						)}
					</Stack>
				</Popover.Dropdown>
			</Popover>

			{/* Clear button when wrestler is selected */}
			{selectedId && (
				<Button variant="light" size="xs" onClick={handleClear}>
					Clear Selection
				</Button>
			)}

			{/* Tip text */}
			{!selectedId && !value && (
				<Text size="xs" c="dimmed">
					Type a name to search, or paste a UUID directly
				</Text>
			)}
		</Stack>
	);
}
