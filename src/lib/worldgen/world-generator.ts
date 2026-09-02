import { makeConfig, type DeepPartial, type SimulationConfig } from '../simulation/config';
import { assertFiniteWorld } from '../simulation/assert';
import { SeededRandom } from '../simulation/rng';
import type { World } from '../simulation/models/world';
import { createNameGenerator } from './names';
import { generateRegions } from './regions';
import { assignTerritory, buildStates } from './states';

export interface WorldGenOptions {
	regionCount?: number;
	stateCount?: number;
	width?: number;
	height?: number;
	lloydIterations?: number;
	config?: DeepPartial<SimulationConfig>;
}

const DEFAULTS = {
	regionCount: 160,
	stateCount: 8,
	width: 1000,
	height: 640,
	lloydIterations: 3
};

/**
 * Generate a fictional world from a seed (BLUEPRINT.md §4, §28, milestone 4).
 * Pure and deterministic: `generateWorld(s)` always deep-equals `generateWorld(s)`.
 * States begin with deliberately asymmetric conditions (MODEL.md §5, §76).
 */
export function generateWorld(seed: number, options: WorldGenOptions = {}): World {
	const opts = { ...DEFAULTS, ...options };
	const config = makeConfig(options.config);
	const rng = new SeededRandom(seed);

	const { regions, populationWeights } = generateRegions(rng.fork('regions'), {
		regionCount: opts.regionCount,
		width: opts.width,
		height: opts.height,
		lloydIterations: opts.lloydIterations
	});

	const territory = assignTerritory(rng.fork('territory'), regions, opts.stateCount);

	const nameGen = createNameGenerator(rng.fork('names'));
	const states = buildStates(
		rng.fork('states'),
		regions,
		populationWeights,
		territory,
		config,
		() => nameGen.next()
	);

	const world: World = {
		seed,
		year: 0,
		width: opts.width,
		height: opts.height,
		states,
		regions,
		wars: [],
		events: [],
		config,
		nextId: 0
	};

	assertFiniteWorld(world);
	return world;
}
