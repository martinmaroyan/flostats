"use client";
import SearchResultsPage from "@/components/SearchResults/SearchResults";
import { ColorSchemeToggle } from "../components/ColorSchemeToggle/ColorSchemeToggle";
import { Welcome } from "../components/Welcome/Welcome";
import React from "react";
import { Button, Checkbox, Group, Input, Stack } from "@mantine/core";

import { IconSearch } from "@tabler/icons-react";

export default function HomePage() {
	const [name, setName] = React.useState<string>("");
	const [broad, setBroad] = React.useState<boolean>(false);

	const nameRef = React.useRef<HTMLInputElement>(null);

	const [searching, setSearching] = React.useState<boolean>(false);

	const handleSearch = () => {
		if (!name) return;
		setSearching(true);
	};

	return (
		<Stack align="center">
			<ColorSchemeToggle />
			<Group>
				<Input ref={nameRef} value={name} onChange={e => setName(e.target.value)} placeholder="Search for a wrestler" title="Search" />
				<Button leftSection={<IconSearch />} onClick={handleSearch} color="blue">Search</Button>
				<Checkbox checked={broad} onChange={e => setBroad(e.target.checked)} label="Broad search" />
			</Group>
			<SearchResultsPage name={name} broad={broad} onSelect={(id, name) => console.log(id, name)} active={searching} setActive={setSearching} />
		</Stack>
	);
}
