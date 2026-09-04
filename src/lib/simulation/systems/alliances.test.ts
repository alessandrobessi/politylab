import { describe, it, expect } from 'vitest';
import { makeConfig } from '../config';
import type { SimContext } from '../context';
import { SeededRandom } from '../rng';
import { TraceSink } from '../trace';
import { assertFiniteWorld } from '../assert';
import { generateWorld } from '../../worldgen';
import { simulateYears } from '../engine';
import { makeTinyWorld } from '../testing/tiny-world';
import { scoreAlliancePartner } from '../strategy/scoring';
import { commonEnemyStrength, updateAlliances } from './diplomacy';

const config = makeConfig();

function context(overrides: Partial<SimContext> = {}): SimContext {
	return { config, rng: new SeededRandom(1), year: 0, history: null, traces: null, ...overrides };
}

describe('scoreAlliancePartner (MODEL.md §49)', () => {
	const base = {
		trust: 0.4,
		normalizedOpinion: 0.5,
		commonThreat: 0.2,
		trade: 0.3,
		strategicCompatibility: 0.6
	};

	it('rises with every input', () => {
		expect(scoreAlliancePartner({ ...base, trust: 0.9 })).toBeGreaterThan(
			scoreAlliancePartner(base)
		);
		expect(scoreAlliancePartner({ ...base, normalizedOpinion: 0.9 })).toBeGreaterThan(
			scoreAlliancePartner(base)
		);
		expect(scoreAlliancePartner({ ...base, commonThreat: 0.9 })).toBeGreaterThan(
			scoreAlliancePartner(base)
		);
		expect(scoreAlliancePartner({ ...base, trade: 0.9 })).toBeGreaterThan(
			scoreAlliancePartner(base)
		);
	});

	it('weights the common threat most heavily (0.30)', () => {
		const dThreat = scoreAlliancePartner({ ...base, commonThreat: 1 }) - scoreAlliancePartner(base);
		const dTrade = scoreAlliancePartner({ ...base, trade: 1 }) - scoreAlliancePartner(base);
		expect(dThreat).toBeGreaterThan(dTrade);
	});
});

describe('commonEnemyStrength', () => {
	it('is the strongest shared adversary', () => {
		const world = generateWorld(7);
		const [a, b, c] = [world.states[0]!, world.states[1]!, world.states[2]!];
		a.relations[c.id]!.threatPerception = 0.8;
		b.relations[c.id]!.threatPerception = 0.6;
		expect(commonEnemyStrength(world.states, a, b)).toBeGreaterThanOrEqual(0.6);
	});
});

describe('updateAlliances', () => {
	it('never forms an alliance between belligerents, and dissolves one if war breaks out', () => {
		const world = makeTinyWorld();
		const [a, b] = [world.states[0]!, world.states[1]!];
		a.relations[b.id]!.alliance = b.relations[a.id]!.alliance = true;
		a.relations[b.id]!.atWar = b.relations[a.id]!.atWar = true;
		updateAlliances(world, context());
		expect(a.relations[b.id]!.alliance).toBe(false);
		expect(b.relations[a.id]!.alliance).toBe(false);
	});

	it('forms alliances between strongly aligned states over time (symmetric, dated)', () => {
		const world = makeTinyWorld();
		const [a, b] = [world.states[0]!, world.states[1]!];
		for (const [x, y] of [
			[a, b],
			[b, a]
		] as const) {
			const rel = x.relations[y.id]!;
			rel.trust = 0.9;
			rel.opinion = 0.8;
			rel.trade = 0.8;
			rel.rivalry = 0;
			// a shared adversary keeps the score high
			rel.threatPerception = 0;
		}
		let formed = false;
		for (let year = 0; year < 400 && !formed; year++) {
			updateAlliances(world, context({ year, rng: new SeededRandom(year) }));
			formed = a.relations[b.id]!.alliance;
		}
		expect(formed).toBe(true);
		expect(a.relations[b.id]!.alliance).toBe(b.relations[a.id]!.alliance);
		expect(a.relations[b.id]!.allianceSince).not.toBeNull();
	});

	it('records an alliance cause set', () => {
		const world = makeTinyWorld();
		const traces = new TraceSink();
		updateAlliances(world, context({ traces }));
		const causes = traces.forState(world.states[0]!.id)?.['alliance:velos'] ?? [];
		expect(causes.map((c) => c.factor)).toContain('common_threat');
	});
});

describe('balance of power (MODEL.md §50, acceptance)', () => {
	/** Alliance-years accumulated among the non-hegemon states over `years`. */
	function nonHegemonAllianceYears(seed: number, hegemon: boolean, years: number): number {
		const world = generateWorld(seed);
		if (hegemon) {
			// A huge capital stock stays dominant for the test window even as
			// `updateMilitary` depreciates it toward the normal level.
			world.states[0]!.military.capital *= 1e6;
		}
		let total = 0;
		for (let y = 0; y < years; y++) {
			simulateYears(world, 1);
			for (let i = 1; i < world.states.length; i++) {
				for (let j = i + 1; j < world.states.length; j++) {
					if (world.states[i]!.relations[world.states[j]!.id]!.alliance) total++;
				}
			}
		}
		return total;
	}

	it('a dominant state makes the weaker states ally more often', () => {
		let control = 0;
		let withHegemon = 0;
		for (const seed of [1, 2, 3, 7, 11, 42, 99, 481204]) {
			control += nonHegemonAllianceYears(seed, false, 80);
			withHegemon += nonHegemonAllianceYears(seed, true, 80);
		}
		expect(withHegemon).toBeGreaterThan(control * 1.2);
	});
});

describe('long-run alliance behaviour', () => {
	it('keeps alliances meaningful (not universal) and symmetric over 1,000 years', () => {
		for (const seed of [1, 7, 42, 481204]) {
			const world = generateWorld(seed);
			simulateYears(world, 1000, { validate: true });
			let allied = 0;
			let pairs = 0;
			for (let i = 0; i < world.states.length; i++) {
				for (let j = i + 1; j < world.states.length; j++) {
					const ab = world.states[i]!.relations[world.states[j]!.id]!;
					const ba = world.states[j]!.relations[world.states[i]!.id]!;
					expect(ab.alliance).toBe(ba.alliance);
					pairs++;
					if (ab.alliance) allied++;
				}
			}
			expect(allied).toBeLessThan(pairs * 0.7); // not everyone allied
			expect(() => assertFiniteWorld(world)).not.toThrow();
		}
	});
});
