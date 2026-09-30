import { beforeEach, describe, expect, it, vi } from "vitest";
import FloAPI from "./FloAPI";

class MockXHR {
	static last: MockXHR;
	status = 200;
	responseText = "{}";
	timeout = 0;
	listeners = new Map<string, (event: Partial<ProgressEvent>) => void>();
	constructor() { MockXHR.last = this; }
	open() { /* Requests are manually completed in each test. */ }
	send() { /* No network traffic. */ }
	addEventListener(name: string, callback: (event: Partial<ProgressEvent>) => void) { this.listeners.set(name, callback); }
	emit(name: string, event: Partial<ProgressEvent> = {}) { this.listeners.get(name)?.(event); }
}

beforeEach(() => { vi.stubGlobal("XMLHttpRequest", MockXHR); });

describe("API requests", () => {
	it("returns parsed JSON and monotonic progress", async () => {
		const progress: number[] = [];
		const response = FloAPI.fetchWithProgress("https://example.test", value => progress.push(value));
		MockXHR.last.emit("progress", { lengthComputable: true, loaded: 60, total: 100 });
		MockXHR.last.emit("progress", { lengthComputable: true, loaded: 30, total: 100 });
		MockXHR.last.responseText = "{\"data\":[]}";
		MockXHR.last.emit("load");
		expect(await response).toEqual({ data: [] });
		expect(progress).toEqual([60, 100]);
	});
	it("rejects HTTP errors", async () => {
		const response = FloAPI.fetchWithProgress("https://example.test");
		MockXHR.last.status = 503;
		MockXHR.last.emit("load");
		await expect(response).rejects.toThrow("503");
	});
	it("rejects malformed JSON rather than leaving a pending promise", async () => {
		const response = FloAPI.fetchWithProgress("https://example.test");
		MockXHR.last.responseText = "<html>error</html>";
		MockXHR.last.emit("load");
		await expect(response).rejects.toThrow("invalid JSON");
	});
	it.each(["error", "timeout", "abort"])("rejects %s events", async event => {
		const response = FloAPI.fetchWithProgress("https://example.test");
		MockXHR.last.emit(event);
		await expect(response).rejects.toThrow();
	});
});

describe("pagination", () => {
	it.each(["fetchAllWrestlers", "fetchAllBouts"] as const)("%s follows pages and clears the next link", async method => {
		const fetch = vi.spyOn(FloAPI, "fetchWithProgress");
		fetch.mockResolvedValueOnce({ data: [{ id: "first" }], included: [], meta: { total: 2 }, links: { next: "https://example.test/page2" } });
		fetch.mockResolvedValueOnce({ data: [{ id: "second" }], included: [], meta: { total: 2 }, links: {} });
		const progress: number[] = [];
		const callback = (value: number) => { progress.push(value); };
		const result = method === "fetchAllBouts"
			? await FloAPI.fetchAllBouts("person", callback)
			: await FloAPI.fetchAllWrestlers("person", callback);
		expect(result.data).toHaveLength(2);
		expect(result.meta.total).toBe(2);
		expect(result.links?.next).toBeUndefined();
		expect(progress).toEqual([...progress].sort((a, b) => a - b));
		expect(progress[progress.length - 1]).toBe(100);
	});
	it("detects pagination cycles", async () => {
		vi.spyOn(FloAPI, "fetchWithProgress")
			.mockResolvedValueOnce({ data: [], included: [], meta: { total: 5 }, links: { next: "https://example.test/page2" } })
			.mockResolvedValue({ data: [], included: [], meta: { total: 5 }, links: { next: "https://example.test/page2" } });
		await expect(FloAPI.fetchAllBouts("person")).rejects.toThrow("repeated a page");
	});
	it("handles an empty result without non-finite progress", async () => {
		vi.spyOn(FloAPI, "fetchWithProgress").mockResolvedValue({ data: [], included: [], meta: { total: 0 } });
		const progress: number[] = [];
		await FloAPI.fetchAllBouts("person", value => progress.push(value));
		expect(progress.every(Number.isFinite)).toBe(true);
		expect(progress[progress.length - 1]).toBe(100);
	});
});
