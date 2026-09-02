import { describe, it, expect } from 'vitest';
import { SeededRandom } from './rng';

describe('SeededRandom — API behaviour', () => {
	it('next() stays in [0, 1)', () => {
		const rng = new SeededRandom(1);
		for (let i = 0; i < 100_000; i++) {
			const v = rng.next();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('next() is roughly uniform (mean ≈ 0.5)', () => {
		const rng = new SeededRandom(42);
		let sum = 0;
		const n = 200_000;
		for (let i = 0; i < n; i++) sum += rng.next();
		expect(sum / n).toBeCloseTo(0.5, 2);
	});

	it('int() respects [min, max) and covers the range', () => {
		const rng = new SeededRandom(7);
		const seen = new Set<number>();
		for (let i = 0; i < 10_000; i++) {
			const v = rng.int(3, 8);
			expect(Number.isInteger(v)).toBe(true);
			expect(v).toBeGreaterThanOrEqual(3);
			expect(v).toBeLessThan(8);
			seen.add(v);
		}
		expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
	});

	it('intInclusive() can return the upper bound', () => {
		const rng = new SeededRandom(7);
		const seen = new Set<number>();
		for (let i = 0; i < 10_000; i++) seen.add(rng.intInclusive(0, 3));
		expect([...seen].sort()).toEqual([0, 1, 2, 3]);
	});

	it('range() stays within [min, max)', () => {
		const rng = new SeededRandom(11);
		for (let i = 0; i < 10_000; i++) {
			const v = rng.range(-2, 5);
			expect(v).toBeGreaterThanOrEqual(-2);
			expect(v).toBeLessThan(5);
		}
	});

	it('bool(p) fires at approximately rate p', () => {
		const rng = new SeededRandom(99);
		let hits = 0;
		const n = 100_000;
		for (let i = 0; i < n; i++) if (rng.bool(0.25)) hits++;
		expect(hits / n).toBeCloseTo(0.25, 2);
	});

	it('normal() has mean ≈ 0 and stdDev ≈ 1', () => {
		const rng = new SeededRandom(2024);
		const n = 200_000;
		const xs: number[] = [];
		for (let i = 0; i < n; i++) xs.push(rng.normal());
		const mean = xs.reduce((a, b) => a + b, 0) / n;
		const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
		expect(mean).toBeCloseTo(0, 1);
		expect(Math.sqrt(variance)).toBeCloseTo(1, 1);
	});

	it('normal(mean, sd) shifts and scales', () => {
		const rng = new SeededRandom(2024);
		const n = 200_000;
		let sum = 0;
		for (let i = 0; i < n; i++) sum += rng.normal(10, 2);
		expect(sum / n).toBeCloseTo(10, 1);
	});

	it('pick() returns a member and covers all members', () => {
		const rng = new SeededRandom(5);
		const items = ['a', 'b', 'c', 'd'] as const;
		const seen = new Set<string>();
		for (let i = 0; i < 5000; i++) seen.add(rng.pick(items));
		expect([...seen].sort()).toEqual(['a', 'b', 'c', 'd']);
	});

	it('weighted() honours the weights', () => {
		const rng = new SeededRandom(123);
		const counts = [0, 0, 0];
		const n = 120_000;
		for (let i = 0; i < n; i++) counts[rng.weighted([0, 1, 2], [1, 0, 3])]!++;
		expect(counts[1]).toBe(0); // zero weight never chosen
		expect(counts[0]! / n).toBeCloseTo(0.25, 2);
		expect(counts[2]! / n).toBeCloseTo(0.75, 2);
	});

	it('shuffle() is a permutation', () => {
		const rng = new SeededRandom(321);
		const original = Array.from({ length: 50 }, (_, i) => i);
		const shuffled = rng.shuffle([...original]);
		expect(shuffled).toHaveLength(original.length);
		expect([...shuffled].sort((a, b) => a - b)).toEqual(original);
		expect(shuffled).not.toEqual(original); // astronomically unlikely to be identity
	});
});

describe('SeededRandom — invalid input throws', () => {
	it('rejects a non-finite seed', () => {
		expect(() => new SeededRandom(Number.NaN)).toThrow(/finite/);
		expect(() => new SeededRandom(Number.POSITIVE_INFINITY)).toThrow(/finite/);
	});

	it('rejects degenerate int() bounds', () => {
		const rng = new SeededRandom(1);
		expect(() => rng.int(5, 5)).toThrow();
		expect(() => rng.int(5, 3)).toThrow();
		expect(() => rng.int(0.5, 3)).toThrow(/integer/);
	});

	it('rejects empty pick() / weighted()', () => {
		const rng = new SeededRandom(1);
		expect(() => rng.pick([])).toThrow();
		expect(() => rng.weighted([], [])).toThrow();
	});

	it('rejects malformed weighted() input', () => {
		const rng = new SeededRandom(1);
		expect(() => rng.weighted([1, 2], [1])).toThrow(/length/);
		expect(() => rng.weighted([1, 2], [0, 0])).toThrow(/positive/);
		expect(() => rng.weighted([1, 2], [1, -1])).toThrow(/non-negative/);
	});
});
