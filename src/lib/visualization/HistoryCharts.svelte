<script lang="ts">
	import type { State, StateYearStats } from '$lib/simulation';
	import LineChart from './LineChart.svelte';
	import { CHART_METRICS, buildSeries } from './charts';

	let {
		states,
		statsFor,
		initialSelected = null
	}: {
		states: State[];
		statsFor: (id: string) => StateYearStats[];
		initialSelected?: string | null;
	} = $props();

	const METRICS = CHART_METRICS;

	let metricId = $state<string>('gdpPerCapita');

	function initialPick(): Set<string> {
		return new Set(initialSelected ? [initialSelected] : states.slice(0, 3).map((s) => s.id));
	}
	let picked = $state<Set<string>>(initialPick());

	const metric = $derived(METRICS.find((m) => m.id === metricId) ?? METRICS[0]!);
	const series = $derived(buildSeries(states, picked, statsFor, metric));

	function toggle(id: string) {
		const next = new Set(picked);
		next.has(id) ? next.delete(id) : next.add(id);
		picked = next;
	}
</script>

<div class="charts">
	<div class="metric-row">
		{#each METRICS as m (m.id)}
			<button class="chip" class:on={metricId === m.id} onclick={() => (metricId = m.id)}
				>{m.label}</button
			>
		{/each}
	</div>

	<LineChart {series} />

	<div class="pick">
		{#each states as s (s.id)}
			<button class="legend-item" class:on={picked.has(s.id)} onclick={() => toggle(s.id)}>
				<span class="sw" style:background="hsl({s.colorHue} 60% 55%)"></span>
				{s.name}{s.alive ? '' : ' †'}
			</button>
		{/each}
	</div>
</div>

<style>
	.charts {
		font-size: 12px;
	}
	.metric-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-bottom: 0.6rem;
	}
	.chip {
		appearance: none;
		font-size: 10px;
		letter-spacing: 0.04em;
		padding: 0.25rem 0.5rem;
		color: var(--text-faint);
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-radius: 999px;
		cursor: pointer;
		transition:
			color 0.12s,
			background 0.12s,
			border-color 0.12s;
	}
	.chip:hover {
		color: var(--text-dim);
	}
	.chip.on {
		color: var(--accent-ink);
		background: var(--accent);
		border-color: var(--accent);
	}

	.pick {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-top: 0.6rem;
	}
	.legend-item {
		appearance: none;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 11px;
		padding: 0.2rem 0.45rem;
		color: var(--text-faint);
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		opacity: 0.55;
		transition:
			opacity 0.12s,
			color 0.12s,
			border-color 0.12s;
	}
	.legend-item.on {
		opacity: 1;
		color: var(--text);
		border-color: var(--border-strong);
	}
	.sw {
		width: 0.65rem;
		height: 0.65rem;
		border-radius: 3px;
		flex: none;
	}
</style>
