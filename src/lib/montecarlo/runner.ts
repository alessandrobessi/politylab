/**
 * Headless Monte Carlo runner (BLUEPRINT.md §27, §40). Runs N worlds for M years
 * with no UI, collects per-world metrics, aggregates them, and applies the
 * MODEL.md §78 warning rules. Framework-free — driven from `scripts/montecarlo.ts`
 * and from `tests/`.
 */

import { createSimulation } from '$lib/simulation';
import { generateWorld, type WorldGenOptions } from '$lib/worldgen';
import { collectMetrics, gini, type Distribution, type WorldMetrics } from './metrics';
import { detectPathologies, firedPathologies, type PathologyFlag } from './pathology';

export interface BatchOptions {
	worlds: number;
	years: number;
	/** First seed; subsequent worlds use `seed + i`. Default 1. */
	seed?: number;
	/** Passed through to `generateWorld` (state count, region count). */
	worldgen?: WorldGenOptions;
	/** Called after each world with 1-based progress. */
	onProgress?: (done: number, total: number) => void;
}

export interface BatchSummary {
	worlds: number;
	years: number;
	seedRange: [number, number];

	meanWars: number;
	meanWarDuration: number;
	meanStateLifespan: number;
	meanExtinctionRate: number;
	meanLargestEmpireShare: number;
	meanTerritorialConcentration: number;
	meanGdpInequality: number;
	meanTechnologyConvergence: number;
	meanPoliticalTransitions: number;
	meanAllianceFrequency: number;

	/** Fraction of worlds where one state ended with >90% of world territory. */
	hegemonyShare: number;
	/** Fraction of worlds with at least one war. */
	worldsWithWar: number;
	/** Government types seen as the plurality across worlds, with counts. */
	governmentPlurality: Record<string, number>;
	/** Distribution of "living states at the end" across the batch. */
	survivors: Distribution;

	pathologies: PathologyFlag[];
	firedPathologies: PathologyFlag[];
}

export interface BatchResult {
	summary: BatchSummary;
	perWorld: WorldMetrics[];
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

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Run one world and return its metrics. Exposed for targeted tests. */
export function runWorld(seed: number, years: number, worldgen?: WorldGenOptions): WorldMetrics {
	const sim = createSimulation(generateWorld(seed, worldgen));
	sim.run(years);
	return collectMetrics(sim.world, sim.history);
}

export function runBatch(options: BatchOptions): BatchResult {
	const { worlds, years, seed = 1, worldgen, onProgress } = options;
	const perWorld: WorldMetrics[] = [];

	for (let i = 0; i < worlds; i++) {
		perWorld.push(runWorld(seed + i, years, worldgen));
		onProgress?.(i + 1, worlds);
	}

	const pathologies = detectPathologies(perWorld);
	const govPlurality: Record<string, number> = {};
	for (const m of perWorld) {
		let best: string | null = null;
		let bestN = -1;
		for (const [g, c] of Object.entries(m.governmentDistribution)) {
			if (c > bestN) {
				best = g;
				bestN = c;
			}
		}
		if (best) govPlurality[best] = (govPlurality[best] ?? 0) + 1;
	}

	const summary: BatchSummary = {
		worlds,
		years,
		seedRange: [seed, seed + worlds - 1],
		meanWars: mean(perWorld.map((m) => m.numberOfWars)),
		meanWarDuration: mean(perWorld.map((m) => m.averageWarDuration)),
		meanStateLifespan: mean(perWorld.map((m) => m.averageStateLifespan)),
		meanExtinctionRate: mean(perWorld.map((m) => m.stateExtinctionRate)),
		meanLargestEmpireShare: mean(perWorld.map((m) => m.largestEmpireShare)),
		meanTerritorialConcentration: mean(perWorld.map((m) => m.territorialConcentration)),
		meanGdpInequality: mean(perWorld.map((m) => m.gdpInequality)),
		meanTechnologyConvergence: mean(perWorld.map((m) => m.technologyConvergence)),
		meanPoliticalTransitions: mean(perWorld.map((m) => m.politicalTransitions)),
		meanAllianceFrequency: mean(perWorld.map((m) => m.allianceFrequency)),
		hegemonyShare: perWorld.filter((m) => m.largestEmpireShare > 0.9).length / Math.max(1, worlds),
		worldsWithWar: perWorld.filter((m) => m.numberOfWars > 0).length / Math.max(1, worlds),
		governmentPlurality: govPlurality,
		survivors: distribution(perWorld.map((m) => m.livingStates)),
		pathologies,
		firedPathologies: firedPathologies(pathologies)
	};

	return { summary, perWorld };
}

/** Human-readable report for the CLI. */
export function formatReport(result: BatchResult): string {
	const s = result.summary;
	const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
	const num = (x: number) => x.toFixed(2);
	const lines: string[] = [];

	lines.push(
		`Monte Carlo — ${s.worlds} worlds × ${s.years} years (seeds ${s.seedRange[0]}–${s.seedRange[1]})`
	);
	lines.push('');
	lines.push('Aggregate metrics (mean across worlds):');
	lines.push(`  wars per world .............. ${num(s.meanWars)}`);
	lines.push(`  mean war duration (yrs) ..... ${num(s.meanWarDuration)}`);
	lines.push(`  worlds with ≥1 war .......... ${pct(s.worldsWithWar)}`);
	lines.push(`  state lifespan (yrs) ........ ${num(s.meanStateLifespan)}`);
	lines.push(`  state extinction rate ....... ${pct(s.meanExtinctionRate)}`);
	lines.push(
		`  survivors / world ........... min ${s.survivors.min}, median ${s.survivors.median}, max ${s.survivors.max}`
	);
	lines.push(`  largest empire share ........ ${pct(s.meanLargestEmpireShare)}`);
	lines.push(`  territorial concentration ... ${num(s.meanTerritorialConcentration)}`);
	lines.push(`  GDP inequality (gini) ....... ${num(s.meanGdpInequality)}`);
	lines.push(`  technology convergence ...... ${num(s.meanTechnologyConvergence)}`);
	lines.push(`  political transitions ....... ${num(s.meanPoliticalTransitions)}`);
	lines.push(`  alliance frequency .......... ${pct(s.meanAllianceFrequency)}`);
	lines.push(`  hegemony (>90% territory) ... ${pct(s.hegemonyShare)} of worlds`);
	lines.push('');
	lines.push('Government plurality (winning type per world):');
	for (const [g, c] of Object.entries(s.governmentPlurality).sort((a, b) => b[1] - a[1])) {
		lines.push(`  ${g.padEnd(24)} ${c}`);
	}
	lines.push('');
	if (s.firedPathologies.length === 0) {
		lines.push('Pathology rules (MODEL.md §78): none fired.');
	} else {
		lines.push('Pathology rules (MODEL.md §78) — FIRED:');
		for (const f of s.firedPathologies) {
			const where = f.seeds.length <= 8 ? ` [seeds ${f.seeds.join(', ')}]` : ` [${f.count} worlds]`;
			lines.push(`  ⚠ ${f.rule} — ${pct(f.share)}${where}`);
		}
	}
	lines.push('');
	lines.push('All rules:');
	for (const f of s.pathologies) {
		lines.push(`  ${f.fired ? '⚠' : '·'} ${f.id}  ${f.rule}  (${f.count}/${s.worlds})`);
	}

	return lines.join('\n');
}

export { gini };
export type { WorldMetrics, Distribution, PathologyFlag };
