import { Delaunay } from 'd3-delaunay';
import { clamp01 } from '../simulation/math';
import type { SeededRandom } from '../simulation/rng';
import type { Region, TerrainType } from '../simulation/models/region';
import type { Vec2 } from '../simulation/models/world';
import { polygonArea, polygonCentroid, distance } from './geometry';

const TERRAINS: TerrainType[] = ['plains', 'forest', 'hills', 'mountains', 'desert', 'coastal'];
const TERRAIN_WEIGHTS: Record<TerrainType, number> = {
	plains: 0.34,
	forest: 0.18,
	hills: 0.16,
	mountains: 0.12,
	desert: 0.1,
	coastal: 0.1
};

/** Base agricultural potential before per-region noise (MODEL.md §75). */
const AGRI_BASE: Record<TerrainType, number> = {
	plains: 0.75,
	forest: 0.55,
	hills: 0.45,
	coastal: 0.6,
	desert: 0.15,
	mountains: 0.12
};

export interface RegionGenResult {
	regions: Region[];
	/** Index-aligned relative weights for distributing a state's population. */
	populationWeights: number[];
}

function lloydRelax(points: Vec2[], width: number, height: number, iterations: number): Vec2[] {
	let current = points;
	for (let iter = 0; iter < iterations; iter++) {
		const delaunay = Delaunay.from(current as [number, number][]);
		const voronoi = delaunay.voronoi([0, 0, width, height]);
		const relaxed: Vec2[] = [];
		for (let i = 0; i < current.length; i++) {
			const cell = voronoi.cellPolygon(i);
			relaxed.push(cell && cell.length >= 3 ? polygonCentroid(cell as Vec2[]) : current[i]!);
		}
		current = relaxed;
	}
	return current;
}

/** Voronoi cells + adjacency graph + terrain + resources + population weights. */
export function generateRegions(
	rng: SeededRandom,
	options: { regionCount: number; width: number; height: number; lloydIterations: number }
): RegionGenResult {
	const { regionCount, width, height, lloydIterations } = options;
	const geomRng = rng.fork('geometry');
	const terrainRng = rng.fork('terrain');
	const resourceRng = rng.fork('resources');

	// 1. Seed points, then relax for evenly sized cells.
	const points: Vec2[] = [];
	for (let i = 0; i < regionCount; i++) {
		points.push([geomRng.range(0, width), geomRng.range(0, height)]);
	}
	const sites = lloydRelax(points, width, height, lloydIterations);

	const delaunay = Delaunay.from(sites as [number, number][]);
	const voronoi = delaunay.voronoi([0, 0, width, height]);

	// 2. Polygons + raw areas.
	const polygons: Vec2[][] = [];
	const rawAreas: number[] = [];
	for (let i = 0; i < regionCount; i++) {
		const cell = voronoi.cellPolygon(i) as Vec2[] | null;
		const site = sites[i]!;
		let polygon: Vec2[];
		if (cell && cell.length >= 3) {
			// d3 returns a closed ring; drop the duplicated last point.
			polygon = cell.slice(0, -1).map((p) => [p[0], p[1]] as Vec2);
		} else {
			const s = Math.sqrt((width * height) / regionCount) / 2;
			polygon = [
				[site[0] - s, site[1] - s],
				[site[0] + s, site[1] - s],
				[site[0] + s, site[1] + s],
				[site[0] - s, site[1] + s]
			];
		}
		polygons.push(polygon);
		rawAreas.push(Math.max(polygonArea(polygon), 1e-6));
	}
	const meanArea = rawAreas.reduce((a, b) => a + b, 0) / regionCount;

	// 3. Adjacency from the Delaunay graph.
	const neighborIds: string[][] = [];
	for (let i = 0; i < regionCount; i++) {
		const ns: string[] = [];
		for (const j of delaunay.neighbors(i)) if (j >= 0 && j < regionCount) ns.push(`r${j}`);
		neighborIds.push(ns);
	}

	// 4. Coherent terrain: a handful of terrain "cores", nearest-core vote, then
	//    a coast override on the map boundary and a little per-region noise so
	//    geography is not destiny (MODEL.md §75).
	const coreCount = terrainRng.int(6, 10);
	const cores: { at: Vec2; terrain: TerrainType }[] = [];
	for (let i = 0; i < coreCount; i++) {
		cores.push({
			at: [terrainRng.range(0, width), terrainRng.range(0, height)],
			terrain: terrainRng.weighted(
				TERRAINS,
				TERRAINS.map((t) => TERRAIN_WEIGHTS[t])
			)
		});
	}
	const boundaryEps = Math.min(width, height) * 0.04;
	const terrains: TerrainType[] = [];
	for (let i = 0; i < regionCount; i++) {
		const site = sites[i]!;
		let best = cores[0]!;
		let bestD = Infinity;
		for (const core of cores) {
			const d = distance(site, core.at);
			if (d < bestD) {
				bestD = d;
				best = core;
			}
		}
		let terrain = best.terrain;
		const touchesBoundary = polygons[i]!.some(
			(p) =>
				p[0] <= boundaryEps ||
				p[0] >= width - boundaryEps ||
				p[1] <= boundaryEps ||
				p[1] >= height - boundaryEps
		);
		if (touchesBoundary && terrain !== 'mountains' && terrainRng.bool(0.55)) terrain = 'coastal';
		if (terrainRng.bool(0.12)) {
			terrain = terrainRng.weighted(
				TERRAINS,
				TERRAINS.map((t) => TERRAIN_WEIGHTS[t])
			);
		}
		terrains.push(terrain);
	}

	// 5. Assemble regions with agricultural potential, resources, infrastructure,
	//    and a population weight (fertile land → more people, MODEL.md §75).
	const regions: Region[] = [];
	const populationWeights: number[] = [];
	for (let i = 0; i < regionCount; i++) {
		const terrain = terrains[i]!;
		const mineralRich = terrain === 'mountains' || terrain === 'hills';

		const agriculturalPotential = clamp01(AGRI_BASE[terrain] + resourceRng.normal(0, 0.12));
		const resources = {
			iron: clamp01((mineralRich ? 0.35 : 0.1) + resourceRng.normal(0, 0.15)),
			coal: clamp01(
				(terrain === 'hills' || terrain === 'mountains' || terrain === 'forest' ? 0.3 : 0.1) +
					resourceRng.normal(0, 0.15)
			),
			oil: clamp01(
				(terrain === 'desert'
					? 0.4
					: terrain === 'coastal'
						? 0.2
						: terrain === 'plains'
							? 0.15
							: 0.05) + resourceRng.normal(0, 0.15)
			),
			minerals: clamp01(
				(terrain === 'mountains' ? 0.55 : terrain === 'hills' ? 0.4 : 0.12) +
					resourceRng.normal(0, 0.15)
			),
			genericResources: clamp01(0.25 + resourceRng.normal(0, 0.12))
		};
		const infrastructure = clamp01(
			0.12 + (terrain === 'coastal' || terrain === 'plains' ? 0.06 : 0) + resourceRng.range(0, 0.1)
		);

		regions.push({
			id: `r${i}`,
			ownerId: null,
			neighbors: neighborIds[i]!,
			area: rawAreas[i]! / meanArea,
			population: 0, // set once territory is assigned
			agriculturalPotential,
			resources,
			terrain,
			infrastructure,
			site: sites[i]!,
			polygon: polygons[i]!
		});
		populationWeights.push(0.3 + agriculturalPotential + resourceRng.range(0, 0.5));
	}

	return { regions, populationWeights };
}
