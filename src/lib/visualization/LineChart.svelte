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
		height = 180,
		yLabel = ''
	}: { series: Series[]; width?: number; height?: number; yLabel?: string } = $props();

	const M = { top: 8, right: 8, bottom: 20, left: 40 };

	const allPoints = $derived(series.flatMap((s) => s.points));
	const x = $derived(
		scaleLinear()
			.domain([
				Math.min(...allPoints.map((p) => p[0]), 0),
				Math.max(...allPoints.map((p) => p[0]), 1)
			])
			.range([M.left, width - M.right])
	);
	const y = $derived(
		scaleLinear()
			.domain([
				Math.min(...allPoints.map((p) => p[1]), 0),
				Math.max(...allPoints.map((p) => p[1]), 1)
			])
			.nice()
			.range([height - M.bottom, M.top])
	);

	const path = (points: [number, number][]) =>
		points.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ');

	const xTicks = $derived(x.ticks(5));
	const yTicks = $derived(y.ticks(4));
</script>

<svg {width} {height} viewBox="0 0 {width} {height}" class="chart">
	{#each yTicks as t (t)}
		<line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} class="grid" />
		<text x={M.left - 5} y={y(t)} class="tick y">{t}</text>
	{/each}
	{#each xTicks as t (t)}
		<text x={x(t)} y={height - 6} class="tick x">{t}</text>
	{/each}
	{#each series as s (s.label)}
		{#if s.points.length}
			<path d={path(s.points)} fill="none" stroke={s.colour} stroke-width="1.6" />
		{/if}
	{/each}
	{#if yLabel}
		<text x={4} y={12} class="axis-label">{yLabel}</text>
	{/if}
</svg>

<style>
	.chart {
		display: block;
		max-width: 100%;
	}
	.grid {
		stroke: #eef1f4;
	}
	.tick {
		font-size: 9px;
		fill: #999;
	}
	.tick.y {
		text-anchor: end;
		dominant-baseline: middle;
	}
	.tick.x {
		text-anchor: middle;
	}
	.axis-label {
		font-size: 9px;
		fill: #666;
	}
</style>
