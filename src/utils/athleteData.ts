import dayjs from "dayjs";
import FloAPI from "../api/FloAPI";
import { BoutObject } from "../api/types/objects/bout";
import { EventObject } from "../api/types/objects/event";
import { TeamAttributes, TeamObject } from "../api/types/objects/team";
import { WrestlerObject } from "../api/types/objects/wrestler";
import { AllBoutRelationships, AllWrestlerRelationships } from "../api/types/relationships";
import { BoutsResponse, WrestlersResponse } from "../api/types/responses";
import { BoutsIncludeAll, FloObject, WrestlersIncludeAll } from "../api/types/types";
import { BasicInfo } from "../components/GeneralInfoDisplay";
import { expandToAliases, getCanonicalId } from "./aliases";

export type AthleteBouts = BoutsResponse<AllBoutRelationships, Exclude<FloObject, BoutObject>>;
export type AthleteWrestlers = WrestlersResponse<AllWrestlerRelationships, Exclude<FloObject, WrestlerObject>>;

export type AthleteDataBundle = {
	aliases: string[];
	availableAliases: string[];
	canonicalId: string;
	wrestlers: AthleteWrestlers;
	bouts: AthleteBouts;
	basicInfo: BasicInfo;
};

type LoadCountCallback = (kind: "wrestlers" | "bouts", loaded: number, total: number) => void;
type ProgressCallback = (progress: number) => void;
export type IdentityLookupStage = "checking" | "waiting" | "loading";
export const IDENTITY_POLL_INTERVAL_MS = 5_000;
export const IDENTITY_WAIT_LIMIT_MS = 120_000;
type AthleteLoadOptions = {
	signal?: AbortSignal;
	onLookupStage?: (stage: IdentityLookupStage) => void;
};

function pollDelay(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) { reject(signal.reason); return; }
		const abort = () => { clearTimeout(timer); reject(signal.reason); };
		const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
		signal.addEventListener("abort", abort, { once: true });
	});
}

async function resolveAvailableAliases(ids: string[], { signal, onLookupStage }: AthleteLoadOptions): Promise<string[]> {
	const controller = new AbortController();
	const abort = () => controller.abort(signal?.reason);
	if (signal?.aborted) abort();
	else signal?.addEventListener("abort", abort, { once: true });
	const timeoutError = new Error("The identity lookup is still pending. Try again in a moment.");
	const timeout = setTimeout(() => controller.abort(timeoutError), IDENTITY_WAIT_LIMIT_MS);
	try {
		controller.signal.throwIfAborted();
		onLookupStage?.("checking");
		let availability = await Promise.all(ids.map(id => FloAPI.prepareArchiveIdentity(id, controller.signal)));
		// Don't hold an existing merged profile back because one of its other IDs is unresolved.
		if (!availability.some(Boolean)) {
			onLookupStage?.("waiting");
			while (!availability.some(Boolean)) {
				await pollDelay(IDENTITY_POLL_INTERVAL_MS, controller.signal);
				availability = await Promise.all(ids.map(id => FloAPI.checkArchiveIdentity(id, controller.signal)));
				controller.signal.throwIfAborted();
			}
		}
		controller.signal.throwIfAborted();
		onLookupStage?.("loading");
		return ids.filter((_, index) => availability[index]);
	} catch (error) {
		if (controller.signal.aborted) throw controller.signal.reason;
		throw error;
	} finally {
		clearTimeout(timeout);
		signal?.removeEventListener("abort", abort);
		controller.abort();
	}
}

export async function fetchMergedAthleteData(
	id: string,
	onProgress?: ProgressCallback,
	onLoadCount?: LoadCountCallback,
	options: AthleteLoadOptions = {},
): Promise<AthleteDataBundle> {
	const allAliases = expandToAliases(id);
	const aliases = await resolveAvailableAliases(allAliases, options);
	const canonicalId = getCanonicalId(id);
	const aliasSet = new Set(aliases);
	const wrestlerCounts = new Map<string, { loaded: number; total: number }>();
	const boutCounts = new Map<string, { loaded: number; total: number }>();
	const progressLanes = new Map<string, number>();

	for (const alias of aliases) {
		progressLanes.set(laneKey("wrestlers", alias), 0);
		progressLanes.set(laneKey("bouts", alias), 0);
	}

	let lastProgress = 0;
	const aggregate = (counts: Map<string, { loaded: number; total: number }>) => {
		let loaded = 0;
		let total = 0;
		for (const count of counts.values()) {
			loaded += count.loaded;
			total += count.total;
		}
		return { loaded, total };
	};
	const pushProgress = () => {
		const totalProgress = [...progressLanes.values()].reduce((total, progress) => total + progress, 0);
		const progress = Math.min(100, totalProgress / progressLanes.size);
		if (progress > lastProgress) {
			lastProgress = progress;
			onProgress?.(progress);
		}
	};
	const updateLaneProgress = (kind: "wrestlers" | "bouts", alias: string, progress: number) => {
		const key = laneKey(kind, alias);
		const currentProgress = progressLanes.get(key) ?? 0;
		const nextProgress = Math.max(currentProgress, Math.min(100, progress));
		progressLanes.set(key, nextProgress);
		pushProgress();
	};

	const responses = await Promise.all(aliases.flatMap(alias => [
		FloAPI.fetchAllWrestlers<AllWrestlerRelationships, Exclude<FloObject, WrestlerObject>>(
			alias,
			progress => updateLaneProgress("wrestlers", alias, progress),
			WrestlersIncludeAll,
			undefined,
			(loaded, total) => {
				wrestlerCounts.set(alias, { loaded, total });
				const count = aggregate(wrestlerCounts);
				onLoadCount?.("wrestlers", count.loaded, count.total);
			},
		),
		FloAPI.fetchAllBouts<AllBoutRelationships, Exclude<FloObject, BoutObject>>(
			alias,
			progress => updateLaneProgress("bouts", alias, progress),
			BoutsIncludeAll,
			undefined,
			(loaded, total) => {
				boutCounts.set(alias, { loaded, total });
				const count = aggregate(boutCounts);
				onLoadCount?.("bouts", count.loaded, count.total);
			},
		),
	]));

	const wrestlerResponses = responses.filter((_, index) => index % 2 === 0) as AthleteWrestlers[];
	const boutResponses = responses.filter((_, index) => index % 2 === 1) as AthleteBouts[];

	const wrestlers: AthleteWrestlers = {
		data: dedupeByObjectId(wrestlerResponses.flatMap(response => response.data)),
		included: dedupeByObjectId(wrestlerResponses.flatMap(response => response.included)),
		meta: { total: wrestlerResponses.reduce((total, response) => total + response.data.length, 0) },
		links: wrestlerResponses[0]?.links,
	};
	const bouts: AthleteBouts = {
		data: dedupeByObjectId(boutResponses.flatMap(response => response.data)),
		included: dedupeByObjectId(boutResponses.flatMap(response => response.included)),
		meta: { total: boutResponses.reduce((total, response) => total + response.data.length, 0) },
		links: boutResponses[0]?.links,
	};

	wrestlers.meta.total = wrestlers.data.length;
	bouts.meta.total = bouts.data.length;
	rewriteAliasedWrestlers(wrestlers, bouts, aliasSet, canonicalId);
	sortWrestlersByEventDate(wrestlers);

	return {
		aliases: allAliases,
		availableAliases: aliases,
		canonicalId,
		wrestlers,
		bouts,
		basicInfo: buildBasicInfo(wrestlers, bouts, canonicalId),
	};
}

function laneKey(kind: "wrestlers" | "bouts", alias: string): string {
	return `${kind}:${alias}`;
}

export function buildBasicInfo(wrestlers: AthleteWrestlers, bouts: AthleteBouts, identityPersonId: string): BasicInfo {
	const teamIdentityIds = [...new Set(wrestlers.data
		.map(wrestler => FloAPI.findIncludedObjectById<TeamObject>(wrestler.attributes.teamId, "team", wrestlers))
		.map(team => team?.attributes.identityTeamId)
		.filter((team): team is string => typeof team === "string"))];
	const teamBasics = teamIdentityIds
		.map(teamId => wrestlers.included.find(item => item.type === "team" && item.attributes.identityTeamId === teamId)?.attributes)
		.filter((team): team is TeamAttributes => Boolean(team));
	const firstName = wrestlers.data.find(wrestler => wrestler.attributes.firstName)?.attributes.firstName;
	const lastName = wrestlers.data.find(wrestler => wrestler.attributes.lastName)?.attributes.lastName;
	const dateOfBirth = wrestlers.data.find(wrestler => wrestler.attributes.dateOfBirth)?.attributes.dateOfBirth;

	return {
		name: [firstName, lastName].filter(Boolean).join(" ") || "Unknown Wrestler",
		dateOfBirth: dateOfBirth ? dayjs(dateOfBirth) : undefined,
		grade: wrestlers.data.find(wrestler => wrestler.attributes.grade)?.attributes.grade,
		teams: teamBasics.map(team => ({
			attributes: team,
			matches: bouts.data.filter(bout => {
				const top = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.topWrestlerId, "wrestler", bouts);
				const bottom = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.bottomWrestlerId, "wrestler", bouts);
				const current = top?.attributes.identityPersonId === identityPersonId ? top
					: bottom?.attributes.identityPersonId === identityPersonId ? bottom : undefined;
				return current
					? FloAPI.findIncludedObjectById<TeamObject>(current.attributes.teamId, "team", bouts)?.attributes.identityTeamId === team.identityTeamId
					: false;
			}),
		})),
	};
}

function dedupeByObjectId<T extends { type: string; id: string }>(items: T[]): T[] {
	const seen = new Set<string>();
	const output: T[] = [];
	for (const item of items) {
		const key = `${item.type}:${item.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		output.push(item);
	}
	return output;
}

function rewriteAliasedWrestlers(
	wrestlers: AthleteWrestlers,
	bouts: AthleteBouts,
	aliasSet: Set<string>,
	canonicalId: string,
) {
	// The filtered /wrestlers response is authoritative even when identityPersonId
	// is omitted. Only registrations returned for these aliases belong to this athlete.
	const registrationIds = new Set(wrestlers.data.map(wrestler => wrestler.id));
	for (const wrestler of wrestlers.data) {
		wrestler.attributes.identityPersonId = canonicalId;
	}
	for (const item of bouts.included) {
		if (item.type !== "wrestler") continue;
		const identity = item.attributes.identityPersonId;
		if (registrationIds.has(item.id) || (identity && aliasSet.has(identity))) {
			item.attributes.identityPersonId = canonicalId;
		} else if (identity) {
			item.attributes.identityPersonId = getCanonicalId(identity);
		}
	}
	// Included expansions may omit the athlete's registration. Keep it available
	// for the existing winner/opponent joins without discarding expanded attributes.
	bouts.included = dedupeByObjectId([...bouts.included, ...wrestlers.data]);
}

function sortWrestlersByEventDate(wrestlers: AthleteWrestlers) {
	wrestlers.data.sort((a, b) => {
		const aEvent = FloAPI.findIncludedObjectById<EventObject>(a.attributes.eventId, "event", wrestlers);
		const bEvent = FloAPI.findIncludedObjectById<EventObject>(b.attributes.eventId, "event", wrestlers);
		const aDate = aEvent?.attributes.endDateTime ?? aEvent?.attributes.startDateTime;
		const bDate = bEvent?.attributes.endDateTime ?? bEvent?.attributes.startDateTime;

		return dayjs(aDate).isBefore(dayjs(bDate)) ? 1 : dayjs(aDate).isAfter(dayjs(bDate)) ? -1 : 0;
	});
}
