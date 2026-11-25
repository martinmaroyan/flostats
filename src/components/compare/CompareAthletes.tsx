import { siteBase } from "../../demo/mode";
import DataError from "../DataError";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Card, SimpleGrid, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { IdentityLookupStatus } from "../AthleteLoadingPanel";
import { Helmet } from "react-helmet-async";

import { ProgressCoordinator } from "../../utils/ProgressCoordinator";
import { BoutsResponse } from "../../api/types/responses";
import { BoutObject } from "../../api/types/objects/bout";
import { AllBoutRelationships } from "../../api/types/relationships";
import { FloObject } from "../../api/types/types";

import { findCommonOpponents, calculateCommonOpponentsSummary, findHeadToHeadMatches } from "../../utils/commonOpponents";
import AthleteSelector from "./AthleteSelector";
import GeneralInfoDisplay, { BasicInfo } from "../GeneralInfoDisplay";
import ComparisonSummary from "./ComparisonSummary";
import CommonOpponentsTable from "./CommonOpponentsTable";
import HeadToHeadDisplay from "./HeadToHeadDisplay";
import { fetchMergedAthleteData, IdentityLookupStage } from "../../utils/athleteData";
import { getCanonicalId, useAliasGroups } from "../../utils/aliases";

type Bouts = BoutsResponse<AllBoutRelationships, Exclude<FloObject, BoutObject>>;

export default function CompareAthletes() {
	const [searchParams] = useSearchParams();
	const athlete1Id = searchParams.get("athlete1");
	const athlete2Id = searchParams.get("athlete2");
	const aliasGroups = useAliasGroups();
	const athlete1CanonicalId = athlete1Id ? getCanonicalId(athlete1Id) : null;
	const athlete2CanonicalId = athlete2Id ? getCanonicalId(athlete2Id) : null;
	const [loadError, setLoadError] = useState<string | null>(null);

	const [downloading, setDownloading] = useState(false);
	const [lookupStages, setLookupStages] = useState<[IdentityLookupStage, IdentityLookupStage]>(["checking", "checking"]);
	const [loadAttempt, setLoadAttempt] = useState(0);

	// Athlete 1 data
	const [athlete1Bouts, setAthlete1Bouts] = useState<Bouts | null>(null);
	const [athlete1Info, setAthlete1Info] = useState<BasicInfo | null>(null);

	// Athlete 2 data
	const [athlete2Bouts, setAthlete2Bouts] = useState<Bouts | null>(null);
	const [athlete2Info, setAthlete2Info] = useState<BasicInfo | null>(null);

	// Compute common opponents
	const commonOpponents = useMemo(() => {
		if (!athlete1Bouts || !athlete2Bouts || !athlete1CanonicalId || !athlete2CanonicalId) {
			return [];
		}
		return findCommonOpponents(athlete1Bouts, athlete2Bouts, athlete1CanonicalId, athlete2CanonicalId);
	}, [athlete1Bouts, athlete2Bouts, athlete1CanonicalId, athlete2CanonicalId]);

	// Compute head-to-head matches
	const h2hMatches = useMemo(() => {
		if (!athlete1Bouts || !athlete2Bouts || !athlete1CanonicalId || !athlete2CanonicalId) {
			return [];
		}
		return findHeadToHeadMatches(athlete1Bouts, athlete1CanonicalId, athlete2CanonicalId);
	}, [athlete1Bouts, athlete2Bouts, athlete1CanonicalId, athlete2CanonicalId]);

	// Compute summary stats
	const summary = useMemo(() => {
		return calculateCommonOpponentsSummary(commonOpponents);
	}, [commonOpponents]);

	useEffect(() => {
		let cancelled = false;
		const controller = new AbortController();
		setAthlete1Bouts(null);
		setAthlete2Bouts(null);
		setAthlete1Info(null);
		setAthlete2Info(null);
		setLoadError(null);
		setDownloading(false);
		if (!athlete1Id || !athlete2Id) return;
		if (athlete1CanonicalId === athlete2CanonicalId) {
			setLoadError("Select two different wrestlers to compare.");
			return;
		}
		setDownloading(true);
		setLookupStages(["checking", "checking"]);
		const options = (index: 0 | 1) => ({ signal: controller.signal, onLookupStage: (stage: IdentityLookupStage) => {
			if (!cancelled) setLookupStages(current => index === 0 ? [stage, current[1]] : [current[0], stage]);
		} });

		const progressCoordinator = new ProgressCoordinator(16);
		progressCoordinator.registerOperation("athlete1", 0.5);
		progressCoordinator.registerOperation("athlete2", 0.5);
		progressCoordinator.start();

		void (async () => {
			try {
				const [athlete1, athlete2] = await Promise.all([
					fetchMergedAthleteData(athlete1Id, progress => { if (!cancelled) progressCoordinator.updateOperation("athlete1", progress); }, undefined, options(0)),
					fetchMergedAthleteData(athlete2Id, progress => { if (!cancelled) progressCoordinator.updateOperation("athlete2", progress); }, undefined, options(1)),
				]);
				if (cancelled) return;

				setAthlete1Bouts(athlete1.bouts);
				setAthlete1Info(athlete1.basicInfo);

				setAthlete2Bouts(athlete2.bouts);
				setAthlete2Info(athlete2.basicInfo);

				document.title = `${athlete1.basicInfo.name} vs ${athlete2.basicInfo.name} - FloStats`;

				progressCoordinator.complete();
			} catch (e) {
				if (!cancelled) setLoadError(e instanceof Error ? e.message : "Unable to load comparison");
			} finally {
				controller.abort();
				if (!cancelled) { setDownloading(false); progressCoordinator.complete(); }
			}
		})();
		return () => { cancelled = true; controller.abort(); progressCoordinator.complete(); };
	}, [athlete1Id, athlete2Id, athlete1CanonicalId, athlete2CanonicalId, aliasGroups, loadAttempt]);

	return (
		<Stack w="100%" align="center" p="md">
			{loadError && <DataError title="Unable to compare wrestlers" message={loadError} onRetry={athlete1CanonicalId !== athlete2CanonicalId ? () => setLoadAttempt(n => n + 1) : undefined} />}
			{athlete1Info && athlete2Info && (
				<Helmet>
					<title>{athlete1Info.name} vs {athlete2Info.name} - Head-to-Head Comparison | FloStats</title>
					<meta
						name="description"
						content={`Compare ${athlete1Info.name} and ${athlete2Info.name} head-to-head. ${
							h2hMatches.length > 0
								? `Direct matchups: ${h2hMatches.filter(m => m.athlete1Won).length}-${h2hMatches.length - h2hMatches.filter(m => m.athlete1Won).length} series. `
								: ""
						}${
							commonOpponents.length > 0
								? `${commonOpponents.length} common opponents. `
								: ""
						}View detailed statistics, match history, and performance comparison.`}
					/>
					<link rel="canonical" href={`${siteBase()}/compare?athlete1=${athlete1Id}&athlete2=${athlete2Id}`} />

					{/* Open Graph */}
					<meta property="og:type" content="website" />
					<meta property="og:url" content={`${siteBase()}/compare?athlete1=${athlete1Id}&athlete2=${athlete2Id}`} />
					<meta property="og:title" content={`${athlete1Info.name} vs ${athlete2Info.name} - Wrestling Comparison | FloStats`} />
					<meta
						property="og:description"
						content={`Head-to-head comparison: ${athlete1Info.name} vs ${athlete2Info.name}${
							h2hMatches.length > 0
								? ` - Series record: ${h2hMatches.filter(m => m.athlete1Won).length}-${h2hMatches.length - h2hMatches.filter(m => m.athlete1Won).length}`
								: ""
						}${
							commonOpponents.length > 0
								? `, ${commonOpponents.length} common opponents`
								: ""
						}.`}
					/>

					{/* Twitter */}
					<meta property="twitter:card" content="summary" />
					<meta property="twitter:url" content={`${siteBase()}/compare?athlete1=${athlete1Id}&athlete2=${athlete2Id}`} />
					<meta property="twitter:title" content={`${athlete1Info.name} vs ${athlete2Info.name} | FloStats`} />
					<meta
						property="twitter:description"
						content={`Head-to-head wrestling comparison${
							h2hMatches.length > 0
								? `: ${h2hMatches.filter(m => m.athlete1Won).length}-${h2hMatches.length - h2hMatches.filter(m => m.athlete1Won).length} series`
								: ""
						}`}
					/>
				</Helmet>
			)}

			<Title order={1}>Wrestler Comparison</Title>
			{downloading && <Card withBorder w={420} maw="100%" p="lg" radius="md" shadow="sm">
				<Stack gap="md">
					<Group gap="sm"><Loader size="sm" /><Title order={4}>Loading comparison</Title></Group>
					<IdentityLookupStatus stage={lookupStages[0]} label="Athlete 1 identity lookup" />
					<IdentityLookupStatus stage={lookupStages[1]} label="Athlete 2 identity lookup" />
					{lookupStages.every(stage => stage === "loading") && <Text size="xs" c="dimmed" ta="center">Loading match histories…</Text>}
				</Stack>
			</Card>}

			{/* Athlete Selection */}
			{(!athlete1Id || !athlete2Id) && <AthleteSelector />}

			{/* Athlete Info Cards */}
			{athlete1Info && athlete2Info && (
				<SimpleGrid cols={{ base: 1, sm: 2 }} w="100%">
					<GeneralInfoDisplay
						info={athlete1Info}
						setIgnoredTeams={() => {}}
						reset={false}
						setReset={() => {}}
					/>
					<GeneralInfoDisplay
						info={athlete2Info}
						setIgnoredTeams={() => {}}
						reset={false}
						setReset={() => {}}
					/>
				</SimpleGrid>
			)}

			{/* Head-to-Head Matches */}
			{athlete1Info && athlete2Info && athlete1Bouts && h2hMatches.length > 0 && (
				<HeadToHeadDisplay
					h2hMatches={h2hMatches}
					athlete1Bouts={athlete1Bouts}
					athlete1Name={athlete1Info.name || "Athlete 1"}
					athlete2Name={athlete2Info.name || "Athlete 2"}
				/>
			)}

			{/* Common Opponents Summary */}
			{athlete1Info && athlete2Info && commonOpponents.length > 0 && (
				<ComparisonSummary
					summary={summary}
					athlete1Name={athlete1Info.name || "Athlete 1"}
					athlete2Name={athlete2Info.name || "Athlete 2"}
				/>
			)}

			{/* Common Opponents Table */}
			{athlete1Id && athlete2Id && athlete1Info && athlete2Info && athlete1Bouts && athlete2Bouts && (
				<Card w="100%" p="lg">
					{commonOpponents.length === 0 ? (
						<Stack align="center" py="xl">
							<Text size="lg" c="dimmed">No common opponents found</Text>
							<Text size="sm" c="dimmed">
								These wrestlers have not faced any of the same opponents.
							</Text>
						</Stack>
					) : (
						<CommonOpponentsTable
							commonOpponents={commonOpponents}
							athlete1Bouts={athlete1Bouts}
							athlete2Bouts={athlete2Bouts}
							athlete1Name={athlete1Info.name || "Wrestler 1"}
							athlete2Name={athlete2Info.name || "Wrestler 2"}
						/>
					)}
				</Card>
			)}
		</Stack>
	);
}
