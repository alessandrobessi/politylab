<script lang="ts">
	import { scaleLinear } from 'd3-scale';

	export interface Series {
		label: string;
		colour: string;
		points: [number, number][];
	}

	let {
		series,
		width = 360,
		height = 190
	}: { series: Series[]; width?: number; height?: number } = $props();

	const M = { top: 12, right: 10, bottom: 20, left: 44 };

	const allPoints = $derived(series.flatMap((s) => s.points));

	/** [min, max] of a coordinate across all points, with a sane fallback. */
	function extent(
		sel: (p: [number, number]) => number,
		fallback: [number, number]
	): [number, number] {
		if (allPoints.length === 0) return fallback;
		let lo = Infinity;
		let hi = -Infinity;
		for (const p of allPoints) {
			const v = sel(p);
			if (!Number.isFinite(v)) continue;
			if (v < lo) lo = v;
			if (v > hi) hi = v;
		}
		if (lo === Infinity) return fallback;
		if (lo === hi) return [lo - 1, hi + 1];
		return [lo, hi];
	}

	const x = $derived(
		scaleLinear()
			.domain(extent((p) => p[0], [0, 1]))
			.range([M.left, width - M.right])
	);
	const y = $derived(
		scaleLinear()
			.domain(extent((p) => p[1], [0, 1]))
			.nice()
			.range([height - M.bottom, M.top])
	);

	const path = (points: [number, number][]) =>
		points.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ');

	const xTicks = $derived(x.ticks(5));
	const yTicks = $derived(y.ticks(4));
</script>

<svg viewBox="0 0 {width} {height}" class="chart">
	{#each yTicks as t (t)}
		<line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} class="grid" />
		<text x={M.left - 6} y={y(t)} class="tick y">{t}</text>
	{/each}
	{#each xTicks as t (t)}
		<text x={x(t)} y={height - 5} class="tick x">{t}</text>
	{/each}
	{#each series as s (s.label)}
		{#if s.points.length}
			<path d={path(s.points)} fill="none" stroke={s.colour} stroke-width="1.75" />
		{/if}
	{/each}
</svg>

<style>
	.chart {
		display: block;
		width: 100%;
		height: auto;
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.grid {
		stroke: var(--border);
	}
	.tick {
		font-family: var(--font-mono);
		font-size: 9px;
		fill: var(--text-faint);
	}
	.tick.y {
		text-anchor: end;
		dominant-baseline: middle;
	}
	.tick.x {
		text-anchor: middle;
	}
</style>
