import type { FloObject } from "../api/types/types";
import type { SearchResultPerson } from "../api/types/responses";
import { generateDataset, type DemoDataset, type DemoPerson } from "./generator";

let dataset: DemoDataset | undefined;
/** Loaded lazily, generated once per page session, and indexed for every subsequent lookup. */
export function getDemoDataset(): DemoDataset {
	return dataset ??= generateDataset();
}

function personResult(person: DemoPerson): SearchResultPerson {
	const team = getDemoDataset().teams[person.team];
	const name = `${person.first} ${person.last}`;
	return {
		arena_person_identity_id: person.id, asset: { size_label: "", raw_url: "", id: person.node, title: name, source: "demo", url: "", status_code: 200, path: "", copied: false, duplicated: false, file_type: "", created_at: "2022-01-01", modified_at: "2022-01-01" },
		node: { id: person.node }, asset_url: "", birth_date: null, created_at: "2022-01-01", name, first_name: person.first, middle_name: null, last_name: person.last, nickname: null, title: name, short_title: name, slug: person.id, slug_uri: `/demo/athletes/${person.id}`, status: 1, status_color: "", status_text: "Synthetic", thumbnail_url: "", type: "person", shareable_link: `/demo/athletes/${person.id}`, is_flo_college: false, gender: "m", high_school_grad_year: person.graduation, id: person.node,
		location: { city: team.attributes.city!, country: "USA", google_place_id: "", id: person.team, lattitude: 0, longitude: 0, name: team.attributes.name, state: "MA", street: null, timezone: "America/New_York", zip_code: null }, modified_at: "2022-01-01",
	};
}

/** Include only the relationship closure, rather than shipping the entire league per athlete. */
export function includedFor(objects: FloObject[], league = getDemoDataset()): FloObject[] {
	const included = new Map<string, FloObject>();
	const visit = (type: string, id: string | null | undefined) => {
		if (!id) return;
		const key = `${type}:${id}`;
		if (included.has(key)) return;
		const object = league.objects.get(key);
		if (!object) return;
		included.set(key, object);
		if (object.type === "bout") {
			visit("wrestler", object.attributes.topWrestlerId);
			visit("wrestler", object.attributes.bottomWrestlerId);
			visit("roundName", object.attributes.roundNameId);
		}
		if (object.type === "wrestler") {
			visit("team", object.attributes.teamId);
			visit("division", object.attributes.divisionId);
			visit("weightClass", object.attributes.weightClassId);
			const registration = league.registrationsById.get(object.id);
			for (const placement of registration?.relationships.bracketPlacements.data ?? []) visit("bracketPlacement", placement.id);
		}
		if ("eventId" in object.attributes) visit("event", object.attributes.eventId);
		if ("weightClassId" in object.attributes) visit("weightClass", object.attributes.weightClassId);
	};
	for (const object of objects) visit(object.type, object.id);
	return [...included.values()];
}

/** Compatible responses for every existing FloAPI entry point. Never falls through to the network. */
export function demoRequest<T>(rawUrl: string, onProgress?: (progress: number) => void): Promise<T> {
	const league = getDemoDataset();
	const url = new URL(rawUrl);
	let result: unknown;
	if (url.pathname.endsWith("/search")) {
		const query = (url.searchParams.get("q") ?? "").toLowerCase().trim();
		const broad = url.searchParams.get("useOfp") === "true";
		const tokens = query.split(/\s+/).filter(Boolean);
		const matches = league.people.filter(p => {
			const name = `${p.first} ${p.last}`.toLowerCase();
			const searchable = broad ? `${name} ${league.teams[p.team].attributes.name.toLowerCase()}` : name;
			return tokens.every(token => searchable.includes(token));
		});
		const limit = Math.max(1, Number(url.searchParams.get("limit")) || 10);
		const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
		const slice = matches.slice((page - 1) * limit, page * limit);
		result = { data: slice.map(personResult), meta: { duration: 0, limit, max_limit: 1000, max_pages: 1000, offset: (page - 1) * limit, page, pages: Math.ceil(matches.length / limit), sites: [2], source: "synthetic", total: matches.length, type: "person", extra: [{ response: { ids: { person: slice.map(p => p.id) }, sortSeq: {} } }] } };
	} else if (url.pathname.includes("/from-node/")) {
		const person = league.people.find(p => p.node === Number(url.pathname.split("/").pop()));
		if (!person) throw new Error("This fictional wrestler was not found. Browse the demo to choose another athlete.");
		const original = personResult(person);
		result = { data: { ...original, original_entity: original, arena_person_identity_id: person.id } };
	} else if (["/wrestlers/", "/bouts/"].includes(url.pathname)) {
		const id = url.searchParams.get("identityPersonId");
		const weight = url.searchParams.get("weightClassId");
		if (id && !league.registrationsByPerson.has(id)) throw new Error("This athlete is not in the fictional dataset. Use demo search to find a wrestler.");
		const all = url.pathname === "/bouts/" ? league.boutsByPerson.get(id ?? "") ?? [] : weight ? league.registrations.filter(r => r.attributes.weightClassId === weight) : league.registrationsByPerson.get(id ?? "") ?? [];
		const size = Math.max(1, Number(url.searchParams.get("page[size]")) || 40);
		const offset = Math.max(0, Number(url.searchParams.get("page[offset]")) || 0);
		const page = all.slice(offset, offset + size);
		const next = new URL(url);
		next.searchParams.set("page[offset]", String(offset + size));
		result = { data: page, included: includedFor(page, league), meta: { total: all.length }, links: { first: rawUrl, next: offset + size < all.length ? next.toString() : undefined } };
	} else {
		throw new Error("This request is not supported by the fictional dataset.");
	}
	onProgress?.(100);
	// Existing alias merging rewrites response objects; keep the cached league immutable.
	return Promise.resolve(structuredClone(result) as T);
}
