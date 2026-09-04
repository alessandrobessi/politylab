import { describe, it, expect } from 'vitest';
import { makeConfig } from '../config';
import type { SimContext } from '../context';
import { SeededRandom } from '../rng';
import { TraceSink } from '../trace';
import { assertFiniteWorld } from '../assert';
import { generateWorld } from '../../worldgen';
import { simulateYears } from '../engine';
import { scoreWarTarget, type WarTargetInputs } from './scoring';
import { makeStrategicDecisions } from './decisions';

const config = makeConfig();

function context(overrides: Partial<SimContext> = {}): SimContext {
	return { config, rng: new SeededRandom(1), year: 0, history: null, traces: null, ...overrides };
}

const baseWar: WarTargetInputs = {
	territorialValue: 0.5,
	resourceValue: 0.4,
	strategicValue: 0.3,
	claimValue: 0.1,
	domesticPoliticalBenefit: 0.1,
	perceivedMilitaryAdvantage: 0.5,
	rivalry: 0.2,
	militaryRisk: 0.5,
	allianceRisk: 0.2,
	economicCost: 0.4,
	warExhaustion: 0.1,
	tradeDependency: 0.3
};

describe('scoreWarTarget (MODEL.md §52, acceptance)', () => {
	it('stronger territorial claims raise war utility', () => {
		expect(scoreWarTarget({ ...baseWar, claimValue: 0.9 })).toBeGreaterThan(
			scoreWarTarget({ ...baseWar, claimValue: 0.0 })
		);
	});

	it('greater military risk lowers war utility', () => {
		expect(scoreWarTarget({ ...baseWar, militaryRisk: 0.9 })).toBeLessThan(
			scoreWarTarget({ ...baseWar, militaryRisk: 0.1 })
		);
	});

	it('alliance risk, economic cost, exhaustion and trade dependency all lower it', () => {
		const base = scoreWarTarget(baseWar);
		expect(scoreWarTarget({ ...baseWar, allianceRisk: 0.9 })).toBeLessThan(base);
		expect(scoreWarTarget({ ...baseWar, economicCost: 0.9 })).toBeLessThan(base);
		expect(scoreWarTarget({ ...baseWar, warExhaustion: 0.9 })).toBeLessThan(base);
		expect(scoreWarTarget({ ...baseWar, tradeDependency: 0.9 })).toBeLessThan(base);
	});

	it('territorial/resource value, advantage, rivalry and domestic benefit all raise it', () => {
		const base = scoreWarTarget(baseWar);
		expect(scoreWarTarget({ ...baseWar, territorialValue: 0.95 })).toBeGreaterThan(base);
		expect(scoreWarTarget({ ...baseWar, resourceValue: 0.95 })).toBeGreaterThan(base);
		expect(scoreWarTarget({ ...baseWar, perceivedMilitaryAdvantage: 0.95 })).toBeGreaterThan(base);
		expect(scoreWarTarget({ ...baseWar, rivalry: 0.95 })).toBeGreaterThan(base);
		expect(scoreWarTarget({ ...baseWar, domesticPoliticalBenefit: 0.95 })).toBeGreaterThan(base);
	});
});

describe('makeStrategicDecisions', () => {
	it('keeps budget shares valid after adaptive reallocation', () => {
		const world = generateWorld(7);
		for (let i = 0; i < 50; i++) makeStrategicDecisions(world, context({ year: i }));
		for (const s of world.states) {
			const total = Object.values(s.budget).reduce((a, b) => a + b, 0);
			expect(total).toBeCloseTo(1, 9);
			for (const share of Object.values(s.budget)) expect(share).toBeGreaterThanOrEqual(0);
		}
	});

	it('a threatened state shifts its budget toward the military', () => {
		const world = generateWorld(7);
		const s = world.states[0]!;
		for (const rel of Object.values(s.relations)) rel.threatPerception = 0.9;
		const before = s.budget.military;
		for (let i = 0; i < 30; i++) {
			for (const rel of Object.values(s.relations)) rel.threatPerception = 0.9;
			makeStrategicDecisions(world, context({ year: i, rng: new SeededRandom(i) }));
		}
		expect(s.budget.military).toBeGreaterThan(before);
	});

	function forceBellicose(world: ReturnType<typeof generateWorld>): void {
		for (const s of world.states) {
			s.politics.stability = 0.8;
			s.military.power = 1000;
			for (const rel of Object.values(s.relations)) {
				rel.territorialClaims = 1;
				rel.rivalry = 1;
				rel.trade = 0;
				rel.alliance = false;
				rel.atWar = false;
			}
		}
	}

	it('only adjacent, non-allied, non-belligerent pairs can go to war', () => {
		const world = generateWorld(7);
		for (let y = 0; y < 15 && world.wars.length === 0; y++) {
			forceBellicose(world);
			makeStrategicDecisions(world, context({ year: y, rng: new SeededRandom(100 + y) }));
		}
		expect(world.wars.length).toBeGreaterThan(0);
		for (const war of world.wars) {
			const attacker = world.states.find((s) => s.id === war.attackerId)!;
			const defenderRegions = world.regions.filter((r) => r.ownerId === war.defenderId);
			const attackerRegionIds = new Set(
				world.regions.filter((r) => r.ownerId === war.attackerId).map((r) => r.id)
			);
			const share = defenderRegions.some((r) => r.neighbors.some((n) => attackerRegionIds.has(n)));
			expect(share).toBe(true);
			expect(attacker.relations[war.defenderId]!.atWar).toBe(true);
		}
	});

	it('records a war-decision cause set', () => {
		const world = generateWorld(7);
		const traces = new TraceSink();
		for (let y = 0; y < 15 && world.wars.length === 0; y++) {
			forceBellicose(world);
			makeStrategicDecisions(world, context({ year: y, rng: new SeededRandom(100 + y), traces }));
		}
		const war = world.wars[0]!;
		const causes = traces.forState(war.attackerId)?.[`war:${war.defenderId}`] ?? [];
		expect(causes.map((c) => c.factor)).toContain('claim');
	});
});

describe('war probability is directional (MODEL.md §53)', () => {
	it('a stronger attacker with claims goes to war more often than a weak one without', () => {
		function warsOver(years: number, strong: boolean): number {
			let total = 0;
			for (const seed of [1, 2, 3, 7, 11]) {
				const world = generateWorld(seed);
				for (const rel of Object.values(world.states[0]!.relations)) {
					rel.territorialClaims = strong ? 0.9 : 0;
				}
				for (let y = 0; y < years; y++) {
					if (strong) world.states[0]!.military.power *= 3;
					simulateYears(world, 1);
					if (strong) world.states[0]!.military.power /= 3;
				}
				total += world.wars.filter((w) => w.attackerId === world.states[0]!.id).length;
			}
			return total;
		}
		expect(warsOver(60, true)).toBeGreaterThan(warsOver(60, false));
	});
});

describe('long-run war behaviour (M15 placeholder resolution)', () => {
	it('wars occur, always end, and the world stays finite over 1,000 years', () => {
		for (const seed of [1, 7, 42, 481204]) {
			const world = generateWorld(seed);
			simulateYears(world, 1000, { validate: true });
			expect(world.wars.length).toBeGreaterThan(10); // not a warless world (MODEL §78)
			const longest = Math.max(
				...world.wars.map((w) => (w.endYear ?? world.year) - w.startYear),
				0
			);
			expect(longest).toBeLessThan(150); // no century-long war (MODEL §78)
			expect(world.wars.filter((w) => w.active).length).toBeLessThan(4);
			expect(() => assertFiniteWorld(world)).not.toThrow();
		}
	});
});
