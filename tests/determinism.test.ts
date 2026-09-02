import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../src/lib/simulation/rng';

/**
 * Determinism is mandatory (BLUEPRINT.md §7, MODEL.md §83). This suite pins the
 * RNG's reproducibility guarantees. The world-level "same seed → identical
 * 1,000-year history" test is added once the engine exists (M4/M5).
 */

function draws(rng: SeededRandom, n: number): number[] {
	return Array.from({ length: n }, () => rng.next());
}

describe('SeededRandom — determinism', () => {
	it('same seed produces an identical sequence', () => {
		expect(draws(new SeededRandom(481204), 2000)).toEqual(draws(new SeededRandom(481204), 2000));
	});

	it('different seeds produce different sequences', () => {
		expect(draws(new SeededRandom(481204), 2000)).not.toEqual(
			draws(new SeededRandom(481205), 2000)
		);
	});

	it('adjacent integer seeds decorrelate immediately', () => {
		// First draw already differs — no shared prefix from nearby seeds.
		const a = new SeededRandom(1000).next();
		const b = new SeededRandom(1001).next();
		expect(a).not.toBe(b);
	});

	it('accepts string and bigint seeds deterministically', () => {
		expect(draws(new SeededRandom('velos'), 500)).toEqual(draws(new SeededRandom('velos'), 500));
		expect(draws(new SeededRandom('velos'), 500)).not.toEqual(
			draws(new SeededRandom('ardan'), 500)
		);
		expect(draws(new SeededRandom(123n), 500)).toEqual(draws(new SeededRandom(123n), 500));
	});

	it('normal() is deterministic for a given seed', () => {
		const a = new SeededRandom(77);
		const b = new SeededRandom(77);
		const seqA = Array.from({ length: 500 }, () => a.normal(0, 0.005));
		const seqB = Array.from({ length: 500 }, () => b.normal(0, 0.005));
		expect(seqA).toEqual(seqB);
	});

	it('shuffle() is deterministic for a given seed', () => {
		const s1 = new SeededRandom(9).shuffle(Array.from({ length: 100 }, (_, i) => i));
		const s2 = new SeededRandom(9).shuffle(Array.from({ length: 100 }, (_, i) => i));
		expect(s1).toEqual(s2);
	});
});

describe('SeededRandom — fork() substreams', () => {
	it('is reproducible for the same (seed, label)', () => {
		const a = new SeededRandom(481204).fork('population');
		const b = new SeededRandom(481204).fork('population');
		expect(draws(a, 1000)).toEqual(draws(b, 1000));
	});

	it('is independent of the order forks are taken', () => {
		const p1 = new SeededRandom(481204);
		const a1 = draws(p1.fork('population'), 500);
		const b1 = draws(p1.fork('warfare'), 500);

		const p2 = new SeededRandom(481204);
		const b2 = draws(p2.fork('warfare'), 500);
		const a2 = draws(p2.fork('population'), 500);

		expect(a1).toEqual(a2);
		expect(b1).toEqual(b2);
	});

	it('does not consume the parent stream', () => {
		const withFork = new SeededRandom(481204);
		withFork.fork('population');
		withFork.fork('diplomacy');
		const after = draws(withFork, 500);

		const withoutFork = draws(new SeededRandom(481204), 500);
		expect(after).toEqual(withoutFork);
	});

	it('produces distinct streams for distinct labels', () => {
		const root = new SeededRandom(481204);
		expect(draws(root.fork('population'), 500)).not.toEqual(draws(root.fork('economy'), 500));
	});

	it('supports nested forks deterministically', () => {
		const a = new SeededRandom(1).fork('a').fork('b');
		const b = new SeededRandom(1).fork('a').fork('b');
		expect(draws(a, 300)).toEqual(draws(b, 300));
		expect(draws(new SeededRandom(1).fork('a').fork('b'), 300)).not.toEqual(
			draws(new SeededRandom(1).fork('b').fork('a'), 300)
		);
	});

	it('year-keyed forks (the tick pattern) differ per year but repeat per run', () => {
		const runA = new SeededRandom(481204);
		const runB = new SeededRandom(481204);
		const yearValues = (root: SeededRandom, year: number) =>
			draws(root.fork(String(year)).fork('population'), 50);

		expect(yearValues(runA, 0)).toEqual(yearValues(runB, 0));
		expect(yearValues(runA, 0)).not.toEqual(yearValues(runA, 1));
	});
});
