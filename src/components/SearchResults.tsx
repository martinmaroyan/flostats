import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import FloAPI, { SearchResultsTyped } from "../api/FloAPI";
import { ProgressCoordinator } from "../utils/ProgressCoordinator";
import { NodeResult, SearchResultPersonUseOfp } from "../api/types/responses";
import { Alert, Badge, Button, Card, Checkbox, Group, Pagination, Skeleton, Stack, Text, Title, Tooltip } from "@mantine/core";
import dayjs from "dayjs";
import { Helmet } from "react-helmet-async";

import styles from "./SearchResults.module.css";
import { IconLink, IconLock, IconUnlink, IconUsers } from "@tabler/icons-react";
import { AliasGroup, deleteGroup, getAliasGroup, getCanonicalId, isBuiltInGroup, mergeIds, useAliasGroups } from "../utils/aliases";

const PAGE_SIZE = 10;

export default function SearchResultsPage() {
	const [searchParams, setSearchParams] = useSearchParams();

	const broadSearch = searchParams.get("ofp") === "true";
	const search = searchParams.get("q")?.trim() ?? "";
	const page = Math.max(1, Math.min(1000, Math.floor(Number(searchParams.get("page"))) || 1));
	const [loadError, setLoadError] = React.useState<string | null>(null);

	const [narrowResults, setNarrowResults] = React.useState<SearchResultsTyped<false> | null>(null);
	const [broadResults, setBroadResults] = React.useState<SearchResultsTyped<true> | null>(null);

	const [loading, setLoading] = React.useState<boolean>(false);

	const [extraData, setExtraData] = React.useState<Map<number, NodeResult>>(new Map());

	const aliasGroups = useAliasGroups();
	const [mergeMode, setMergeMode] = React.useState<boolean>(false);
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
	const toggleSelect = (id: string) => setSelectedIds(prev => {
		const next = new Set(prev);
		if (next.has(id)) next.delete(id); else next.add(id);
		return next;
	});

	const navigate = useNavigate();

	const getRedirectLink = (id: string) => {
		const returnTo = searchParams.get("returnTo");
		const selectFor = searchParams.get("selectFor");

		const a1 = searchParams.get("athlete1");
		const a2 = searchParams.get("athlete2");

		if (returnTo && selectFor) {
			const params = new URLSearchParams();
			if (a1) params.set("athlete1", a1);
			if (a2) params.set("athlete2", a2);
			params.set(selectFor, id);
			return `${returnTo}?${params.toString()}`;
		} else {
			return `/athletes/${id}`;
		}
	};

	React.useEffect(() => {
		let cancelled = false;
		setBroadResults(null);
		setNarrowResults(null);
		setExtraData(new Map());
		setSelectedIds(new Set());
		setLoadError(null);
		setLoading(Boolean(search));
		if (!search) return;
		const progressCoordinator = new ProgressCoordinator(16);
		progressCoordinator.registerOperation("order-search", 0.5);
		progressCoordinator.registerOperation("data-search", 0.5);
		progressCoordinator.start();
		void (async () => {
			try {
				const orderData = await FloAPI.searchByName(search, {
					limit: PAGE_SIZE, page, useOfp: true,
					onProgress: progress => { if (!cancelled) progressCoordinator.updateOperation("order-search", progress); },
				});
				if (cancelled) return;
				if (broadSearch) {
					setBroadResults(orderData);
					const details = await Promise.allSettled((orderData.data ?? []).map(async result =>
						[result.node.id, await FloAPI.fetchFromNode(result.node.id)] as const));
					if (cancelled) return;
					setExtraData(new Map(details.flatMap(detail => detail.status === "fulfilled" ? [detail.value] : [])));
				} else {
					const data = await FloAPI.searchByName(search, {
						limit: PAGE_SIZE, page, useOfp: false,
						onProgress: progress => { if (!cancelled) progressCoordinator.updateOperation("data-search", progress); },
					});
					if (cancelled) return;
					const sortSeq = orderData.data?.map(result => result.node.id) ?? [];
					data.data?.sort((a, b) => sortSeq.indexOf(a.id) - sortSeq.indexOf(b.id));
					setNarrowResults(data);
				}
			} catch (error) {
				if (!cancelled) setLoadError(error instanceof Error ? error.message : "Search failed");
			} finally {
				if (!cancelled) { setLoading(false); progressCoordinator.complete(); }
			}
		})();
		return () => { cancelled = true; progressCoordinator.complete(); };
	}, [search, broadSearch, page]);

	const switchPage = (page: number) => {
		setSearchParams(current => {
			const next = new URLSearchParams(current);
			next.set("page", String(page));
			return next;
		});
	};

	const broadResultsClick = (result: SearchResultPersonUseOfp) => {
		void FloAPI.fetchFromNode(result.node.id).then(data => {
			void navigate(getRedirectLink(getCanonicalId(data.data.arena_person_identity_id)));
		}).catch(error => setLoadError(error instanceof Error ? error.message : "Unable to open profile"));
	};

	return (
		<Stack>
			{loadError && <Alert color="red" title="Search failed">{loadError}</Alert>}
			{search && (
				<Helmet>
					<title>{search} - Wrestler Search Results | FloStats</title>
					<meta
						name="description"
						content={`Search results for "${search}" - Find wrestlers and view their complete match history, statistics, and career records on FloStats.`}
					/>
					<link rel="canonical" href={`https://flostats.com/search?q=${encodeURIComponent(search)}&page=${searchParams.get("page") || "1"}`} />

					{/* Open Graph */}
					<meta property="og:type" content="website" />
					<meta property="og:url" content={`https://flostats.com/search?q=${encodeURIComponent(search)}`} />
					<meta property="og:title" content={`${search} - Wrestler Search Results | FloStats`} />
					<meta
						property="og:description"
						content={`Search results for "${search}" on FloStats - Wrestling statistics and match history database.`}
					/>

					{/* Twitter */}
					<meta property="twitter:card" content="summary" />
					<meta property="twitter:url" content={`https://flostats.com/search?q=${encodeURIComponent(search)}`} />
					<meta property="twitter:title" content={`${search} - Wrestler Search | FloStats`} />
					<meta
						property="twitter:description"
						content={`Search results for "${search}" on FloStats`}
					/>
				</Helmet>
			)}
			<Title order={1}>{broadSearch ? "Broad" : "Narrow"} {loading ? "Search...": "Results"}</Title>

			<Group gap="sm" justify="flex-end" wrap="wrap">
				<Button
					size="xs"
					variant={mergeMode ? "filled" : "light"}
					leftSection={<IconUsers size={14} />}
					onClick={() => { setMergeMode(m => !m); setSelectedIds(new Set()); }}
				>
					{mergeMode ? "Done" : "Manage Merges"}
				</Button>
				{mergeMode && selectedIds.size >= 2 && (
					<Button
						size="xs"
						leftSection={<IconLink size={14} />}
						onClick={() => {
							mergeIds([...selectedIds]);
							setSelectedIds(new Set());
						}}
					>
						Merge {selectedIds.size} selected
					</Button>
				)}
			</Group>

			{mergeMode && aliasGroups.length > 0 && (
				<Card withBorder p="sm">
					<Stack gap="xs">
						<Text size="sm" fw={600}>Existing merge groups ({aliasGroups.length})</Text>
						{aliasGroups.map(g => {
							const builtIn = isBuiltInGroup(g);
							return (
								<Group key={g.join("|")} justify="space-between" wrap="nowrap">
									<Text size="xs" style={{ fontFamily: "monospace" }}>{g.map(id => id.slice(0, 8)).join(" + ")}{builtIn ? " (built-in)" : ""}</Text>
									{builtIn ? (
										<Tooltip label="This merge is built in and always applied.">
											<Badge size="xs" variant="light" color="gray" leftSection={<IconLock size={10} />}>locked</Badge>
										</Tooltip>
									) : (
										<Button
											size="compact-xs"
											variant="subtle"
											color="red"
											leftSection={<IconUnlink size={14} />}
											onClick={() => deleteGroup(g)}
										>
											Remove merge
										</Button>
									)}
								</Group>
							);
						})}
					</Stack>
				</Card>
			)}

			{loading ? (
				[...Array<string>(PAGE_SIZE)].map((_, i) => (
					<Skeleton key={i} style={{ marginBottom: "1rem" }} />
				))
			) : ((narrowResults && narrowResults.data && !broadSearch) ? (
				<Stack align="stretch" gap="xl" mb="xl">
					<Stack>
						{dedupByCanonical(narrowResults.data, r => r.arena_person_identity_id).map(({ item: result, group }) => {
							const canonical = getCanonicalId(result.arena_person_identity_id);
							return (
								<Card key={result.id} styles={{ root: { textAlign: "left", flexBasis: "11rem", justifyContent: "center" } }} p="lg" className={styles.result} mx="xs">
									<Group align="flex-start" wrap="nowrap" gap="sm">
										{mergeMode && (
											<Checkbox
												checked={selectedIds.has(canonical)}
												onChange={() => toggleSelect(canonical)}
												onClick={e => e.stopPropagation()}
											/>
										)}
										<Stack gap={2} style={{ flex: 1 }}>
											<Link to={getRedirectLink(canonical)} style={{ textDecoration: "none" }} className={styles.resultLink}>
												<Group gap={6} wrap="wrap" align="center">
													<Title order={3}>{result.name}</Title>
													{group && <MergedBadge group={group} />}
												</Group>
												<Text size="xs" c="dimmed">ID: {canonical}</Text>
												{result.location ?
													<Text><Text span fw={600}>Location:</Text> {result.location.name} ({[result.location.city, result.location.state].filter(v => v).join(", ")})</Text>
													: <Text c="dimmed">No location data</Text>}
												<Text><Text span fw={600}>HS Graduation:</Text> {result.high_school_grad_year}</Text>
												{result.birth_date ? <Text><Text span fw={600}>Birthday:</Text> {dayjs(result.birth_date).format("MMMM D, YYYY")}</Text> : <Text c="dimmed">Birth date unavailable</Text>}
											</Link>
											{mergeMode && group && !isBuiltInGroup(group) ? <RemoveMergeButton group={group} /> : null}
										</Stack>
									</Group>
								</Card>
							);
						})}
					</Stack>
					<Pagination
						total={Math.min(narrowResults.meta.max_limit, narrowResults.meta.pages)} value={narrowResults.meta.page} withEdges withControls onChange={switchPage}
						styles={{ root: { justifyItems: "center", justifyContent: "center" } }}
						className={styles.resultsPagination}
					/>
				</Stack>
			) : (broadResults && broadResults.data && broadSearch) ? (
				<Stack align="stretch" gap="xl" mb="xl">
					<Stack>
						{dedupByCanonical(Array.from(extraData.values()), e => e.data.original_entity.arena_person_identity_id).map(({ item: extra, group }) => {
							const canonical = getCanonicalId(extra.data.original_entity.arena_person_identity_id);
							return (
								<Card key={extra.data.original_entity.id} styles={{ root: { textAlign: "left", flexBasis: "11rem", justifyContent: "center" } }} p="lg" className={styles.result} mx="xs">
									<Group align="flex-start" wrap="nowrap" gap="sm">
										{mergeMode && (
											<Checkbox
												checked={selectedIds.has(canonical)}
												onChange={() => toggleSelect(canonical)}
												onClick={e => e.stopPropagation()}
											/>
										)}
										<Stack gap={2} style={{ flex: 1 }}>
											<Link to={getRedirectLink(canonical)} style={{ textDecoration: "none" }} className={styles.resultLink}>
												<Group gap={6} wrap="wrap" align="center">
													<Title order={3}>{extra.data.original_entity.name}</Title>
													{group && <MergedBadge group={group} />}
												</Group>
												<Text size="xs" c="dimmed">ID: {canonical}</Text>
												{extra.data.original_entity.location ?
													<Text><Text span fw={600}>Location:</Text> {extra.data.original_entity.location.name} ({[extra.data.original_entity.location.city, extra.data.original_entity.location.state].filter(v => v).join(", ")})</Text>
													: <Text c="dimmed">No location data</Text>}
												<Text><Text span fw={600}>HS Graduation:</Text> {extra.data.original_entity.high_school_grad_year}</Text>
												{extra.data.original_entity.birth_date ? <Text><Text span fw={600}>Birthday:</Text> {dayjs(extra.data.original_entity.birth_date).format("MMMM D, YYYY")}</Text> : <Text c="dimmed">Birth date unavailable</Text>}
											</Link>
											{mergeMode && group && !isBuiltInGroup(group) ? <RemoveMergeButton group={group} /> : null}
										</Stack>
									</Group>
								</Card>
							);
						})}
						{broadResults.data.filter(result => !extraData.has(result.node.id)).map((result) => (
							<Card key={result.id} styles={{ root: { textAlign: "left", flexBasis: "11rem", justifyContent: "center" } }} p="lg" className={styles.result} mx="xs" onClick={() => !extraData.get(result.node.id) ? broadResultsClick(result) : null}>
								<Title order={3}>{result.title}</Title><Text size="xs" c="dimmed">ID: {result.node.id} ({result.id})</Text>
								<Text size="sm" c="dimmed">Profile details unavailable. Select to retry.</Text>
							</Card>
						))}
					</Stack>
					<Pagination
						total={Math.min(broadResults.meta.max_limit, broadResults.meta.pages)} value={broadResults.meta.page} withEdges withControls onChange={switchPage}
						styles={{ root: { justifyItems: "center", justifyContent: "center" } }}
						className={styles.resultsPagination}
					/>
				</Stack>
			) : (
				<p>No results found</p>
			))}
		</Stack>
	);
}

/** De-dupe results that fall into the same merge group, keeping first occurrence.
 *  Returns each kept item annotated with its group (if part of one). */
function dedupByCanonical<T>(items: T[], getId: (item: T) => string): { item: T; group: AliasGroup | null }[] {
	const seenCanonical = new Set<string>();
	const out: { item: T; group: AliasGroup | null }[] = [];
	for (const item of items) {
		const id = getId(item);
		const canonical = getCanonicalId(id);
		if (seenCanonical.has(canonical)) continue;
		seenCanonical.add(canonical);
		out.push({ item, group: getAliasGroup(id) });
	}
	return out;
}

function MergedBadge({ group }: { group: AliasGroup }) {
	return (
		<Tooltip label={`Merged from ${group.length} profiles: ${group.map(id => id.slice(0, 8)).join(", ")}`}>
			<Badge size="xs" variant="light" color="blue" leftSection={<IconLink size={10} />}>merged</Badge>
		</Tooltip>
	);
}

function RemoveMergeButton({ group }: { group: AliasGroup }) {
	return (
		<Button
			size="compact-xs"
			variant="light"
			color="red"
			leftSection={<IconUnlink size={14} />}
			w="fit-content"
			onClick={event => {
				event.preventDefault();
				event.stopPropagation();
				deleteGroup(group);
			}}
		>
			Remove merge
		</Button>
	);
}
