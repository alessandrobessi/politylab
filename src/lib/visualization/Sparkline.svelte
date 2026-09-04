<script lang="ts">
	import { sparklinePoints } from './sparkline';

	let {
		values,
		width = 96,
		height = 22,
		colour = 'var(--accent)'
	}: { values: number[]; width?: number; height?: number; colour?: string } = $props();

	const points = $derived(sparklinePoints(values, width, height));
	const last = $derived(values.at(-1));
	const first = $derived(values.find((v) => Number.isFinite(v)));
	const trend = $derived(
		last != null && first != null && last !== first ? (last > first ? 'up' : 'down') : 'flat'
	);
</script>

<span class="spark-wrap">
	<svg {width} {height} class="spark" viewBox="0 0 {width} {height}" preserveAspectRatio="none">
		{#if points}
			<polyline
				{points}
				fill="none"
				stroke={colour}
				stroke-width="1.5"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
		{/if}
	</svg>
	<span class="trend {trend}" aria-hidden="true">
		{trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'}
	</span>
</span>

<style>
	.spark-wrap {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
	}
	.spark {
		flex: 1;
		min-width: 0;
		width: 100%;
		height: 22px;
		vertical-align: middle;
		opacity: 0.9;
	}
	.trend {
		font-size: 0.55rem;
	}
	.trend.up {
		color: var(--good);
	}
	.trend.down {
		color: var(--danger);
	}
	.trend.flat {
		color: var(--text-faint);
	}
</style>
