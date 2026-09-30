import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	use: { baseURL: "http://127.0.0.1:4173", timezoneId: "America/New_York", trace: "retain-on-failure", screenshot: "only-on-failure" },
	projects: [
		{ name: "desktop", use: { ...devices["Desktop Chrome"] } },
		{ name: "mobile", use: { ...devices["Pixel 5"] } },
	],
	webServer: {
		command: "pnpm preview --host 127.0.0.1 --port 4173 --strictPort",
		url: "http://127.0.0.1:4173",
		reuseExistingServer: false,
	},
});
