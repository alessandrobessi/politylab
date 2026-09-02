/**
 * Causal metadata. BLUEPRINT.md §25 / MODEL.md §66, §71: important derived
 * values expose their major contributors so the UI can answer "Why did this
 * value move?". Raw impacts are stored (not percentages) — the UI derives
 * percentages later.
 *
 * Systems build a `CauseSet` as they compute a metric, then attach `list()` (or
 * `explain(value)`) to that year's trace. Consumed by the UI from M19, but
 * produced from the first system onward so nothing has to be retrofitted.
 */

export interface Cause {
	/** Stable identifier for the contributing factor, e.g. `"food_stress"`. */
	factor: string;
	/** Signed contribution to the metric, in the metric's own units. */
	impact: number;
	/** Optional: the underlying factor value that produced this impact. */
	value?: number;
}

export interface Explained<T> {
	value: T;
	causes: Cause[];
}

/** Accumulates `Cause` entries for one metric during a single tick. */
export class CauseSet {
	#causes: Cause[] = [];

	/** Record a contribution. No-ops on a zero impact with no reported value. */
	add(factor: string, impact: number, value?: number): this {
		if (impact === 0 && value === undefined) return this;
		const cause: Cause = { factor, impact };
		if (value !== undefined) cause.value = value;
		this.#causes.push(cause);
		return this;
	}

	/** Contributions, copied and sorted by descending magnitude of impact. */
	list(): Cause[] {
		return [...this.#causes].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
	}

	/** Pair a resolved metric value with its sorted contributors. */
	explain<T>(value: T): Explained<T> {
		return { value, causes: this.list() };
	}

	/** Sum of all recorded impacts (a consistency check against the delta). */
	total(): number {
		let sum = 0;
		for (const c of this.#causes) sum += c.impact;
		return sum;
	}

	get size(): number {
		return this.#causes.length;
	}
}
