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
	canonicalId: string;
	wrestlers: AthleteWrestlers;
	bouts: AthleteBouts;
	basicInfo: BasicInfo;
};

type LoadCountCallback = (kind: "wrestlers" | "bouts", loaded: number, total: number) => void;
type ProgressCallback = (progress: number) => void;

export async function fetchMergedAthleteData(
	id: string,
	onProgress?: ProgressCallback,
	onLoadCount?: LoadCountCallback,
): Promise<AthleteDataBundle> {
	const aliases = expandToAliases(id);
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
		data: wrestlerResponses.flatMap(response => response.data),
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

	rewriteAliasedWrestlers(wrestlers, bouts, aliasSet, canonicalId);
	sortWrestlersByEventDate(wrestlers);

	return {
		aliases,
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
				const current = top?.attributes.identityPersonId === identityPersonId ? top : bottom;
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
	for (const wrestler of wrestlers.data) {
		if (aliasSet.has(wrestler.attributes.identityPersonId)) wrestler.attributes.identityPersonId = canonicalId;
	}
	for (const item of bouts.included) {
		if (item.type === "wrestler" && aliasSet.has(item.attributes.identityPersonId)) {
			item.attributes.identityPersonId = canonicalId;
		}
	}
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
