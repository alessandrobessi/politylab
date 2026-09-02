/**
 * Deterministic seeded random-number generator.
 *
 * BLUEPRINT.md §7 / §55.6: simulation code must never call `Math.random()`. All
 * stochastic behaviour flows through this class. Given the same seed and the
 * same sequence of calls it produces exactly the same numbers, on any platform.
 *
 * Algorithm: the numeric/string seed is expanded with **splitmix64** (BigInt,
 * run only a handful of times at construction) into four 32-bit words that seed
 * an **sfc32** generator (pure int32 math in the hot path — no BigInt per draw).
 *
 * `fork(label)` derives an independent child stream keyed by a string label and
 * by this generator's *identity seed* — never by how many numbers have been
 * drawn so far. That makes substreams order-insensitive: a system can call
 * `ctx.rng.fork('population')` regardless of which other systems ran first, and
 * adding or reordering systems never shifts another system's draws (see
 * BLUEPRINT.md §24 tick pipeline, wired in a later milestone).
 */

const U64 = (1n << 64n) - 1n;
const U32 = 0xffffffffn;
const SPLITMIX_GAMMA = 0x9e3779b97f4a7c15n;

/** The splitmix64 finalizer: a bijective, non-linear 64-bit bit-mixer. */
function mix64(x: bigint): bigint {
	let z = x & U64;
	z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & U64;
	z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & U64;
	return (z ^ (z >> 31n)) & U64;
}

/** One step of splitmix64; returns the advanced state and the mixed output. */
function splitmix64Step(state: bigint): { state: bigint; value: bigint } {
	const next = (state + SPLITMIX_GAMMA) & U64;
	return { state: next, value: mix64(next) };
}

/** FNV-1a 64-bit hash of a string, used for seeds and `fork` labels. */
function hashString64(str: string): bigint {
	let h = 0xcbf29ce484222325n;
	for (let i = 0; i < str.length; i++) {
		h ^= BigInt(str.charCodeAt(i));
		h = (h * 0x100000001b3n) & U64;
	}
	return h;
}

function normalizeSeed(seed: number | bigint | string): bigint {
	if (typeof seed === 'bigint') return seed & U64;
	if (typeof seed === 'string') return hashString64(seed);
	if (!Number.isFinite(seed)) {
		throw new Error(`SeededRandom: seed must be a finite number, got ${seed}`);
	}
	return BigInt(Math.trunc(seed)) & U64;
}

export class SeededRandom {
	/** The normalized 64-bit identity seed. `fork` is derived from this. */
	readonly seed: bigint;

	#a = 0;
	#b = 0;
	#c = 0;
	#d = 0;
	#spareNormal: number | null = null;

	constructor(seed: number | bigint | string) {
		this.seed = normalizeSeed(seed);

		// Expand the identity seed into four 32-bit words with splitmix64.
		let sm = this.seed;
		const words: number[] = [];
		while (words.length < 4) {
			const step = splitmix64Step(sm);
			sm = step.state;
			words.push(Number(step.value & U32));
			words.push(Number((step.value >> 32n) & U32));
		}
		this.#a = words[0]! | 0;
		this.#b = words[1]! | 0;
		this.#c = words[2]! | 0;
		this.#d = words[3]! | 0;

		// Discard the first outputs so nearby seeds decorrelate immediately.
		for (let i = 0; i < 16; i++) this.#raw();
	}

	/** Raw sfc32 step → unsigned 32-bit integer. */
	#raw(): number {
		let a = this.#a | 0;
		let b = this.#b | 0;
		let c = this.#c | 0;
		const d = this.#d | 0;

		const t = (((a + b) | 0) + d) | 0;
		this.#d = (d + 1) | 0;
		a = b ^ (b >>> 9);
		b = (c + (c << 3)) | 0;
		c = (c << 21) | (c >>> 11);
		c = (c + t) | 0;
		this.#a = a;
		this.#b = b;
		this.#c = c;

		return t >>> 0;
	}

	/** Float in [0, 1). */
	next(): number {
		return this.#raw() / 4294967296;
	}

	/** Float in [min, max). */
	range(min: number, max: number): number {
		if (!Number.isFinite(min) || !Number.isFinite(max)) {
			throw new Error(`SeededRandom.range: bounds must be finite, got [${min}, ${max})`);
		}
		return min + this.next() * (max - min);
	}

	/** Integer in [minInclusive, maxExclusive). */
	int(minInclusive: number, maxExclusive: number): number {
		if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
			throw new Error(
				`SeededRandom.int: bounds must be integers, got [${minInclusive}, ${maxExclusive})`
			);
		}
		if (maxExclusive <= minInclusive) {
			throw new Error(
				`SeededRandom.int: maxExclusive (${maxExclusive}) must be greater than minInclusive (${minInclusive})`
			);
		}
		return minInclusive + Math.floor(this.next() * (maxExclusive - minInclusive));
	}

	/** Integer in [min, max], both inclusive. */
	intInclusive(min: number, max: number): number {
		return this.int(min, max + 1);
	}

	/** Boolean that is true with probability `pTrue` (default 0.5). */
	bool(pTrue = 0.5): boolean {
		return this.next() < pTrue;
	}

	/** Gaussian sample (Box–Muller, with a cached spare for the paired value). */
	normal(mean = 0, stdDev = 1): number {
		if (this.#spareNormal !== null) {
			const z = this.#spareNormal;
			this.#spareNormal = null;
			return mean + stdDev * z;
		}
		let u1 = 0;
		do {
			u1 = this.next();
		} while (u1 <= Number.EPSILON);
		const u2 = this.next();
		const mag = Math.sqrt(-2 * Math.log(u1));
		this.#spareNormal = mag * Math.sin(2 * Math.PI * u2);
		return mean + stdDev * (mag * Math.cos(2 * Math.PI * u2));
	}

	/** Uniformly pick one element. Throws on an empty array. */
	pick<T>(items: readonly T[]): T {
		if (items.length === 0) {
			throw new Error('SeededRandom.pick: cannot pick from an empty array');
		}
		return items[this.int(0, items.length)]!;
	}

	/** Pick one element with probability proportional to its weight. */
	weighted<T>(items: readonly T[], weights: readonly number[]): T {
		if (items.length === 0) {
			throw new Error('SeededRandom.weighted: cannot pick from an empty array');
		}
		if (items.length !== weights.length) {
			throw new Error(
				`SeededRandom.weighted: items (${items.length}) and weights (${weights.length}) have different lengths`
			);
		}
		let total = 0;
		for (const w of weights) {
			if (!Number.isFinite(w) || w < 0) {
				throw new Error(`SeededRandom.weighted: weights must be finite and non-negative, got ${w}`);
			}
			total += w;
		}
		if (total <= 0) {
			throw new Error('SeededRandom.weighted: total weight must be positive');
		}
		let r = this.next() * total;
		for (let i = 0; i < items.length; i++) {
			r -= weights[i]!;
			if (r < 0) return items[i]!;
		}
		return items[items.length - 1]!; // floating-point safety net
	}

	/** Fisher–Yates shuffle, in place. Returns the same array. */
	shuffle<T>(items: T[]): T[] {
		for (let i = items.length - 1; i > 0; i--) {
			const j = this.int(0, i + 1);
			const tmp = items[i]!;
			items[i] = items[j]!;
			items[j] = tmp;
		}
		return items;
	}

	/**
	 * An independent child generator keyed by `label`. Deterministic in
	 * `(this.seed, label)` only — independent of how many values this generator
	 * has produced, and identical for repeated calls with the same label.
	 *
	 * The outer `mix64` makes derivation order-sensitive, so nested forks such as
	 * `fork('a').fork('b')` and `fork('b').fork('a')` yield different streams
	 * (a plain XOR/addition of label hashes would collide).
	 */
	fork(label: string): SeededRandom {
		return new SeededRandom(mix64(this.seed ^ mix64(hashString64(label))));
	}
}
