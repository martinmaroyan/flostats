import { expect, test, type Page } from "@playwright/test";
import { generateDataset, personId } from "../src/demo/generator";

const league = generateDataset();
const first = league.people[0];
const fullName = `${first.first} ${first.last}`;
const profile = `/demo/athletes/${first.id}`;

function summary(page: Page) {
	return page.getByRole("heading", { name: "Total Summary", exact: true }).locator("..").locator("..");
}
function counted(id: string) { return league.boutsByPerson.get(id)!.filter(b => b.attributes.winType !== "FF"); }
function wins(id: string) { return counted(id).filter(b => league.registrationsById.get(b.attributes.winnerWrestlerId)!.attributes.identityPersonId === id).length; }

const external: string[] = [];
test.beforeEach(async ({ page }) => {
	external.length = 0;
	await page.route(/https:\/\/([^/]+\.)?flowrestling\.org\//, route => {
		external.push(route.request().url());
		return route.abort();
	});
	await page.route(/googletagmanager|googlesyndication/, route => route.abort());
	page.on("pageerror", error => { throw error; });
});
test.afterEach(() => { expect(external).toEqual([]); });

test("homepage notice enters a responsive demo with persistent disclosure and exit", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByText("Live Data Temporarily Unavailable", { exact: true })).toBeVisible();
	await page.getByRole("link", { name: "Explore Interactive Demo" }).click();
	await expect(page).toHaveURL(/\/demo$/);
	await expect(page.getByText("DEMO MODE: All wrestlers and results are fictional.", { exact: true })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Demo dataset" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Demo dataset" })).toHaveCSS("text-align", "center");
	await expect(page.getByRole("heading", { name: fullName, exact: true })).toHaveCSS("text-align", "center");
	await expect(page.getByText("384 wrestlers", { exact: true })).toBeVisible();
	await expect(page.getByText(`${league.bouts.length.toLocaleString("en-US")} bouts`, { exact: true })).toBeVisible();
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	await page.getByRole("button", { name: "Toggle color scheme" }).click();
	await expect(page.locator("html")).toHaveAttribute("data-mantine-color-scheme", "light");
	await page.screenshot({ path: `test-results/demo-home-light-${test.info().project.name}.png`, fullPage: true });
	await page.getByRole("link", { name: "Exit demo" }).click();
	await expect(page).toHaveURL("/");
	await expect(page.getByText("Live Data Temporarily Unavailable", { exact: true })).toBeVisible();
});

test("narrow and broad searches, pagination, profiles, refresh, and demo query links", async ({ page }) => {
	await page.goto("/?demo=1");
	await page.getByRole("textbox", { name: "Search by wrestler name" }).fill(first.first);
	await page.getByRole("button", { name: "Narrow Search", exact: true }).click();
	await expect(page).toHaveURL(/\/demo\/search/);
	await expect(page.getByRole("heading", { name: fullName, exact: true })).toBeVisible();
	await page.goto("/demo/search?q=a&page=1");
	await expect(page.getByRole("heading", { level: 3 })).toHaveCount(10);
	await page.getByRole("button", { name: "2", exact: true }).click();
	await expect(page).toHaveURL(/page=2/);
	await expect(page.getByRole("heading", { level: 3 })).toHaveCount(10);
	await page.goto("/demo/search?q=Alderhaven&ofp=true");
	await expect(page.getByRole("heading", { name: fullName, exact: true })).toBeVisible();
	await page.getByRole("link").filter({ has: page.getByRole("heading", { name: fullName, exact: true }) }).click();
	await expect(page).toHaveURL(profile);
	await expect(page.getByRole("heading", { name: fullName, exact: true })).toBeVisible();
	await expect(summary(page).getByText("Wins:", { exact: true }).locator("..")).toHaveText(`Wins:${wins(first.id)}`);
	await page.reload();
	await expect(page.getByRole("heading", { name: fullName, exact: true })).toBeVisible();
	await expect(summary(page).getByText("Wins:", { exact: true }).locator("..")).toHaveText(`Wins:${wins(first.id)}`);
});

test("profiles calculate real totals, season charts, filters, sortable matches, and placements", async ({ page }) => {
	await page.goto(profile);
	const total = summary(page);
	await expect(total.getByText("Matches:", { exact: true }).locator("..")).toHaveText(`Matches:${counted(first.id).length}`);
	await expect(page.getByRole("heading", { name: /^Season: / })).toHaveCount(4);
	await expect(page.getByRole("heading", { name: "Seeding Criteria", exact: true })).toBeVisible();
	await expect(page.getByText("Step 1: wins against opponents with prior-season paperwork", { exact: false }).first()).toBeVisible();
	await page.getByLabel("Forfeits", { exact: true }).check();
	await expect(total.getByText("Matches:", { exact: true }).locator("..")).toHaveText(`Matches:${league.boutsByPerson.get(first.id)!.length}`);
	await page.getByLabel("Forfeits", { exact: true }).uncheck();
	await total.getByRole("button", { name: "See More" }).click();
	await expect(total.getByRole("table")).toBeVisible();
	await expect(total.locator(".recharts-surface").first()).toBeVisible();
	await total.getByRole("button", { name: "Show/Hide filters" }).click();
	const opponent = league.people[12];
	await total.getByPlaceholder("Filter by Opponent").fill(`${opponent.first} ${opponent.last}`);
	await expect(total.getByRole("link", { name: `${opponent.first} ${opponent.last}`, exact: true }).first()).toBeVisible();
	await total.getByPlaceholder("Filter by Opponent").fill("");
	await total.getByPlaceholder("Filter by Weight").fill("120");
	await expect(total.getByRole("link", { name: /202[34] .*Dual/ }).first()).toHaveCount(0);
	await total.getByPlaceholder("Filter by Weight").fill("");
	await total.getByRole("button", { name: "Show/Hide filters" }).click();
	await total.getByRole("columnheader", { name: /Date/ }).getByText("Date", { exact: true }).click();
	await total.getByRole("tab", { name: "Weight progression", exact: true }).click();
	await expect(total.getByRole("button", { name: "Zoom Out", exact: true })).toBeVisible();
	await expect(total.locator(".recharts-line-curve").first()).toBeVisible();
	await total.getByRole("button", { name: "Zoom Out", exact: true }).click();
	await total.getByRole("tab", { name: "Placements", exact: true }).click();
	await expect(total.getByRole("button", { name: /State Tournament/ }).first()).toBeVisible();
	await page.getByLabel("Filter Start Date").fill("November 1, 2025");
	await page.getByLabel("Filter Start Date").press("Enter");
	await expect(page.getByRole("heading", { name: /^Season: / })).toHaveCount(1);
	const expected = counted(first.id).filter(b => b.attributes.goDateTime >= "2025-11").length;
	await expect(total.getByText("Matches:", { exact: true }).locator("..")).toHaveText(`Matches:${expected}`);
	await page.getByLabel("Duals", { exact: true }).uncheck();
	const tournaments = counted(first.id).filter(b => b.attributes.goDateTime >= "2025-11" && !b.attributes.dualId).length;
	await expect(total.getByText("Matches:", { exact: true }).locator("..")).toHaveText(`Matches:${tournaments}`);
	await page.screenshot({ path: `test-results/demo-profile-${test.info().project.name}.png`, fullPage: true });
});

test("featured comparison has reciprocal head-to-head, expandable common opponents, and local event results", async ({ page }) => {
	await page.goto("/demo");
	await page.getByRole("link", { name: "View comparison" }).click();
	await expect(page).toHaveURL(/\/demo\/compare\?athlete1=/);
	await expect(page.getByRole("heading", { name: "Direct Head-to-Head Matches", exact: true })).toBeVisible();
	await expect(page.getByRole("table")).toBeVisible();
	await page.getByRole("button", { name: "Expand", exact: true }).first().click();
	await expect(page.getByText(new RegExp(`${fullName} vs `)).first()).toBeVisible();
	const event = page.getByRole("link", { name: /Dual|Invitational|Tournament|Classic|Open|Challenge|Sectional/ }).first();
	await expect(event).toHaveAttribute("href", /^\/demo\/events\/demo-event-/);
	await page.goto(await event.getAttribute("href") ?? "");
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	await expect(page.getByRole("columnheader", { name: "Winner", exact: true })).toBeVisible();
	await expect(page.getByRole("link", { name: fullName, exact: true }).first()).toBeVisible();
});

test("live authorization failures explain the restriction and lead to demo", async ({ page }) => {
	await page.unroute(/https:\/\/([^/]+\.)?flowrestling\.org\//);
	await page.route("https://floarena-api.flowrestling.org/**", route => route.fulfill({ status: 401, body: "Unauthorized" }));
	await page.goto(`/athletes/${personId(0)}`);
	await expect(page.getByRole("alert")).toContainText("401 Unauthorized");
	await expect(page.getByText("Loading athlete data", { exact: false })).toHaveCount(0);
	await page.getByRole("link", { name: "Explore Interactive Demo" }).click();
	await expect(page).toHaveURL(/\/demo$/);
	await expect(page.getByRole("heading", { name: "Demo dataset" })).toBeVisible();
});
