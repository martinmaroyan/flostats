import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Card, Group, Overlay, Stack, Text, Title } from "@mantine/core";
import { nprogress } from "@mantine/nprogress";

import FloAPI from "../../api/FloAPI";
import { ProgressCoordinator } from "../../utils/ProgressCoordinator";
import { BoutsResponse, WrestlersResponse } from "../../api/types/responses";
import { BoutObject } from "../../api/types/objects/bout";
import { WrestlerObject } from "../../api/types/objects/wrestler";
import { AllBoutRelationships, AllWrestlerRelationships } from "../../api/types/relationships";
import { BoutsIncludeAll, FloObject, WrestlersIncludeAll } from "../../api/types/types";
import { TeamObject } from "../../api/types/objects/team";
import { EventObject } from "../../api/types/objects/event";

import { findCommonOpponents, calculateCommonOpponentsSummary, findHeadToHeadMatches } from "../../utils/commonOpponents";
import AthleteSelector from "./AthleteSelector";
import GeneralInfoDisplay, { BasicInfo } from "../GeneralInfoDisplay";
import ComparisonSummary from "./ComparisonSummary";
import CommonOpponentsTable from "./CommonOpponentsTable";
import HeadToHeadDisplay from "./HeadToHeadDisplay";

import dayjs from "dayjs";
import { TeamAttributes } from "../../api/types/objects/team";

type Bouts = BoutsResponse<AllBoutRelationships, Exclude<FloObject, BoutObject>>;
type Wrestlers = WrestlersResponse<AllWrestlerRelationships, Exclude<FloObject, WrestlerObject>>;

export default function CompareAthletes() {
	const [searchParams] = useSearchParams();
	const athlete1Id = searchParams.get("athlete1");
	const athlete2Id = searchParams.get("athlete2");

	const [downloading, setDownloading] = useState(false);

	// Athlete 1 data
	const [athlete1Bouts, setAthlete1Bouts] = useState<Bouts | null>(null);
	const [athlete1Wrestlers, setAthlete1Wrestlers] = useState<Wrestlers | null>(null);
	const [athlete1Info, setAthlete1Info] = useState<BasicInfo | null>(null);

	// Athlete 2 data
	const [athlete2Bouts, setAthlete2Bouts] = useState<Bouts | null>(null);
	const [athlete2Wrestlers, setAthlete2Wrestlers] = useState<Wrestlers | null>(null);
	const [athlete2Info, setAthlete2Info] = useState<BasicInfo | null>(null);

	// Load data when athlete IDs change
	useEffect(() => {
		if (athlete1Id && athlete2Id) {
			void loadComparisonData(athlete1Id, athlete2Id);
		}
	}, [athlete1Id, athlete2Id]);

	// Compute common opponents
	const commonOpponents = useMemo(() => {
		if (!athlete1Bouts || !athlete2Bouts || !athlete1Id || !athlete2Id) {
			return [];
		}
		return findCommonOpponents(athlete1Bouts, athlete2Bouts, athlete1Id, athlete2Id);
	}, [athlete1Bouts, athlete2Bouts, athlete1Id, athlete2Id]);

	// Compute head-to-head matches
	const h2hMatches = useMemo(() => {
		if (!athlete1Bouts || !athlete2Bouts || !athlete1Id || !athlete2Id) {
			return [];
		}
		return findHeadToHeadMatches(athlete1Bouts, athlete2Bouts, athlete1Id, athlete2Id);
	}, [athlete1Bouts, athlete2Bouts, athlete1Id, athlete2Id]);

	// Compute summary stats
	const summary = useMemo(() => {
		return calculateCommonOpponentsSummary(commonOpponents);
	}, [commonOpponents]);

	const loadComparisonData = async (id1: string, id2: string) => {
		setDownloading(true);

		// Create progress coordinator with 4 operations, each weighted equally at 25%
		const progressCoordinator = new ProgressCoordinator(16);
		progressCoordinator.registerOperation('athlete1-bouts', 0.25);
		progressCoordinator.registerOperation('athlete1-wrestlers', 0.25);
		progressCoordinator.registerOperation('athlete2-bouts', 0.25);
		progressCoordinator.registerOperation('athlete2-wrestlers', 0.25);
		progressCoordinator.start();

		try {
			// Fetch both athletes in parallel for efficiency
			const [bouts1, wrestlers1, bouts2, wrestlers2] = await Promise.all([
				FloAPI.fetchAllBouts<AllBoutRelationships, Exclude<FloObject, BoutObject>>(
					id1,
					progressCoordinator.getCallback('athlete1-bouts'),
					BoutsIncludeAll
				),
				FloAPI.fetchWrestlersByAthleteId<AllWrestlerRelationships, Exclude<FloObject, WrestlerObject>>(
					id1,
					{ pageSize: 0, pageOffset: 0, onProgress: progressCoordinator.getCallback('athlete1-wrestlers') },
					WrestlersIncludeAll
				),
				FloAPI.fetchAllBouts<AllBoutRelationships, Exclude<FloObject, BoutObject>>(
					id2,
					progressCoordinator.getCallback('athlete2-bouts'),
					BoutsIncludeAll
				),
				FloAPI.fetchWrestlersByAthleteId<AllWrestlerRelationships, Exclude<FloObject, WrestlerObject>>(
					id2,
					{ pageSize: 0, pageOffset: 0, onProgress: progressCoordinator.getCallback('athlete2-wrestlers') },
					WrestlersIncludeAll
				),
			]);

			// Build basic info for athlete 1
			const teamIdentityIds1 = [...new Set(wrestlers1.data.map(w =>
				FloAPI.findIncludedObjectById<TeamObject>(w.attributes.teamId, "team", wrestlers1)
			).map(t => t?.attributes.identityTeamId).filter(t => typeof t == "string"))];
			const teamBasics1 = teamIdentityIds1.map(t =>
				wrestlers1.included.find(i => i.type == "team" && i.attributes.identityTeamId == t)?.attributes
			) as TeamAttributes[];

			const basicInfo1: BasicInfo = {
				name: wrestlers1.data.find(w => w.attributes.firstName)
					? `${wrestlers1.data.find(w => w.attributes.firstName)?.attributes.firstName} ${wrestlers1.data.find(w => w.attributes.lastName)?.attributes.lastName}`
					: undefined,
				dateOfBirth: wrestlers1.data.find(w => w.attributes.dateOfBirth)
					? dayjs(wrestlers1.data.find(w => w.attributes.dateOfBirth)?.attributes.dateOfBirth)
					: undefined,
				grade: wrestlers1.data.find(w => w.attributes.grade)?.attributes.grade,
				teams: teamBasics1.map(team => ({
					attributes: team,
					matches: bouts1.data.filter(bout => {
						const top = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.topWrestlerId, "wrestler", bouts1);
						const bottom = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.bottomWrestlerId, "wrestler", bouts1);
						const current = top?.attributes.identityPersonId == id1 ? top : bottom;
						if (!current) return false;
						return FloAPI.findIncludedObjectById<TeamObject>(current.attributes.teamId, "team", bouts1)?.attributes.identityTeamId == team.identityTeamId;
					}),
				})),
			};

			// Build basic info for athlete 2
			const teamIdentityIds2 = [...new Set(wrestlers2.data.map(w =>
				FloAPI.findIncludedObjectById<TeamObject>(w.attributes.teamId, "team", wrestlers2)
			).map(t => t?.attributes.identityTeamId).filter(t => typeof t == "string"))];
			const teamBasics2 = teamIdentityIds2.map(t =>
				wrestlers2.included.find(i => i.type == "team" && i.attributes.identityTeamId == t)?.attributes
			) as TeamAttributes[];

			const basicInfo2: BasicInfo = {
				name: wrestlers2.data.find(w => w.attributes.firstName)
					? `${wrestlers2.data.find(w => w.attributes.firstName)?.attributes.firstName} ${wrestlers2.data.find(w => w.attributes.lastName)?.attributes.lastName}`
					: undefined,
				dateOfBirth: wrestlers2.data.find(w => w.attributes.dateOfBirth)
					? dayjs(wrestlers2.data.find(w => w.attributes.dateOfBirth)?.attributes.dateOfBirth)
					: undefined,
				grade: wrestlers2.data.find(w => w.attributes.grade)?.attributes.grade,
				teams: teamBasics2.map(team => ({
					attributes: team,
					matches: bouts2.data.filter(bout => {
						const top = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.topWrestlerId, "wrestler", bouts2);
						const bottom = FloAPI.findIncludedObjectById<WrestlerObject>(bout.attributes.bottomWrestlerId, "wrestler", bouts2);
						const current = top?.attributes.identityPersonId == id2 ? top : bottom;
						if (!current) return false;
						return FloAPI.findIncludedObjectById<TeamObject>(current.attributes.teamId, "team", bouts2)?.attributes.identityTeamId == team.identityTeamId;
					}),
				})),
			};

			// Update state
			setAthlete1Bouts(bouts1);
			setAthlete1Wrestlers(wrestlers1);
			setAthlete1Info(basicInfo1);

			setAthlete2Bouts(bouts2);
			setAthlete2Wrestlers(wrestlers2);
			setAthlete2Info(basicInfo2);

			// Update page title
			document.title = `${basicInfo1.name} vs ${basicInfo2.name} - FloStats`;

			progressCoordinator.complete();
		} catch (e) {
			console.error("Error loading comparison data:", e);
			nprogress.complete();
		} finally {
			setDownloading(false);
		}
	};

	return (
		<Stack w="100%" align="center" p="md">
			{downloading && <Overlay backgroundOpacity={0} blur={2} h="100%" fixed={true} />}

			<Title order={1}>Wrestler Comparison</Title>

			{/* Athlete Selection */}
			{(!athlete1Id || !athlete2Id) && <AthleteSelector />}

			{/* Athlete Info Cards */}
			{athlete1Info && athlete2Info && (
				<Group align="start" w="100%" grow>
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
				</Group>
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
			{athlete1Id && athlete2Id && athlete1Bouts && athlete2Bouts && (
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
