/**
 * Simulation engine. One tick = one year (BLUEPRINT.md §24). Systems run in a
 * fixed phase order and mutate the `World` in place; `simulateYear` then advances
 * the clock and, when a `WorldHistory` is supplied, records annual stats and a
 * periodic full snapshot.
 *
 * Determinism: the per-tick RNG is derived only from `(world.seed, world.year)`,
 * so a run never depends on how the engine was invoked, and a saved world
 * resumes identically. Framework-free — usable from the browser, a worker, Node,
 * tests, and Monte Carlo without modification (BLUEPRINT.md §6).
 */

import { assertFiniteWorld } from './assert';
import type { SimContext } from './context';
import { createHistory, type StateYearStats, type WorldHistory } from './models/history';
import type { World } from './models/world';
import { SeededRandom } from './rng';
import { technologyIndex } from './systems/technology';
import { TraceSink } from './trace';

import { updateEnvironment } from './systems/environment';
import { updatePopulation } from './systems/population';
import { updateProduction } from './systems/economy';
import {
	updateDebt,
	updateGovernmentRevenue,
	updateGovernmentSpending
} from './systems/government';
import { updateMilitary } from './systems/military';
import { updateTechnology } from './systems/technology';
import { updatePolitics } from './systems/politics';
import { updateTrade } from './systems/trade';
import { updateAlliances, updateDiplomacy } from './systems/diplomacy';
import { makeStrategicDecisions } from './strategy/decisions';
import { resolveWarfare, applyTerritorialChanges } from './systems/warfare';
import { generateEvents } from './events/event-engine';

export type { SimContext } from './context';

export interface SimulateOptions {
	/** Record annual stats and periodic snapshots into this history. */
	history?: WorldHistory | null;
	/** Run `assertFiniteWorld` after each simulated year (tests pass `true`). */
	validate?: boolean;
}

/** Advance `world` by one year, in place, and return it. */
export function simulateYear(world: World, options: SimulateOptions = {}): World {
	const { history = null, validate = false } = options;
	const traces = history ? new TraceSink() : null;

	const ctx: SimContext = {
		config: world.config,
		rng: new SeededRandom(world.seed).fork(`year:${world.year}`),
		year: world.year,
		history,
		traces
	};

	// BLUEPRINT.md §24 phase order. Systems 1–13 are no-ops until their milestone.
	updateEnvironment(world, ctx); // 1
	updatePopulation(world, ctx); // 2
	updateProduction(world, ctx); // 3
	updateGovernmentRevenue(world, ctx); // 4
	updateGovernmentSpending(world, ctx); // 5
	updateDebt(world, ctx); // 5 (debt interest / war deficits)
	updateMilitary(world, ctx); // 5 (military capital & power)
	updateTechnology(world, ctx); // 6
	updatePolitics(world, ctx); // 7
	updateTrade(world, ctx); // 8
	updateDiplomacy(world, ctx); // 9
	updateAlliances(world, ctx); // 9 (alliances)
	makeStrategicDecisions(world, ctx); // 10
	resolveWarfare(world, ctx); // 11
	applyTerritorialChanges(world, ctx); // 12
	generateEvents(world, ctx); // 13

	world.year += 1;

	if (history) {
		recordStatistics(world, history, traces); // 14
		maybeSnapshot(world, history); // 15
	}
	if (validate) assertFiniteWorld(world);

	return world;
}

/** Advance `world` by `years` years, in place, and return it. */
export function simulateYears(world: World, years: number, options: SimulateOptions = {}): World {
	for (let i = 0; i < years; i++) simulateYear(world, options);
	return world;
}

function recordStatistics(world: World, history: WorldHistory, traces: TraceSink | null): void {
	for (const s of world.states) {
		const row: StateYearStats = {
			year: world.year,
			stateId: s.id,
			alive: s.alive,
			population: s.population,
			gdp: s.gdp,
			gdpPerCapita: s.gdpPerCapita,
			technologyIndex: technologyIndex(s.technology),
			stability: s.politics.stability,
			legitimacy: s.politics.legitimacy,
			militaryPower: s.military.power,
			territory: s.territory,
			governmentType: s.politics.governmentType
		};
		const causes = traces?.forState(s.id);
		if (causes) row.causes = causes;
		(history.byState[s.id] ??= []).push(row);
	}
}

function maybeSnapshot(world: World, history: WorldHistory): void {
	const interval = world.config.history.snapshotInterval;
	if (interval > 0 && world.year % interval === 0) {
		history.snapshots.push({ year: world.year, world: structuredClone(world) });
	}
}

export interface Simulation {
	readonly world: World;
	readonly history: WorldHistory;
	/** Simulate one year. */
	step(): void;
	/** Simulate `years` years. */
	run(years: number): void;
}

/**
 * Wrap a freshly generated world with a history that captures the year-0
 * baseline. The engine mutates `world` in place, so callers that need
 * change notification (the Svelte UI) should track their own version counter.
 */
export function createSimulation(world: World): Simulation {
	const history = createHistory();
	recordStatistics(world, history, null);
	maybeSnapshot(world, history);

	return {
		world,
		history,
		step() {
			simulateYear(world, { history });
		},
		run(years: number) {
			simulateYears(world, years, { history });
		}
	};
}
