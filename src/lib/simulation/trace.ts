import type { Cause } from './events/causes';

/**
 * Per-tick sink for causal explanations (BLUEPRINT.md §25, MODEL.md §71).
 * Systems record the contributors to a metric as they compute it; `recordStatistics`
 * folds them into that year's `StateYearStats`. A fresh sink is created each tick,
 * and only when history is being recorded, so non-recording runs pay nothing.
 */
export class TraceSink {
	#data = new Map<string, Map<string, Cause[]>>();

	record(stateId: string, metric: string, causes: Cause[]): void {
		let metrics = this.#data.get(stateId);
		if (!metrics) {
			metrics = new Map();
			this.#data.set(stateId, metrics);
		}
		metrics.set(metric, causes);
	}

	/** All metrics recorded for a state this tick, or `undefined` if none. */
	forState(stateId: string): Record<string, Cause[]> | undefined {
		const metrics = this.#data.get(stateId);
		if (!metrics || metrics.size === 0) return undefined;
		return Object.fromEntries(metrics);
	}
}
