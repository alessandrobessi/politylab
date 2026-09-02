import { describe, it, expect } from 'vitest';
import { makeConfig } from '../config';
import type { SimContext } from '../context';
import { SeededRandom } from '../rng';
import { TraceSink } from '../trace';
import { sharesSumToOne } from '../math';
import { assertFiniteWorld } from '../assert';
import { generateWorld } from '../../worldgen';
import { simulateYears } from '../engine';
import { updateGovernmentRevenue, updateGovernmentSpending } from './government';
import { revenueFraction } from './common';

const config = makeConfig();

function context(overrides: Partial<SimContext> = {}): SimContext {
	return { config, rng: new SeededRandom(1), year: 0, history: null, traces: null, ...overrides };
}

describe('updateGovernmentRevenue', () => {
	it('sets revenue to GDP × taxRate × tax efficiency (MODEL.md §16)', () => {
		const world = generateWorld(7);
		updateGovernmentRevenue(world, context());
		for (const s of world.states) {
			expect(s.revenue).toBeCloseTo(s.gdp * revenueFraction(s), 6);
		}
	});
});

describe('updateGovernmentSpending', () => {
	it('splits revenue across the six lines, summing back to revenue', () => {
		const world = generateWorld(7);
		updateGovernmentRevenue(world, context());
		updateGovernmentSpending(world, context());
		for (const s of world.states) {
			const total = Object.values(s.spending).reduce((a, b) => a + b, 0);
			expect(total).toBeCloseTo(s.revenue, 6); // spend ≤ revenue + borrowing (0)
			expect(s.spending.military).toBeCloseTo(s.budget.military * s.revenue, 6);
		}
	});

	it('keeps budget shares summing to 1, and re-normalizes a corrupted budget', () => {
		const world = generateWorld(7);
		world.states[0]!.budget.military += 0.3; // break the invariant
		updateGovernmentRevenue(world, context());
		updateGovernmentSpending(world, context());
		for (const s of world.states) {
			expect(sharesSumToOne(Object.values(s.budget))).toBe(true);
		}
	});

	it('updates military spending and burden (MODEL.md §43)', () => {
		const world = generateWorld(7);
		updateGovernmentRevenue(world, context());
		updateGovernmentSpending(world, context());
		for (const s of world.states) {
			expect(s.military.spending).toBe(s.spending.military);
			expect(s.military.burden).toBeCloseTo(s.spending.military / s.gdp, 9);
		}
	});

	it('raises region infrastructure when infrastructure is funded (MODEL.md §18)', () => {
		const world = generateWorld(7);
		const s = world.states[0]!;
		const owned = () => world.regions.filter((r) => r.ownerId === s.id);
		const before = owned().reduce((a, r) => a + r.infrastructure, 0) / owned().length;
		for (let i = 0; i < 60; i++) {
			updateGovernmentRevenue(world, context());
			updateGovernmentSpending(world, context());
		}
		const after = owned().reduce((a, r) => a + r.infrastructure, 0) / owned().length;
		expect(after).toBeGreaterThan(before);
	});

	it('raises education when education is funded, scaled by institutional capacity (MODEL.md §19, §81)', () => {
		const world = generateWorld(7);
		const [weak, strong] = [world.states[0]!, world.states[1]!];
		// identical education budget & starting education, different institutions
		weak.education = strong.education = 0.2;
		weak.budget = { ...weak.budget, education: 0.2 };
		strong.budget = { ...strong.budget, education: 0.2 };
		weak.politics.institutionalCapacity = 0.2;
		strong.politics.institutionalCapacity = 0.9;
		for (let i = 0; i < 40; i++) {
			updateGovernmentRevenue(world, context());
			updateGovernmentSpending(world, context());
		}
		expect(weak.education).toBeGreaterThan(0.2);
		expect(strong.education).toBeGreaterThan(weak.education);
	});

	it('records an educationChange decomposition', () => {
		const world = generateWorld(7);
		updateGovernmentRevenue(world, context());
		const traces = new TraceSink();
		updateGovernmentSpending(world, context({ traces }));
		const causes = traces.forState(world.states[0]!.id)?.educationChange ?? [];
		expect(causes.map((c) => c.factor).sort()).toEqual(['depreciation', 'education_spending']);
	});
});

describe('budget trade-offs (BLUEPRINT.md §13)', () => {
	it('heavy military spending crowds out infrastructure and education growth', () => {
		const guns = generateWorld(7);
		const butter = generateWorld(7);
		for (const s of guns.states) {
			s.budget = {
				infrastructure: 0.08,
				education: 0.05,
				research: 0.02,
				military: 0.55,
				welfare: 0.1,
				administration: 0.2
			};
		}
		for (const s of butter.states) {
			s.budget = {
				infrastructure: 0.28,
				education: 0.25,
				research: 0.1,
				military: 0.07,
				welfare: 0.1,
				administration: 0.2
			};
		}
		simulateYears(guns, 200);
		simulateYears(butter, 200);
		const meanEdu = (w: typeof guns) =>
			w.states.reduce((a, s) => a + s.education, 0) / w.states.length;
		const meanGdpPerCapita = (w: typeof guns) =>
			w.states.reduce((a, s) => a + s.gdpPerCapita, 0) / w.states.length;
		expect(meanEdu(butter)).toBeGreaterThan(meanEdu(guns));
		expect(meanGdpPerCapita(butter)).toBeGreaterThan(meanGdpPerCapita(guns));
	});
});

describe('long-run fiscal behaviour', () => {
	it('infrastructure and education converge to bounded equilibria over 1,000 years', () => {
		for (const seed of [1, 7, 42, 481204]) {
			const world = generateWorld(seed);
			simulateYears(world, 1000, { validate: true });
			for (const s of world.states) {
				expect(s.education).toBeGreaterThan(0);
				expect(s.education).toBeLessThan(0.95);
				expect(Number.isFinite(s.revenue)).toBe(true);
			}
			for (const r of world.regions) {
				expect(r.infrastructure).toBeGreaterThan(0);
				expect(r.infrastructure).toBeLessThan(0.98);
			}
			expect(() => assertFiniteWorld(world)).not.toThrow();
		}
	});
});
