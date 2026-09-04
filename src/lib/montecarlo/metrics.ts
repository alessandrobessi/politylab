/**
 * Per-world metrics for Monte Carlo calibration (BLUEPRINT.md §40). Pure
 * functions over a finished `World` and its `WorldHistory` — no engine coupling,
 * no RNG, safe to run in Node.
 */

import {
	technologyIndex,
	type State,
	type StateYearStats,
	type War,
	type World,
	type WorldHistory
} from '$lib/simulation';

export interface WorldMetrics {
	seed: number;
	years: number;

	/** Wars declared over the run (ended wars are retained in `world.wars`). */
	numberOfWars: number;
	/** Mean `endYear − startYear` over concluded wars (0 if none concluded). */
	averageWarDuration: number;
	/** Longest single war in years (concluded or still running at the end). */
	longestWarDuration: number;

	/** Mean years survived; a state alive at the end contributes the full run. */
	averageStateLifespan: number;
	/** Fraction of states no longer alive at the end. */
	stateExtinctionRate: number;
	/** Number of states whose `alive` flag went false before year 100. */
	earlyExtinctions: number;

	/** Largest living state's share of all living territory, 0..1. */
	largestEmpireShare: number;
	/** Herfindahl index of territory shares across living states, 0..1. */
	territorialConcentration: number;

	/** Gini coefficient of GDP across living states, 0..1. */
	gdpInequality: number;
	gdpPerCapita: Distribution;

	technologyIndex: Distribution;
	/** 1 − (max − min) of the technology index across living states, 0..1. */
	technologyConvergence: number;
	/** Min technology index across living states at year 250 (null if run < 250y). */
	minTechnologyAt250: number | null;

	/** Living-state counts keyed by government type. */
	governmentDistribution: Record<string, number>;
	/** Government-type changes summed over every state's recorded history. */
	politicalTransitions: number;

	/** Allied ordered pairs ÷ all ordered pairs among living states, 0..1. */
	allianceFrequency: number;

	livingStates: number;
	/** Number of states the world started with (dead states are retained). */
	startingStates: number;
	/** world population at the end ÷ world population at year 0. */
	populationGrowthFactor: number;
	/** world food capacity at the end ÷ food capacity at year 0. */
	foodCapacityGrowthFactor: number;
}

export interface Distribution {
	min: number;
	median: number;
	max: number;
	mean: number;
}

function distribution(values: number[]): Distribution {
	if (values.length === 0) return { min: 0, median: 0, max: 0, mean: 0 };
	const sorted = [...values].sort((a, b) => a - b);
	const n = sorted.length;
	const mid = n >> 1;
	const median = n % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
	const mean = sorted.reduce((a, b) => a + b, 0) / n;
	return { min: sorted[0]!, median, max: sorted[n - 1]!, mean };
}

/** Gini coefficient of a non-negative sample (0 = equal, →1 = concentrated). */
export function gini(values: number[]): number {
	const xs = values.filter((v) => v >= 0);
	const n = xs.length;
	if (n === 0) return 0;
	const total = xs.reduce((a, b) => a + b, 0);
	if (total === 0) return 0;
	xs.sort((a, b) => a - b);
	let cum = 0;
	for (let i = 0; i < n; i++) cum += (i + 1) * xs[i]!;
	return (2 * cum) / (n * total) - (n + 1) / n;
}

function herfindahl(shares: number[]): number {
	return shares.reduce((acc, s) => acc + s * s, 0);
}

function warDuration(w: War, endYear: number): number {
	return (w.endYear ?? endYear) - w.startYear;
}

/** Year a state's `alive` flag first went false, or null if it never did. */
function deathYear(rows: StateYearStats[] | undefined): number | null {
	if (!rows) return null;
	for (const row of rows) if (!row.alive) return row.year;
	return null;
}

function countTransitions(rows: StateYearStats[] | undefined): number {
	if (!rows || rows.length < 2) return 0;
	let changes = 0;
	for (let i = 1; i < rows.length; i++) {
		if (rows[i]!.governmentType !== rows[i - 1]!.governmentType) changes++;
	}
	return changes;
}

function minTechAt(history: WorldHistory, year: number): number | null {
	const perState = Object.values(history.byState);
	if (perState.length === 0) return null;
	let min = Infinity;
	let found = false;
	for (const rows of perState) {
		const row = rows.find((r) => r.year === year);
		if (!row || !row.alive) continue;
		found = true;
		if (row.technologyIndex < min) min = row.technologyIndex;
	}
	return found ? min : null;
}

export function collectMetrics(world: World, history: WorldHistory): WorldMetrics {
	const years = world.year;
	const living = world.states.filter((s) => s.alive);
	const territories = living.map((s) => Math.max(0, s.territory));
	const totalTerritory = territories.reduce((a, b) => a + b, 0);
	const shares = totalTerritory > 0 ? territories.map((t) => t / totalTerritory) : [];

	const concluded = world.wars.filter((w) => w.endYear !== null);
	const durations = world.wars.map((w) => warDuration(w, years));

	const lifespans = world.states.map((s) => {
		const dy = deathYear(history.byState[s.id]);
		return dy ?? years;
	});

	const govDist: Record<string, number> = {};
	for (const s of living) {
		govDist[s.politics.governmentType] = (govDist[s.politics.governmentType] ?? 0) + 1;
	}

	const techIdx = living.map((s) => technologyIndex(s.technology));
	const gdpPc = living.map((s) => s.gdpPerCapita);

	const pairCount = living.length * (living.length - 1);
	let alliedPairs = 0;
	for (const a of living) {
		for (const b of living) {
			if (a.id === b.id) continue;
			if (a.relations[b.id]?.alliance) alliedPairs++;
		}
	}

	const initialPop = sumField(history, 'population', 0);
	const finalPop = world.states.reduce((a, s) => a + s.population, 0);
	const initialFood = firstSnapshotFood(world, history);
	const finalFood = world.states.reduce((a, s) => a + s.foodCapacity, 0);

	return {
		seed: world.seed,
		years,
		numberOfWars: world.wars.length,
		averageWarDuration:
			concluded.length > 0
				? concluded.reduce((a, w) => a + warDuration(w, years), 0) / concluded.length
				: 0,
		longestWarDuration: durations.length > 0 ? Math.max(...durations) : 0,
		averageStateLifespan: lifespans.reduce((a, b) => a + b, 0) / Math.max(1, lifespans.length),
		stateExtinctionRate: world.states.length > 0 ? 1 - living.length / world.states.length : 0,
		earlyExtinctions: world.states.filter((s) => {
			const dy = deathYear(history.byState[s.id]);
			return dy !== null && dy < 100;
		}).length,
		largestEmpireShare: shares.length > 0 ? Math.max(...shares) : 0,
		territorialConcentration: herfindahl(shares),
		gdpInequality: gini(living.map((s) => s.gdp)),
		gdpPerCapita: distribution(gdpPc),
		technologyIndex: distribution(techIdx),
		technologyConvergence:
			techIdx.length > 0 ? 1 - (Math.max(...techIdx) - Math.min(...techIdx)) : 1,
		minTechnologyAt250: years >= 250 ? minTechAt(history, 250) : null,
		governmentDistribution: govDist,
		politicalTransitions: world.states.reduce(
			(a, s) => a + countTransitions(history.byState[s.id]),
			0
		),
		allianceFrequency: pairCount > 0 ? alliedPairs / pairCount : 0,
		livingStates: living.length,
		startingStates: world.states.length,
		populationGrowthFactor: initialPop > 0 ? finalPop / initialPop : 1,
		foodCapacityGrowthFactor: initialFood > 0 ? finalFood / initialFood : 1
	};
}

function sumField(history: WorldHistory, field: 'population', year: number): number {
	let total = 0;
	for (const rows of Object.values(history.byState)) {
		const row = rows.find((r) => r.year === year);
		if (row) total += row[field];
	}
	return total;
}

function firstSnapshotFood(world: World, history: WorldHistory): number {
	const zero = history.snapshots.find((s) => s.year === 0);
	if (zero) return zero.world.states.reduce((a, s) => a + s.foodCapacity, 0);
	// Fall back to the current food capacity if no year-0 snapshot was kept.
	return world.states.reduce((a: number, s: State) => a + s.foodCapacity, 0);
}
