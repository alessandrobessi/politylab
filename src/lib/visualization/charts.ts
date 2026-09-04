import type { StateYearStats } from '$lib/simulation';
import type { Series } from './LineChart.svelte';

/** One selectable time-series metric drawn from the recorded {@link StateYearStats}. */
export interface ChartMetric {
	id: string;
	label: string;
	pick: (row: StateYearStats) => number;
}

export const CHART_METRICS: ChartMetric[] = [
	{ id: 'population', label: 'Population (M)', pick: (s) => s.population / 1e6 },
	{ id: 'gdp', label: 'GDP', pick: (s) => s.gdp / 1e6 },
	{ id: 'gdpPerCapita', label: 'GDP / capita', pick: (s) => s.gdpPerCapita },
	{ id: 'technologyIndex', label: 'Technology', pick: (s) => s.technologyIndex },
	{ id: 'stability', label: 'Stability', pick: (s) => s.stability },
	{ id: 'militaryPower', label: 'Military (k)', pick: (s) => s.militaryPower / 1e3 },
	{ id: 'territory', label: 'Territory', pick: (s) => s.territory }
];

export interface ChartState {
	id: string;
	name: string;
	colorHue: number;
	alive: boolean;
}

/**
 * Turn the picked states' recorded history into {@link Series} for {@link LineChart}.
 * Pure so M24's derivation can be tested without mounting a component.
 */
export function buildSeries(
	states: ChartState[],
	picked: ReadonlySet<string>,
	rowsFor: (id: string) => StateYearStats[],
	metric: ChartMetric
): Series[] {
	return states
		.filter((s) => picked.has(s.id))
		.map((s) => ({
			label: s.name,
			colour: `hsl(${s.colorHue} 55% 45%)`,
			points: rowsFor(s.id).map((row) => [row.year, metric.pick(row)] as [number, number])
		}));
}
