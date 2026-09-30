import React from "react";
import { Alert, Anchor, Badge, Center, Checkbox, Group, Stack, Tooltip } from "@mantine/core";
import { IconLink } from "@tabler/icons-react";
import AthleteLoadingPanel, { LoadCounters } from "./components/AthleteLoadingPanel";
import { nprogress } from "@mantine/nprogress";
import { Helmet } from "react-helmet-async";


import { BoutsResponse, WrestlersResponse } from "./api/types/responses";
import FloAPI from "./api/FloAPI";
import { EventObject } from "./api/types/objects/event";
import { WrestlerObject } from "./api/types/objects/wrestler";
import { FloObject } from "./api/types/types";
import { BoutObject } from "./api/types/objects/bout";

import { AllBoutRelationships, AllWrestlerRelationships } from "./api/types/relationships";
import { useParams, Link } from "react-router";

import dayjs from "dayjs";
import { TeamObject } from "./api/types/objects/team";

import BoutDateFilter from "./components/BoutDateFilter";
import GeneralInfoDisplay, { BasicInfo } from "./components/GeneralInfoDisplay";

import TimeframeSummary from "./components/TimeframeSummary";
import SeedingCriteria from "./components/SeedingCriteria";
import { useAliasGroups } from "./utils/aliases";
import { fetchMergedAthleteData } from "./utils/athleteData";
import { isForfeit } from "./utils/boutResults";

export type AthleteDataProps = {
	wrestlers: WrestlersResponse<AllWrestlerRelationships, Exclude<FloObject, WrestlerObject>>,
	bouts: BoutsResponse<AllBoutRelationships, Exclude<FloObject, BoutObject>>,
	identityPersonId: string,
}

type Wrestlers = WrestlersResponse<AllWrestlerRelationships, Exclude<FloObject, WrestlerObject>>;
type Bouts = BoutsResponse<AllBoutRelationships, Exclude<FloObject, BoutObject>>;

export default function Athletes() {
	const { id } = useParams();

	const [downloading, setDownloading] = React.useState<boolean>(false);
	const [loadCounters, setLoadCounters] = React.useState<LoadCounters>({
		wrestlersLoaded: 0,
		wrestlersTotal: null,
		boutsLoaded: 0,
		boutsTotal: null,
		overallProgress: null,
	});

	const [wrestlers, setWrestlers] = React.useState<Wrestlers | null>(null);
	const [bouts, setBouts] = React.useState<Bouts | null>(null);

	const [oldestBout, setOldestBout] = React.useState<Date | undefined>(undefined);
	const [newestBout, setNewestBout] = React.useState<Date | undefined>(undefined);

	const aliasGroups = useAliasGroups();
	const [loadError, setLoadError] = React.useState<string | null>(null);

	const [athleteId, setAthleteId] = React.useState<string | null>(null);
	const [mergedAliases, setMergedAliases] = React.useState<string[]>([]);

	const [startDate, setStartDate] = React.useState<Date | null>(null);
	const [endDate, setEndDate] = React.useState<Date | null>(null);

	const [filter, setFilter] = React.useState({
		eventType: {
			tournaments: true,
			duals: true,
		},
		byes: false,
		forfeits: false,
		ignoredTeams: new Set<string>(),
	});

	const filteredBouts = React.useMemo(() => {
		let total = 0;

		return bouts ? {
			data: bouts.data.filter(bout => {
				const date = dayjs(bout.attributes.goDateTime ?? bout.attributes.endDateTime ?? FloAPI.findIncludedObjectById<EventObject>(bout.attributes.eventId, "event", bouts)?.attributes.startDateTime);
				if (startDate && date.isBefore(dayjs(startDate), "day")) return false;
				if (endDate && date.isAfter(dayjs(endDate), "day")) return false;
				if (bout.attributes.winType == "NC") return false;
				if (bout.attributes.winType == "BYE" && !filter.byes) return false;
				if (isForfeit(bout.attributes.winType) && !filter.forfeits) return false;
				const event = FloAPI.findIncludedObjectById<EventObject>(bout.attributes.eventId, "event", bouts);
				if (event?.attributes.isDual && !filter.eventType.duals) return false;
				if (!event?.attributes.isDual && !filter.eventType.tournaments) return false;

				const topWrestler = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.topWrestlerId, "wrestler", bouts);
				const bottomWrestler = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.bottomWrestlerId, "wrestler", bouts);

				const thisWrestler = topWrestler?.attributes.identityPersonId == athleteId ? topWrestler : bottomWrestler;

				const team = thisWrestler ? FloAPI.findIncludedObjectById<TeamObject>(thisWrestler.attributes.teamId, "team", bouts) : undefined;
				if (team?.attributes.identityTeamId && filter.ignoredTeams.has(team?.attributes.identityTeamId)) return false;
				total++;
				return true;
			}),
			included: bouts.included,
			meta: { total },
			links: bouts.links,
		} : null;
	}, [bouts, startDate, endDate, filter, athleteId]);

	const filteredWrestlers = React.useMemo(() => {
		let total = 0;
		return wrestlers ? {
			data: wrestlers.data.filter(wrestler => {
				const event = FloAPI.findIncludedObjectById<EventObject>(wrestler.attributes.eventId, "event", wrestlers);
				const date = dayjs(event?.attributes.endDateTime ?? event?.attributes.startDateTime);
				if (startDate && date.isBefore(dayjs(startDate), "day")) return false;
				if (endDate && date.isAfter(dayjs(endDate), "day")) return false;
				if (!filter.eventType.duals && event?.attributes.isDual) return false;
				if (!filter.eventType.tournaments && !event?.attributes.isDual) return false;


				total++;
				return true;
			}),
			included: wrestlers.included.filter(i => {
				if (i.type == "bracketPlacement") {
					const event = FloAPI.findIncludedObjectById<EventObject>(i.attributes.eventId, "event", wrestlers);

					if (event?.attributes.isDual && !filter.eventType.duals) return false;
					if (!event?.attributes.isDual && !filter.eventType.tournaments) return false;
				}

				return true;
			}),
			meta: { total },
			links: wrestlers.links,
		} : null;
	}, [wrestlers, startDate, endDate, filter]);

	const [basicInfo, setBasicInfo] = React.useState<BasicInfo | null>(null);

	const seasons = React.useMemo<{ name: string, bouts: Bouts, wrestlers: Wrestlers }[]>(() => {
		if (!filteredBouts || !filteredWrestlers) return [];
		const seasons: { name: string, bouts: Bouts, wrestlers: Wrestlers }[] = [];
		// Season starts after Thanksgiving

		filteredBouts.data.forEach(bout => {
			const date = dayjs(FloAPI.findIncludedObjectById<EventObject>(bout.attributes.eventId, "event", filteredBouts)?.attributes.startDateTime);
			const seasonStart = date.clone().startOf("year").month(10).date(1).isBefore(date) ? date.clone().startOf("year").month(10).date(1) : date.clone().startOf("year").month(10).date(1).subtract(1, "year");
			const seasonName = `${seasonStart.format("YYYY")}-${seasonStart.add(1, "year").format("YY")}`;

			const season = seasons.find(s => s.name == seasonName);
			if (season) {
				season.bouts.data.push(bout);
				season.bouts.meta.total++;
			} else {
				seasons.push({
					name: seasonName,
					bouts: {
						data: [bout],
						included: filteredBouts.included,
						meta: { total: 1 },
						links: filteredBouts.links,
					},
					wrestlers: {
						data: [],
						included: filteredWrestlers.included,
						meta: { total: 0 },
					},
				});
			}
		});

		filteredWrestlers.data.forEach(wrestler => {
			const event = FloAPI.findIncludedObjectById<EventObject>(wrestler.attributes.eventId, "event", filteredWrestlers);
			const date = dayjs(event?.attributes.startDateTime);
			const seasonStart = date.clone().startOf("year").month(10).date(1).isBefore(date) ? date.clone().startOf("year").month(10).date(1) : date.clone().startOf("year").month(10).date(1).subtract(1, "year");
			const seasonName = `${seasonStart.format("YYYY")}-${seasonStart.add(1, "year").format("YY")}`;

			const season = seasons.find(s => s.name == seasonName);
			if (season) {
				season.wrestlers.data.push(wrestler);
				season.wrestlers.meta.total++;
			} else {
				seasons.push({
					name: seasonName,
					bouts: {
						data: [],
						included: filteredBouts.included,
						meta: { total: 0 },
					},
					wrestlers: {
						data: [wrestler],
						included: filteredWrestlers.included,
						meta: { total: 1 },
					}
				});
			}
		});


		return seasons;
	}, [filteredBouts, filteredWrestlers]);

	React.useEffect(() => {
		if (!id) return;
		let cancelled = false;
		setDownloading(true);
		setLoadError(null);
		setAthleteId(null);
		setMergedAliases([]);
		setOldestBout(undefined);
		setNewestBout(undefined);
		setStartDate(null);
		setEndDate(null);
		setFilter(current => ({ ...current, ignoredTeams: new Set() }));
		setWrestlers(null);
		setBouts(null);
		setBasicInfo(null);
		setLoadCounters({ wrestlersLoaded: 0, wrestlersTotal: null, boutsLoaded: 0, boutsTotal: null, overallProgress: null });

		void (async () => {
			try {
				nprogress.start();
				const { aliases, canonicalId, wrestlers: wrestlersResponse, bouts: boutsResponse, basicInfo } = await fetchMergedAthleteData(
					id,
					progress => {
						if (cancelled) return;
						nprogress.set(progress);
						setLoadCounters(current => ({ ...current, overallProgress: progress }));
					},
					(kind, loaded, total) => {
						if (cancelled) return;
						setLoadCounters(current => kind === "wrestlers"
							? { ...current, wrestlersLoaded: loaded, wrestlersTotal: total }
							: { ...current, boutsLoaded: loaded, boutsTotal: total });
					},
				);
				if (cancelled) return;

				setWrestlers(wrestlersResponse);
				setBasicInfo(basicInfo);
				setMergedAliases(aliases.length > 1 ? aliases : []);

				document.title = `${basicInfo.name} - FloStats`;

				setBouts(boutsResponse);

				setAthleteId(canonicalId);
				setDownloading(false);

				const boundDates: Date[] = [];
				for (const bout of boutsResponse.data) {
					const event = FloAPI.findIncludedObjectById<EventObject>(bout.attributes.eventId, "event", boutsResponse);
					for (const d of [bout.attributes.goDateTime, bout.attributes.endDateTime, event?.attributes.startDateTime, event?.attributes.endDateTime]) {
						if (d && dayjs(d).isValid()) boundDates.push(dayjs(d).toDate());
					}
				}
				for (const wrestler of wrestlersResponse.data) {
					const event = FloAPI.findIncludedObjectById<EventObject>(wrestler.attributes.eventId, "event", wrestlersResponse);
					for (const d of [event?.attributes.startDateTime, event?.attributes.endDateTime]) {
						if (d && dayjs(d).isValid()) boundDates.push(dayjs(d).toDate());
					}
				}

				if (boundDates.length) {
					const oldest = boundDates.reduce((a, b) => a < b ? a : b);
					const newest = boundDates.reduce((a, b) => a > b ? a : b);
					setOldestBout(oldest);
					setNewestBout(newest);

					setStartDate(oldest);
					setEndDate(newest);
				}

				nprogress.complete();

			} catch (e) {
				if (!cancelled) setLoadError(e instanceof Error ? e.message : "Unable to load athlete data");
			} finally {
				if (!cancelled) {
					setDownloading(false);
					nprogress.complete();
					cancelled = true;
				}
			}
		})();
		return () => {
			cancelled = true;
			nprogress.complete();
		};
	}, [id, aliasGroups]);

	// Calculate stats for SEO meta description
	const athleteStats = React.useMemo(() => {
		if (!filteredBouts || !athleteId) return null;

		let wins = 0;
		let losses = 0;
		let pins = 0;

		filteredBouts.data.forEach(bout => {
			const winner = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.winnerWrestlerId, "wrestler", filteredBouts);
			const isWin = winner?.attributes.identityPersonId === athleteId;

			if (isWin) {
				wins++;
				if (["F", "FALL"].includes(bout.attributes.winType)) pins++;
			} else {
				losses++;
			}
		});

		const total = wins + losses;
		const winPercentage = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

		return { wins, losses, pins, winPercentage, total };
	}, [filteredBouts, athleteId]);

	return (
		<Stack w="100%" align="center">
			{loadError && <Alert color="red" title="Unable to load athlete">{loadError}</Alert>}
			{basicInfo && athleteStats && (
				<Helmet>
					<title>{basicInfo.name} - Wrestling Stats & Match History | FloStats</title>
					<meta
						name="description"
						content={`${basicInfo.name}'s complete wrestling record: ${athleteStats.wins}-${athleteStats.losses} (${athleteStats.winPercentage}% win rate) with ${athleteStats.pins} pins. View detailed match history, tournament placements, and career statistics.`}
					/>
					<link rel="canonical" href={`https://flostats.com/athletes/${id}`} />

					{/* Open Graph */}
					<meta property="og:type" content="profile" />
					<meta property="og:url" content={`https://flostats.com/athletes/${id}`} />
					<meta property="og:title" content={`${basicInfo.name} - Wrestling Stats & Match History | FloStats`} />
					<meta
						property="og:description"
						content={`${basicInfo.name}'s complete wrestling record: ${athleteStats.wins}-${athleteStats.losses} (${athleteStats.winPercentage}% win rate) with ${athleteStats.pins} pins.`}
					/>

					{/* Twitter */}
					<meta property="twitter:card" content="summary" />
					<meta property="twitter:url" content={`https://flostats.com/athletes/${id}`} />
					<meta property="twitter:title" content={`${basicInfo.name} - Wrestling Stats | FloStats`} />
					<meta
						property="twitter:description"
						content={`${basicInfo.name}: ${athleteStats.wins}-${athleteStats.losses} record, ${athleteStats.pins} pins`}
					/>

					{/* Schema.org Person structured data */}
					<script type="application/ld+json">
						{JSON.stringify({
							"@context": "https://schema.org",
							"@type": "Person",
							"name": basicInfo.name,
							"description": `Wrestler with ${athleteStats.wins}-${athleteStats.losses} record`,
							...(basicInfo.dateOfBirth && { "birthDate": basicInfo.dateOfBirth.format("YYYY-MM-DD") }),
							"sport": "Wrestling",
							"memberOf": basicInfo.teams.map(team => ({
								"@type": "SportsTeam",
								"name": team.attributes.name,
								"sport": "Wrestling"
							})),
							"url": `https://flostats.com/athletes/${id}`,
							"sameAs": `https://arena.flowrestling.org/people/${id}`
						})}
					</script>
				</Helmet>
			)}
			{downloading ? (
				<Center w="100%" mih="60vh">
					<AthleteLoadingPanel counters={loadCounters} />
				</Center>
			) : (
				<>
					{mergedAliases.length > 1 ? <MergedProfilesBadge aliases={mergedAliases} canonical={athleteId} /> : null}
					{basicInfo ? <GeneralInfoDisplay info={basicInfo} setIgnoredTeams={teams => setFilter({ ...filter, ignoredTeams: teams })} reset={false} setReset={() => {}} /> : null}
					{athleteId && (
						<Anchor
							component={Link}
							to={`/compare?athlete1=${athleteId}`}
							size="md"
						>
							Compare with Another Wrestler
						</Anchor>
					)}
					<BoutDateFilter startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} oldestBout={oldestBout} newestBout={newestBout} />
					<Stack gap="sm" mb="md" align="center">
						<Group content="center">
							<Checkbox checked={filter.eventType.duals} label="Duals" onChange={e => {
								if (!e.target.checked) {
									setFilter({ ...filter, eventType: { ...filter.eventType, duals: false, tournaments: true } });
								} else {
									setFilter({ ...filter, eventType: { ...filter.eventType, duals: true } });
								}
							}} />
							<Checkbox checked={filter.eventType.tournaments} label="Tournaments" onChange={e => {
								if (!e.target.checked) {
									setFilter({ ...filter, eventType: { ...filter.eventType, tournaments: false, duals: true } });
								} else {
									setFilter({ ...filter, eventType: { ...filter.eventType, tournaments: true } });
								}
							}} />
						</Group>
						<Group>
							<Checkbox checked={filter.byes} label="Byes" onChange={e => setFilter({ ...filter, byes: e.target.checked })} />
							<Checkbox checked={filter.forfeits} label="Forfeits" onChange={e => setFilter({ ...filter, forfeits: e.target.checked })} />
						</Group>
					</Stack>
					{filteredBouts && filteredWrestlers && athleteId ? (
						<Stack w="100%">
							<TimeframeSummary title="Total Summary" bouts={filteredBouts} wrestlers={filteredWrestlers} identityPersonId={athleteId} total />
							{seasons.filter(season => season.bouts.meta.total > 0).map(season => (
								<TimeframeSummary key={season.name} title={"Season: " + season.name} bouts={season.bouts} wrestlers={season.wrestlers} identityPersonId={athleteId} total={false} />
							))}
							<SeedingCriteria wrestlers={filteredWrestlers} bouts={filteredBouts} identityPersonId={athleteId} />
						</Stack>
					) : null}
				</>
			)}
		</Stack>
	);
}

function MergedProfilesBadge({ aliases, canonical }: { aliases: string[]; canonical: string | null }) {
	const others = aliases.filter(a => a !== canonical);
	const label = `Merged from ${aliases.length} FloWrestling profiles`;
	return (
		<Tooltip
			multiline
			w={360}
			label={`This view combines data from ${aliases.length} separate FloWrestling identityPersonIds${others.length ? ` (other ids: ${others.map(o => o.slice(0, 8)).join(", ")})` : ""}.`}
		>
			<Badge variant="light" color="blue" leftSection={<IconLink size={12} />} size="sm">
				{label}
			</Badge>
		</Tooltip>
	);
}
