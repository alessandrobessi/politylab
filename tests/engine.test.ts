import { describe, it, expect } from 'vitest';
import { generateWorld } from '../src/lib/worldgen';
import { simulateYear, simulateYears, createSimulation } from '../src/lib/simulation/engine';

const SEED = 481204;

describe('simulateYear / simulateYears', () => {
	it('advances the clock by one year and returns the same world reference', () => {
		const world = generateWorld(SEED);
		const returned = simulateYear(world);
		expect(returned).toBe(world);
		expect(world.year).toBe(1);
	});

	it('advances by exactly N years', () => {
		const world = generateWorld(SEED);
		simulateYears(world, 250);
		expect(world.year).toBe(250);
	});

	it('is deterministic for the same seed over many years', () => {
		const a = generateWorld(SEED);
		const b = generateWorld(SEED);
		simulateYears(a, 300);
		simulateYears(b, 300);
		expect(a).toEqual(b);
	});

	it('produces a different trajectory for a different seed', () => {
		const a = generateWorld(SEED);
		const b = generateWorld(SEED + 1);
		simulateYears(a, 300);
		simulateYears(b, 300);
		expect(a).not.toEqual(b);
	});

	it('reaches the same state whether run in one call or year by year', () => {
		const bulk = generateWorld(SEED);
		simulateYears(bulk, 120);

		const stepwise = generateWorld(SEED);
		for (let i = 0; i < 120; i++) simulateYear(stepwise);

		expect(stepwise).toEqual(bulk);
	});
});

describe('createSimulation history recording', () => {
	it('captures a year-0 baseline stat for every state', () => {
		const world = generateWorld(SEED);
		const sim = createSimulation(world);
		for (const s of world.states) {
			const series = sim.history.byState[s.id]!;
			expect(series).toHaveLength(1);
			expect(series[0]!.year).toBe(0);
			expect(series[0]!.population).toBe(s.population);
		}
	});

	it('records one stat row per state per year, in ascending order', () => {
		const sim = createSimulation(generateWorld(SEED));
		sim.run(25);
		for (const series of Object.values(sim.history.byState)) {
			expect(series).toHaveLength(26); // years 0..25
			const years = series.map((r) => r.year);
			expect(years).toEqual([...years].sort((a, b) => a - b));
			expect(years.at(-1)).toBe(25);
		}
	});

	it('snapshots every snapshotInterval years, starting at year 0', () => {
		const sim = createSimulation(generateWorld(SEED));
		sim.run(35);
		expect(sim.history.snapshots.map((s) => s.year)).toEqual([0, 10, 20, 30]);
	});

	it('stores snapshots as deep copies independent of the live world', () => {
		const sim = createSimulation(generateWorld(SEED));
		sim.run(10);
		const snap = sim.history.snapshots.find((s) => s.year === 10)!;
		const before = snap.world.states[0]!.population;
		sim.world.states[0]!.population = 42;
		expect(snap.world.states[0]!.population).toBe(before);
	});

	it('running one world does not affect a snapshot from an earlier year', () => {
		const sim = createSimulation(generateWorld(SEED));
		sim.run(10);
		const clone = structuredClone(sim.history.snapshots[0]!);
		sim.run(40);
		expect(sim.history.snapshots[0]).toEqual(clone);
	});
});
