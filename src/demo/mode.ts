/** The URL is the source of truth: demo links also work in a new tab or browser. */
export function isDemoMode(): boolean {
	return typeof window !== "undefined" && /^\/demo(?:\/|$)/.test(window.location.pathname);
}

export function normalizeDemoUrl(): void {
	const url = new URL(window.location.href);
	if (url.searchParams.get("demo") !== "1") return;
	url.searchParams.delete("demo");
	if (!isDemoMode()) url.pathname = `/demo${url.pathname === "/" ? "" : url.pathname}`;
	window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

export function siteBase(): string {
	return `https://flostats.com${isDemoMode() ? "/demo" : ""}`;
}
