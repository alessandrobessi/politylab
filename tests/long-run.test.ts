import { describe, it, expect } from 'vitest';
import { generateWorld } from '../src/lib/worldgen';
import { simulateYear, simulateYears } from '../src/lib/simulation/engine';
import { assertFiniteWorld } from '../src/lib/simulation/assert';

/**
 * Long-run numerical stability (BLUEPRINT.md §4 success criterion, MODEL.md §84).
 * `validate: true` runs `assertFiniteWorld` after every tick — no NaN/Infinity,
 * no negative population or capital, no broken ownership references. It does not
 * assert that any state survives.
 *
 * Systems are no-ops until M6, so today this exercises the harness; the assertion
 * bite arrives as each system lands.
 */
describe('long-run stability', () => {
	it('simulates 1,000 years from a single seed without numerical failure', () => {
		const world = generateWorld(481204);
		for (let y = 0; y < 1000; y++) simulateYear(world, { validate: true });
		expect(world.year).toBe(1000);
		expect(() => assertFiniteWorld(world)).not.toThrow();
	});

	it('stays finite across several seeds over 500 years each', () => {
		for (const seed of [1, 2, 3, 7, 42, 777]) {
			const world = generateWorld(seed);
			simulateYears(world, 500, { validate: true });
			expect(world.year).toBe(500);
			expect(() => assertFiniteWorld(world)).not.toThrow();
		}
	});
});
