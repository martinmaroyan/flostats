import { expect, Page, test } from "@playwright/test";

const FIRST = "11111111-1111-4111-8111-111111111111";
const ALIAS = "22222222-2222-4222-8222-222222222222";
const SECOND = "33333333-3333-4333-8333-333333333333";
const SHARED = "44444444-4444-4444-8444-444444444444";

function registration(person: string) {
	const name = person === SECOND ? "Second Wrestler" : person === SHARED ? "Shared Opponent" : "First Wrestler";
	return { type: "wrestler", id: `registration-${person}`, attributes: {
		identityPersonId: person, firstName: name.split(" ")[0], lastName: name.split(" ")[1], fullName: name,
		eventId: "event", teamId: "team", weightClassId: "weight", divisionId: "division", dateOfBirth: null,
	}, relationships: {} };
}

function athleteResponse(person: string, resource: string) {
	const athlete = registration(person);
	const opponent = registration(SHARED);
	const headToHead = registration(person === SECOND ? FIRST : SECOND);
	const event = { type: "event", id: "event", attributes: { name: "Test Tournament", startDateTime: "2026-01-10T08:00:00", endDateTime: "2026-01-10T20:00:00", isDual: false } };
	const team = { type: "team", id: "team", attributes: { identityTeamId: "team-person", name: "Test Team", location: { name: "Test Location" } } };
	const weight = { type: "weightClass", id: "weight", attributes: { name: "150", maxWeight: 150 } };
	const bout = (id: string, other: ReturnType<typeof registration>) => ({ type: "bout", id, attributes: {
		topWrestlerId: athlete.id, bottomWrestlerId: other.id, winnerWrestlerId: athlete.id,
		eventId: "event", weightClassId: "weight", winType: id.startsWith("shared-") ? "F" : "DEC", result: id.startsWith("shared-") ? "0:45" : "5-2", goDateTime: "2026-01-10T15:00:00", endDateTime: "2026-01-10T15:06:00",
	}, relationships: {} });
	const data = resource === "wrestlers" ? [athlete] : [bout(`shared-${person}`, opponent), bout("head-to-head", headToHead)];
	return { data, included: [athlete, opponent, headToHead, event, team, weight], meta: { total: data.length }, links: {} };
}

async function mockAPI(page: Page) {
	await page.route("https://floarena-api.flowrestling.org/**", async route => {
		const url = new URL(route.request().url());
		await route.fulfill({ json: athleteResponse(url.searchParams.get("identityPersonId") ?? FIRST, url.pathname.includes("wrestlers") ? "wrestlers" : "bouts") });
	});
	await page.route("https://api.flowrestling.org/**", async route => {
		const url = new URL(route.request().url());
		const query = url.searchParams.get("q") ?? "First";
		if (url.pathname.includes("from-node")) {
			const person = url.pathname.endsWith("/2") ? ALIAS : FIRST;
			await route.fulfill({ json: { data: { arena_person_identity_id: person, original_entity: { id: person === ALIAS ? 2 : 1, arena_person_identity_id: person, name: "First Wrestler", location: null } } } });
			return;
		}
		const data = [FIRST, ALIAS].map((person, i) => ({
			id: i + 1, node: { id: i + 1 }, arena_person_identity_id: person,
			name: `${query} Wrestler`, title: `${query} Wrestler`, location: null, high_school_grad_year: 2026,
		}));
		await route.fulfill({ json: { data, meta: { page: Number(url.searchParams.get("page")) || 1, pages: 2, max_limit: 1000 } } });
	});
}

test.beforeEach(async ({ page }) => {
	await mockAPI(page);
	await page.route(/googletagmanager|googlesyndication/, route => route.abort());
	page.on("pageerror", error => { throw error; });
});

test("homepage headings and wrapped introductory text stay centered", async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem("flostats_recent_searches", JSON.stringify([{ query: "First", timestamp: Date.now() }]));
	});
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "FloStats", exact: true })).toHaveCSS("text-align", "center");
	await expect(page.getByText("Search for high school wrestlers and explore their match records, tournament results, and season statistics.", { exact: true })).toHaveCSS("text-align", "center");
	const recent = page.getByText("Recent Searches", { exact: true });
	await expect(recent).toHaveCSS("text-align", "center");
	await expect(recent.locator("..").getByRole("button", { name: "First", exact: true }).locator("..")).toHaveCSS("justify-content", "center");
});

test("home search, pagination, merges, and broad search preserve navigation", async ({ page }) => {
	await page.goto("/");
	await page.getByRole("textbox").fill("First");
	await page.getByRole("textbox").press("Enter");
	await expect(page.getByRole("heading", { name: "First Wrestler", exact: true })).toHaveCount(2);
	await page.getByRole("button", { name: "2", exact: true }).click();
	await expect(page).toHaveURL(/page=2/);
	await page.getByRole("button", { name: "Manage Merges" }).click();
	const boxes = page.getByRole("checkbox");
	await expect(boxes).toHaveCount(2);
	await boxes.nth(0).check();
	await boxes.nth(1).check();
	await page.getByRole("button", { name: "Merge 2 selected" }).click();
	await expect(page.getByRole("heading", { name: "First Wrestler", exact: true })).toHaveCount(1);
	await page.reload();
	await expect(page.getByRole("heading", { name: "First Wrestler", exact: true })).toHaveCount(1);
	await page.getByRole("button", { name: "Broad Search", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Broad Results" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "First Wrestler", exact: true })).toHaveCount(1);
});

test("athlete summaries retain end-date matches and team filtering works", async ({ page }) => {
	await page.goto(`/athletes/${FIRST}`);
	await expect(page.getByRole("heading", { name: "First Wrestler", exact: true })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Total Summary" })).toBeVisible();
	await page.getByLabel("Filter End Date").fill("January 10, 2026");
	await page.getByLabel("Filter End Date").press("Enter");
	await expect(page.getByRole("heading", { name: "Season: 2025-26" })).toBeVisible();
	const team = page.getByRole("button", { name: "Test Team Test Location 2 matches" });
	await team.click();
	await expect(team).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("heading", { name: "Season: 2025-26" })).toHaveCount(0);
	await expect(page.getByText("NaN", { exact: false })).toHaveCount(0);
	await team.click();
	await expect(page.getByRole("heading", { name: "Season: 2025-26" })).toBeVisible();
	const totalSummary = page.getByRole("heading", { name: "Total Summary" }).locator("..").locator("..");
	await expect(totalSummary.getByText("Pins:", { exact: true }).locator("..")).toHaveText(/Pins:\s*1/);
	await expect(totalSummary.getByText("0:45 F", { exact: true })).toBeVisible();
	await totalSummary.getByRole("button", { name: "See More" }).click();
	await expect(totalSummary.getByRole("table")).toBeVisible();
	await expect(totalSummary.getByRole("link", { name: "Shared Opponent", exact: true })).toBeVisible();
	await totalSummary.getByRole("button", { name: "Show/Hide filters" }).click();
	await totalSummary.getByPlaceholder("Filter by Opponent").fill("Shared");
	await expect(totalSummary.getByRole("link", { name: "Second Wrestler", exact: true })).toHaveCount(0);
	await totalSummary.getByPlaceholder("Filter by Opponent").fill("");
	await expect(totalSummary.getByRole("link", { name: "Second Wrestler", exact: true })).toBeVisible();
	await totalSummary.getByRole("tab", { name: "Placements", exact: true }).click();
	await expect(totalSummary.getByRole("button", { name: /Test Tournament/ })).toBeVisible();
	await totalSummary.getByRole("tab", { name: "Matches", exact: true }).click();
	await page.screenshot({ path: `test-results/athlete-${test.info().project.name}.png`, fullPage: true });
});

test("comparison shows head-to-head matches and common opponents", async ({ page }) => {
	await page.goto(`/compare?athlete1=${FIRST}&athlete2=${SECOND}`);
	await expect(page.getByRole("heading", { name: "Head-to-Head Matches" })).toBeVisible();
	await expect(page.getByText("Shared Opponent", { exact: true })).toBeVisible();
});

test("failed API calls exit loading and show an error", async ({ page }) => {
	await page.route("https://floarena-api.flowrestling.org/**", route => route.fulfill({ status: 503, body: "Unavailable" }));
	await page.goto(`/athletes/${FIRST}`);
	await expect(page.getByRole("alert")).toContainText("503");
	await expect(page.getByText("Loading athlete data", { exact: false })).toHaveCount(0);
});

test("search can recover after an API error", async ({ page }) => {
	await page.route("https://api.flowrestling.org/**", route => {
		if (new URL(route.request().url()).searchParams.get("q") === "Failure") return route.fulfill({ status: 503, body: "Unavailable" });
		return route.fallback();
	});
	await page.goto("/search?q=Failure");
	await expect(page.getByRole("alert")).toContainText("503");
	await page.getByPlaceholder("Enter name or ID...").fill("Recovered");
	await page.getByPlaceholder("Enter name or ID...").press("Enter");
	await expect(page.getByRole("heading", { name: "Recovered Wrestler", exact: true })).toHaveCount(2);
	await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a delayed search cannot replace a newer query", async ({ page }) => {
	let release = () => {};
	const gate = new Promise<void>(resolve => { release = resolve; });
	await page.route("https://api.flowrestling.org/**", async route => {
		if (new URL(route.request().url()).searchParams.get("q") === "Delayed") await gate;
		await route.fallback();
	});
	const pending = page.waitForRequest(request => new URL(request.url()).searchParams.get("q") === "Delayed");
	await page.goto("/search?q=Delayed");
	await pending;
	await page.getByPlaceholder("Enter name or ID...").fill("Current");
	await page.getByPlaceholder("Enter name or ID...").press("Enter");
	await expect(page.getByRole("heading", { name: "Current Wrestler", exact: true })).toHaveCount(2);
	const completed = page.waitForResponse(response => new URL(response.url()).searchParams.get("q") === "Delayed");
	release();
	await completed;
	await expect(page.getByRole("heading", { name: "Current Wrestler", exact: true })).toHaveCount(2);
	await expect(page.getByRole("heading", { name: "Delayed Wrestler", exact: true })).toHaveCount(0);
});

test("a delayed athlete load cannot replace a newly selected athlete", async ({ page }) => {
	let release = () => {};
	const gate = new Promise<void>(resolve => { release = resolve; });
	await page.route("https://floarena-api.flowrestling.org/**", async route => {
		if (new URL(route.request().url()).searchParams.get("identityPersonId") === FIRST) await gate;
		await route.fallback();
	});
	const pending = page.waitForRequest(request => new URL(request.url()).searchParams.get("identityPersonId") === FIRST);
	await page.goto(`/athletes/${FIRST}`);
	await pending;
	await page.getByPlaceholder("Enter name or ID...").fill(SECOND);
	await page.getByPlaceholder("Enter name or ID...").press("Enter");
	await expect(page.getByRole("heading", { name: "Second Wrestler", exact: true })).toBeVisible();
	const completed = page.waitForResponse(response => new URL(response.url()).searchParams.get("identityPersonId") === FIRST);
	release();
	await completed;
	await expect(page.getByRole("heading", { name: "Second Wrestler", exact: true })).toBeVisible();
	await expect(page.getByRole("heading", { name: "First Wrestler", exact: true })).toHaveCount(0);
});
