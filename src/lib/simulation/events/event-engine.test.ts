import { describe, it, expect } from 'vitest';
import { generateWorld } from '../../worldgen';
import { createSimulation } from '../engine';

describe('event engine (BLUEPRINT.md §26, MODEL.md §65–§66)', () => {
	it('emits war and peace events with the right actors and importance', () => {
		const sim = createSimulation(generateWorld(481204));
		sim.run(200);
		const wars = sim.world.events.filter((e) => e.type === 'war');
		const peaces = sim.world.events.filter((e) => e.type === 'peace');
		expect(wars.length).toBeGreaterThan(0);
		expect(peaces.length).toBeGreaterThan(0);
		for (const e of wars) {
			expect(e.importance).toBe(0.8);
			expect(e.actors).toHaveLength(2);
			expect(e.title).toMatch(/declares war on/);
		}
		// every war event corresponds to a real war in the record
		for (const e of wars) {
			expect(sim.world.wars.some((w) => w.id === e.data.warId)).toBe(true);
		}
	});

	it('emits a politics event when a government type changes, matching the state', () => {
		const sim = createSimulation(generateWorld(7));
		sim.run(600);
		const transitions = sim.world.events.filter((e) => e.type === 'politics');
		expect(transitions.length).toBeGreaterThan(0);
		for (const e of transitions) {
			expect(e.importance).toBe(0.6);
			expect(e.data.from).not.toBe(e.data.to);
		}
	});

	it('event importance follows the MODEL.md §65 scale', () => {
		const sim = createSimulation(generateWorld(2));
		sim.run(600);
		const importanceByType: Record<string, number> = {
			alliance: 0.3,
			economy: 0.3,
			technology: 0.4,
			demography: 0.4,
			peace: 0.5,
			politics: 0.6,
			war: 0.8
		};
		for (const e of sim.world.events) {
			if (e.type in importanceByType) {
				expect(e.importance).toBeCloseTo(importanceByType[e.type]!, 6);
			}
			expect(e.importance).toBeGreaterThan(0);
			expect(e.importance).toBeLessThanOrEqual(1);
		}
	});

	it('produces a diverse event stream over a long run', () => {
		const sim = createSimulation(generateWorld(481204));
		sim.run(1000);
		const types = new Set(sim.world.events.map((e) => e.type));
		expect(types.size).toBeGreaterThanOrEqual(4);
		// chronological
		const years = sim.world.events.map((e) => e.year);
		expect(years).toEqual([...years].sort((a, b) => a - b));
		// war-decision events keep their causal factors
		const warWithCauses = sim.world.events.find((e) => e.type === 'war' && e.causes.length > 0);
		expect(warWithCauses).toBeDefined();
	});
});
