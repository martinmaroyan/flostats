import React from "react";
import ReactDOM from "react-dom/client";
import Athletes from "./Athletes.tsx";
import { BrowserRouter, Route, Routes } from "react-router";
import { createTheme, CSSVariablesResolver, MantineProvider } from "@mantine/core";
import { NavigationProgress } from "@mantine/nprogress";
import { HelmetProvider } from "react-helmet-async";

import SearchBar from "./components/SearchBar.tsx";
import InfoButton from "./components/InfoButton.tsx";

import "./index.css";
import "@mantine/core/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/nprogress/styles.css";
import "@mantine/carousel/styles.css";
import "mantine-react-table/styles.css";

import SearchResultsPage from "./components/SearchResults.tsx";
import ThemeToggle from "./components/ThemeToggle.tsx";
import CompareAthletes from "./components/compare/CompareAthletes.tsx";

export const ID_REGEX = new RegExp("[0-9(a-f|A-F)]{8}-[0-9(a-f|A-F)]{4}-4[0-9(a-f|A-F)]{3}-[89ab][0-9(a-f|A-F)]{3}-[0-9(a-f|A-F)]{12}"); // UUID v4

const root = document.getElementById("root");

const themeOverride = createTheme({
	primaryColor: "blue",
	colors: {
		blue: [
			"#e5f3ff",
			"#cde2ff",
			"#9ac2ff",
			"#64a0ff",
			"#3884fe",
			"#1d72fe",
			"#0969ff",
			"#0058e4",
			"#004ecd",
			"#0043b5"
		],
	}
});

const resolver: CSSVariablesResolver = theme => ({
	variables: {
		"--mantine-win-color": theme.colors.green[7],
		"--mantine-loss-color": theme.colors.red[6],
	},
	light: {},
	dark: {},
});

ReactDOM.createRoot(root!).render(
	<React.StrictMode>
		<HelmetProvider>
			<MantineProvider defaultColorScheme="dark" theme={themeOverride} cssVariablesResolver={resolver}>
				<NavigationProgress />
				<BrowserRouter>
					<SearchBar loading={false} />
					<InfoButton />
					<ThemeToggle styles={{ root: {
						position: "absolute",
						top: "0.5rem",
						right: "0.5rem",
					} }} size="lg" />
					<Routes>
						<Route path="/" element={<></>} />
						<Route path="/search" element={<SearchResultsPage />} />
						<Route path="/athletes/:id" element={<Athletes />} />
						<Route path="/teams/:id" element={<Athletes />} />
						<Route path="/compare" element={<CompareAthletes />} />
					</Routes>
				</BrowserRouter>
			</MantineProvider>
		</HelmetProvider>
	</React.StrictMode>,
);
