import React from "react";
import ReactDOM from "react-dom/client";
import { createTheme, CSSVariablesResolver, MantineProvider } from "@mantine/core";
import { NavigationProgress } from "@mantine/nprogress";
import { HelmetProvider } from "react-helmet-async";

import App from "./App";

import "./index.css";
import "@mantine/core/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/nprogress/styles.css";
import "mantine-react-table/styles.css";

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
				<App />
			</MantineProvider>
		</HelmetProvider>
	</React.StrictMode>,
);
