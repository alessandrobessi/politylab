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
	<select bind:value={metricId}>
		{#each METRICS as m (m.id)}
			<option value={m.id}>{m.label}</option>
		{/each}
	</select>

	<LineChart {series} yLabel={metric.label} />

	<div class="pick">
		{#each states as s (s.id)}
			<label class:on={picked.has(s.id)}>
				<input type="checkbox" checked={picked.has(s.id)} onchange={() => toggle(s.id)} />
				<span class="sw" style:background="hsl({s.colorHue} 55% 45%)"></span>
				{s.name}{s.alive ? '' : ' †'}
			</label>
		{/each}
	</div>
</div>

<style>
	.charts {
		font-size: 0.8rem;
	}
	select {
		margin-bottom: 0.5rem;
		font-size: 0.8rem;
	}
	.pick {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.6rem;
		margin-top: 0.5rem;
	}
	.pick label {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		opacity: 0.55;
		cursor: pointer;
	}
	.pick label.on {
		opacity: 1;
	}
	.sw {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 2px;
	}
</style>
