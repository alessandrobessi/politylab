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

	const livingCount = $derived(sim.world?.states.filter((s) => s.alive).length ?? 0);
	const activeWarCount = $derived(sim.world?.wars.filter((w) => w.active).length ?? 0);
	const replaying = $derived(sim.viewYear !== null);
</script>

<div class="console">
	<header class="topbar">
		<div class="brand">
			<svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
				<path d="M16 16 L16 6 A10 10 0 0 1 24.66 21 Z" fill="#0ea5e9" />
				<path d="M16 16 L24.66 21 A10 10 0 0 1 7.34 21 Z" fill="#1c7fb0" />
				<path d="M16 16 L7.34 21 A10 10 0 0 1 16 6 Z" fill="#38bdf8" />
				<circle cx="16" cy="16" r="2.6" fill="#f5a524" />
			</svg>
			<div class="wordmark">
				<strong>POLITYLAB</strong>
				<span class="eyebrow">Emergent States</span>
			</div>
		</div>

		<div class="clock">
			<span class="eyebrow">{replaying ? 'Reviewing' : 'Year'}</span>
			<span class="year num" class:replay={replaying}>{sim.year}</span>
			{#if replaying}
				<button class="btn replay-exit" onclick={() => sim.resumeLive()}>Return to present ↩</button
				>
			{/if}
		</div>

		<div class="transport" role="group" aria-label="Simulation speed">
			<button
				class="btn"
				class:is-active={!sim.running && !replaying}
				onclick={() => sim.pause()}
				disabled={replaying}
				aria-label="Pause">❚❚</button
			>
			{#each SPEEDS as s (s)}
				<button
					class="btn"
					class:is-active={sim.speed === s}
					onclick={() => sim.setSpeed(s)}
					disabled={replaying}>{s}×</button
				>
			{/each}
			<button class="btn" onclick={() => sim.step()} disabled={sim.running || replaying}
				>Step ▸</button
			>
		</div>

		<form
			class="seedform"
			onsubmit={(e) => {
				e.preventDefault();
				sim.regenerate(seedInput);
			}}
		>
			<span class="eyebrow">Seed</span>
			<input type="number" bind:value={seedInput} aria-label="World seed" />
			<button class="btn" type="submit">Generate ↻</button>
		</form>
	</header>

	{#if sim.world}
		<main class="stage">
			<div class="mapframe">
				<div class="modes" role="group" aria-label="Map mode">
					{#each MAP_MODES as m (m.id)}
						<button class="btn" class:is-active={mode === m.id} onclick={() => (mode = m.id)}
							>{m.label}</button
						>
					{/each}
				</div>

				<div class="hud">
					<span><b class="num">{livingCount}</b> states</span>
					<span class:war={activeWarCount > 0}
						><b class="num">{activeWarCount}</b> active {activeWarCount === 1
							? 'war'
							: 'wars'}</span
					>
					<span><b class="num">{sim.totalEvents}</b> events</span>
				</div>

				<WorldMap
					world={sim.world}
					{mode}
					selectedId={sim.selectedId}
					onselect={(id) => sim.select(id)}
				/>
			</div>

			<Timeline
				year={sim.viewYear ?? sim.liveYear}
				max={sim.liveYear}
				{replaying}
				onseek={(y) => sim.seek(y)}
				onresume={() => sim.resumeLive()}
			/>

			<div class="feedframe panel">
				<EventFeed
					events={sim.world.events}
					selectedId={sim.selectedId}
					{nameOf}
					onselect={(id) => sim.select(id)}
				/>
			</div>
		</main>

		<aside class="rail panel scroll">
			<div class="tabs" role="tablist">
				<button
					class="tab"
					class:is-active={tab === 'inspect'}
					role="tab"
					aria-selected={tab === 'inspect'}
					onclick={() => (tab = 'inspect')}>Inspect</button
				>
				<button
					class="tab"
					class:is-active={tab === 'charts'}
					role="tab"
					aria-selected={tab === 'charts'}
					onclick={() => (tab = 'charts')}>Charts</button
				>
			</div>

			<div class="rail-body">
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
						<p class="hint">Select a state — on the map or below — to inspect it.</p>
						<ul class="roster">
							{#each sim.world.states.filter((s) => s.alive) as s (s.id)}
								<li>
									<button onclick={() => sim.select(s.id)}>
										<span class="sw" style:background="hsl({s.colorHue} 60% 58%)"></span>
										<span class="rname">{s.name}</span>
										<span class="rterr num">{s.territory.toFixed(0)}</span>
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
			</div>

			<SavedWorlds
				seed={sim.seed}
				year={sim.liveYear}
				exportState={() => sim.exportState()}
				onload={(saved) => sim.loadState(saved)}
			/>
		</aside>
	{:else}
		<div class="booting">
			<svg class="mark spin" viewBox="0 0 32 32" aria-hidden="true">
				<path d="M16 16 L16 6 A10 10 0 0 1 24.66 21 Z" fill="#0ea5e9" />
				<path d="M16 16 L24.66 21 A10 10 0 0 1 7.34 21 Z" fill="#1c7fb0" />
				<path d="M16 16 L7.34 21 A10 10 0 0 1 16 6 Z" fill="#38bdf8" />
			</svg>
			<p class="eyebrow">Generating world…</p>
		</div>
	{/if}
</div>

<style>
	.console {
		height: 100vh;
		height: 100dvh;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 22rem;
		grid-template-rows: auto minmax(0, 1fr);
		grid-template-areas:
			'top top'
			'stage rail';
		gap: 0.75rem;
		padding: 0.75rem;
		background:
			radial-gradient(1200px 600px at 78% -8%, rgba(56, 189, 248, 0.06), transparent 60%), var(--bg);
	}

	/* ---- top bar ---- */
	.topbar {
		grid-area: top;
		display: flex;
		align-items: center;
		gap: 1.25rem;
		flex-wrap: wrap;
		padding: 0.55rem 0.85rem;
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow-panel);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.mark {
		width: 30px;
		height: 30px;
		border-radius: 7px;
		background: var(--bg-sunken);
		border: 1px solid var(--border-strong);
		padding: 3px;
		flex: none;
	}
	.wordmark {
		display: flex;
		flex-direction: column;
		line-height: 1.15;
	}
	.wordmark strong {
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 700;
		letter-spacing: 0.12em;
	}

	.clock {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding-left: 1.1rem;
		border-left: 1px solid var(--border);
	}
	.clock .eyebrow {
		align-self: center;
	}
	.year {
		font-size: 34px;
		font-weight: 700;
		letter-spacing: 0.01em;
		color: var(--text);
		line-height: 1;
		min-width: 2ch;
	}
	.year.replay {
		color: var(--warn);
		text-shadow: 0 0 22px var(--warn-glow);
	}
	.replay-exit {
		color: var(--warn);
		border-color: color-mix(in srgb, var(--warn) 45%, transparent);
	}
	.replay-exit:hover:not(:disabled) {
		color: var(--warn);
		border-color: var(--warn);
	}

	.transport {
		display: flex;
		gap: 0.3rem;
	}
	.transport .btn {
		min-width: 2.6rem;
		font-family: var(--font-mono);
	}

	.seedform {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-left: auto;
	}
	.seedform input {
		width: 6.5rem;
	}

	/* ---- stage (map + timeline + feed) ---- */
	.stage {
		grid-area: stage;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.mapframe {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		border-radius: var(--radius);
		overflow: hidden;
		border: 1px solid var(--border);
		box-shadow: var(--shadow-panel);
		background:
			radial-gradient(120% 90% at 50% 30%, transparent 55%, rgba(0, 0, 0, 0.45)),
			repeating-linear-gradient(0deg, transparent 0 89px, rgba(120, 170, 210, 0.05) 89px 90px),
			repeating-linear-gradient(90deg, transparent 0 89px, rgba(120, 170, 210, 0.05) 89px 90px),
			var(--ocean);
	}
	.modes {
		position: absolute;
		top: 0.6rem;
		left: 0.6rem;
		z-index: 3;
		display: flex;
		gap: 0.25rem;
		padding: 0.25rem;
		background: color-mix(in srgb, var(--panel) 82%, transparent);
		backdrop-filter: blur(8px);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.modes .btn {
		background: transparent;
		border-color: transparent;
		color: var(--text-faint);
	}
	.modes .btn:hover:not(:disabled) {
		background: var(--elev);
		color: var(--text);
	}
	.modes .btn.is-active {
		color: var(--accent-ink);
		background: var(--accent);
		box-shadow: 0 0 14px -3px var(--accent-glow);
	}
	.hud {
		position: absolute;
		top: 0.6rem;
		right: 0.6rem;
		z-index: 3;
		display: flex;
		gap: 0.9rem;
		padding: 0.4rem 0.7rem;
		font-size: 11px;
		color: var(--text-dim);
		background: color-mix(in srgb, var(--panel) 82%, transparent);
		backdrop-filter: blur(8px);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.hud b {
		color: var(--text);
		font-size: 12px;
	}
	.hud .war b,
	.hud .war {
		color: var(--danger);
	}

	.feedframe {
		height: 11rem;
		flex: none;
		overflow: hidden;
		display: flex;
	}

	/* ---- right rail ---- */
	.rail {
		grid-area: rail;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		padding: 0;
	}
	.tabs {
		display: flex;
		gap: 0.25rem;
		padding: 0.6rem 0.6rem 0;
		position: sticky;
		top: 0;
		background: var(--panel);
		z-index: 2;
	}
	.tab {
		appearance: none;
		flex: 1;
		padding: 0.5rem;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--text-faint);
		background: transparent;
		border: 0;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		transition:
			color 0.14s,
			border-color 0.14s;
	}
	.tab:hover {
		color: var(--text-dim);
	}
	.tab.is-active {
		color: var(--text);
		border-bottom-color: var(--accent);
	}
	.rail-body {
		flex: 1;
		padding: 0.9rem;
		border-top: 1px solid var(--border);
	}

	.hint {
		color: var(--text-faint);
		font-size: 12px;
		margin: 0 0 0.85rem;
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
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.4rem 0.55rem;
		font-size: 12px;
		color: var(--text-dim);
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition:
			background 0.14s,
			color 0.14s,
			border-color 0.14s;
	}
	.roster button:hover {
		background: var(--elev);
		color: var(--text);
		border-color: var(--border-strong);
	}
	.sw {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 3px;
		flex: none;
	}
	.rname {
		flex: 1;
		text-align: left;
	}
	.rterr {
		color: var(--text-faint);
		font-size: 11px;
	}

	/* ---- boot ---- */
	.booting {
		grid-column: 1 / -1;
		grid-row: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}
	.booting .mark {
		width: 46px;
		height: 46px;
	}
	.spin {
		animation: spin 1.6s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 900px) {
		.console {
			height: auto;
			min-height: 100vh;
			grid-template-columns: 1fr;
			grid-template-areas:
				'top'
				'stage'
				'rail';
			overflow: visible;
		}
		.mapframe {
			min-height: 60vh;
		}
		.rail {
			max-height: none;
		}
	}
</style>
