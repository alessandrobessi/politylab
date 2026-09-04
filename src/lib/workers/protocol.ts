import type { StateYearStats, World, WorldEvent } from '$lib/simulation';

/** Serialized simulation state exchanged with the worker (plain data only). */
export interface SavedSimulation {
	world: World;
	/** Full annual stats per state id. */
	stats: Record<string, StateYearStats[]>;
	/** Full world snapshots (year → deep-cloned world). */
	snapshots: { year: number; world: World }[];
}

/** Commands the UI sends to the worker. */
export type WorkerCommand =
	| { type: 'generate'; seed: number }
	| { type: 'step' }
	| { type: 'play'; ticksPerSecond: number }
	| { type: 'pause' }
	| { type: 'seek'; year: number }
	| { type: 'resume' }
	| { type: 'load'; saved: SavedSimulation }
	| { type: 'export' };

/**
 * State the worker pushes back. `world.events` is truncated to the most recent
 * `EVENT_TAIL`; `statsTail` holds the last `STATS_TAIL` years per state for
 * sparklines. Full history is fetched via `seek` / `load` payloads.
 */
export interface WorkerState {
	type: 'state';
	world: World;
	/** Total events ever emitted (world.events may be truncated). */
	totalEvents: number;
	/** Last STATS_TAIL annual rows per state id. */
	statsTail: Record<string, StateYearStats[]>;
	/** Present when replaying a past year (read-only view); null when live. */
	viewYear: number | null;
	/** The true present year of the live simulation (unaffected by replay). */
	liveYear: number;
	running: boolean;
}

/** One-off replies to `load`/`save`-style requests. */
export interface WorkerSaved {
	type: 'saved';
	saved: SavedSimulation;
}

export type WorkerMessage = WorkerState | WorkerSaved;

export const EVENT_TAIL = 400;
export const STATS_TAIL = 250;
/** Minimum ms between pushed `state` messages during continuous play. */
export const PUSH_INTERVAL_MS = 60;

export type { WorldEvent };
