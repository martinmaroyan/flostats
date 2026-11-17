import { BoutsIncludeAll, WrestlersIncludeAll } from "./types/types";

export type ConnectionEndpoint = "wrestlers" | "bouts";
export type ConnectionResult = {
	endpoint: ConnectionEndpoint;
	url: string;
	credentials: "include" | "omit";
	state: "success" | "http-error" | "network-error" | "invalid-response" | "timeout";
	status?: number;
	message: string;
	total?: number;
	returned?: number;
	wrestlers?: number;
	identifiedWrestlers?: number;
};

type JsonObject = Record<string, unknown>;
function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function connectionTestUrl(endpoint: ConnectionEndpoint, athleteId: string): string {
	const url = new URL(`https://floarena-api.flowrestling.org/${endpoint}/`);
	url.searchParams.set("identityPersonId", athleteId);
	url.searchParams.set("page[size]", "1");
	url.searchParams.set("page[offset]", "0");
	url.searchParams.set("include", (endpoint === "bouts" ? BoutsIncludeAll : WrestlersIncludeAll).join(","));
	if (endpoint === "bouts") url.searchParams.set("hasResult", "true");
	return url.href;
}

export async function testConnection(endpoint: ConnectionEndpoint, athleteId: string, credentials: "include" | "omit", signal: AbortSignal): Promise<ConnectionResult> {
	const url = connectionTestUrl(endpoint, athleteId);
	const base = { endpoint, url, credentials };
	const controller = new AbortController();
	const abort = () => controller.abort();
	signal.addEventListener("abort", abort, { once: true });
	if (signal.aborted) controller.abort();
	let timedOut = false;
	const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 30000);
	try {
		// Go directly to Flo: a proxy would hide the browser cookie/CORS behavior.
		const response = await fetch(url, { credentials, cache: "no-store", signal: controller.signal });
		const status = response.status;
		let body: unknown;
		try { body = await response.json(); } catch {
			if (controller.signal.aborted) throw new Error("Request aborted");
			return { ...base, status, state: response.ok ? "invalid-response" : "http-error", message: "The API returned a non-JSON response." };
		}
		if (!response.ok) {
			return { ...base, status, state: "http-error", message: status === 401 || status === 403
				? "Flo rejected this request. Sign in, then retry with cookies. If already signed in, cookies may be expired or withheld by the browser."
				: status === 429 ? "Flo rate limited this request. Wait before trying again." : "Flo returned an HTTP error." };
		}
		if (!isObject(body) || !Array.isArray(body.data) || body.errors || (body.included !== undefined && !Array.isArray(body.included))) {
			return { ...base, status, state: "invalid-response", message: "The response did not have the expected JSON:API shape." };
		}
		const data = body.data as unknown[];
		const included: unknown[] = Array.isArray(body.included) ? body.included : [];
		const wrestlers = [...data, ...included].filter((item): item is JsonObject => isObject(item) && item.type === "wrestler");
		return {
			...base, status, state: "success", message: "The browser received a readable API response.",
			returned: data.length,
			total: isObject(body.meta) && typeof body.meta.total === "number" ? body.meta.total : undefined,
			wrestlers: wrestlers.length,
			identifiedWrestlers: wrestlers.filter(item => isObject(item.attributes) && Boolean(item.attributes.identityPersonId)).length,
		};
	} catch {
		if (signal.aborted) throw new Error("Connection test cancelled");
		return { ...base, state: timedOut ? "timeout" : "network-error", message: timedOut
			? "No response within 30 seconds."
			: "The browser could not expose a response. Check DevTools for CORS, blocked cookies, extensions, or network errors; JavaScript cannot distinguish these reliably." };
	} finally {
		window.clearTimeout(timeout);
		signal.removeEventListener("abort", abort);
	}
}
