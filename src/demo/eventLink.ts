import { isDemoMode } from "./mode";
export function eventLink(id: string | undefined): string {
	return isDemoMode() ? `/events/${id ?? ""}` : `https://arena.flowrestling.org/event/${id ?? ""}`;
}
