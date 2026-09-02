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
	computeOpinionDelta,
	computeThreatPerception,
	computeTrustDelta,
	updateDiplomacy,
	type OpinionInputs
} from './diplomacy';
import { proximityFromDistance } from './geography';

const config = makeConfig();

function context(overrides: Partial<SimContext> = {}): SimContext {
	return { config, rng: new SeededRandom(1), year: 0, history: null, traces: null, ...overrides };
}

const baseOpinion: OpinionInputs = {
	opinion: 0,
	trade: 0.2,
	alliance: false,
	commonEnemy: 0,
	territorialClaims: 0,
	threatPerception: 0.2,
	rivalry: 0.1,
	warMemory: 0
};

describe('opinion dynamics (MODEL.md §44, acceptance)', () => {
	it('more trade improves opinion', () => {
		const low = computeOpinionDelta(
			{ ...baseOpinion, trade: 0.05 },
			config.diplomacy.opinionMeanReversion
		);
		const high = computeOpinionDelta(
			{ ...baseOpinion, trade: 0.9 },
			config.diplomacy.opinionMeanReversion
		);
		expect(high).toBeGreaterThan(low);
	});

	it('more perceived threat worsens opinion', () => {
		const low = computeOpinionDelta(
			{ ...baseOpinion, threatPerception: 0.05 },
			config.diplomacy.opinionMeanReversion
		);
		const high = computeOpinionDelta(
			{ ...baseOpinion, threatPerception: 0.9 },
			config.diplomacy.opinionMeanReversion
		);
		expect(high).toBeLessThan(low);
	});

	it('territorial claims, rivalry and war memory each worsen opinion', () => {
		const mr = config.diplomacy.opinionMeanReversion;
		const base = computeOpinionDelta(baseOpinion, mr);
		expect(computeOpinionDelta({ ...baseOpinion, territorialClaims: 0.6 }, mr)).toBeLessThan(base);
		expect(computeOpinionDelta({ ...baseOpinion, rivalry: 0.6 }, mr)).toBeLessThan(base);
		expect(computeOpinionDelta({ ...baseOpinion, warMemory: 1 }, mr)).toBeLessThan(base);
	});

	it('mean reversion pulls opinion back toward 0', () => {
		const mr = config.diplomacy.opinionMeanReversion;
		expect(computeOpinionDelta({ ...baseOpinion, opinion: 0.9 }, mr)).toBeLessThan(
			computeOpinionDelta({ ...baseOpinion, opinion: -0.9 }, mr)
		);
	});
});

describe('trust dynamics (MODEL.md §45)', () => {
	it('rises with trade and a long peace, falls at war and with claims', () => {
		expect(computeTrustDelta(0.4, 0.8, false, 1, false, 0, 0)).toBeGreaterThan(0);
		expect(computeTrustDelta(0.4, 0, false, 0, true, 0.5, 0.5)).toBeLessThan(0);
	});

	it('has a stable equilibrium in (0, 1)', () => {
		let t = 0.5;
		for (let i = 0; i < 500; i++) t += computeTrustDelta(t, 0.3, false, 1, false, 0, 0.1);
		expect(t).toBeGreaterThan(0);
		expect(t).toBeLessThan(1);
	});
});

describe('threat perception (MODEL.md §48)', () => {
	it('rises with the other state’s relative power', () => {
		expect(computeThreatPerception(100, 50, 0, 1, 0)).toBeLessThan(
			computeThreatPerception(100, 300, 0, 1, 0)
		);
	});

	it('rises with hostility (lower opinion) and expansionism, and vanishes at zero proximity', () => {
		expect(computeThreatPerception(100, 100, 0.8, 1, 0)).toBeLessThan(
			computeThreatPerception(100, 100, -0.8, 1, 0)
		);
		expect(computeThreatPerception(100, 100, 0, 1, 0)).toBeLessThan(
			computeThreatPerception(100, 100, 0, 1, 1)
		);
		expect(computeThreatPerception(100, 100, -1, 0, 1)).toBe(0);
	});

	it('stays within [0, 1]', () => {
		expect(computeThreatPerception(1, 1e6, -1, 1, 1)).toBeLessThanOrEqual(1);
		expect(computeThreatPerception(1e6, 1, 1, 1, 0)).toBeGreaterThanOrEqual(0);
	});
});

describe('updateDiplomacy', () => {
	it('recomputes proximity from the current border graph', () => {
		const world = generateWorld(7);
		updateDiplomacy(world, context());
		// tiny world neighbours ⇒ proximity 1
		const tiny = makeTinyWorld();
		updateDiplomacy(tiny, context());
		expect(tiny.states[0]!.relations['velos']!.proximity).toBe(proximityFromDistance(1));
	});

	it('improves a trading pair and worsens a claiming/threatening pair over time', () => {
		const world = makeTinyWorld();
		const [a, b] = [world.states[0]!, world.states[1]!];
		a.relations[b.id]!.trade = 0.8;
		a.relations[b.id]!.territorialClaims = 0;
		a.relations[b.id]!.rivalry = 0;
		b.relations[a.id]!.trade = 0.8;
		b.relations[a.id]!.territorialClaims = 0.7;
		b.relations[a.id]!.rivalry = 0.5;
		for (let i = 0; i < 80; i++) updateDiplomacy(world, context({ year: i }));
		expect(a.relations[b.id]!.opinion).toBeGreaterThan(0);
		expect(b.relations[a.id]!.opinion).toBeLessThan(0);
	});

	it('decays war memory (×warMemoryDecay) and territorial claims (×claimDecay)', () => {
		const world = makeTinyWorld();
		const rel = world.states[0]!.relations['velos']!;
		rel.warMemory = 1;
		rel.territorialClaims = 0.5;
		updateDiplomacy(world, context());
		expect(rel.warMemory).toBeCloseTo(config.diplomacy.warMemoryDecay, 9);
		expect(rel.territorialClaims).toBeCloseTo(0.5 * config.diplomacy.claimDecay, 9);
	});

	it('records an opinion cause set', () => {
		const world = makeTinyWorld();
		const traces = new TraceSink();
		updateDiplomacy(world, context({ traces }));
		const t = traces.forState(world.states[0]!.id)!;
		expect(t['opinion:velos']!.map((c) => c.factor)).toContain('trade');
	});
});

describe('long-run diplomatic behaviour', () => {
	it('keeps every relation field bounded and finite, with a spread of opinions', () => {
		for (const seed of [1, 7, 42, 481204]) {
			const world = generateWorld(seed);
			simulateYears(world, 1000, { validate: true });
			const opinions: number[] = [];
			for (const s of world.states) {
				for (const rel of Object.values(s.relations)) {
					expect(rel.opinion).toBeGreaterThanOrEqual(-1);
					expect(rel.opinion).toBeLessThanOrEqual(1);
					expect(rel.trust).toBeGreaterThanOrEqual(0);
					expect(rel.trust).toBeLessThanOrEqual(1);
					expect(rel.threatPerception).toBeGreaterThanOrEqual(0);
					expect(rel.threatPerception).toBeLessThanOrEqual(1);
					opinions.push(rel.opinion);
				}
			}
			expect(Math.max(...opinions) - Math.min(...opinions)).toBeGreaterThan(0.2);
			expect(() => assertFiniteWorld(world)).not.toThrow();
		}
	});
});
