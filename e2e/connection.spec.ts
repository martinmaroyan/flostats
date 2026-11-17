import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.route(/googletagmanager|googlesyndication/, route => route.abort());
	page.on("pageerror", error => { throw error; });
});

test("manually compares credentialed and anonymous API requests without paging", async ({ page }) => {
	const requests: string[] = [];
	await page.addInitScript(() => {
		const original = window.fetch.bind(window);
		const modes: string[] = [];
		Object.assign(window, { connectionTestModes: modes });
		window.fetch = (input, init) => {
			if (String(input).includes("floarena-api.flowrestling.org")) modes.push(init?.credentials ?? "same-origin");
			return original(input, init);
		};
	});
	await page.route("https://floarena-api.flowrestling.org/**", async route => {
		requests.push(route.request().url());
		const url = new URL(route.request().url());
		expect(url.searchParams.get("page[size]")).toBe("1");
		expect(url.searchParams.get("page[offset]")).toBe("0");
		expect(url.searchParams.get("identityPersonId")).toBe("064ad7f4-8d16-4dd2-94b1-1dd1c45c3832");
		if (requests.length > 2) {
			await route.fulfill({ status: 401, json: { errors: [{ status: 401 }] } });
		} else {
			await route.fulfill({ json: { data: [{ type: url.pathname.includes("wrestlers") ? "wrestler" : "bout", id: "record", attributes: {} }], included: [], meta: { total: 121 } } });
		}
	});
	await page.goto("/connection-test");
	await expect(page.getByRole("heading", { name: "Test your Flo connection" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Open FloWrestling login" })).toHaveAttribute("href", "https://www.flowrestling.org/login");
	expect(requests).toHaveLength(0);
	await page.getByRole("button", { name: "Test with browser cookies" }).click();
	await expect(page.getByText("HTTP 200", { exact: true })).toHaveCount(2);
	await expect(page.getByText("Records returned: 1 · Total: 121 · Wrestler objects: 1 · With identityPersonId: 0")).toBeVisible();
	await expect(page.getByRole("button", { name: "Compare without cookies" })).toBeEnabled();
	await page.getByRole("button", { name: "Compare without cookies" }).click();
	await expect(page.getByText("HTTP 401", { exact: true })).toBeVisible();
	expect(requests).toHaveLength(3);
	await page.screenshot({ path: `test-results/connection-${test.info().project.name}.png`, fullPage: true });
	expect(await page.evaluate(() => Reflect.get(window, "connectionTestModes") as string[])).toEqual(["include", "include", "omit"]);
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("reports an unreadable response without mislabeling it as authentication failure", async ({ page }) => {
	let count = 0;
	await page.route("https://floarena-api.flowrestling.org/**", route => { count++; return route.abort("failed"); });
	await page.goto("/connection-test");
	await page.getByRole("button", { name: "Test with browser cookies" }).click();
	await expect(page.getByText("No readable response", { exact: true })).toBeVisible();
	await expect(page.getByText(/JavaScript cannot distinguish these reliably/)).toBeVisible();
	expect(count).toBe(1);
});

test("rejects an invalid athlete UUID before requesting the API", async ({ page }) => {
	let count = 0;
	await page.route("https://floarena-api.flowrestling.org/**", route => { count++; return route.abort(); });
	await page.goto("/connection-test");
	await page.getByRole("textbox", { name: "Athlete identityPersonId" }).fill("invalid");
	await page.getByRole("button", { name: "Test with browser cookies" }).click();
	await expect(page.getByText("Enter a valid athlete UUID.")).toBeVisible();
	expect(count).toBe(0);
});
