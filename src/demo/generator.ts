import type { AthleteBouts, AthleteWrestlers } from "../utils/athleteData";
import type { FloObject } from "../api/types/types";
import type { EventObject } from "../api/types/objects/event";
import type { TeamObject } from "../api/types/objects/team";
import type { WeightClassObject } from "../api/types/objects/weightClass";
import type { DivisionObject } from "../api/types/objects/division";
import type { RoundNameObject } from "../api/types/objects/roundName";
import type { BracketPlacementObject } from "../api/types/objects/bracketPlacement";
import type { PlacementIndex } from "../utils/placementIndex";
import { pointsForPlacement, type MaTournamentType } from "../utils/seedingCriteria";

export const DEMO_SEED = 20261116;
export const DEMO_YEARS = [2023, 2024, 2025, 2026];
export const WEIGHTS = [106, 113, 120, 126, 132, 138, 144, 150, 157, 165, 175, 190, 215, 285];
type Registration = AthleteWrestlers["data"][number];
type Bout = AthleteBouts["data"][number];
export type DemoPerson = { id: string; node: number; first: string; last: string; team: number; lane: number; graduation: number; skill: number; growth: number };
export type DemoDataset = {
	seed: number;
	people: DemoPerson[];
	teams: TeamObject[];
	events: EventObject[];
	bouts: Bout[];
	registrations: Registration[];
	registrationsById: Map<string, Registration>;
	objects: Map<string, FloObject>;
	boutsByPerson: Map<string, Bout[]>;
	registrationsByPerson: Map<string, Registration[]>;
	indexes: Map<number, PlacementIndex>;
};

/** Mulberry32; no Math.random, wall clock, locale, or network input. */
function randomSource(seed: number) {
	let state = seed >>> 0;
	return () => {
		state += 0x6d2b79f5;
		let t = Math.imul(state ^ state >>> 15, 1 | state);
		t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
export function personId(index: number): string {
	return `de000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, "0")}`;
}

/** A closed fictional league. Scale is adjustable in multiples of eight teams. */
export function generateDataset(seed = DEMO_SEED, teamCount = 32): DemoDataset {
	if (teamCount < 16 || teamCount > 48 || teamCount % 8) throw new Error("Use 16–48 teams in multiples of eight");
	const random = randomSource(seed);
	const pick = <T,>(values: T[]): T => values[Math.floor(random() * values.length)];
	const shuffle = <T,>(values: T[]): T[] => {
		const out = [...values];
		for (let i = out.length - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[out[i], out[j]] = [out[j], out[i]];
		}
		return out;
	};
	const stamp = "2022-01-01T00:00:00.000Z";
	const audit = { createdByUserId: "demo", createdDateTimeUtc: stamp, modifiedByUserId: "demo", modifiedDateTimeUtc: stamp };
	const location = { id: "demo-location", address: null, city: "Alderhaven", country: "USA", googlePlaceId: null, latitude: null, longitude: null, name: "Fictional New England League", state: "MA", zipCode: null };
	const data: DemoDataset = { seed, people: [], teams: [], events: [], bouts: [], registrations: [], registrationsById: new Map(), objects: new Map(), boutsByPerson: new Map(), registrationsByPerson: new Map(), indexes: new Map() };
	const add = <T extends FloObject>(object: T): T => { data.objects.set(`${object.type}:${object.id}`, object); return object; };
	const firsts = ["Adrian", "Elias", "Rowan", "Miles", "Theo", "Nolan", "Jasper", "Caleb", "Silas", "Owen", "Ezra", "Felix", "Jonah", "Luca", "Reed", "Emmett", "Asher", "Cole", "Dorian", "Finn", "Gavin", "Hugo", "Isaac", "Julian", "Kai", "Leon", "Micah", "Nico", "Orion", "Quinn", "Ronan", "Soren"];
	const lasts = ["Alderwick", "Briarford", "Cedarvale", "Dunmere", "Everholt", "Fenwicke", "Glenmere", "Hawkridge", "Iversonne", "Juniper", "Kingswell", "Larkspur", "Marlowe", "Northvale", "Oakmere", "Pinehurst", "Quillford", "Ridgewell", "Stonebrook", "Thornvale", "Underhill", "Valewood", "Westmere", "Yarrowell", "Ashcombe", "Brookmere", "Crestwood", "Dalesworth", "Elmwick", "Fairholt", "Greymere", "Hartwell"];
	const towns = ["Alderhaven", "Briarmont", "Cedar Hollow", "Dunridge", "Ember Glen", "Fernhaven", "Glenbrook Vale", "Hawkmere", "Ivydale", "Juniper Ridge", "Kestrel Bay", "Larkhaven", "Mossfield", "North Ember", "Oakmarsh", "Pinecrest Vale", "Quillhaven", "Raven Hollow", "Silvermere", "Thornhaven", "Umber Falls", "Valecrest", "Willowmere", "Yarrow Bay", "Ashenbrook", "Brindle Cove", "Copper Glen", "Driftwood Vale", "Elmharbor", "Foxmere", "Golden Hollow", "Hazelwick", "Ironglen", "Jadehaven", "Kingferry", "Lindenmere", "Maplewick", "Nettle Cove", "Orchard Vale", "Pebblehaven", "Quartz Ridge", "Rosemere", "Sprucehaven", "Tamarack Vale", "Upper Briar", "Violet Glen", "Wintermere", "Zephyr Bay"];
	const usedNames = new Set<string>();
	for (let team = 0; team < teamCount; team++) {
		data.teams.push(add<TeamObject>({ type: "team", id: `demo-team-${team}`, attributes: { ...audit, createdByUserId: 0, modifiedByUserId: 0, identityTeamId: `demo-team-${team}`, eventId: "", name: `${towns[team]} High School`, abbreviation: `D${team + 1}`, city: towns[team], state: "MA", zipCode: null, registeredWrestlerCount: 12, location: { ...location, city: towns[team], name: towns[team] } } }));
		for (let lane = 0; lane < 12; lane++) {
			let first = pick(firsts), last = pick(lasts);
			while (usedNames.has(`${first} ${last}`)) { first = pick(firsts); last = pick(lasts); }
			usedNames.add(`${first} ${last}`);
			const i = data.people.length;
			data.people.push({ id: personId(i), node: i + 1, first, last, team, lane, graduation: team < teamCount / 2 ? 2026 : team < teamCount * 0.75 ? 2027 : 2028, skill: team === 0 ? 2.7 + random() : (random() + random() - 1) * 3, growth: random() * 0.6 });
		}
	}
	const byId = new Map(data.people.map(p => [p.id, p]));
	let eventNumber = 0;
	for (const year of DEMO_YEARS) {
		const season = year - 2023;
		const active = data.people.filter(p => year >= p.graduation - 3 && year <= p.graduation);
		const activeTeams = [...new Set(active.map(p => p.team))];
		const index: PlacementIndex = { year, builtAt: stamp, source: `Synthetic league • seed ${seed}`, personCount: 0, byPerson: {} };
		data.indexes.set(year, index);
		const firstDecember = new Date(Date.UTC(year - 1, 11, 1));
		const firstSaturday = 1 + (6 - firstDecember.getUTCDay() + 7) % 7;
		const dateAt = (day: number) => new Date(Date.UTC(year - 1, 11, firstSaturday + day, 14));
		const weightFor = (person: DemoPerson) => WEIGHTS[person.lane + Math.max(0, season - 1)];
		const makeEvent = (name: string, day: number, dual: boolean) => {
			const eventId = `demo-event-${++eventNumber}`;
			const start = dateAt(day).toISOString();
			const end = new Date(dateAt(day).getTime() + 8 * 3600000).toISOString();
			const event = add<EventObject>({ type: "event", id: eventId, attributes: { ...audit, apiHost: "", city: "Alderhaven", clonedFromEventId: null, description: "Entirely fictional wrestling event in the FloStats synthetic league.", endDateTime: end, firebasehost: "", isArenaSync: false, isDual: dual, isLivescorerTestMode: false, isParticipantWaiverRequired: false, isPresetTeams: true, isSetupComplete: true, isTestEvent: true, isVisible: true, location, locationName: "Synthetic League Fieldhouse", maxWrestlerCount: null, name, participantAlias: "Wrestler", participantAliasPlural: "Wrestlers", registrationReceiptMsg: "", resultsEmailsSentDateTime: null, sendAnnouncerChatsToAdmins: false, startDateTime: start, state: "MA", stripeAccountId: "", timeZone: "America/New_York", websiteUrl: "" } });
			data.events.push(event);
			const grade = { type: "grade" as const, id: `demo-grade-${year}`, attributes: { name: "Varsity", numericValue: 12, sequence: 12 } };
			const division = add<DivisionObject>({ type: "division", id: `${eventId}-division`, attributes: { ...audit, abbreviation: "HS", displayBlackWhite: false, divisionGroupingType: "grade", divisionProfileId: "demo", enableSeperateion: false, eventId, eventTimeZone: "America/New_York", floLevelId: "demo", hideByes: true, isDual: dual, isVarsity: true, maskSeeds: false, maxPerBracket: 8, measurementUnit: "lbs", name: "High School Varsity", oldestGrade: grade, oldestGradeId: grade.id, publishBrackets: true, sequence: 1, teamScoreGroupId: "demo", weighInEndDateTime: start, weighInStartDateTime: start, youngestGrade: grade, youngestGradeId: grade.id } });
			const registrations = new Map<string, Registration>();
			const weights = new Map<number, WeightClassObject>();
			function register(person: DemoPerson) {
				const existing = registrations.get(person.id);
				if (existing) return existing;
				const weight = weightFor(person);
				if (!weights.has(weight)) weights.set(weight, add<WeightClassObject>({ type: "weightClass", id: `${eventId}-${weight}`, attributes: { ...audit, createdByUserId: 0, modifiedByUserId: 0, divisionId: division.id, eventId, maxWeight: weight, minWeight: 0, maxWrestlerCount: 8, name: String(weight), sequence: weight } }));
				const weightClass = weights.get(weight)!;
				const team = data.teams[person.team];
				const gradeNumber = 12 - (person.graduation - year);
				const wrestler = add<Registration>({ type: "wrestler", id: `${eventId}-${person.id}`, attributes: { ...audit, identityPersonId: person.id, city: team.attributes.city!, state: "MA", divisionId: division.id, eventId, exactWeight: Math.round((weight - 0.2 - random() * 3.5) * 10) / 10, firstName: person.first, fullName: `${person.first} ${person.last}`, lastName: person.last, grade: { ...grade, attributes: { name: String(gradeNumber), numericValue: gradeNumber, sequence: gradeNumber } }, gradeId: null, dateOfBirth: null, gender: "Male", isSkinChecked: true, isTeamScorer: true, isWeighInOk: true, location: team.attributes.location, nickname: null, teamId: team.id, weightClassId: weightClass.id, withdrawn: false, zipCode: null }, relationships: { team: { data: { type: "team", id: team.id } }, division: { data: { type: "division", id: division.id } }, event: { data: { type: "event", id: eventId } }, weightClass: { data: { type: "weightClass", id: weightClass.id } }, bracketPlacements: { data: [] } } });
				registrations.set(person.id, wrestler);
				data.registrations.push(wrestler);
				data.registrationsById.set(wrestler.id, wrestler);
				const history = data.registrationsByPerson.get(person.id) ?? [];
				history.push(wrestler); data.registrationsByPerson.set(person.id, history);
				return wrestler;
			}
			function wrestle(a: DemoPerson, b: DemoPerson, round: number, pool: string, label: string, poolSize = 8) {
				const top = register(a), bottom = register(b);
				const strength = (p: DemoPerson) => p.skill + p.growth * (year - (p.graduation - 3));
				const aWins = random() < 1 / (1 + Math.exp((strength(b) - strength(a)) * 1.3));
				const winner = aWins ? top : bottom;
				const outcome = random();
				const gap = Math.abs(strength(a) - strength(b));
				const winType = outcome < 0.015 ? "FF" : outcome < 0.28 + Math.min(gap * 0.06, 0.18) ? "F" : outcome < 0.45 ? "TF" : outcome < 0.62 ? "MD" : "DEC";
				const low = Math.floor(random() * 7);
				const margin = winType === "TF" ? 15 : winType === "MD" ? 8 + Math.floor(random() * 7) : 1 + Math.floor(random() * 7);
				const seconds = winType === "FF" ? 0 : winType === "F" ? 20 + Math.floor(random() * 320) : winType === "TF" ? 120 + Math.floor(random() * 230) : 360;
				const start = new Date(new Date(event.attributes.startDateTime).getTime() + (round * 120 + Math.floor(random() * 20)) * 60000).toISOString();
				const end = new Date(new Date(start).getTime() + seconds * 1000).toISOString();
				const roundName = add<RoundNameObject>({ type: "roundName", id: `${eventId}-${round}-${label}`, attributes: { ...audit, eventId, systemName: label, displayName: label, sequence: round, visibility: 1 } });
				const boutId = `demo-bout-${data.bouts.length + 1}`;
				const bout = add<Bout>({ type: "bout", id: boutId, attributes: { eventId, dualId: dual ? eventId : null, bottomWrestlerId: bottom.id, bottomWrestlerScore: winType === "FF" ? 0 : aWins ? low : low + margin, boutNumber: String(data.bouts.length + 1), boutPoolId: pool, bracketSize: dual ? 2 : poolSize, createdDateTimeUtc: start, endDateTime: end, goDateTime: start, isBottomBye: false, isConfirmed: true, isConsolation: label.includes("Consolation"), isInProgress: false, isPlace: !dual && round === Math.log2(poolSize) - 1, isPrinted: false, isRepechange: false, isTopBye: false, loserToBoutId: null, mat: null, matchQueueId: "demo", maxPlace: dual ? 0 : poolSize, modifiedDateTimeUtc: end, naturalRound: round, redWrestler: top.id, result: winType === "F" ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : winType === "FF" ? "Forfeit" : `${low + margin}-${low}`, roundNameId: roundName.id, roundSpot: 0, sequenceNumber: data.bouts.length + 1, staticSequenceNumber: data.bouts.length + 1, topWrestlerId: top.id, topWrestlerScore: winType === "FF" ? 0 : aWins ? low + margin : low, trueRound: round, weightClassId: top.attributes.weightClassId, winType, winnerPoints: 0, winnerToBoutId: "", winnerToTop: false, winnerWrestlerId: winner.id }, relationships: { topWrestler: { data: { type: "wrestler", id: top.id } }, bottomWrestler: { data: { type: "wrestler", id: bottom.id } }, weightClass: { data: { type: "weightClass", id: top.attributes.weightClassId } }, roundName: { data: { type: "roundName", id: roundName.id } }, event: { data: { type: "event", id: eventId } } } });
				data.bouts.push(bout);
				for (const person of [a, b]) {
					const history = data.boutsByPerson.get(person.id) ?? [];
					history.push(bout); data.boutsByPerson.set(person.id, history);
				}
				return { winner: aWins ? a : b, loser: aWins ? b : a, bout };
			}
			return { event, register, wrestle };
		};
		// Circle schedule: eight distinct dual opponents, one event per team per week.
		const circle = [...activeTeams];
		for (let week = 0; week < 8; week++) {
			for (let pair = 0; pair < circle.length / 2; pair++) {
				const a = circle[pair], b = circle[circle.length - 1 - pair];
				const meet = makeEvent(`${year} ${towns[a]} vs ${towns[b]} Dual`, week * 7 + 4, true);
				for (let lane = 0; lane < 12; lane++) meet.wrestle(active.find(p => p.team === a && p.lane === lane)!, active.find(p => p.team === b && p.lane === lane)!, 0, meet.event.id, "Varsity Dual");
			}
			circle.splice(1, 0, circle.pop()!);
		}
		let qualifiers = new Set<string>();
		for (let tournament = 0; tournament < 6; tournament++) {
			const type: MaTournamentType | null = tournament === 4 ? "sectional" : tournament === 5 ? "divisionalState" : null;
			const names = ["Alderhaven Winter Classic", "Briarmont Holiday Invitational", "Cedar Hollow Challenge", "Hawkmere Varsity Open", "Demo MIAA D1N Sectional", "Demo MIAA D1 State Tournament"];
			const meet = makeEvent(`${year} ${names[tournament]}`, [0, 14, 28, 49, 70, 77][tournament], false);
			const eligible = tournament === 5 ? active.filter(p => qualifiers.has(p.id)) : active;
			const nextQualifiers = new Set<string>();
			for (let lane = 0; lane < 12; lane++) {
				const field = shuffle(eligible.filter(p => p.lane === lane));
				for (let offset = 0; offset < field.length; offset += 8) {
					const pool = `${meet.event.id}-pool-${lane}-${offset}`;
					const poolSize = Math.min(8, field.length - offset);
					// Full eight-person classification bracket: every place is decided on the mat.
					const bracket = (entrants: DemoPerson[], basePlace: number, round: number): DemoPerson[] => {
						if (entrants.length === 1) return entrants;
						const winners: DemoPerson[] = [], losers: DemoPerson[] = [];
						for (let i = 0; i < entrants.length; i += 2) {
							const label = round === Math.log2(poolSize) - 1 ? `${basePlace === 1 ? "Championship" : "Consolation"} ${basePlace}${basePlace === 1 ? "st" : basePlace === 3 ? "rd" : "th"} Place` : basePlace > 1 ? "Consolation" : round === 0 ? "Quarterfinal" : "Semifinal";
							const result = meet.wrestle(entrants[i], entrants[i + 1], round, pool, label, poolSize);
							winners.push(result.winner); losers.push(result.loser);
						}
						return [...bracket(winners, basePlace, round + 1), ...bracket(losers, basePlace + entrants.length / 2, round + 1)];
					};
					const ordered = bracket(field.slice(offset, offset + 8), 1, 0);
					ordered.forEach((person, rank) => {
						const wrestler = meet.register(person), place = rank + 1;
						const lastBout = data.boutsByPerson.get(person.id)!.slice(-1)[0];
						const placement = add<BracketPlacementObject>({ type: "bracketPlacement", id: `${pool}-place-${place}`, attributes: { boutId: lastBout.id, boutPoolId: pool, createdByUserId: "demo", createDateTimeUtc: meet.event.attributes.endDateTime, eventId: meet.event.id, modifiedByUserId: "demo", modifiedDateTimeUtc: meet.event.attributes.endDateTime, placement: place, placementDisplay: `${place}${place === 1 ? "st" : place === 2 ? "nd" : place === 3 ? "rd" : "th"}`, winnerPoints: 0, wrestlerId: wrestler.id } });
						wrestler.relationships.bracketPlacements.data.push({ type: "bracketPlacement", id: placement.id });
						if (place <= 4) nextQualifiers.add(person.id);
						if (type) {
							const points = pointsForPlacement(type, place);
							if (points > 0) {
								const record = index.byPerson[person.id] ?? { fullName: `${person.first} ${person.last}`, highestType: type, highestPoints: 0, placements: [] };
								record.placements.push({ type, tournament: meet.event.attributes.name, date: meet.event.attributes.startDateTime, weightClass: String(weightFor(person)), place, points });
								if (points > record.highestPoints) { record.highestPoints = points; record.highestType = type; }
								index.byPerson[person.id] = record;
							}
						}
					});
				}
			}
			qualifiers = nextQualifiers;
		}
		index.personCount = Object.keys(index.byPerson).length;
		Object.values(index.byPerson).forEach(record => record.placements.sort((a, b) => b.points - a.points));
	}
	// Ensure all generated identities have histories; this also catches schedule regressions.
	for (const id of byId.keys()) if (!data.boutsByPerson.has(id)) throw new Error(`Missing history for ${id}`);
	return data;
}
