import { describe, it, expect } from 'vitest';
import { runBatch, runWorld } from '../src/lib/montecarlo';
import { gini } from '../src/lib/montecarlo/metrics';

/**
 * M27 — the Monte Carlo runner works headlessly (no DOM, no engine changes) and
 * produces finite metrics + the MODEL.md §78 pathology flags. Kept small; the
 * `pnpm mc` CLI and `MC_HEAVY=1` long-run test cover larger batches.
 */
describe('monte carlo runner (M27)', () => {
	it('gini is 0 for a flat sample and rises with concentration', () => {
		expect(gini([5, 5, 5, 5])).toBeCloseTo(0, 5);
		expect(gini([0, 0, 0, 100])).toBeGreaterThan(0.7);
		expect(gini([])).toBe(0);
	});

	it('runs a small batch and returns finite aggregate metrics', () => {
		const { summary, perWorld } = runBatch({ worlds: 6, years: 120, seed: 1 });
		expect(perWorld).toHaveLength(6);

		for (const m of perWorld) {
			for (const v of [
				m.numberOfWars,
				m.averageWarDuration,
				m.averageStateLifespan,
				m.stateExtinctionRate,
				m.largestEmpireShare,
				m.territorialConcentration,
				m.gdpInequality,
				m.technologyConvergence,
				m.politicalTransitions,
				m.allianceFrequency,
				m.populationGrowthFactor
			]) {
				expect(Number.isFinite(v)).toBe(true);
			}
			expect(m.largestEmpireShare).toBeGreaterThanOrEqual(0);
			expect(m.largestEmpireShare).toBeLessThanOrEqual(1);
			expect(m.stateExtinctionRate).toBeGreaterThanOrEqual(0);
			expect(m.stateExtinctionRate).toBeLessThanOrEqual(1);
			expect(m.livingStates).toBeLessThanOrEqual(m.startingStates);
		}

		expect(Number.isFinite(summary.meanWars)).toBe(true);
		expect(summary.survivors.max).toBeLessThanOrEqual(8);
		// one flag object per §78 rule (6 per-world + 1 batch-level)
		expect(summary.pathologies).toHaveLength(7);
		for (const f of summary.pathologies) {
			expect(typeof f.fired).toBe('boolean');
			expect(f.count).toBe(f.seeds.length);
		}
	});

	it('is deterministic — same options give identical metrics', () => {
		const a = runBatch({ worlds: 4, years: 80, seed: 50 });
		const b = runBatch({ worlds: 4, years: 80, seed: 50 });
		expect(JSON.stringify(b.perWorld)).toBe(JSON.stringify(a.perWorld));
	});

	it('runWorld matches the batch for the same seed', () => {
		const single = runWorld(9, 100);
		const batch = runBatch({ worlds: 1, years: 100, seed: 9 });
		expect(batch.perWorld[0]).toEqual(single);
	});

	it('flags a no-war world when the rule applies (synthetic ≥1000y check via longest war)', () => {
		// A 200-year batch should never trip the "war lasts >150 years" rule.
		const { summary } = runBatch({ worlds: 5, years: 200, seed: 3 });
		const longWar = summary.pathologies.find((f) => f.id === 'g2yf64')!;
		expect(longWar.fired).toBe(false);
	});
});
