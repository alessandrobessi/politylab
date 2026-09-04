import type { SimulationConfig } from '../simulation/config';
import { clamp01, normalizeShares, safeDivide } from '../simulation/math';
import type { SeededRandom } from '../simulation/rng';
import type { Region } from '../simulation/models/region';
import type { Relation } from '../simulation/models/relation';
import type {
	GovernmentType,
	State,
	TechDomain,
	TechnologyState
} from '../simulation/models/state';
import { TECH_DOMAINS } from '../simulation/models/state';
import { computeFoodCapacity } from '../simulation/systems/food';
import { graphDistances, proximityFromDistance } from '../simulation/systems/geography';
import { computeMilitaryPower } from '../simulation/systems/military';
import { computeDesiredParticipation, computeEliteConflict } from '../simulation/systems/politics';
import { computeGdp, computeTfp } from '../simulation/systems/production';
import { distance } from './geometry';

const GOV_TYPES: GovernmentType[] = [
	'monarchy',
	'constitutional-monarchy',
	'republic',
	'oligarchy',
	'autocracy',
	'military-regime',
	'federation'
];
const GOV_WEIGHTS = [0.22, 0.1, 0.16, 0.18, 0.18, 0.1, 0.06];

/** Typical starting budget (MODEL.md §17), perturbed per state. */
const BASE_BUDGET = {
	infrastructure: 0.2,
	education: 0.15,
	research: 0.08,
	military: 0.25,
	welfare: 0.12,
	administration: 0.2
};

export interface TerritoryResult {
	/** Region index → owning state id. */
	ownerByRegion: string[];
	/** State id → owned region indices. */
	regionsByState: Map<string, number[]>;
	/** State id → set of adjacent state ids. */
	adjacency: Map<string, Set<string>>;
}

/** Contiguous multi-region territories by round-robin flood fill from spread seeds. */
export function assignTerritory(
	rng: SeededRandom,
	regions: Region[],
	stateCount: number
): TerritoryResult {
	const n = regions.length;
	const fillRng = rng.fork('territory');
	const stateIds = Array.from({ length: stateCount }, (_, i) => `s${i}`);
	const indexById = new Map(regions.map((r, i) => [r.id, i]));

	// Spread seed regions: first at random, each next far from those chosen.
	const seeds: number[] = [fillRng.int(0, n)];
	while (seeds.length < stateCount) {
		const scored = regions.map((r, i) => {
			let minD = Infinity;
			for (const s of seeds) minD = Math.min(minD, distance(r.site, regions[s]!.site));
			return { i, minD };
		});
		scored.sort((a, b) => b.minD - a.minD);
		const poolSize = Math.max(1, Math.floor(scored.length * 0.15));
		seeds.push(scored[fillRng.int(0, poolSize)]!.i);
	}

	const owner: (string | null)[] = new Array(n).fill(null);
	const frontiers: number[][] = stateIds.map((id, k) => {
		owner[seeds[k]!] = id;
		return [seeds[k]!];
	});

	let remaining = n - stateCount;
	while (remaining > 0 && frontiers.some((f) => f.length > 0)) {
		const order = fillRng.shuffle([...stateIds.keys()]);
		for (const k of order) {
			const id = stateIds[k]!;
			const next: number[] = [];
			for (const regionIndex of frontiers[k]!) {
				for (const neighborRegionId of regions[regionIndex]!.neighbors) {
					const j = indexById.get(neighborRegionId);
					if (j === undefined || owner[j] !== null) continue;
					owner[j] = id;
					next.push(j);
					remaining--;
				}
			}
			frontiers[k] = next;
		}
	}

	// Any stragglers (disconnected graph) join a neighbouring state, else nearest seed.
	for (let i = 0; i < n; i++) {
		if (owner[i] !== null) continue;
		const neighborOwner = regions[i]!.neighbors.map((rid) => indexById.get(rid))
			.filter((j): j is number => j !== undefined && owner[j] !== null)
			.map((j) => owner[j]!)[0];
		if (neighborOwner) {
			owner[i] = neighborOwner;
		} else {
			let best = 0;
			let bestD = Infinity;
			seeds.forEach((s, k) => {
				const d = distance(regions[i]!.site, regions[s]!.site);
				if (d < bestD) {
					bestD = d;
					best = k;
				}
			});
			owner[i] = stateIds[best]!;
		}
	}

	const ownerByRegion = owner as string[];
	const regionsByState = new Map<string, number[]>(stateIds.map((id) => [id, []]));
	ownerByRegion.forEach((id, i) => {
		regionsByState.get(id)!.push(i);
		regions[i]!.ownerId = id;
	});

	const adjacency = new Map<string, Set<string>>(stateIds.map((id) => [id, new Set()]));
	for (let i = 0; i < n; i++) {
		const a = ownerByRegion[i]!;
		for (const neighborRegionId of regions[i]!.neighbors) {
			const j = indexById.get(neighborRegionId);
			if (j === undefined) continue;
			const b = ownerByRegion[j]!;
			if (a !== b) adjacency.get(a)!.add(b);
		}
	}

	return { ownerByRegion, regionsByState, adjacency };
}

function rollTechnology(rng: SeededRandom): TechnologyState {
	const base = rng.range(0.1, 0.3);
	return Object.fromEntries(
		TECH_DOMAINS.map((d) => [d, clamp01(base + rng.range(-0.05, 0.05))])
	) as TechnologyState;
}

function rollBudget(rng: SeededRandom): State['budget'] {
	const jitter = (base: number) => Math.max(0.02, base + rng.range(-0.05, 0.05));
	return normalizeShares({
		infrastructure: jitter(BASE_BUDGET.infrastructure),
		education: jitter(BASE_BUDGET.education),
		research: jitter(BASE_BUDGET.research),
		military: jitter(BASE_BUDGET.military),
		welfare: jitter(BASE_BUDGET.welfare),
		administration: jitter(BASE_BUDGET.administration)
	});
}

/**
 * Build the eight (or `stateCount`) states: seeded asymmetric structural
 * variables (MODEL.md §5, §76), food-calibrated populations (MODEL.md §9),
 * and derived economic / military / fiscal starting values.
 */
export function buildStates(
	rng: SeededRandom,
	regions: Region[],
	populationWeights: number[],
	territory: TerritoryResult,
	config: SimulationConfig,
	nameFor: () => string
): State[] {
	const statsRng = rng.fork('stateStats');
	const alpha = config.economy.capitalElasticity;
	const halfSat = config.economy.prosperityHalfSaturation;
	const scale = config.food.areaCapacityScale;

	const stateIds = [...territory.regionsByState.keys()];
	const states: State[] = [];

	for (let s = 0; s < stateIds.length; s++) {
		const id = stateIds[s]!;
		const regionIdx = territory.regionsByState.get(id)!;
		const regs = regionIdx.map((i) => regions[i]!);
		const meanInfra = regs.reduce((a, r) => a + r.infrastructure, 0) / regs.length;
		const coastalFraction = regs.filter((r) => r.terrain === 'coastal').length / regs.length;

		const technology = rollTechnology(statsRng);
		const researchPriorities = Object.fromEntries(
			TECH_DOMAINS.map((d) => [d, statsRng.range(0.5, 1.5)])
		) as Record<TechDomain, number>;

		const education = statsRng.range(0.1, 0.35);
		const urbanization = statsRng.range(0.05, 0.25);
		const inequality = statsRng.range(0.25, 0.65);
		const taxRate = statsRng.range(0.12, 0.28);

		const stability = statsRng.range(0.45, 0.85);
		const legitimacy = statsRng.range(0.4, 0.75);
		const institutionalCapacity = statsRng.range(0.25, 0.6);
		const ruleOfLaw = statsRng.range(0.2, 0.7);
		const centralization = statsRng.range(0.3, 0.8);
		const politicalParticipation = statsRng.range(0.1, 0.55);

		const governmentType = statsRng.weighted(GOV_TYPES, GOV_WEIGHTS);
		const hereditary =
			governmentType === 'monarchy' || governmentType === 'constitutional-monarchy';

		const factions = normalizeShares({
			elite: statsRng.range(0.1, 1),
			merchant: statsRng.range(0.1, 1),
			military: statsRng.range(0.1, 1),
			worker: statsRng.range(0.1, 1)
		});

		const budget = rollBudget(statsRng);
		const economy = normalizeShares({
			agriculture: statsRng.range(0.55, 0.85),
			industry: statsRng.range(0.08, 0.25),
			services: statsRng.range(0.03, 0.15)
		});

		const tradeOpenness = clamp01(0.15 + 0.4 * coastalFraction + statsRng.range(0, 0.15));

		// Food capacity (MODEL.md §9), then population from a per-state target ratio.
		const foodCapacity = computeFoodCapacity(technology.agriculture, stability, regs, scale);
		const targetFoodRatio = statsRng.range(0.95, 1.28);
		const population = Math.max(1, foodCapacity / targetFoodRatio);
		const foodRatio = safeDivide(foodCapacity, population, 1);
		const foodStress = clamp01((1 - foodRatio) / 0.4);

		// Distribute population across owned regions by fertility weight.
		const weightSum = regionIdx.reduce((a, i) => a + populationWeights[i]!, 0);
		for (const i of regionIdx) {
			regions[i]!.population = (population * populationWeights[i]!) / weightSum;
		}
		const territoryArea = regs.reduce((a, r) => a + r.area, 0);

		// Productivity (MODEL.md §14) → capital → GDP (Cobb–Douglas, MODEL.md §13).
		const productivity = computeTfp(
			technology,
			institutionalCapacity,
			stability,
			meanInfra,
			tradeOpenness,
			config
		);

		const capital = statsRng.range(0.8, 2.5) * population;
		const gdp = computeGdp(productivity, capital, population, alpha);
		const gdpPerCapita = safeDivide(gdp, population);
		const prosperity = clamp01(gdpPerCapita / (gdpPerCapita + halfSat));

		const taxEfficiency = 0.45 + 0.55 * institutionalCapacity;
		const revenue = gdp * taxRate * taxEfficiency;
		const spending: State['spending'] = {
			infrastructure: budget.infrastructure * revenue,
			education: budget.education * revenue,
			research: budget.research * revenue,
			military: budget.military * revenue,
			welfare: budget.welfare * revenue,
			administration: budget.administration * revenue
		};
		const treasury = statsRng.range(0, 0.5) * revenue;
		const debt = statsRng.range(0, 0.4) * gdp;
		const debtRatio = safeDivide(debt, gdp);
		const debtStress = clamp01((debtRatio - 0.5) / 1.5);

		const militarySpending = budget.military * revenue;
		const militaryCapital = statsRng.range(1.5, 6) * militarySpending;
		const militaryPower = computeMilitaryPower(
			militaryCapital,
			population,
			technology.military,
			technology.transport,
			meanInfra,
			stability
		);

		const participationGap = Math.max(
			0,
			computeDesiredParticipation(education, urbanization, factions) - politicalParticipation
		);
		const eliteConflict = computeEliteConflict(participationGap, factions, inequality);

		states.push({
			id,
			name: nameFor(),
			alive: true,
			colorHue: (s * (360 / stateIds.length) + statsRng.range(-12, 12) + 360) % 360,

			population,
			territory: territoryArea,

			foodCapacity,
			foodRatio,
			foodStress,

			capital,
			gdp,
			gdpPerCapita,
			productivity,
			prosperity,
			economy,
			growth: { gdp: 0, gdpPerCapita: 0, population: 0 },
			economicStress: 0,

			revenue,
			spending,
			treasury,
			debt,
			debtRatio,
			debtStress,
			taxRate,
			budget,

			education,
			urbanization,
			inequality,

			technology,
			researchPriorities,

			politics: {
				governmentType,
				hereditary,
				legitimacy,
				stability,
				politicalParticipation,
				centralization,
				ruleOfLaw,
				institutionalCapacity,
				factions,
				eliteConflict,
				participationGap
			},

			military: {
				capital: militaryCapital,
				power: militaryPower,
				readiness: statsRng.range(0.5, 0.8),
				morale: clamp01(0.5 + 0.4 * stability),
				spending: militarySpending,
				burden: safeDivide(militarySpending, gdp)
			},

			tradeOpenness,
			overextension: 0,
			warExhaustion: 0,
			relations: {}
		});
	}

	initRelations(rng, states, territory.adjacency);
	return states;
}

/** Seed every bilateral relation (MODEL.md §44–§48). */
function initRelations(
	rng: SeededRandom,
	states: State[],
	adjacency: Map<string, Set<string>>
): void {
	const relRng = rng.fork('relations');
	const ids = states.map((s) => s.id);
	const distances = graphDistances(ids, adjacency);

	for (let i = 0; i < states.length; i++) {
		for (let j = i + 1; j < states.length; j++) {
			const a = states[i]!;
			const b = states[j]!;
			const d = distances.get(a.id)?.get(b.id) ?? Infinity;
			const proximity = proximityFromDistance(d);
			const neighbors = d === 1;

			const opinion = relRng.range(-0.2, 0.2);
			const trust = relRng.range(0.2, 0.5);
			const trade = clamp01(proximity * relRng.range(0, 0.25));
			const rivalry = neighbors ? relRng.range(0, 0.35) : clamp01(proximity * relRng.range(0, 0.1));
			const borderTension = neighbors ? relRng.range(0, 0.3) : 0;
			const claimAB = neighbors ? relRng.range(0, 0.15) : 0;
			const claimBA = neighbors ? relRng.range(0, 0.15) : 0;

			const hostility = clamp01((-opinion + 1) / 2);
			const threatFrom = (self: State, other: State) =>
				clamp01(
					safeDivide(other.military.power, self.military.power + other.military.power) *
						proximity *
						(0.5 + 0.5 * hostility)
				);

			a.relations[b.id] = makeRelation({
				opinion,
				trust,
				trade,
				rivalry,
				borderTension,
				territorialClaims: claimAB,
				threatPerception: threatFrom(a, b),
				proximity
			});
			b.relations[a.id] = makeRelation({
				opinion,
				trust,
				trade,
				rivalry,
				borderTension,
				territorialClaims: claimBA,
				threatPerception: threatFrom(b, a),
				proximity
			});
		}
	}
}

function makeRelation(overrides: Partial<Relation>): Relation {
	return {
		opinion: 0,
		trust: 0.3,
		trade: 0,
		rivalry: 0,
		borderTension: 0,
		territorialClaims: 0,
		threatPerception: 0,
		warMemory: 0,
		proximity: 0,
		alliance: false,
		atWar: false,
		allianceSince: null,
		lastWarEndYear: null,
		...overrides
	};
}
