import type { SimulationConfig } from './config';
import type { WorldHistory } from './models/history';
import type { SeededRandom } from './rng';
import type { TraceSink } from './trace';

/**
 * Per-tick context handed to every simulation system (BLUEPRINT.md §24). Systems
 * mutate the `World` in place; they read coefficients from `config` and draw all
 * randomness from `rng` (a year-keyed substream, see engine.ts). Kept in its own
 * module so systems and the engine share the type without an import cycle.
 */
export interface SimContext {
	readonly config: SimulationConfig;
	readonly rng: SeededRandom;
	/** The year being simulated (before the end-of-tick increment). */
	readonly year: number;
	/** Present when the caller is recording history; otherwise `null`. */
	readonly history: WorldHistory | null;
	/** Collects causal explanations for this tick; `null` when not recording. */
	readonly traces: TraceSink | null;
}
