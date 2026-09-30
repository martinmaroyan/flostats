import { Anchor, Button, Group, TextInput } from "@mantine/core";
import React from "react";
import { ID_REGEX } from "../utils/identity";
import { useNavigate, Link } from "react-router";

type Props = {
	loading: boolean;
}

export default function SearchBar({ loading }: Props) {
	const [inputValue, setInputValue] = React.useState("");
	const [inputError, setInputError] = React.useState(false);
	const [inputFocused, setInputFocused] = React.useState<boolean>(false);

	const navigate = useNavigate();

	React.useEffect(() => {
		const search = new URLSearchParams(window.location.search).get("q");
		if (search) setInputValue(search);
	}, []);

	React.useEffect(() => {
		if (inputError && inputFocused) setInputError(false);
	}, [inputFocused, inputError]);

	const searchFor = (query: string, useOfp: boolean) => {
		query = query.trim();
		if (!query) {
			// setInputError(true);
		} else {
			const test = ID_REGEX.exec(query);
			if (!test) {
				void navigate(`/search?q=${encodeURIComponent(query)}&page=1&ofp=${useOfp}`);
			} else {
				void navigate(`/athletes/${test[0]}`);
			}
		}
	};

	return (
		<Group justify="center" mb="xl" mt={{ base: "xl", sm: 0 }}>
			<TextInput
				value={inputValue}
				name="wrestler-search"
				onChange={e => setInputValue(e.currentTarget.value)}
				placeholder="Enter name or ID..."
				onKeyDown={event => { if (event.key === "Enter" && !event.repeat) searchFor(inputValue, false); }}
				error={inputError}
				onFocus={() => setInputFocused(true)}
				onBlur={() => setInputFocused(false)}
				size="md"
				spellCheck={false}
				autoComplete="true"
			/>
			<Group justify="center">
				<Group>
					<Button
						variant="outline"
						loading={loading}
						onClick={() => {
							searchFor(inputValue, false);
						}}
					>
						Narrow Search
					</Button>
					<Button
						variant="outline"
						loading={loading}
						onClick={() => {
							searchFor(inputValue, true);
						}}
					>
						Broad Search
					</Button>
				</Group>
				<Anchor
					component={Link}
					to="/compare"
					size="md"
				>
					Compare Wrestlers
				</Anchor>
			</Group>
		</Group>
	);
}
