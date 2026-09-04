import { scaleSequential } from 'd3-scale';
import { interpolateViridis, interpolateYlOrRd, interpolateBlues } from 'd3-scale-chromatic';
import type { State, World } from '$lib/simulation';
import { technologyIndex } from '$lib/simulation';

export type MapMode = 'political' | 'gdp' | 'stability' | 'military' | 'technology';

/** Fill for regions with no owner (and any missing lookup) — a dark landmass. */
const UNOWNED = '#1b2430';

export const MAP_MODES: { id: MapMode; label: string }[] = [
	{ id: 'political', label: 'Political' },
	{ id: 'gdp', label: 'GDP / capita' },
	{ id: 'stability', label: 'Stability' },
	{ id: 'military', label: 'Military' },
	{ id: 'technology', label: 'Technology' }
];

interface ModeSpec {
	value: (s: State) => number;
	interpolate: (t: number) => string;
	/** Legend tick labels for t = 0, 0.5, 1. */
	format: (v: number) => string;
}

const SPECS: Record<Exclude<MapMode, 'political'>, ModeSpec> = {
	gdp: {
		value: (s) => s.gdpPerCapita,
		interpolate: interpolateViridis,
		format: (v) => v.toFixed(1)
	},
	stability: {
		value: (s) => s.politics.stability,
		interpolate: interpolateBlues,
		format: (v) => `${Math.round(v * 100)}%`
	},
	military: {
		value: (s) => s.military.power,
		interpolate: interpolateYlOrRd,
		format: (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e3).toFixed(0)}K`)
	},
	technology: {
		value: (s) => technologyIndex(s.technology),
		interpolate: interpolateViridis,
		format: (v) => v.toFixed(2)
	}
};

export interface RegionColouring {
	/** region id → fill colour. */
	fill: Map<string, string>;
	/** Legend entries (low→high), or `null` for the political mode. */
	legend: { label: string; colour: string }[] | null;
}

/** Colour every region for a given map mode. */
export function colourRegions(world: World, mode: MapMode): RegionColouring {
	const ownerHue = new Map(world.states.map((s) => [s.id, s.colorHue]));
	const fill = new Map<string, string>();

	if (mode === 'political') {
		for (const r of world.regions) {
			const hue = r.ownerId === null ? null : ownerHue.get(r.ownerId);
			fill.set(r.id, hue == null ? UNOWNED : `hsl(${hue.toFixed(0)} 58% 56%)`);
		}
		return { fill, legend: null };
	}

	const spec = SPECS[mode];
	const alive = world.states.filter((s) => s.alive);
	const values = alive.map(spec.value).filter(Number.isFinite);
	const lo = values.length ? Math.min(...values) : 0;
	const hi = values.length ? Math.max(...values) : 1;
	const scale = scaleSequential([lo, hi], spec.interpolate);
	const byState = new Map(alive.map((s) => [s.id, scale(spec.value(s))]));

	for (const r of world.regions) {
		fill.set(r.id, r.ownerId ? (byState.get(r.ownerId) ?? UNOWNED) : UNOWNED);
	}
	const legend = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
		label: spec.format(lo + t * (hi - lo)),
		colour: spec.interpolate(t)
	}));
	return { fill, legend };
}
