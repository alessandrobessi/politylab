<script lang="ts">
	import { onDestroy } from 'svelte';
	import { SimulationController } from '$lib/stores/simulation.svelte';

	const sim = new SimulationController();
	onDestroy(() => sim.dispose());

	let seedInput = $state(sim.seed);
	let minImportance = $state(0.3);

	const recentEvents = $derived(
		sim.world.events
			.filter((e) => e.importance >= minImportance)
			.slice(-40)
			.reverse()
	);
	const eventDot = (imp: number) =>
		imp >= 0.9 ? '#c0392b' : imp >= 0.7 ? '#e67e22' : imp >= 0.5 ? '#f1c40f' : '#95a5a6';

	const millions = (n: number) => (n / 1_000_000).toFixed(2) + 'M';
	const techAvg = (t: Record<string, number>) => {
		const vs = Object.values(t);
		return (vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(2);
	};
	const fill = (hue: number) => `hsl(${hue.toFixed(0)} 55% 55%)`;
	const pointsOf = (polygon: readonly (readonly [number, number])[]) =>
		polygon.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
	const ownerHue = (ownerId: string | null) =>
		sim.world.states.find((s) => s.id === ownerId)?.colorHue ?? 0;
</script>

<main>
	<header>
		<div class="year">YEAR {sim.year}</div>
		<div class="speeds">
			<button class:active={!sim.running} onclick={() => sim.pause()}>Pause</button>
			<button class:active={sim.speed === 1} onclick={() => sim.setSpeed(1)}>1×</button>
			<button class:active={sim.speed === 5} onclick={() => sim.setSpeed(5)}>5×</button>
			<button onclick={() => sim.step()} disabled={sim.running}>Step</button>
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

	<svg viewBox="0 0 {sim.world.width} {sim.world.height}" role="img" aria-label="World map">
		{#each sim.world.regions as region (region.id)}
			<polygon
				points={pointsOf(region.polygon)}
				fill={fill(ownerHue(region.ownerId))}
				stroke="rgba(0,0,0,0.25)"
				stroke-width="0.75"
			/>
		{/each}
		{#each sim.world.states as state (state.id)}
			{@const r = sim.world.regions.find((rr) => rr.ownerId === state.id)}
			{#if r}
				<text
					x={r.site[0]}
					y={r.site[1]}
					text-anchor="middle"
					font-size="14"
					fill="rgba(0,0,0,0.75)">{state.name}</text
				>
			{/if}
		{/each}
	</svg>

	<table>
		<thead>
			<tr>
				<th>State</th>
				<th>Gov</th>
				<th>Regions</th>
				<th>Population</th>
				<th>GDP p.c.</th>
				<th>Tech</th>
				<th>Stability</th>
				<th>Food ratio</th>
			</tr>
		</thead>
		<tbody>
			{#each sim.world.states as state (state.id)}
				<tr>
					<td><span class="swatch" style:background={fill(state.colorHue)}></span>{state.name}</td>
					<td>{state.politics.governmentType}</td>
					<td>{sim.world.regions.filter((r) => r.ownerId === state.id).length}</td>
					<td>{millions(state.population)}</td>
					<td>{state.gdpPerCapita.toFixed(2)}</td>
					<td>{techAvg(state.technology)}</td>
					<td>{(state.politics.stability * 100).toFixed(0)}%</td>
					<td>{state.foodRatio.toFixed(2)}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<section class="events">
		<header class="events-head">
			<h2>Historical events</h2>
			<label
				>min importance {minImportance.toFixed(1)}
				<input type="range" min="0" max="1" step="0.1" bind:value={minImportance} />
			</label>
		</header>
		<ul>
			{#each recentEvents as e (e.id)}
				<li>
					<span class="year">{e.year}</span>
					<span class="dot" style:background={eventDot(e.importance)}></span>
					<span class="title">{e.title}</span>
					{#if e.causes.length}
						<span class="causes"
							>{e.causes
								.slice(0, 3)
								.map((c) => c.factor)
								.join(' · ')}</span
						>
					{/if}
				</li>
			{:else}
				<li class="empty">No events at this importance yet — let the clock run.</li>
			{/each}
		</ul>
	</section>

	<p class="note">
		Milestone 18 — nine simulation systems plus a derived event feed; every event above emerges from
		this year's change in world state, not a script. Prior note: no-op, so only the year advances.
	</p>
</main>

<style>
	main {
		max-width: 1040px;
		margin: 0 auto;
		padding: 1.5rem;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
	}
	header {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		flex-wrap: wrap;
		padding-bottom: 1rem;
		border-bottom: 1px solid #ddd;
		margin-bottom: 1rem;
	}
	.year {
		font-size: 1.4rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.speeds {
		display: flex;
		gap: 0.35rem;
	}
	button {
		padding: 0.3rem 0.7rem;
		border: 1px solid #bbb;
		background: #f6f6f6;
		border-radius: 4px;
		cursor: pointer;
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
		width: 9rem;
	}
	svg {
		width: 100%;
		height: auto;
		border: 1px solid #ddd;
		background: #eef2f5;
		display: block;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 1rem;
		font-size: 0.9rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.35rem 0.5rem;
		border-bottom: 1px solid #e3e3e3;
	}
	.swatch {
		display: inline-block;
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 2px;
		margin-right: 0.4rem;
		vertical-align: middle;
	}
	.events {
		margin-top: 1.5rem;
	}
	.events-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.events h2 {
		font-size: 1rem;
		margin: 0;
	}
	.events label {
		font-size: 0.8rem;
		color: #666;
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.events ul {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0;
		max-height: 16rem;
		overflow-y: auto;
		border: 1px solid #e3e3e3;
		border-radius: 4px;
	}
	.events li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.3rem 0.6rem;
		border-bottom: 1px solid #f0f0f0;
		font-size: 0.85rem;
	}
	.events .year {
		color: #888;
		font-variant-numeric: tabular-nums;
		min-width: 2.5rem;
	}
	.events .dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		flex: none;
		align-self: center;
	}
	.events .title {
		flex: 1;
	}
	.events .causes {
		color: #999;
		font-size: 0.75rem;
	}
	.events .empty {
		color: #999;
	}
	.note {
		color: #666;
		font-size: 0.85rem;
		margin-top: 1rem;
	}
</style>
