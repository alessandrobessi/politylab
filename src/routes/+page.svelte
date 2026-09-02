<script lang="ts">
	import { onDestroy } from 'svelte';
	import { SimulationController } from '$lib/stores/simulation.svelte';

	const sim = new SimulationController();
	onDestroy(() => sim.dispose());

	let seedInput = $state(sim.seed);

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

	<p class="note">
		Milestone 5 — the clock runs and history is recorded, but every simulation system is still a
		no-op, so only the year advances.
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
	.note {
		color: #666;
		font-size: 0.85rem;
		margin-top: 1rem;
	}
</style>
