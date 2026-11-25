import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
	vi.resetModules();
	vi.stubEnv("VITE_FLOSTATS_API_URL", "https://api.flostats.com");
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

it("uses the archive for identity-filtered match requests", async () => {
	const open = vi.fn<(method: string, url: string) => void>();
	class XHR {
		status = 200;
		responseText = "{\"data\":[]}";
		timeout = 0;
		listeners = new Map<string, () => void>();
		open = open;
		addEventListener(name: string, callback: () => void) { this.listeners.set(name, callback); }
		send() { this.listeners.get("load")?.(); }
	}
	vi.stubGlobal("XMLHttpRequest", XHR);
	const { default: FloAPI } = await import("./FloAPI");
	await FloAPI.fetchBouts("person", {pageSize: 40, pageOffset: 0});
	expect(open.mock.calls[0][1]).toMatch(/^https:\/\/api\.flostats\.com\/bouts\/\?identityPersonId=person/);
});

it("reuses linked identities and queues unresolved identities only once per lookup", async () => {
	const fetch = vi.fn<typeof globalThis.fetch>()
		.mockResolvedValueOnce(Response.json({state: "linked", linkedRegistrations: 2}))
		.mockResolvedValueOnce(Response.json({state: "unresolved", linkedRegistrations: 0}))
		.mockResolvedValueOnce(Response.json({state: "awaiting_source"}, {status: 202}));
	vi.stubGlobal("fetch", fetch);
	const { default: FloAPI } = await import("./FloAPI");
	expect(await FloAPI.prepareArchiveIdentity("linked")).toBe(true);
	expect(await FloAPI.prepareArchiveIdentity("unknown")).toBe(false);
	expect(fetch).toHaveBeenCalledTimes(3);
	expect(fetch.mock.calls[2][1]).toEqual({method: "POST"});
});

it("polls identity status without writing to the queue again", async () => {
	const fetch = vi.fn<typeof globalThis.fetch>()
		.mockResolvedValueOnce(Response.json({state: "awaiting_source", linkedRegistrations: 0}))
		.mockResolvedValueOnce(Response.json({state: "complete", linkedRegistrations: 2}));
	vi.stubGlobal("fetch", fetch);
	const { default: FloAPI } = await import("./FloAPI");
	const controller = new AbortController();
	expect(await FloAPI.checkArchiveIdentity("pending", controller.signal)).toBe(false);
	expect(await FloAPI.checkArchiveIdentity("pending", controller.signal)).toBe(true);
	expect(fetch.mock.calls.every(([, init]) => init?.method === undefined && init?.signal === controller.signal)).toBe(true);
});
