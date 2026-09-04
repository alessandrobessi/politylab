<script lang="ts">
	import { onDestroy } from 'svelte';
	import { SimulationController, SPEEDS } from '$lib/stores/simulation.svelte';
	import WorldMap from '$lib/visualization/WorldMap.svelte';
	import StateInspector from '$lib/visualization/StateInspector.svelte';
	import EventFeed from '$lib/visualization/EventFeed.svelte';
	import HistoryCharts from '$lib/visualization/HistoryCharts.svelte';
	import Timeline from '$lib/visualization/Timeline.svelte';
	import SavedWorlds from '$lib/visualization/SavedWorlds.svelte';
	import { MAP_MODES, type MapMode } from '$lib/visualization/mapModes';

	const sim = new SimulationController();
	onDestroy(() => sim.dispose());

	let seedInput = $state(sim.seed);
	let mode = $state<MapMode>('political');
	let tab = $state<'inspect' | 'charts'>('inspect');

	const nameOf = (id: string) => sim.world?.states.find((s) => s.id === id)?.name ?? id;
	const regionCount = (id: string) =>
		sim.world?.regions.filter((r) => r.ownerId === id).length ?? 0;
	const warsFor = (id: string) =>
		sim.world?.wars.filter((w) => w.attackerId === id || w.defenderId === id) ?? [];
</script>

<div class="app">
	<header class="topbar">
		<div class="year">
			YEAR {sim.year}{#if sim.viewYear !== null}<span class="replay"> · replay</span>{/if}
		</div>
		<div class="speeds">
			<button
				class:active={!sim.running && sim.viewYear === null}
				onclick={() => sim.pause()}
				disabled={sim.viewYear !== null}>Pause</button
			>
			{#each SPEEDS as s (s)}
				<button
					class:active={sim.speed === s}
					onclick={() => sim.setSpeed(s)}
					disabled={sim.viewYear !== null}>{s}×</button
				>
			{/each}
			<button onclick={() => sim.step()} disabled={sim.running || sim.viewYear !== null}
				>Step</button
			>
		</div>
		<form
			class="seed"
			onsubmit={(e) => {
				e.preventDefault();
				sim.regenerate(seedInput);
			}}
		>
			<label>Seed <input type="number" bind:value={seedInput} /></label>
			<button type="submit">Generate</button>
		</form>
	</header>

	{#if sim.world}
		<Timeline
			year={sim.viewYear ?? sim.liveYear}
			max={sim.liveYear}
			replaying={sim.viewYear !== null}
			onseek={(y) => sim.seek(y)}
			onresume={() => sim.resumeLive()}
		/>

		<div class="body">
			<section class="map-col">
				<div class="modes">
					{#each MAP_MODES as m (m.id)}
						<button class:active={mode === m.id} onclick={() => (mode = m.id)}>{m.label}</button>
					{/each}
				</div>
				<WorldMap
					world={sim.world}
					{mode}
					selectedId={sim.selectedId}
					onselect={(id) => sim.select(id)}
				/>
			</section>

			<aside class="side-col">
				<div class="tabs">
					<button class:active={tab === 'inspect'} onclick={() => (tab = 'inspect')}>Inspect</button
					>
					<button class:active={tab === 'charts'} onclick={() => (tab = 'charts')}>Charts</button>
				</div>

				{#if tab === 'inspect'}
					{#if sim.selected}
						<StateInspector
							country={sim.selected}
							stats={sim.statsFor(sim.selected.id)}
							wars={warsFor(sim.selected.id)}
							regionCount={regionCount(sim.selected.id)}
							{nameOf}
							causesFor={(metric) => sim.causesFor(sim.selected!.id, metric)}
						/>
					{:else}
						<p class="hint">Click a state on the map to inspect it.</p>
						<ul class="roster">
							{#each sim.world.states.filter((s) => s.alive) as s (s.id)}
								<li>
									<button onclick={() => sim.select(s.id)}>
										<span class="sw" style:background="hsl({s.colorHue} 55% 55%)"></span>{s.name}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				{:else}
					<HistoryCharts
						states={sim.world.states}
						statsFor={(id) => sim.statsFor(id)}
						initialSelected={sim.selectedId}
					/>
				{/if}

				<SavedWorlds
					seed={sim.seed}
					year={sim.liveYear}
					exportState={() => sim.exportState()}
					onload={(saved) => sim.loadState(saved)}
				/>
			</aside>
		</div>

		<footer class="feed-row">
			<EventFeed
				events={sim.world.events}
				selectedId={sim.selectedId}
				{nameOf}
				onselect={(id) => sim.select(id)}
			/>
		</footer>
	{:else}
		<p class="loading">Generating world…</p>
	{/if}
</div>

<style>
	.app {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem 1.25rem 2rem;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
		color: #1c2733;
	}
	.topbar {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		flex-wrap: wrap;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid #ddd;
		margin-bottom: 0.75rem;
	}
	.year {
		font-size: 1.35rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.replay {
		font-size: 0.8rem;
		font-weight: 500;
		color: #b7791f;
	}
	.speeds,
	.modes {
		display: flex;
		gap: 0.3rem;
	}
	button {
		padding: 0.28rem 0.65rem;
		border: 1px solid #bbb;
		background: #f6f6f6;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
	}
	button.active {
		background: #2b6cb0;
		border-color: #2b6cb0;
		color: #fff;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.seed {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}
	.seed input {
		width: 8rem;
	}
	.body {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(17rem, 1fr);
		gap: 1.25rem;
		align-items: start;
		margin-top: 0.75rem;
	}
	.modes {
		margin-bottom: 0.5rem;
		flex-wrap: wrap;
	}
	.side-col {
		border: 1px solid #e2e6ea;
		border-radius: 6px;
		padding: 0.9rem 1rem;
		background: #fcfcfd;
		min-height: 12rem;
	}
	.tabs {
		display: flex;
		gap: 0.3rem;
		margin-bottom: 0.75rem;
	}
	.hint {
		color: #888;
		margin: 0 0 0.75rem;
	}
	.roster {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.25rem;
	}
	.roster button {
		width: 100%;
		text-align: left;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid #e2e6ea;
		background: #fff;
	}
	.sw {
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 2px;
		display: inline-block;
	}
	.feed-row {
		margin-top: 1.25rem;
	}
	.loading {
		color: #888;
		padding: 3rem 0;
		text-align: center;
	}
	@media (max-width: 820px) {
		.body {
			grid-template-columns: 1fr;
		}
	}
</style>
