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

	public static fetchBouts<R extends RelationshipToBout | void, I extends Exclude<FloObject, BoutObject> | void>(athleteId: UUID, config: FetchConfig, include: readonly BoutsIncludeString[] = ["bottomWrestler.team", "topWrestler.team", "weightClass", "topWrestler.division", "bottomWrestler.division", "event","roundName"], extra?: string): Promise<BoutsResponse<R, I>> {
		return this.fetchWithProgressTyped<BoutObject, R, I>(`https://floarena-api.flowrestling.org/bouts/?identityPersonId=${athleteId}&page[size]=${config.pageSize}&page[offset]=${config.pageOffset}&hasResult=true` + (include.length ? `&include=${include.join(",")}` : "") + (extra ?? ""), config.onProgress);
	}

	public static async fetchAllBouts<R extends RelationshipToBout | void, I extends Exclude<FloObject, BoutObject> | void>(athleteId: UUID, onProgress?: (progress: number) => void, include: readonly BoutsIncludeString[] = ["bottomWrestler.team", "topWrestler.team", "weightClass", "topWrestler.division", "bottomWrestler.division", "event","roundName"], extra?: string): Promise<BoutsResponse<R, I>> {
		// Track the highest progress reported to ensure monotonic progress
		let lastReportedProgress = 0;

		// Helper to report progress only if it increases
		const reportProgress = (progress: number) => {
			if (onProgress && progress > lastReportedProgress) {
				lastReportedProgress = progress;
				onProgress(progress);
			}
		};

		// Fetch the first 40 items
		let totalData = await this.fetchBouts<R, I>(athleteId, { pageSize: 40, pageOffset: 0 }, include, extra);

		// Get the total count from meta
		const totalCount = totalData.meta?.total ?? totalData.data.length;

		// Report initial progress
		reportProgress((totalData.data.length / totalCount) * 100);

		let currentLink = `https://floarena-api.flowrestling.org/bouts/?identityPersonId=${athleteId}&page[size]=40&page[offset]=0&hasResult=true` + (include.length ? `&include=${include.join(",")}` : "") + (extra ?? "");

		// Keep fetching while there's a next link that's different from the current link
		while (totalData.links.next && totalData.links.next !== currentLink) {
			// Calculate progress for this page
			const currentItemCount = totalData.data.length;
			const baseProgress = (currentItemCount / totalCount) * 100;
			const pageSize = 40; // Assumed page size
			const progressPerPage = (pageSize / totalCount) * 100;

			// Fetch with progress tracking for individual page download
			const nextData = await this.fetchWithProgressTyped<BoutObject, R, I>(
				totalData.links.next,
				(pageProgress) => {
					// Combine base progress with current page's progress
					const totalProgress = baseProgress + (pageProgress / 100) * progressPerPage;
					reportProgress(Math.min(totalProgress, 100));
				}
			);

			// Append the data to totalData
			totalData.data = [...totalData.data, ...nextData.data];
			if (nextData.included) {
				totalData.included = [...totalData.included, ...nextData.included];
			}

			// Report progress based on cumulative data length after page completes
			reportProgress((totalData.data.length / totalCount) * 100);

			// Update the current link for next iteration
			currentLink = totalData.links.next;
			totalData.links.next = nextData.links.next;
		}

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