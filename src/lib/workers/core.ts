import {
	createSimulation,
	simulateYears,
	type Simulation,
	type StateYearStats,
	type World
} from '$lib/simulation';
import { generateWorld } from '$lib/worldgen';
import { EVENT_TAIL, STATS_TAIL, type SavedSimulation, type WorkerState } from './protocol';

/**
 * The simulation runtime that lives inside the Web Worker (BLUEPRINT.md §34) —
 * but with no `self` / `postMessage`, so it can be unit-tested in Node. The
 * `.worker.ts` shim is a thin adapter over this.
 */
export class WorkerCore {
	#sim: Simulation;
	#viewYear: number | null = null;
	#historical: World | null = null;

	constructor(seed = 481204) {
		this.#sim = createSimulation(generateWorld(seed));
	}

	generate(seed: number): void {
		this.#sim = createSimulation(generateWorld(seed));
		this.#viewYear = null;
		this.#historical = null;
	}

	load(saved: SavedSimulation): void {
		const sim = createSimulation(saved.world);
		// Restore recorded history (createSimulation only captured year 0).
		sim.history.byState = structuredClone(saved.stats);
		sim.history.snapshots = saved.snapshots.map((s) => ({
			year: s.year,
			world: structuredClone(s.world)
		}));
		this.#sim = sim;
		this.#viewYear = null;
		this.#historical = null;
	}

	/** Advance `years` years (leaves any replay view). */
	run(years: number): void {
		this.#viewYear = null;
		this.#historical = null;
		simulateYears(this.#sim.world, years, { history: this.#sim.history });
	}

	/** Enter a read-only view of the nearest snapshot at or before `year`. */
	seek(year: number): void {
		const snapshots = this.#sim.history.snapshots;
		if (snapshots.length === 0) return;
		let chosen = snapshots[0]!;
		for (const s of snapshots) if (s.year <= year && s.year >= chosen.year) chosen = s;
		this.#viewYear = chosen.year;
		this.#historical = structuredClone(chosen.world);
	}

	resume(): void {
		this.#viewYear = null;
		this.#historical = null;
	}

	get snapshotYears(): number[] {
		return this.#sim.history.snapshots.map((s) => s.year);
	}

	export(): SavedSimulation {
		return {
			world: structuredClone(this.#sim.world),
			stats: structuredClone(this.#sim.history.byState),
			snapshots: this.#sim.history.snapshots.map((s) => ({
				year: s.year,
				world: structuredClone(s.world)
			}))
		};
	}

	/** The complete per-state annual time series (for the history charts). */
	fullHistory(): { stats: Record<string, StateYearStats[]>; liveYear: number } {
		return {
			stats: structuredClone(this.#sim.history.byState),
			liveYear: this.#sim.world.year
		};
	}

	/** The state message to push to the UI. */
	snapshot(running: boolean): WorkerState {
		const live = this.#sim.world;
		const shown = this.#historical ?? live;
		const world: World = { ...shown, events: shown.events.slice(-EVENT_TAIL) };

		const statsTail: WorkerState['statsTail'] = {};
		for (const [id, rows] of Object.entries(this.#sim.history.byState)) {
			statsTail[id] = rows.slice(-STATS_TAIL);
		}

		return {
			type: 'state',
			world,
			totalEvents: live.events.length,
			statsTail,
			viewYear: this.#viewYear,
			liveYear: live.year,
			running
		};
	}
}
