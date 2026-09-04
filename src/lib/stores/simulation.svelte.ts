/**
 * The Simulation Controller layer (BLUEPRINT.md §6, §34): the bridge between the
 * framework-free engine and the Svelte UI. It owns the running world, a speed
 * setting, and the timer that advances the clock.
 *
 * The engine mutates the world object in place, which Svelte's `$state` proxy
 * cannot observe, so a private version counter is bumped after every advance and
 * read by the public getters — any reactive scope that reads `world` / `year`
 * re-runs when the world changes. High-speed execution moves into a Web Worker
 * in milestone 23.
 */

import { createSimulation, type Simulation } from '$lib/simulation/engine';
import type { Cause, State, StateYearStats } from '$lib/simulation';
import { generateWorld } from '$lib/worldgen';

export type Speed = 0 | 1 | 5;

const TICK_INTERVAL_MS = 250;
const DEFAULT_SEED = 481204;

export class SimulationController {
	#sim: Simulation;
	#version = $state(0);
	#timer: ReturnType<typeof setInterval> | null = null;

	seed = $state(DEFAULT_SEED);
	speed = $state<Speed>(0);
	/** Currently inspected state, or `null`. */
	selectedId = $state<string | null>(null);

	constructor(seed: number = DEFAULT_SEED) {
		this.seed = seed;
		this.#sim = createSimulation(generateWorld(seed));
	}

	get world() {
		void this.#version;
		return this.#sim.world;
	}

	get history() {
		void this.#version;
		return this.#sim.history;
	}

	get year() {
		void this.#version;
		return this.#sim.world.year;
	}

	get running(): boolean {
		return this.speed > 0;
	}

	/** The selected state object, or `null`. */
	get selected(): State | null {
		void this.#version;
		return this.selectedId
			? (this.#sim.world.states.find((s) => s.id === this.selectedId) ?? null)
			: null;
	}

	select(id: string | null): void {
		this.selectedId = id;
	}

	/** Annual stat history for a state, oldest → newest. */
	statsFor(id: string): StateYearStats[] {
		void this.#version;
		return this.#sim.history.byState[id] ?? [];
	}

	/** Latest recorded causal contributors for a metric on a state. */
	causesFor(id: string, metric: string): Cause[] {
		void this.#version;
		const rows = this.#sim.history.byState[id];
		return rows?.at(-1)?.causes?.[metric] ?? [];
	}

	#bump(): void {
		this.#version += 1;
	}

	#stopTimer(): void {
		if (this.#timer !== null) {
			clearInterval(this.#timer);
			this.#timer = null;
		}
	}

	/** Advance exactly one year (only meaningful while paused). */
	step(): void {
		this.#sim.step();
		this.#bump();
	}

	setSpeed(speed: Speed): void {
		this.speed = speed;
		this.#stopTimer();
		if (speed > 0) {
			this.#timer = setInterval(() => {
				this.#sim.run(speed);
				this.#bump();
			}, TICK_INTERVAL_MS);
		}
	}

	pause(): void {
		this.setSpeed(0);
	}

	/** Discard the current world and generate a fresh one from `seed`. */
	regenerate(seed: number = this.seed): void {
		this.#stopTimer();
		this.speed = 0;
		this.seed = seed;
		this.selectedId = null;
		this.#sim = createSimulation(generateWorld(seed));
		this.#bump();
	}

	/** Stop the timer; call from the component's teardown. */
	dispose(): void {
		this.#stopTimer();
	}
}
