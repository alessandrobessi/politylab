<script lang="ts">
	import type { State, StateYearStats } from '$lib/simulation';
	import LineChart from './LineChart.svelte';
	import { CHART_METRICS, buildSeries } from './charts';

	let {
		states,
		fetchHistory,
		year,
		initialSelected = null
	}: {
		states: State[];
		/** One-shot fetch of the complete per-state time series from the worker. */
		fetchHistory: () => Promise<Record<string, StateYearStats[]>>;
		/** Live year — drives a throttled refresh while the simulation advances. */
		year: number;
		initialSelected?: string | null;
	} = $props();

	const METRICS = CHART_METRICS;
	let metricId = $state<string>('gdpPerCapita');

	function initialPick(): Set<string> {
		return new Set(initialSelected ? [initialSelected] : states.slice(0, 3).map((s) => s.id));
	}
	let picked = $state<Set<string>>(initialPick());

	let history = $state<Record<string, StateYearStats[]>>({});
	let lastRefresh = 0;
	let inflight = false;

	async function refresh() {
		if (inflight) return;
		inflight = true;
		lastRefresh = Date.now();
		try {
			history = await fetchHistory();
		} finally {
			inflight = false;
		}
	}

	// Refresh on mount and, while the clock runs, at most ~once a second.
	$effect(() => {
		year;
		if (Date.now() - lastRefresh > 1100) refresh();
	});

	const loaded = $derived(Object.keys(history).length > 0);
	const metric = $derived(METRICS.find((m) => m.id === metricId) ?? METRICS[0]!);
	const series = $derived(buildSeries(states, picked, (id) => history[id] ?? [], metric));

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

	<div class="plot">
		<LineChart {series} />
		{#if !loaded}<div class="veil">Loading history…</div>{/if}
	</div>

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

	.plot {
		position: relative;
	}
	.veil {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-faint);
		background: color-mix(in srgb, var(--panel-2) 70%, transparent);
		border-radius: var(--radius-sm);
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
