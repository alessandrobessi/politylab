import { describe, it, expect } from 'vitest';
import { generateWorld } from '$lib/worldgen';
import { simulateYears } from '$lib/simulation';
import { compact, population, percent, signedPercent, titleCase } from './format';
import { toDisplayCauses } from './causes';
import { sparklinePoints } from './sparkline';
import { colourRegions, MAP_MODES } from './mapModes';

describe('format', () => {
	it('formats population and magnitudes', () => {
		expect(population(12_400_000)).toBe('12.40M');
		expect(population(3_100_000_000)).toBe('3.10B');
		expect(compact(4_800_000)).toBe('4.8M');
		expect(compact(81_000_000_000)).toBe('81.0B');
		expect(percent(0.632)).toBe('63%');
		expect(signedPercent(0.043)).toBe('+4.3%');
		expect(signedPercent(-0.02)).toBe('-2.0%');
		expect(titleCase('military-regime')).toBe('Military regime');
		expect(population(NaN)).toBe('—');
	});
});

describe('toDisplayCauses', () => {
	it('humanizes factors and computes each share of total absolute impact', () => {
		const out = toDisplayCauses([
			{ factor: 'food_stress', impact: -0.06 },
			{ factor: 'legitimacy', impact: 0.03 },
			{ factor: 'institutions', impact: 0.01 }
		]);
		expect(out.map((c) => c.label)).toEqual(['Food stress', 'Legitimacy', 'Institutions']);
		expect(out.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1, 9);
		expect(out[0]!.share).toBeCloseTo(0.6, 9);
	});

	it('handles an empty list', () => {
		expect(toDisplayCauses([])).toEqual([]);
	});
});

describe('sparklinePoints', () => {
	it('maps a series into the box, ascending series ⇒ y descending', () => {
		const pts = sparklinePoints([0, 1, 2, 3], 100, 20).split(' ');
		expect(pts).toHaveLength(4);
		const y = (p: string) => Number(p.split(',')[1]);
		expect(y(pts[0]!)).toBeGreaterThan(y(pts[3]!));
	});

	it('is safe for empty and single-value input', () => {
		expect(sparklinePoints([], 100, 20)).toBe('');
		expect(sparklinePoints([5], 100, 20)).toMatch(/^1,10/);
	});
});

describe('colourRegions', () => {
	const world = simulateYears(generateWorld(7), 50);

	it('political mode colours every region and has no legend', () => {
		const { fill, legend } = colourRegions(world, 'political');
		expect(fill.size).toBe(world.regions.length);
		expect(legend).toBeNull();
		for (const r of world.regions) expect(fill.get(r.id)).toMatch(/^(hsl|#)/);
	});

	it('every non-political mode produces a fill for each region and a 5-stop legend', () => {
		for (const { id } of MAP_MODES.filter((m) => m.id !== 'political')) {
			const { fill, legend } = colourRegions(world, id);
			expect(fill.size).toBe(world.regions.length);
			expect(legend).toHaveLength(5);
			for (const r of world.regions) expect(typeof fill.get(r.id)).toBe('string');
		}
	});
});
