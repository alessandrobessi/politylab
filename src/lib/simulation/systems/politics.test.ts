import { describe, it, expect } from 'vitest';
import { makeConfig } from '../config';
import type { SimContext } from '../context';
import { SeededRandom } from '../rng';
import { TraceSink } from '../trace';
import { assertFiniteWorld } from '../assert';
import { generateWorld } from '../../worldgen';
import { simulateYears } from '../engine';
import { makeTinyWorld } from '../testing/tiny-world';
import {
	computeDesiredParticipation,
	computeEliteConflict,
	computeStress,
	computeSupport,
	updatePolitics
} from './politics';

const config = makeConfig();

function context(overrides: Partial<SimContext> = {}): SimContext {
	return { config, rng: new SeededRandom(1), year: 0, history: null, traces: null, ...overrides };
}

const factions = { elite: 0.3, merchant: 0.25, military: 0.25, worker: 0.2 };

describe('support and stress (MODEL.md §30, §81)', () => {
	it('higher legitimacy increases support (and thus target stability)', () => {
		expect(computeSupport(0.8, 0.5, 0.5, 0.3)).toBeGreaterThan(computeSupport(0.2, 0.5, 0.5, 0.3));
	});

	it('higher food stress increases stress (and thus lowers target stability)', () => {
		expect(computeStress(0.4, 0.7, 0, 0, 0, 0.2)).toBeGreaterThan(
			computeStress(0.4, 0.1, 0, 0, 0, 0.2)
		);
	});

	it('higher war exhaustion increases stress', () => {
		expect(computeStress(0.4, 0.3, 0.8, 0, 0, 0.2)).toBeGreaterThan(
			computeStress(0.4, 0.3, 0.0, 0, 0, 0.2)
		);
	});
});

describe('elite conflict (MODEL.md §34)', () => {
	it('rises with participation gap and inequality', () => {
		const base = computeEliteConflict(0.1, factions, 0.3);
		expect(computeEliteConflict(0.5, factions, 0.3)).toBeGreaterThan(base);
		expect(computeEliteConflict(0.1, factions, 0.8)).toBeGreaterThan(base);
	});

	it('falls when one faction is dominant', () => {
		const balanced = computeEliteConflict(
			0.3,
			{ elite: 0.3, merchant: 0.25, military: 0.25, worker: 0.2 },
			0.5
		);
		const dominated = computeEliteConflict(
			0.3,
			{ elite: 0.85, merchant: 0.05, military: 0.05, worker: 0.05 },
			0.5
		);
		expect(dominated).toBeLessThan(balanced);
	});
});

describe('desired participation (MODEL.md §29)', () => {
	it('rises with education and urbanization', () => {
		const base = computeDesiredParticipation(0.2, 0.1, factions);
		expect(computeDesiredParticipation(0.8, 0.1, factions)).toBeGreaterThan(base);
		expect(computeDesiredParticipation(0.2, 0.6, factions)).toBeGreaterThan(base);
	});
});

describe('updatePolitics', () => {
	function twin() {
		return [makeTinyWorld(), makeTinyWorld()] as const;
	}

	it('food stress lowers the resulting stability', () => {
		const [calm, hungry] = twin();
		calm.states[0]!.foodStress = 0.0;
		hungry.states[0]!.foodStress = 0.9;
		updatePolitics(calm, context());
		updatePolitics(hungry, context());
		expect(hungry.states[0]!.politics.stability).toBeLessThan(calm.states[0]!.politics.stability);
	});

	it('higher legitimacy raises the resulting stability', () => {
		const [low, high] = twin();
		low.states[0]!.politics.legitimacy = 0.2;
		high.states[0]!.politics.legitimacy = 0.9;
		updatePolitics(low, context());
		updatePolitics(high, context());
		expect(high.states[0]!.politics.stability).toBeGreaterThan(low.states[0]!.politics.stability);
	});

	it('war exhaustion lowers the resulting stability', () => {
		const [rested, exhausted] = twin();
		exhausted.states[0]!.warExhaustion = 0.8;
		updatePolitics(rested, context());
		updatePolitics(exhausted, context());
		expect(exhausted.states[0]!.politics.stability).toBeLessThan(
			rested.states[0]!.politics.stability
		);
	});

	it('sets economic stress from negative real per-capita growth (MODEL.md §31)', () => {
		const world = makeTinyWorld();
		world.states[0]!.growth.gdpPerCapita = -0.05;
		world.states[1]!.growth.gdpPerCapita = 0.03;
		updatePolitics(world, context());
		expect(world.states[0]!.economicStress).toBeCloseTo(0.5, 6);
		expect(world.states[1]!.economicStress).toBe(0);
	});

	it('sets debt stress from the debt/GDP ratio (MODEL.md §40)', () => {
		const world = makeTinyWorld();
		world.states[0]!.debt = 2 * world.states[0]!.gdp; // ratio 2.0
		world.states[1]!.debt = 0.2 * world.states[1]!.gdp; // ratio 0.2
		updatePolitics(world, context());
		expect(world.states[0]!.debtStress).toBeCloseTo(1, 6);
		expect(world.states[1]!.debtStress).toBe(0);
	});

	it('reduces inequality when welfare spending is high', () => {
		const world = makeTinyWorld();
		const s = world.states[0]!;
		s.inequality = 0.6;
		s.budget = { ...s.budget, welfare: 0.5 };
		const before = s.inequality;
		for (let i = 0; i < 30; i++) updatePolitics(world, context());
		expect(s.inequality).toBeLessThan(before);
	});

	it('is deterministic including the seeded disturbance', () => {
		const a = makeTinyWorld();
		const b = makeTinyWorld();
		for (let i = 0; i < 20; i++) {
			updatePolitics(a, context({ rng: new SeededRandom(a.seed).fork(`year:${i}`) }));
			updatePolitics(b, context({ rng: new SeededRandom(b.seed).fork(`year:${i}`) }));
		}
		expect(a.states.map((s) => s.politics.stability)).toEqual(
			b.states.map((s) => s.politics.stability)
		);
	});

	it('records stability and legitimacy cause sets', () => {
		const world = makeTinyWorld();
		const traces = new TraceSink();
		updatePolitics(world, context({ traces }));
		const t = traces.forState(world.states[0]!.id)!;
		expect(t.stability!.map((c) => c.factor)).toContain('food_stress');
		expect(t.legitimacy!.map((c) => c.factor)).toContain('economic_growth');
	});
});

describe('long-run political behaviour', () => {
	it('keeps legitimacy and stability bounded, and does not collapse every state', () => {
		for (const seed of [1, 7, 42, 481204]) {
			const world = generateWorld(seed);
			simulateYears(world, 1000, { validate: true });
			for (const s of world.states) {
				expect(s.politics.legitimacy).toBeGreaterThanOrEqual(0);
				expect(s.politics.legitimacy).toBeLessThanOrEqual(1);
				expect(s.politics.stability).toBeGreaterThanOrEqual(0);
				expect(s.politics.stability).toBeLessThanOrEqual(1);
			}
			const stable = world.states.filter((s) => s.politics.stability > 0.3);
			expect(stable.length).toBeGreaterThan(0);
			expect(() => assertFiniteWorld(world)).not.toThrow();
		}
	});
});

describe('government transitions (MODEL.md §35–§37, acceptance)', () => {
	it('a troubled state does NOT transition every year', () => {
		const world = makeTinyWorld();
		const s = world.states[0]!;
		s.politics.stability = 0.15;
		s.politics.legitimacy = 0.1;
		s.politics.participationGap = 0.6;
		let transitions = 0;
		let prev = s.politics.governmentType;
		for (let y = 0; y < 200; y++) {
			s.politics.stability = 0.15;
			s.politics.legitimacy = 0.1;
			updatePolitics(world, context({ year: y, rng: new SeededRandom(y) }));
			if (s.politics.governmentType !== prev) {
				transitions++;
				prev = s.politics.governmentType;
			}
		}
		expect(transitions).toBeGreaterThan(0); // some do happen
		expect(transitions).toBeLessThan(60); // but not ~every year over 200
	});

	it('a stable, legitimate state rarely transitions', () => {
		const world = makeTinyWorld();
		const s = world.states[0]!;
		let transitions = 0;
		let prev = s.politics.governmentType;
		for (let y = 0; y < 300; y++) {
			s.politics.stability = 0.85;
			s.politics.legitimacy = 0.8;
			updatePolitics(world, context({ year: y, rng: new SeededRandom(y) }));
			if (s.politics.governmentType !== prev) {
				transitions++;
				prev = s.politics.governmentType;
			}
		}
		expect(transitions).toBeLessThan(5);
	});

	it('produces a spread of government types across seeds — none dominates (MODEL §77)', () => {
		const counts = new Map<string, number>();
		for (const seed of [1, 3, 7, 11, 42, 481204]) {
			const world = generateWorld(seed);
			simulateYears(world, 600);
			for (const s of world.states.filter((x) => x.alive)) {
				counts.set(s.politics.governmentType, (counts.get(s.politics.governmentType) ?? 0) + 1);
			}
		}
		const total = [...counts.values()].reduce((a, b) => a + b, 0);
		expect(counts.size).toBeGreaterThanOrEqual(3);
		expect(Math.max(...counts.values()) / total).toBeLessThan(0.7);
	});
});

describe('overextension (MODEL.md §38)', () => {
	it('a state far larger than its administrative capacity is overextended and less stable', () => {
		const world = generateWorld(7);
		const big = world.states[0]!;
		// Give it 4× everyone else's territory without extra capacity.
		big.territory *= 4;
		updatePolitics(world, context());
		expect(big.overextension).toBeGreaterThan(0.3);
		const small = world.states[1]!;
		expect(small.overextension).toBeLessThan(big.overextension);
	});
});
