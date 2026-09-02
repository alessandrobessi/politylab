/**
 * A hand-built two-state world for unit tests (BLUEPRINT.md milestone 3). Fully
 * deterministic and explicit — no RNG, no world generation. Values sit in the
 * MODEL.md §5 starting ranges and satisfy every `assertFiniteWorld` invariant.
 * Procedural generation arrives in M4.
 */

import { makeConfig } from '../config';
import { safeDivide } from '../math';
import type { Region, TerrainType } from '../models/region';
import type { Relation } from '../models/relation';
import type { State, TechDomain, TechnologyState, ResearchPriorities } from '../models/state';
import { TECH_DOMAINS } from '../models/state';
import type { World } from '../models/world';

function tech(value: number): TechnologyState {
	return Object.fromEntries(TECH_DOMAINS.map((d) => [d, value])) as TechnologyState;
}

function priorities(overrides: Partial<Record<TechDomain, number>> = {}): ResearchPriorities {
	return Object.fromEntries(TECH_DOMAINS.map((d) => [d, overrides[d] ?? 1])) as ResearchPriorities;
}

function relation(overrides: Partial<Relation>): Relation {
	return {
		opinion: 0,
		trust: 0.3,
		trade: 0.2,
		rivalry: 0.2,
		borderTension: 0.2,
		territorialClaims: 0,
		threatPerception: 0.2,
		warMemory: 0,
		proximity: 1,
		alliance: false,
		atWar: false,
		allianceSince: null,
		lastWarEndYear: null,
		...overrides
	};
}

/** 5×2 grid of unit regions; row 0 → first owner, row 1 → second owner. */
function makeRegions(owners: [string, string]): Region[] {
	const cols = 5;
	const rows = 2;
	const cell = 100;
	const terrainByRow: TerrainType[][] = [
		['coastal', 'plains', 'plains', 'hills', 'forest'],
		['plains', 'hills', 'mountains', 'mountains', 'desert']
	];
	const regions: Region[] = [];
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const index = row * cols + col;
			const neighbors: string[] = [];
			if (col > 0) neighbors.push(`r${index - 1}`);
			if (col < cols - 1) neighbors.push(`r${index + 1}`);
			if (row > 0) neighbors.push(`r${index - cols}`);
			if (row < rows - 1) neighbors.push(`r${index + cols}`);
			const x0 = col * cell;
			const y0 = row * cell;
			regions.push({
				id: `r${index}`,
				ownerId: owners[row]!,
				neighbors,
				area: cell * cell,
				population: row === 0 ? 600_000 : 300_000,
				agriculturalPotential: terrainByRow[row]![col] === 'mountains' ? 0.2 : 0.6,
				resources: {
					iron: terrainByRow[row]![col] === 'hills' ? 0.5 : 0.1,
					coal: terrainByRow[row]![col] === 'mountains' ? 0.6 : 0.1,
					oil: terrainByRow[row]![col] === 'desert' ? 0.4 : 0.05,
					minerals: terrainByRow[row]![col] === 'mountains' ? 0.7 : 0.2,
					genericResources: 0.3
				},
				terrain: terrainByRow[row]![col]!,
				infrastructure: row === 0 ? 0.4 : 0.25,
				site: [x0 + cell / 2, y0 + cell / 2],
				polygon: [
					[x0, y0],
					[x0 + cell, y0],
					[x0 + cell, y0 + cell],
					[x0, y0 + cell]
				]
			});
		}
	}
	return regions;
}

interface StateSeed {
	id: string;
	name: string;
	colorHue: number;
	population: number;
	gdp: number;
	capital: number;
	debt: number;
	treasury: number;
	foodCapacity: number;
	taxRate: number;
	education: number;
	urbanization: number;
	inequality: number;
	tradeOpenness: number;
	techLevel: number;
	militaryCapital: number;
	militaryPower: number;
	governmentType: State['politics']['governmentType'];
	hereditary: boolean;
	economy: State['economy'];
	budget: State['budget'];
	politics: Pick<
		State['politics'],
		| 'legitimacy'
		| 'stability'
		| 'politicalParticipation'
		| 'centralization'
		| 'ruleOfLaw'
		| 'institutionalCapacity'
		| 'eliteConflict'
		| 'participationGap'
	>;
	factions: State['politics']['factions'];
}

function makeState(seed: StateSeed, relations: Record<string, Relation>): State {
	const gdpPerCapita = safeDivide(seed.gdp, seed.population);
	const foodRatio = safeDivide(seed.foodCapacity, seed.population);
	const foodStress = Math.max(0, Math.min(1, (1 - foodRatio) / 0.4));
	const debtRatio = safeDivide(seed.debt, seed.gdp);
	const debtStress = Math.max(0, Math.min(1, (debtRatio - 0.5) / 1.5));
	const militarySpending = seed.budget.military * seed.gdp * seed.taxRate;

	return {
		id: seed.id,
		name: seed.name,
		alive: true,
		colorHue: seed.colorHue,

		population: seed.population,
		territory: 500 * 100, // five 100×100 regions

		foodCapacity: seed.foodCapacity,
		foodRatio,
		foodStress,

		capital: seed.capital,
		gdp: seed.gdp,
		gdpPerCapita,
		productivity: 1,
		prosperity: gdpPerCapita / (gdpPerCapita + 2),
		economy: { ...seed.economy },
		growth: { gdp: 0, gdpPerCapita: 0, population: 0 },
		economicStress: 0,

		treasury: seed.treasury,
		debt: seed.debt,
		debtRatio,
		debtStress,
		taxRate: seed.taxRate,
		budget: { ...seed.budget },

		education: seed.education,
		urbanization: seed.urbanization,
		inequality: seed.inequality,

		technology: tech(seed.techLevel),
		researchPriorities: priorities(),

		politics: {
			governmentType: seed.governmentType,
			hereditary: seed.hereditary,
			...seed.politics,
			factions: { ...seed.factions }
		},

		military: {
			capital: seed.militaryCapital,
			power: seed.militaryPower,
			readiness: 0.7,
			morale: 0.6 + 0.3 * seed.politics.stability,
			spending: militarySpending,
			burden: safeDivide(militarySpending, seed.gdp)
		},

		tradeOpenness: seed.tradeOpenness,
		overextension: 0,
		warExhaustion: 0,
		relations
	};
}

export function makeTinyWorld(): World {
	const regions = makeRegions(['ardan', 'velos']);

	const ardan = makeState(
		{
			id: 'ardan',
			name: 'Ardan Republic',
			colorHue: 210,
			population: 3_000_000,
			gdp: 4_800_000,
			capital: 9_000_000,
			debt: 1_000_000,
			treasury: 500_000,
			foodCapacity: 3_300_000,
			taxRate: 0.2,
			education: 0.3,
			urbanization: 0.2,
			inequality: 0.35,
			tradeOpenness: 0.3,
			techLevel: 0.25,
			militaryCapital: 2_000_000,
			militaryPower: 100,
			governmentType: 'republic',
			hereditary: false,
			economy: { agriculture: 0.45, industry: 0.3, services: 0.25 },
			budget: {
				infrastructure: 0.2,
				education: 0.15,
				research: 0.1,
				military: 0.2,
				welfare: 0.15,
				administration: 0.2
			},
			politics: {
				legitimacy: 0.65,
				stability: 0.75,
				politicalParticipation: 0.5,
				centralization: 0.45,
				ruleOfLaw: 0.55,
				institutionalCapacity: 0.5,
				eliteConflict: 0.2,
				participationGap: 0.05
			},
			factions: { elite: 0.3, merchant: 0.3, military: 0.2, worker: 0.2 }
		},
		{ velos: relation({ opinion: -0.1, territorialClaims: 0.1, threatPerception: 0.3 }) }
	);

	const velos = makeState(
		{
			id: 'velos',
			name: 'Velos',
			colorHue: 25,
			population: 1_500_000,
			gdp: 1_800_000,
			capital: 3_000_000,
			debt: 2_000_000,
			treasury: 200_000,
			foodCapacity: 1_425_000,
			taxRate: 0.16,
			education: 0.18,
			urbanization: 0.1,
			inequality: 0.55,
			tradeOpenness: 0.2,
			techLevel: 0.15,
			militaryCapital: 1_200_000,
			militaryPower: 80,
			governmentType: 'autocracy',
			hereditary: true,
			economy: { agriculture: 0.7, industry: 0.2, services: 0.1 },
			budget: {
				infrastructure: 0.18,
				education: 0.08,
				research: 0.05,
				military: 0.3,
				welfare: 0.12,
				administration: 0.27
			},
			politics: {
				legitimacy: 0.55,
				stability: 0.6,
				politicalParticipation: 0.2,
				centralization: 0.7,
				ruleOfLaw: 0.3,
				institutionalCapacity: 0.35,
				eliteConflict: 0.35,
				participationGap: 0.25
			},
			factions: { elite: 0.45, merchant: 0.15, military: 0.3, worker: 0.1 }
		},
		{
			ardan: relation({
				opinion: -0.2,
				trust: 0.35,
				territorialClaims: 0.4,
				threatPerception: 0.45
			})
		}
	);

	return {
		seed: 481204,
		year: 0,
		width: 500,
		height: 200,
		states: [ardan, velos],
		regions,
		wars: [],
		events: [],
		config: makeConfig(),
		nextId: 0
	};
}
