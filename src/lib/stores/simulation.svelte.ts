/**
 * The Simulation Controller (BLUEPRINT.md §6, §34): a message client for the
 * Web Worker that runs the engine. The worker owns the world and history; the
 * controller holds the latest pushed `WorkerState` and exposes it reactively.
 * Engine work never touches the UI thread, so 20×/100× stay responsive.
 */

import SimulationWorker from '$lib/workers/simulation.worker?worker';
import type {
	SavedSimulation,
	WorkerCommand,
	WorkerMessage,
	WorkerState
} from '$lib/workers/protocol';
import { WorkerCore } from '$lib/workers/core';
import type { Cause, State, StateYearStats, World } from '$lib/simulation';

export type Speed = 0 | 1 | 5 | 20 | 100;
export const SPEEDS: Speed[] = [1, 5, 20, 100];

const DEFAULT_SEED = 481204;

/** Minimal transport: a real Worker in the browser, an inline core elsewhere. */
interface Transport {
	post(cmd: WorkerCommand): void;
	dispose(): void;
}

export class SimulationController {
	#transport: Transport;
	#version = $state(0);
	#state = $state<WorkerState | null>(null);
	#pendingSave: ((saved: SavedSimulation) => void) | null = null;
	#pendingHistory: ((stats: Record<string, StateYearStats[]>) => void) | null = null;

	seed = $state(DEFAULT_SEED);
	speed = $state<Speed>(0);
	selectedId = $state<string | null>(null);

	constructor(seed: number = DEFAULT_SEED) {
		this.seed = seed;
		this.#transport = createTransport((msg) => this.#onMessage(msg));
		this.#transport.post({ type: 'generate', seed });
	}

	#onMessage(msg: WorkerMessage): void {
		if (msg.type === 'state') {
			this.#state = msg;
			this.#version += 1;
		} else if (msg.type === 'saved') {
			this.#pendingSave?.(msg.saved);
			this.#pendingSave = null;
		} else if (msg.type === 'history') {
			this.#pendingHistory?.(msg.stats);
			this.#pendingHistory = null;
		}
	}

	get ready(): boolean {
		void this.#version;
		return this.#state !== null;
	}

	get world(): World | null {
		void this.#version;
		return this.#state?.world ?? null;
	}

	get year(): number {
		void this.#version;
		return this.#state?.world.year ?? 0;
	}

	/** The true present year, unaffected by replay (for the timeline extent). */
	get liveYear(): number {
		void this.#version;
		return this.#state?.liveYear ?? 0;
	}

	get running(): boolean {
		return this.speed > 0;
	}

	/** True while viewing a past year (read-only). */
	get viewYear(): number | null {
		void this.#version;
		return this.#state?.viewYear ?? null;
	}

	get totalEvents(): number {
		void this.#version;
		return this.#state?.totalEvents ?? 0;
	}

	get selected(): State | null {
		void this.#version;
		return this.selectedId
			? (this.#state?.world.states.find((s) => s.id === this.selectedId) ?? null)
			: null;
	}

	select(id: string | null): void {
		this.selectedId = id;
	}

	statsFor(id: string): StateYearStats[] {
		void this.#version;
		return this.#state?.statsTail[id] ?? [];
	}

	causesFor(id: string, metric: string): Cause[] {
		void this.#version;
		return this.#state?.statsTail[id]?.at(-1)?.causes?.[metric] ?? [];
	}

	step(): void {
		this.speed = 0;
		this.#transport.post({ type: 'step' });
	}

	setSpeed(speed: Speed): void {
		this.speed = speed;
		this.#transport.post(
			speed === 0 ? { type: 'pause' } : { type: 'play', ticksPerSecond: speed * 6 }
		);
	}

	pause(): void {
		this.setSpeed(0);
	}

	/** Enter a read-only view of a past year. */
	seek(year: number): void {
		this.speed = 0;
		this.#transport.post({ type: 'pause' });
		this.#transport.post({ type: 'seek', year });
	}

	/** Leave the historical view and return to the present. */
	resumeLive(): void {
		this.#transport.post({ type: 'resume' });
	}

	regenerate(seed: number = this.seed): void {
		this.speed = 0;
		this.seed = seed;
		this.selectedId = null;
		this.#transport.post({ type: 'generate', seed });
	}

	/** Ask the worker for a full serializable snapshot (for persistence). */
	exportState(): Promise<SavedSimulation> {
		return new Promise((resolve) => {
			this.#pendingSave = resolve;
			this.#transport.post({ type: 'export' });
		});
	}

	/**
	 * Fetch the complete per-state annual time series (not the truncated tail on
	 * `statsTail`). Used by the history charts; call it on demand rather than
	 * every tick — the payload is the whole run.
	 */
	requestHistory(): Promise<Record<string, StateYearStats[]>> {
		return new Promise((resolve) => {
			this.#pendingHistory = resolve;
			this.#transport.post({ type: 'history' });
		});
	}

	loadState(saved: SavedSimulation): void {
		this.speed = 0;
		this.selectedId = null;
		this.seed = saved.world.seed;
		this.#transport.post({ type: 'load', saved });
	}

	dispose(): void {
		this.#transport.dispose();
	}
}

function createTransport(onMessage: (msg: WorkerMessage) => void): Transport {
	if (typeof Worker !== 'undefined') {
		const worker = new SimulationWorker();
		worker.onmessage = (e: MessageEvent<WorkerMessage>) => onMessage(e.data);
		return {
			post: (cmd) => worker.postMessage(cmd),
			dispose: () => worker.terminate()
		};
	}
	// SSR / no-Worker fallback: run the core inline (synchronous).
	const core = new WorkerCore();
	return {
		post: (cmd) => {
			switch (cmd.type) {
				case 'generate':
					core.generate(cmd.seed);
					break;
				case 'step':
					core.run(1);
					break;
				case 'seek':
					core.seek(cmd.year);
					break;
				case 'resume':
					core.resume();
					break;
				case 'load':
					core.load(cmd.saved);
					break;
				case 'export':
					onMessage({ type: 'saved', saved: core.export() });
					return;
				case 'history': {
					const h = core.fullHistory();
					onMessage({ type: 'history', stats: h.stats, liveYear: h.liveYear });
					return;
				}
				case 'play':
				case 'pause':
					break;
			}
			onMessage(core.snapshot(false));
		},
		dispose: () => {}
	};
}
