import { BaseResponse, BoutsResponse, NodeResult, SearchResultPerson, SearchResultPersonUseOfp, SearchResults, WrestlersResponse } from "./types/responses";
import { BoutsIncludeString, FloObject, FloObjectTypeString, UUID, WrestlersIncludeString } from "./types/types";
import { Relationship, RelationshipToBout, RelationshipToWrestler } from "./types/relationships";
import { WrestlerObject } from "./types/objects/wrestler";
import { BoutObject } from "./types/objects/bout";

export type FetchConfig = {
	pageSize: number;
	pageOffset: number;
	onProgress?: (progress: number) => void;
}

export type SearchResultsTyped<O extends boolean> = O extends true ? SearchResults<SearchResultPersonUseOfp> : SearchResults<SearchResultPerson>;

export default class FloAPI {
	public static searchByName<T extends boolean>(name: string, { limit, page, onProgress, useOfp }: { limit: number, page: number, onProgress: (v: number) => void, useOfp: T }): Promise<SearchResultsTyped<T>> {
		return this.fetchWithProgress<SearchResultsTyped<T>>(`https://api.flowrestling.org/api/experiences/web/legacy-core/search?site_id=2&version=1.33.2&limit=${limit}&view=global-search-web&fields=data%3C1%3E&q=${encodeURIComponent(name)}&page=${page}&type=person` + (useOfp ? "&useOfp=true" : ""), onProgress);
	}

	public static fetchWithProgress<T>(url: string, onProgress?: (progress: number) => void): Promise<T> {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open("GET", url, true);

			// Track last reported progress to ensure monotonic updates
			let lastProgress = 0;

			xhr.addEventListener("progress", e => {
				if (e.lengthComputable && onProgress) {
					const progress = (e.loaded / e.total) * 100;
					// Only report if progress increases (monotonic guarantee)
					if (progress > lastProgress) {
						lastProgress = progress;
						onProgress(progress);
					}
				}
			});
			xhr.addEventListener("load", () => {
				if (onProgress) onProgress(100);
				resolve(JSON.parse(xhr.responseText) as T);
			});
			xhr.addEventListener("error", reject);
			xhr.send();
		});
	}

	public static fetchWithProgressTyped<O extends FloObject, R extends Relationship | void, I = Exclude<FloObject, O> | void>(url: string, onProgress?: (progress: number) => void): Promise<BaseResponse<O, R, I>> {
		return this.fetchWithProgress<BaseResponse<O, R, I>>(url, onProgress);
	}

	public static fetchWrestlersByAthleteId<R extends RelationshipToWrestler | void, I extends Exclude<FloObject, WrestlerObject> | void>(athleteId: UUID, config: FetchConfig, include: readonly WrestlersIncludeString[] = ["bracketPlacements.weightClass", "division", "event", "weightClass", "team"], extra?: string): Promise<WrestlersResponse<R, I>> {
		return this.fetchWithProgressTyped<WrestlerObject, R, I>(`https://floarena-api.flowrestling.org/wrestlers/?identityPersonId=${athleteId}&orderBy=eventEndDateTime&orderDirection=desc&page[size]=${config.pageSize}&page[offset]=${config.pageOffset}` + (include.length ? `&include=${include.join(",")}` : "") + (extra ?? ""), config.onProgress);
	}

	public static async fetchAllWrestlers<R extends RelationshipToWrestler | void, I extends Exclude<FloObject, WrestlerObject> | void>(athleteId: UUID, onProgress?: (progress: number) => void, include: readonly WrestlersIncludeString[] = ["bracketPlacements.weightClass", "division", "event", "weightClass", "team"], extra?: string, onCount?: (loaded: number, total: number) => void): Promise<WrestlersResponse<R, I>> {
		const totalData = await this.fetchWrestlersByAthleteId<R, I>(athleteId, { pageSize: 40, pageOffset: 0 }, include, extra);
		const totalCount = Math.max(totalData.meta?.total ?? totalData.data.length, totalData.data.length);

		onCount?.(totalData.data.length, totalCount);
		onProgress?.(totalCount > 0 ? (totalData.data.length / totalCount) * 100 : 100);

		let currentLink = `https://floarena-api.flowrestling.org/wrestlers/?identityPersonId=${athleteId}&orderBy=eventEndDateTime&orderDirection=desc&page[size]=40&page[offset]=0` + (include.length ? `&include=${include.join(",")}` : "") + (extra ?? "");
		let nextLink = totalData.links?.next;

		while (nextLink && nextLink !== currentLink) {
			const nextData = await this.fetchWithProgressTyped<WrestlerObject, R, I>(nextLink);
			totalData.data = [...totalData.data, ...nextData.data];
			if (nextData.included) totalData.included = [...totalData.included, ...nextData.included];

			onCount?.(totalData.data.length, Math.max(totalCount, totalData.data.length));
			onProgress?.(Math.min(100, (totalData.data.length / Math.max(totalCount, totalData.data.length)) * 100));

			currentLink = nextLink;
			nextLink = nextData.links?.next;
		}

		// Final flush in case meta.total under-counted.
		onCount?.(totalData.data.length, totalData.data.length);
		onProgress?.(100);
		return totalData;
	}

	public static fetchBouts<R extends RelationshipToBout | void, I extends Exclude<FloObject, BoutObject> | void>(athleteId: UUID, config: FetchConfig, include: readonly BoutsIncludeString[] = ["bottomWrestler.team", "topWrestler.team", "weightClass", "topWrestler.division", "bottomWrestler.division", "event","roundName"], extra?: string): Promise<BoutsResponse<R, I>> {
		return this.fetchWithProgressTyped<BoutObject, R, I>(`https://floarena-api.flowrestling.org/bouts/?identityPersonId=${athleteId}&page[size]=${config.pageSize}&page[offset]=${config.pageOffset}&hasResult=true` + (include.length ? `&include=${include.join(",")}` : "") + (extra ?? ""), config.onProgress);
	}

	public static async fetchAllBouts<R extends RelationshipToBout | void, I extends Exclude<FloObject, BoutObject> | void>(athleteId: UUID, onProgress?: (progress: number) => void, include: readonly BoutsIncludeString[] = ["bottomWrestler.team", "topWrestler.team", "weightClass", "topWrestler.division", "bottomWrestler.division", "event","roundName"], extra?: string, onCount?: (loaded: number, total: number) => void): Promise<BoutsResponse<R, I>> {
		const totalData = await this.fetchBouts<R, I>(athleteId, { pageSize: 40, pageOffset: 0 }, include, extra);
		const totalCount = Math.max(totalData.meta?.total ?? totalData.data.length, totalData.data.length);

		onCount?.(totalData.data.length, totalCount);
		onProgress?.(totalCount > 0 ? (totalData.data.length / totalCount) * 100 : 100);

		let currentLink = `https://floarena-api.flowrestling.org/bouts/?identityPersonId=${athleteId}&page[size]=40&page[offset]=0&hasResult=true` + (include.length ? `&include=${include.join(",")}` : "") + (extra ?? "");

		let nextLink = totalData.links?.next;
		while (nextLink && nextLink !== currentLink) {
			const nextData = await this.fetchWithProgressTyped<BoutObject, R, I>(nextLink);

			totalData.data = [...totalData.data, ...nextData.data];
			if (nextData.included) totalData.included = [...totalData.included, ...nextData.included];

			onCount?.(totalData.data.length, Math.max(totalCount, totalData.data.length));
			onProgress?.(Math.min(100, (totalData.data.length / Math.max(totalCount, totalData.data.length)) * 100));

			currentLink = nextLink;
			nextLink = nextData.links?.next;
		}

		onCount?.(totalData.data.length, totalData.data.length);
		onProgress?.(100);
		return totalData;
	}

	public static fetchWrestlersByWeightClass<R extends RelationshipToWrestler | void, I extends Exclude<FloObject, WrestlerObject> | void>(weightClassId: UUID, config: FetchConfig, include: readonly string[] = [], extra?: string): Promise<WrestlersResponse<R, I>> {
		return this.fetchWithProgressTyped<WrestlerObject, R, I>(`https://floarena-api.flowrestling.org/wrestlers/?weightClassId=${weightClassId}&page[size]=${config.pageSize}&page[offset]=${config.pageOffset}` + (include.length ? `&include=${include.join(",")}` : "") + (extra ?? ""),);
	}

	public static fetchFromNode(node: number, onProgress?: (progress: number) => void) {
		return this.fetchWithProgress<NodeResult>(`https://api.flowrestling.org/api/collections/from-node/${node}`, onProgress);
	}

	public static findIncludedObjectById<T extends FloObject>(id: UUID, type: FloObjectTypeString, res: BaseResponse<FloObject, Relationship | void, FloObject>) {
		return res.included.find(i => i.type == type && i.id == id) as T | undefined;
	}
}