import { describe, it, expect } from 'vitest';
import {
	clamp,
	clamp01,
	safeDivide,
	finiteOrFallback,
	sigmoid,
	lerp,
	approach,
	mean,
	normalizeShares,
	sharesSumToOne
} from './math';

describe('clamp / clamp01', () => {
	it('clamps into range', () => {
		expect(clamp(5, 0, 10)).toBe(5);
		expect(clamp(-1, 0, 10)).toBe(0);
		expect(clamp(11, 0, 10)).toBe(10);
	});
	it('clamp01 restricts to [0, 1]', () => {
		expect(clamp01(-0.2)).toBe(0);
		expect(clamp01(0.4)).toBe(0.4);
		expect(clamp01(1.5)).toBe(1);
	});
});

describe('safeDivide', () => {
	it('divides normally', () => {
		expect(safeDivide(10, 4)).toBe(2.5);
	});
	it('returns the fallback on a zero denominator', () => {
		expect(safeDivide(1, 0)).toBe(0);
		expect(safeDivide(1, 0, -1)).toBe(-1);
	});
	it('returns the fallback on a non-finite result', () => {
		expect(safeDivide(Number.POSITIVE_INFINITY, 2, 42)).toBe(42);
		expect(safeDivide(Number.NaN, 2, 42)).toBe(42);
	});
});

describe('finiteOrFallback', () => {
	it('passes finite values through', () => {
		expect(finiteOrFallback(3.14, 0)).toBe(3.14);
	});
	it('replaces NaN and Infinity', () => {
		expect(finiteOrFallback(Number.NaN, 7)).toBe(7);
		expect(finiteOrFallback(Number.POSITIVE_INFINITY, 7)).toBe(7);
	});
});

describe('sigmoid', () => {
	it('is 0.5 at 0 and monotonic', () => {
		expect(sigmoid(0)).toBeCloseTo(0.5, 12);
		expect(sigmoid(2)).toBeGreaterThan(sigmoid(1));
		expect(sigmoid(-1)).toBeLessThan(sigmoid(0));
	});
	it('does not overflow on extreme input', () => {
		expect(sigmoid(1e9)).toBe(sigmoid(20));
		expect(sigmoid(-1e9)).toBe(sigmoid(-20));
		expect(Number.isFinite(sigmoid(1e9))).toBe(true);
	});
});

describe('lerp / approach', () => {
	it('lerp interpolates', () => {
		expect(lerp(0, 10, 0.5)).toBe(5);
		expect(lerp(0, 10, 0)).toBe(0);
		expect(lerp(0, 10, 1)).toBe(10);
	});
	it('approach moves a fraction toward the target', () => {
		expect(approach(0, 1, 0.15)).toBeCloseTo(0.15, 12);
		let x = 0;
		for (let i = 0; i < 200; i++) x = approach(x, 1, 0.15);
		expect(x).toBeCloseTo(1, 6);
	});
});

describe('mean', () => {
	it('averages', () => {
		expect(mean([1, 2, 3, 4])).toBe(2.5);
	});
	it('is 0 for an empty list', () => {
		expect(mean([])).toBe(0);
	});
});

describe('normalizeShares', () => {
	it('scales values to sum to 1', () => {
		const out = normalizeShares({ a: 1, b: 1, c: 2 });
		expect(out).toEqual({ a: 0.25, b: 0.25, c: 0.5 });
		expect(sharesSumToOne(Object.values(out))).toBe(true);
	});
	it('treats negatives as zero', () => {
		const out = normalizeShares({ a: -5, b: 1, c: 1 });
		expect(out.a).toBe(0);
		expect(sharesSumToOne(Object.values(out))).toBe(true);
	});
	it('splits equally when the total is non-positive', () => {
		expect(normalizeShares({ a: 0, b: 0 })).toEqual({ a: 0.5, b: 0.5 });
		expect(normalizeShares({ a: Number.NaN, b: 3 }).b).toBe(1);
	});
});
