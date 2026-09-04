<script lang="ts">
	import { sparklinePoints } from './sparkline';

	let {
		values,
		width = 120,
		height = 28,
		colour = '#2b6cb0'
	}: { values: number[]; width?: number; height?: number; colour?: string } = $props();

	const points = $derived(sparklinePoints(values, width, height));
	const last = $derived(values.at(-1));
	const first = $derived(values.find((v) => Number.isFinite(v)));
	const trend = $derived(
		last != null && first != null && last !== first ? (last > first ? 'up' : 'down') : 'flat'
	);
</script>

<svg {width} {height} class="spark" viewBox="0 0 {width} {height}" preserveAspectRatio="none">
	{#if points}
		<polyline {points} fill="none" stroke={colour} stroke-width="1.5" />
	{/if}
</svg>
<span class="trend {trend}" aria-hidden="true">
	{trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'}
</span>

<style>
	.spark {
		vertical-align: middle;
	}
	.trend {
		font-size: 0.65rem;
		margin-left: 0.25rem;
	}
	.trend.up {
		color: #2f855a;
	}
	.trend.down {
		color: #c53030;
	}
	.trend.flat {
		color: #999;
	}
</style>
