/**
 * MODEL.md §78 "Initial Monte Carlo Warning Rules". Each rule flags a
 * calibration problem (not necessarily a bug). Most rules are per-world; the
 * hegemony rule is a property of the whole batch.
 */

import type { WorldMetrics } from './metrics';

export interface PathologyFlag {
	id: string;
	rule: string;
	/** Seeds exhibiting the pattern. */
	seeds: number[];
	/** How many worlds tripped it, and the share of the batch. */
	count: number;
	share: number;
	/** True when this flag should be treated as a calibration failure. */
	fired: boolean;
}

const PER_WORLD: Array<{ id: string; rule: string; hit: (m: WorldMetrics) => boolean }> = [
	{
		id: '7rqp01',
		rule: '>90% of states disappear before year 100',
		hit: (m) => m.startingStates > 0 && m.earlyExtinctions / m.startingStates > 0.9
	},
	{
		id: 'b4n6sk',
		rule: 'no war occurs in 1,000 years',
		hit: (m) => m.years >= 1000 && m.numberOfWars === 0
	},
	{
		id: 'g2yf64',
		rule: 'a single war lasts >150 years',
		hit: (m) => m.longestWarDuration > 150
	},
	{
		id: 's6j4is',
		rule: 'all states reach technology >0.95 before year 250',
		hit: (m) => m.minTechnologyAt250 !== null && m.minTechnologyAt250 > 0.95
	},
	{
		id: 'td6ki3',
		rule: 'all states converge to the same government',
		hit: (m) => m.livingStates > 1 && Object.keys(m.governmentDistribution).length === 1
	},
	{
		id: 'o9i447',
		rule: 'world population grows >1000× without corresponding food-capacity growth',
		hit: (m) =>
			m.populationGrowthFactor > 1000 && m.foodCapacityGrowthFactor < m.populationGrowthFactor / 10
	}
];

export function detectPathologies(all: WorldMetrics[]): PathologyFlag[] {
	const flags: PathologyFlag[] = [];
	const n = Math.max(1, all.length);

	for (const { id, rule, hit } of PER_WORLD) {
		const seeds = all.filter(hit).map((m) => m.seed);
		flags.push({
			id,
			rule,
			seeds,
			count: seeds.length,
			share: seeds.length / n,
			fired: seeds.length > 0
		});
	}

	// Batch-level: one state controls >90% of world territory in >50% of seeds.
	const hegemonSeeds = all.filter((m) => m.largestEmpireShare > 0.9).map((m) => m.seed);
	flags.push({
		id: 'c4haqr',
		rule: 'one state controls >90% of world territory in >50% of seeds',
		seeds: hegemonSeeds,
		count: hegemonSeeds.length,
		share: hegemonSeeds.length / n,
		fired: hegemonSeeds.length / n > 0.5
	});

	return flags;
}

export function firedPathologies(flags: PathologyFlag[]): PathologyFlag[] {
	return flags.filter((f) => f.fired);
}
