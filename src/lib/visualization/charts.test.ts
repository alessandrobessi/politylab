import { describe, it, expect } from 'vitest';
import { CHART_METRICS, buildSeries, type ChartState } from './charts';
import type { StateYearStats } from '$lib/simulation';

function row(year: number, over: Partial<StateYearStats> = {}): StateYearStats {
	return {
		year,
		stateId: 'x',
		alive: true,
		governmentType: 'republic',
		population: 1_000_000 + year * 1000,
		gdp: 5_000_000 + year * 2000,
		gdpPerCapita: 5000 + year,
		technologyIndex: 0.2,
		stability: 0.6,
		legitimacy: 0.6,
		militaryPower: 3000,
		territory: 10,
		...over
	} as StateYearStats;
}

const states: ChartState[] = [
	{ id: 'a', name: 'Aland', colorHue: 10, alive: true },
	{ id: 'b', name: 'Bland', colorHue: 200, alive: true },
	{ id: 'c', name: 'Cland', colorHue: 120, alive: false }
];

describe('buildSeries (M24)', () => {
	const rows: Record<string, StateYearStats[]> = {
		a: [row(0), row(1), row(2)],
		b: [row(0), row(1)],
		c: []
	};
	const rowsFor = (id: string) => rows[id] ?? [];

	it('emits one series per picked state, in state order', () => {
		const series = buildSeries(states, new Set(['b', 'a']), rowsFor, CHART_METRICS[0]!);
		expect(series.map((s) => s.label)).toEqual(['Aland', 'Bland']);
	});

	it('projects [year, value] points with the metric accessor', () => {
		const gdpPerCapita = CHART_METRICS.find((m) => m.id === 'gdpPerCapita')!;
		const [a] = buildSeries(states, new Set(['a']), rowsFor, gdpPerCapita);
		expect(a!.points).toEqual([
			[0, 5000],
			[1, 5001],
			[2, 5002]
		]);
	});

	it('scales population to millions', () => {
		const pop = CHART_METRICS.find((m) => m.id === 'population')!;
		const [a] = buildSeries(states, new Set(['a']), rowsFor, pop);
		expect(a!.points[0]).toEqual([0, 1]);
		expect(a!.points[1]![1]).toBeCloseTo(1.001);
	});

	it('drops unpicked states and tolerates empty history', () => {
		const series = buildSeries(states, new Set(['c']), rowsFor, CHART_METRICS[0]!);
		expect(series).toHaveLength(1);
		expect(series[0]!.points).toEqual([]);
	});

	it('gives every metric a distinct id and a working accessor', () => {
		const ids = new Set(CHART_METRICS.map((m) => m.id));
		expect(ids.size).toBe(CHART_METRICS.length);
		for (const m of CHART_METRICS) {
			expect(Number.isFinite(m.pick(row(1)))).toBe(true);
		}
	});
});
