import { MaTournamentType } from "./seedingCriteria";
import { expandToAliases } from "./aliases";

export type PlacementEntry = {
	type: MaTournamentType;
	tournament: string;
	date: string | null;
	weightClass: string | null;
	place: number;
	points: number;
};

export type PersonRecord = {
	fullName: string | null;
	highestType: MaTournamentType;
	highestPoints: number;
	placements: PlacementEntry[];
};

export type PlacementIndex = {
	year: number;
	builtAt: string;
	source: string;
	personCount: number;
	byPerson: Record<string, PersonRecord>;
};

export type ManifestEntry = { year: number; personCount: number; builtAt: string };
export type Manifest = { indexes: ManifestEntry[] };

const indexCache = new Map<number, Promise<PlacementIndex>>();
let manifestCache: Promise<Manifest> | null = null;

const BASE = `${import.meta.env.BASE_URL}seeding`;

export function loadManifest(): Promise<Manifest> {
	if (!manifestCache) {
		manifestCache = fetch(`${BASE}/manifest.json`).then(r => {
			if (!r.ok) throw new Error(`manifest fetch failed: ${r.status}`);
			return r.json() as Promise<Manifest>;
		}).catch((error: unknown) => { manifestCache = null; throw error; });
	}
	return manifestCache;
}

export function loadPlacementIndex(year: number): Promise<PlacementIndex> {
	let p = indexCache.get(year);
	if (!p) {
		p = fetch(`${BASE}/${year}.json`).then(r => {
			if (!r.ok) throw new Error(`index fetch for ${year} failed: ${r.status}`);
			return r.json() as Promise<PlacementIndex>;
		}).catch((error: unknown) => { indexCache.delete(year); throw error; });
		indexCache.set(year, p);
	}
	return p;
}

export function lookup(index: PlacementIndex, identityPersonId: string): PersonRecord | null {
	const records = expandToAliases(identityPersonId).flatMap(id => index.byPerson[id] ? [index.byPerson[id]] : []);
	if (!records.length) return null;
	const best = records.reduce((a, b) => a.highestPoints >= b.highestPoints ? a : b);
	return { ...best, placements: records.flatMap(record => record.placements).sort((a, b) => b.points - a.points) };
}
