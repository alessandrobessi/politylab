import type { Vec2 } from './world';

/** BLUEPRINT.md §10. Terrain initially affects agricultural output, resource
 *  distribution, and military defense only. */
export type TerrainType = 'plains' | 'forest' | 'hills' | 'mountains' | 'desert' | 'coastal';

export interface RegionResources {
	iron: number;
	coal: number;
	oil: number;
	minerals: number;
	genericResources: number;
}

/** A single map cell. The map is a set of these (BLUEPRINT.md §10, §28). */
export interface Region {
	id: string;
	/** Owning state id, or `null` if unclaimed. */
	ownerId: string | null;
	/** Ids of adjacent regions (undirected graph). */
	neighbors: string[];

	area: number;
	population: number;

	/** Q in MODEL.md §9, normalized 0..1. */
	agriculturalPotential: number;
	resources: RegionResources;
	terrain: TerrainType;
	/** 0..1. Local transport/administrative development. */
	infrastructure: number;

	/** Voronoi site and cell polygon, for rendering and adjacency (BLUEPRINT.md §28). */
	site: Vec2;
	polygon: Vec2[];
}
