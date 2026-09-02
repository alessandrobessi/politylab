/**
 * Numerical-safety helpers. BLUEPRINT.md §44 / MODEL.md §69: every simulation
 * system must guard against NaN, Infinity, division by zero, negative
 * population/territory, and invalid shares. Systems use these rather than raw
 * arithmetic so invalid state cannot silently propagate.
 */

/** Clamp `x` into [lo, hi]. */
export function clamp(x: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, x));
}

/** Clamp `x` into [0, 1] — the range of most normalized structural variables. */
export function clamp01(x: number): number {
	return Math.max(0, Math.min(1, x));
}

/** `a / b`, but returns `fallback` when `b` is 0 or the result is non-finite. */
export function safeDivide(a: number, b: number, fallback = 0): number {
	if (b === 0) return fallback;
	const q = a / b;
	return Number.isFinite(q) ? q : fallback;
}

/** Return `x` if it is a finite number, otherwise `fallback`. */
export function finiteOrFallback(x: number, fallback: number): number {
	return Number.isFinite(x) ? x : fallback;
}

/** Logistic function. Input is clamped to ±20 to avoid `Math.exp` overflow. */
export function sigmoid(x: number): number {
	const c = clamp(x, -20, 20);
	return 1 / (1 + Math.exp(-c));
}

/** Linear interpolation between `a` and `b` by `t` (unclamped). */
export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/**
 * Move `current` a fraction `rate` of the way toward `target`. Used for the
 * gradual-adjustment updates throughout MODEL.md (`x += rate * (target - x)`).
 */
export function approach(current: number, target: number, rate: number): number {
	return current + (target - current) * rate;
}

/** Arithmetic mean; returns 0 for an empty list. */
export function mean(xs: readonly number[]): number {
	if (xs.length === 0) return 0;
	let sum = 0;
	for (const x of xs) sum += x;
	return sum / xs.length;
}

/**
 * Normalize a record of shares so the values are non-negative and sum to 1.
 * Negative inputs are treated as 0. If the total is non-positive or non-finite,
 * the weight is split equally (never returns NaN or all-zero shares).
 */
export function normalizeShares<K extends string>(shares: Record<K, number>): Record<K, number> {
	const keys = Object.keys(shares) as K[];
	const result = {} as Record<K, number>;
	if (keys.length === 0) return result;

	let total = 0;
	for (const k of keys) {
		const v = shares[k];
		const safe = Number.isFinite(v) && v > 0 ? v : 0;
		result[k] = safe;
		total += safe;
	}

	if (total <= 0 || !Number.isFinite(total)) {
		const equal = 1 / keys.length;
		for (const k of keys) result[k] = equal;
		return result;
	}
	for (const k of keys) result[k] = result[k] / total;
	return result;
}

/** True when `values` sum to 1 within `tolerance`. */
export function sharesSumToOne(values: readonly number[], tolerance = 1e-6): boolean {
	let sum = 0;
	for (const v of values) sum += v;
	return Math.abs(sum - 1) <= tolerance;
}
